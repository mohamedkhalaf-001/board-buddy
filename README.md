# Board Buddy

A **single-user Kanban board** that runs locally on your machine. Manage work
items as cards across configurable columns and swimlanes, with labels, due
dates, WIP limits, drag-and-drop, keyboard shortcuts, a full undo/redo
history, and an activity log.

- **Frontend** — React + TypeScript (TanStack Start / Vite), `@dnd-kit` drag & drop
- **Backend** — Python FastAPI (currently a mock in-memory DB; SQLite planned)
- **Run target** — localhost only, single board, no auth

> Spec & scope: [`_docs/specs.md`](_docs/specs.md) · API contract:
> [`_docs/openapi.yaml`](_docs/openapi.yaml)

---

## Features

- Configurable **columns**: add, rename, reorder, delete; per-column **WIP limits**
- **Cards**: create, edit, delete, move; optional description + due date (overdue highlight)
- **Swimlanes**: horizontal rows ("High / Normal urgency"…)
- **Labels**: colored tags you can assign to cards and filter by
- **Drag-and-drop** cards and columns
- **Search / filter**: text, label, swimlane, and empty states ("no due date", "overdue")
- **Undo / redo** — server-backed and survives a page refresh (`Ctrl+Z` / `Ctrl+Shift+Z`)
- **Activity log** of every board mutation
- **Keyboard shortcuts** and a **dark/light theme** toggle
- **Responsive layout** — no horizontal scrollbar at any screen size

---

## Project structure

```
├── _docs/            Spec + OpenAPI contract
│   ├── specs.md         Product spec, data model, acceptance criteria
│   └── openapi.yaml     API contract (source of truth for the backend)
├── frontend/         React + TypeScript app (TanStack Start / Vite)
│   └── src/
│       ├── lib/kanban/     API client, board state hook, types, (legacy) mock server
│       └── components/     UI: kanban board, cards, dialogs, panels
└── backend/          Python FastAPI service (uv project)
    ├── src/kanban_backend/
    │   ├── main.py            FastAPI app, routes, CORS
    │   ├── schemas.py         Pydantic models mirroring openapi.yaml
    │   ├── commands.py        Command validation + board mutation engine (18 types)
    │   ├── db.py              MockDatabase: command log, undo/redo, activity
    │   └── seed.py            Sample board matching the frontend mock
    └── tests/                Endpoint tests + OpenAPI contract test
```

---

## Quick start

### Prerequisites

| Tool    | Version                                    |
|---------|--------------------------------------------|
| Node.js | 20.19+ (required by Vite 8)                |
| Python  | 3.13+                                      |
| uv      | [docs.astral.sh/uv](https://docs.astral.sh/uv) |

### 1. Install dependencies

```sh
# Backend
cd backend
uv sync

# Frontend
cd ../frontend
npm install
```

### 2. Start the backend

```sh
# from backend/
uv run kanban-backend
```

Serves the API at `http://127.0.0.1:8000` — interactive docs (Swagger) at
`http://127.0.0.1:8000/docs`.

### 3. Start the frontend

```sh
# from frontend/
npm run dev
```

Open `http://localhost:8080`. The Vite dev server proxies every `/api` request
to the backend on `127.0.0.1:8000`, so the board reads and writes straight to
FastAPI.

---

## API

Base URL in dev: `http://localhost:8080/api` (proxied to `127.0.0.1:8000/api`).

| Method | Path                   | Description                                  |
|--------|------------------------|----------------------------------------------|
| GET    | `/api/board`           | Full board state (columns, swimlanes, labels, cards) |
| GET    | `/api/commands`        | Command history (markers for undo/redo availability) |
| POST   | `/api/commands`        | Apply a mutating command `{ type, payload }` |
| POST   | `/api/commands/undo`   | Undo the last applied command                |
| POST   | `/api/commands/redo`   | Redo the last undone command                 |
| GET    | `/api/activity`        | Activity log (`?limit=`, 1–200, default 50)  |
| POST   | `/api/reset`           | Reset the board to seed data                 |

**Command types (18):** `create_column`, `rename_column`, `delete_column`,
`reorder_column`, `set_wip_limit`, `create_swimlane`, `rename_swimlane`,
`delete_swimlane`, `reorder_swimlane`, `create_card`, `update_card`,
`delete_card`, `move_card`, `create_label`, `rename_label`, `delete_label`,
`assign_label`, `remove_label`.

**Errors:** `400` invalid command/payload · `409` nothing to undo/redo.

---

## Configuration

| Variable            | Default           | Purpose                                   |
|---------------------|-------------------|-------------------------------------------|
| `VITE_API_URL`      | `/api` (proxied)  | Override backend base URL, e.g. `http://127.0.0.1:8000/api` |

Only `VITE_`-prefixed variables are exposed to the frontend. When using an
absolute `VITE_API_URL`, CORS is open to any `localhost` / `127.0.0.1` origin.

---

## Tests & lint

```sh
# Backend (from backend/)
uv run pytest                 # 28 endpoint + contract tests
uv run ruff check .           # lint
uv run ruff format --check .  # formatting

# Frontend (from frontend/)
npm run lint                  # ESLint
```

---

## Build & deploy

```sh
# from frontend/
npm run build                 # production build into .output/
npx vite preview              # preview the build locally
```

> **Status:** The frontend can be built and previewed, but a single-command
> "serve the built frontend from the backend" mode is not implemented yet —
> it's on the roadmap (spec acceptance criterion). The backend currently uses
> an in-memory mock DB; SQLite persistence is the next milestone.

---

## Roadmap

- [x] Scaffold — repo layout, FastAPI stub + tests, Vite frontend, dev wiring
- [x] Backend implementation — command engine, undo/redo log, activity feed (mock DB)
- [x] Frontend wired to the live API (was mock-only)
- [ ] SQLite persistence (survives restart)
- [ ] Single-command production serve (backend serves built frontend)

---

## Built with Lovable

This project is connected to [Lovable](https://lovable.dev) — commits pushed to
the connected branch sync back into the Lovable editor. Keep the branch in a
working state and avoid rewriting pushed history (no force-push / rebase /
amend of published commits).