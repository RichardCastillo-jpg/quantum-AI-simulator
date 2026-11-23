import math
import unittest
import numpy as np

from schema import Circuit, Op, Block, expand, ARITY, ANGLES
from engine import simulate


def gate(name, *q, **opts):
    return Op(gate=name, q=list(q), **opts)


def run(ops, n=2, initial=None, mode="Statevector", noise="ninguno", library=None):
    c = Circuit(n=n, bits=2, initial=initial or "0"*n, shots=128, mode=mode, noise=noise, ops=ops)
    return simulate(c, expand(c.ops, n, c.bits, library or {}))


class Physics(unittest.TestCase):
    def test_every_gate_preserves_norm(self):
        for g, arity in ARITY.items():
            args = {"angle": .3} if g in ANGLES else {"bit": 0} if g in {"M","IFX","IFZ"} else {}
            r = run([gate(g, *range(arity), **args)], n=3, initial="111")
            self.assertAlmostEqual(sum(r["probabilities"]), 1.)

    def test_bell(self):
        r = run([gate("H",0),gate("CNOT",0,1)],mode="Shot")
        np.testing.assert_allclose(r["probabilities"], [.5,0,0,.5], atol=1e-12)
        np.testing.assert_allclose(r["bloch"], np.zeros((2,3)),atol=1e-12)
        self.assertEqual(sum(r["counts"].values()),128)
        self.assertLessEqual(set(r["counts"]),{"00","11"})

    def test_teleport_phase_and_population(self):
        for theta, phi in [(0,0), (math.pi,0), (.7,1.3)]:
            r = run([gate("RY",0,angle=theta),gate("P",0,angle=phi),gate("H",1),gate("CNOT",1,2),
                     gate("CNOT",0,1),gate("H",0),gate("M",0,bit=0),gate("M",1,bit=1),
                     gate("IFX",2,bit=1),gate("IFZ",2,bit=0)],n=3,mode="Shot")
            np.testing.assert_allclose(r["bloch"][2],[math.sin(theta)*math.cos(phi),
                math.sin(theta)*math.sin(phi),math.cos(theta)],atol=1e-12)
            self.assertEqual(sum(r["classical"].values()),128)
            if theta == 0:
                self.assertTrue(all(key[0]=="0" for key in r["counts"]))
            self.assertIsNone(r["amplitudes"])

    def test_deutsch(self):
        for constant in (True,False):
            for offset in (True,False):
                oracle = ([] if constant else [gate("CNOT",0,1)]) + ([gate("X",1)] if offset else [])
                ops = [gate("X",1),gate("H",0),gate("H",1),*oracle,gate("H",0),gate("M",0,bit=0)]
                r = run(ops,mode="Shot")
                self.assertEqual(r["classical"],{"00" if constant else "01":128})

    def test_noisy_measurement(self):
        for noise in ("depolarizing","thermal relaxation"):
            r=run([gate("X",0),gate("M",0,bit=1),gate("IFX",1,bit=1)],noise=noise,mode="Shot")
            self.assertGreater(r["probabilities"][3],.9)
            self.assertLess(r["probabilities"][3],1)
            self.assertIsNone(r["amplitudes"])

    def test_nested_mapping(self):
        lib={"flip":Block(name="Invierte",description="",n=1,ops=[gate("X",0)])}
        lib["outer"]=Block(name="Par",description="",n=2,ops=[gate("SUB",1,ref="flip")])
        r=run([Op(gate="FOR",repeat=3,body=[gate("SUB",1,0,ref="outer")])],library=lib)
        self.assertEqual(r["probabilities"],[0,1,0,0])
        with self.assertRaises(ValueError):
            expand([gate("CNOT",1,1)],2,2,{})


if __name__=="__main__":
    unittest.main()
