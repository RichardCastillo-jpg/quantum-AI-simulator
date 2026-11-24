import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from qiskit import QuantumCircuit
from qiskit.quantum_info import DensityMatrix, Statevector, partial_trace
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel, depolarizing_error, thermal_relaxation_error

DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
SUBCIRCUITS_FILE = DATA_DIR / "subcircuits.json"

app = FastAPI(title="QuLab Quantum Simulator API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:4321").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GateOp(BaseModel):
    type: str
    col: int = 0
    qubits: List[int]
    angle: Optional[float] = 0.0
    cbit: Optional[int] = None
    condBit: Optional[int] = None
    subId: Optional[str] = None


class ForLoop(BaseModel):
    startCol: int
    endCol: int
    iterations: int = Field(ge=1, le=32)


class SubcircuitModel(BaseModel):
    id: str
    name: str
    description: str = ""
    numQubits: int = Field(ge=1, le=6)
    gates: List[GateOp]


class SimulationRequest(BaseModel):
    numQubits: int = Field(ge=1, le=8)
    numCbits: int = Field(ge=1, le=8)
    initialState: str = "000"
    mode: str = "statevector"
    shots: int = Field(default=1024, ge=10, le=20000)
    noiseModel: str = "none"
    noiseParam: float = Field(default=0.05, ge=0.0, le=0.5)
    gates: List[GateOp] = []
    forLoops: List[ForLoop] = []


def load_subcircuits() -> List[Dict[str, Any]]:
    if not SUBCIRCUITS_FILE.exists():
        return []
    return json.loads(SUBCIRCUITS_FILE.read_text(encoding="utf-8"))


def save_subcircuits(items: List[Dict[str, Any]]) -> None:
    SUBCIRCUITS_FILE.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")


def build_noise_model(kind: str, param: float) -> Optional[NoiseModel]:
    if kind == "none" or param <= 0:
        return None
    nm = NoiseModel()
    if kind == "depolarizing":
        nm.add_all_qubit_quantum_error(depolarizing_error(param, 1), ["h", "x", "y", "z", "s", "sdg", "t", "tdg", "sx", "p", "rx", "ry", "rz"])
        nm.add_all_qubit_quantum_error(depolarizing_error(min(0.99, param * 1.5), 2), ["cx", "swap"])
    elif kind == "thermal":
        t1, t2, tg = 50e3, 30e3, max(100.0, param * 50e3)
        nm.add_all_qubit_quantum_error(thermal_relaxation_error(t1, t2, tg), ["h", "x", "y", "z", "s", "sdg", "t", "tdg", "sx", "p", "rx", "ry", "rz"])
    return nm


def apply_op(qc: QuantumCircuit, op: GateOp) -> None:
    t, qs, a = op.type, op.qubits, float(op.angle or 0.0)
    if t == "H": qc.h(qs[0])
    elif t == "X": qc.x(qs[0])
    elif t == "Y": qc.y(qs[0])
    elif t == "Z": qc.z(qs[0])
    elif t == "I": qc.id(qs[0])
    elif t == "S": qc.s(qs[0])
    elif t == "Sdg": qc.sdg(qs[0])
    elif t == "T": qc.t(qs[0])
    elif t == "Tdg": qc.tdg(qs[0])
    elif t == "SX": qc.sx(qs[0])
    elif t == "P": qc.p(a, qs[0])
    elif t == "RX": qc.rx(a, qs[0])
    elif t == "RY": qc.ry(a, qs[0])
    elif t == "RZ": qc.rz(a, qs[0])
    elif t == "CNOT": qc.cx(qs[0], qs[1])
    elif t == "SWAP": qc.swap(qs[0], qs[1])
    elif t == "CCNOT": qc.ccx(qs[0], qs[1], qs[2])
    elif t == "M": qc.measure(qs[0], op.cbit if op.cbit is not None else qs[0])


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/subcircuits")
def list_subcircuits():
    return load_subcircuits()


@app.post("/api/subcircuits")
def upsert_subcircuit(sub: SubcircuitModel):
    items = [s for s in load_subcircuits() if s["id"] != sub.id]
    items.append(sub.model_dump())
    save_subcircuits(items)
    return sub


@app.delete("/api/subcircuits/{sub_id}")
def delete_subcircuit(sub_id: str):
    items = load_subcircuits()
    filtered = [s for s in items if s["id"] != sub_id]
    if len(filtered) == len(items):
        raise HTTPException(status_code=404, detail="Subcircuito no encontrado")
    save_subcircuits(filtered)
    return {"deleted": sub_id}


@app.post("/api/simulate")
def simulate(req: SimulationRequest):
    qc = QuantumCircuit(req.numQubits, req.numCbits)
    init = req.initialState.ljust(req.numQubits, "0")[:req.numQubits]
    for q, bit in enumerate(init):
        if bit == "1":
            qc.x(q)

    # Expand columns and for-loops
    max_col = max([g.col for g in req.gates], default=-1) + 1
    by_col: Dict[int, List[GateOp]] = {c: [] for c in range(max_col)}
    for g in req.gates:
        by_col.setdefault(g.col, []).append(g)

    loops = sorted(req.forLoops, key=lambda l: l.startCol)
    c = 0
    while c < max_col:
        loop = next((l for l in loops if l.startCol == c), None)
        if loop:
            end = min(loop.endCol, max_col - 1)
            for _ in range(loop.iterations):
                for cc in range(c, end + 1):
                    for g in by_col.get(cc, []):
                        apply_op(qc, g)
            c = end + 1
        else:
            for g in by_col.get(c, []):
                apply_op(qc, g)
            c += 1

    nm = build_noise_model(req.noiseModel, req.noiseParam)
    if req.mode == "statevector" and nm is None:
        sim = AerSimulator(method="statevector")
        qc.save_statevector()
        res = sim.run(qc).result()
        sv = Statevector(res.get_statevector())
        probs = [float(p) for p in sv.probabilities()]
        bloch = []
        for q in range(req.numQubits):
            others = [i for i in range(req.numQubits) if i != q]
            rho_q = partial_trace(sv, others).data if others else DensityMatrix(sv).data
            bloch.append({
                "x": float(2 * np.real(rho_q[0, 1])),
                "y": float(-2 * np.imag(rho_q[0, 1])),
                "z": float(np.real(rho_q[0, 0] - rho_q[1, 1])),
            })
        return {"mode": "statevector", "probabilities": probs, "bloch": bloch}

    qc.measure_all()
    sim = AerSimulator(noise_model=nm) if nm else AerSimulator()
    counts = sim.run(qc, shots=req.shots).result().get_counts()
    return {"mode": "shot", "shots": req.shots, "counts": counts}
