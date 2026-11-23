import asyncio
import json
import multiprocessing as mp
import os
import time
from pathlib import Path
from threading import RLock
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from schema import Circuit, Block, expand

app = FastAPI(title="Orbital · API de simulación")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:4321,http://127.0.0.1:4321").split(","), allow_methods=["*"], allow_headers=["*"])
directory = Path(os.getenv("DATA_DIR", "data"))
lock = RLock()
slots = asyncio.Semaphore(2)


def read():
    path = directory / "blocks.json"
    raw = json.loads(path.read_text()) if path.exists() else {}
    return {key: Block.model_validate(value) for key, value in raw.items()}


def write(lib):
    directory.mkdir(parents=True, exist_ok=True)
    temp = directory / "blocks.tmp"
    temp.write_text(json.dumps({k: v.model_dump() for k, v in lib.items()}, ensure_ascii=False))
    temp.replace(directory / "blocks.json")


@app.get("/subcircuits")
def blocks():
    with lock:
        return read()


def save(key, block, new=False):
    with lock:
        lib = read()
        if not new and key not in lib:
            raise HTTPException(404, "Subcircuito inexistente.")
        lib[key] = block
        try:
            for item in lib.values():
                expand(item.ops, item.n, 8, lib)
        except ValueError as err:
            raise HTTPException(422, str(err))
        write(lib)
        return {"id": key}


@app.post("/subcircuits", status_code=201)
def create(block: Block):
    return save(str(uuid4()), block, True)


@app.put("/subcircuits/{key}")
def update(key: str, block: Block):
    return save(key, block)


@app.delete("/subcircuits/{key}", status_code=204)
def delete(key: str):
    with lock:
        lib = read()
        if key not in lib:
            raise HTTPException(404, "Subcircuito inexistente.")
        del lib[key]
        try:
            for block in lib.values():
                expand(block.ops, block.n, 8, lib)
        except ValueError:
            raise HTTPException(409, "Otro subcircuito utiliza este bloque.")
        write(lib)
    return Response(status_code=204)


def worker(pipe, circuit, flat):
    try:
        from engine import simulate
        pipe.send((True, simulate(circuit, flat)))
    except Exception as err:
        pipe.send((False, str(err)))
    finally:
        pipe.close()


@app.post("/simulate")
async def run(circuit: Circuit, request: Request):
    with lock:
        try:
            flat = expand(circuit.ops, circuit.n, circuit.bits, read())
        except ValueError as err:
            raise HTTPException(422, str(err))
    async with slots:
        if await request.is_disconnected():
            return Response(status_code=499)
        ctx = mp.get_context("spawn")
        receiver, sender = ctx.Pipe(duplex=False)
        proc = ctx.Process(target=worker, args=(sender, circuit, flat))
        proc.start()
        sender.close()
        deadline = time.monotonic() + 90
        try:
            while not receiver.poll():
                if await request.is_disconnected():
                    return Response(status_code=499)
                if time.monotonic() > deadline:
                    raise HTTPException(408, "Se superó el tiempo de simulación.")
                await asyncio.sleep(.04)
            try:
                ok, payload = receiver.recv()
            except EOFError:
                raise HTTPException(503, "El proceso de simulación se interrumpió.")
            if not ok:
                raise HTTPException(422, payload)
            return payload
        finally:
            if proc.is_alive():
                proc.terminate()
            proc.join()
            receiver.close()


@app.post("/validate")
def validate(circuit: Circuit):
    with lock:
        try:
            expand(circuit.ops, circuit.n, circuit.bits, read())
        except ValueError as err:
            raise HTTPException(422, str(err))
    return {"valid": True}
