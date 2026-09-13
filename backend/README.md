# Board Buddy Backend

FastAPI backend for the Board Buddy Kanban board. Swappable mock database for now; SQLite later.

See `../_docs/openapi.yaml` for the API contract and `../_docs/specs.md` for the product spec.

## Setup

Requires [uv](https://docs.astral.sh/uv/).

```sh
uv sync
```

## Run

```sh
uv run kanban-backend
```

Serves on `http://127.0.0.1:8000` with Swagger UI at `/docs`.

## Test / Lint

```sh
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

## Layout

- `src/kanban_backend/main.py` — FastAPI app + routes
- `src/kanban_backend/schemas.py` — Pydantic models mirroring openapi.yaml
- `src/kanban_backend/commands.py` — command payload validation + board mutation engine (18 command types)
- `src/kanban_backend/db.py` — `MockDatabase` with command log, server-backed undo/redo, activity feed
- `src/kanban_backend/seed.py` — seed board mirroring the frontend mock server
- `tests/` — endpoint tests + OpenAPI contract test