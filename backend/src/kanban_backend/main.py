"""Board Buddy API — FastAPI application (see _docs/openapi.yaml)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query, Request
from fastapi.responses import JSONResponse

from .commands import PayloadError
from .db import ConflictError, MockDatabase
from .schemas import (
    ActivityLogEntry,
    Board,
    Command,
    CommandRequest,
    CommandResult,
)

# ── lifespan ─────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _app.state.db = MockDatabase()
    _app.state.db.reset()
    yield


# ── app ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Board Buddy API",
    version="1.0.0",
    lifespan=lifespan,
)


# ── dependency ───────────────────────────────────────────────────────────────


def _get_db(request: Request) -> MockDatabase:  # type: ignore[return]
    db: MockDatabase = request.app.state.db
    return db


def _db_dep(request: Request) -> MockDatabase:
    return _get_db(request)


# ── error handlers ───────────────────────────────────────────────────────────


@app.exception_handler(PayloadError)
async def _payload_error_handler(request: Request, exc: PayloadError):  # type: ignore[override]
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def _conflict_error_handler(request: Request, exc: ConflictError):  # type: ignore[override]
    return JSONResponse(status_code=409, content={"detail": str(exc)})


# ── routes ───────────────────────────────────────────────────────────────────


@app.get("/api/board", response_model=Board)
def get_board(db: MockDatabase = Depends(_db_dep)) -> Board:
    return db.get_board()


@app.get("/api/commands", response_model=list[Command])
def get_commands(db: MockDatabase = Depends(_db_dep)) -> list[Command]:
    return db.get_commands()


@app.post("/api/commands", response_model=CommandResult)
def post_command(
    body: CommandRequest,
    db: MockDatabase = Depends(_db_dep),
) -> CommandResult:
    try:
        board, command_id = db.post_command(body.type, body.payload)
    except (PayloadError, ConflictError):
        raise
    except Exception as exc:
        raise PayloadError(str(exc)) from exc
    return CommandResult(board=board, commandId=command_id)


@app.post("/api/commands/undo", response_model=Board)
def undo(db: MockDatabase = Depends(_db_dep)) -> Board:
    return db.undo()


@app.post("/api/commands/redo", response_model=Board)
def redo(db: MockDatabase = Depends(_db_dep)) -> Board:
    return db.redo()


@app.get("/api/activity", response_model=list[ActivityLogEntry])
def get_activity(
    limit: int = Query(50, ge=1, le=200),
    db: MockDatabase = Depends(_db_dep),
) -> list[ActivityLogEntry]:
    return db.get_activity(limit)


@app.post("/api/reset", response_model=Board)
def reset(db: MockDatabase = Depends(_db_dep)) -> Board:
    return db.reset()
