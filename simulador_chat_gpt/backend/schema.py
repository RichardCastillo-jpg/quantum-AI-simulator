from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from math import isfinite

ARITY = dict.fromkeys("H X I T S Z TDG SDG P RZ SX Y RX RY M IFX IFZ".split(), 1)
ARITY.update(CNOT=2, SWAP=2, CCNOT=3)
ANGLES = {"P", "RZ", "RX", "RY"}
CLASSICAL = {"M", "IFX", "IFZ"}


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Op(Strict):
    gate: str
    q: list[int] = Field(default_factory=list, max_length=8)
    angle: float | None = None
    bit: int | None = None
    ref: str | None = None
    repeat: int = Field(default=1, ge=1, le=128)
    body: list["Op"] = Field(default_factory=list, max_length=512)


class Circuit(Strict):
    n: int = Field(ge=1, le=8)
    bits: int = Field(ge=0, le=8)
    initial: str
    mode: Literal["Statevector", "Shot"]
    shots: int = Field(ge=1, le=16384)
    noise: Literal["ninguno", "depolarizing", "thermal relaxation"]
    ops: list[Op] = Field(max_length=512)

    @model_validator(mode="after")
    def check_initial(self):
        if len(self.initial) != self.n or set(self.initial) - set("01"):
            raise ValueError("El estado inicial debe contener un bit por cúbit.")
        return self


class Block(Strict):
    name: str = Field(min_length=1, max_length=64)
    description: str = Field(max_length=500)
    n: int = Field(ge=1, le=8)
    ops: list[Op] = Field(min_length=1, max_length=512)


def expand(ops, n, bits, library):
    flat = []
    budget = 8192

    def visit(items, mapping, path, depth):
        nonlocal budget
        if depth > 12:
            raise ValueError("La anidación supera 12 niveles.")
        for op in items:
            budget -= 1
            if budget < 0 or len(flat) >= 2048:
                raise ValueError("El circuito expandido supera el límite de operaciones.")
            g = op.gate
            if g == "FOR":
                if not op.body or op.q:
                    raise ValueError("El ciclo requiere un cuerpo y usa los cables de su contexto.")
                for _ in range(op.repeat):
                    visit(op.body, mapping, path, depth + 1)
                continue
            if op.body or op.repeat != 1:
                raise ValueError("Solo FOR admite cuerpo y repeticiones.")
            if len(set(op.q)) != len(op.q) or any(i < 0 or i >= len(mapping) for i in op.q):
                raise ValueError("Los cúbits destino deben ser distintos y estar disponibles.")
            q = [mapping[i] for i in op.q]
            if g == "SUB":
                block = library.get(op.ref)
                if not block or op.ref in path or len(q) != block.n:
                    raise ValueError("Subcircuito inexistente, recursivo o incompatible.")
                visit(block.ops, q, path | {op.ref}, depth + 1)
                continue
            if ARITY.get(g) != len(q):
                raise ValueError(f"Compuerta o número de operandos inválido: {g}")
            if g in ANGLES and (op.angle is None or not isfinite(op.angle)):
                raise ValueError("Se requiere un ángulo finito en radianes.")
            if g in CLASSICAL and (op.bit is None or not 0 <= op.bit < bits):
                raise ValueError("Falta un registro clásico compatible.")
            flat.append((g, q, op.angle, op.bit))
    visit(ops, list(range(n)), set(), 0)
    if sum(g == "M" for g, *_ in flat) > 6:
        raise ValueError("Se admiten hasta seis mediciones intermedias por ejecución.")
    return flat
