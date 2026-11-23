"""Simulación exacta por ramas. Cada rama mantiene su memoria clásica."""
import numpy as np
from qiskit import QuantumCircuit, ClassicalRegister
from qiskit_aer import AerSimulator
from qiskit_aer.noise import depolarizing_error, thermal_relaxation_error


def append_gate(circuit, gate, wires, angle, noise):
    name = {"CNOT": "cx", "CCNOT": "ccx", "I": "id"}.get(gate, gate.lower())
    args = [angle, *wires] if gate in {"P", "RZ", "RY", "RX"} else wires
    getattr(circuit, name)(*args)
    if noise != "ninguno":
        channel = (depolarizing_error(.01, 1) if noise == "depolarizing"
                   else thermal_relaxation_error(50e-6, 70e-6, 200e-9))
        for wire in wires:
            circuit.append(channel.to_instruction(), [wire])


def evolve(state, ops, n, pure, noise):
    if not ops:
        return state
    circuit = QuantumCircuit(n)
    method = "statevector" if pure else "density_matrix"
    getattr(circuit, "set_" + method)(state)
    for gate, wires, angle, _ in ops:
        append_gate(circuit, gate, wires, angle, noise)
    getattr(circuit, "save_" + method)()
    result = AerSimulator(method=method, max_parallel_threads=1).run(circuit, shots=1).result()
    if not result.success:
        raise ValueError(result.status)
    return np.asarray(result.data(0)[method])


def summarize(rho, n, vector=None):
    p = np.maximum(0, rho.diagonal().real)
    p = p / p.sum()
    if vector is None:
        k = int(p.argmax())
        candidate = rho[:, k] / np.sqrt(p[k])
        if np.allclose(rho, np.outer(candidate, candidate.conj()), atol=1e-8):
            vector = candidate
    spheres = []
    indices = np.arange(len(p))
    for q in range(n):
        lo = indices[(indices & (1 << q)) == 0]
        hi = lo | (1 << q)
        off = rho[hi, lo].sum()
        spheres.append([2 * off.real, 2 * off.imag, p[lo].sum() - p[hi].sum()])
    return dict(probabilities=p.tolist(), bloch=spheres,
                amplitudes=None if vector is None else [[v.real, v.imag] for v in vector])


def simulate(c, ops):
    size = 1 << c.n
    initial = np.eye(1, size, int(c.initial, 2), dtype=complex).ravel()
    pure = c.noise == "ninguno" and all(g != "M" for g, *_ in ops)
    start = initial if pure else np.outer(initial, initial.conj())
    branches = [(1., 0, start)]
    pending = []

    def flush():
        nonlocal branches
        branches = [(w, mem, evolve(s, pending, c.n, pure, c.noise)) for w, mem, s in branches]
        pending.clear()

    for op in ops:
        gate, wires, _, bit = op
        if gate not in {"M", "IFX", "IFZ"}:
            pending.append(op)
            continue
        flush()
        if gate.startswith("IF"):
            branches = [(w, m, evolve(s, [(gate[2:], wires, None, None)], c.n, pure, c.noise)
                         if m & (1 << bit) else s) for w, m, s in branches]
            continue
        following = []
        for weight, memory, rho in branches:
            for outcome in (0, 1):
                mask = ((np.arange(size) >> wires[0]) & 1) == outcome
                likelihood = rho.diagonal().real[mask].sum()
                if likelihood > 1e-14:
                    projected = rho * mask[:, None] * mask[None, :] / likelihood
                    mem = (memory & ~(1 << bit)) | (outcome << bit)
                    following.append((weight * likelihood, mem, projected))
        branches = following
    flush()
    vector = branches[0][2] if pure else None
    rho = np.outer(vector, vector.conj()) if pure else sum(w*s for w, _, s in branches)
    result = summarize(rho, c.n, vector)
    result["counts"] = {}
    result["classical"] = {}
    if c.mode == "Shot":
        measured = QuantumCircuit(c.n)
        if c.bits:
            memory = ClassicalRegister(c.bits, "m")
            measured.add_register(memory)
        output = ClassicalRegister(c.n, "out")
        measured.add_register(output)
        if c.noise == "ninguno":
            measured.set_statevector(initial)
        else:
            measured.set_density_matrix(start)
        for gate, wires, angle, bit in ops:
            if gate == "M":
                measured.measure(wires[0], memory[bit])
            elif gate in {"IFX", "IFZ"}:
                with measured.if_test((memory[bit], True)):
                    append_gate(measured, gate[2:], wires, None, c.noise)
            else:
                append_gate(measured, gate, wires, angle, c.noise)
        measured.measure(range(c.n), output)
        method = "statevector" if c.noise == "ninguno" else "density_matrix"
        sampled = AerSimulator(method=method, max_parallel_threads=1).run(measured, shots=c.shots).result()
        if not sampled.success:
            raise ValueError(sampled.status)
        for key, count in sampled.get_counts().items():
            registers = key.split()
            out = registers[0]
            result["counts"][out] = result["counts"].get(out, 0) + count
            if c.bits:
                mem = registers[1]
                result["classical"][mem] = result["classical"].get(mem, 0) + count
    return result
