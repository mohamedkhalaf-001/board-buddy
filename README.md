# Board Buddy

A single-user, single-board **Kanban web app** running on `localhost` with a
React frontend and a FastAPI + SQLite backend.

> Spec: see [`_docs/specs.md`](_docs/specs.md).

## Project structure

```
_docs/specs.md   Project spec (requirements, data model, API, acceptance criteria)
frontend/        React + TypeScript app (TanStack Start/Vite)
backend/         Python FastAPI + SQLite (planned)
```

## Development

### Frontend

Requires Node.js and npm.

```sh
cd frontend
npm i
npm run dev
```

The frontend currently talks to a mock API (`frontend/src/lib/kanban/mock-server.ts`).
The FastAPI backend is implemented separately in `backend/` and will serve the
same `/api/*` endpoints defined in `_docs/specs.md`.

### Backend

Coming soon — FastAPI service in `backend/` (SQLite persistence, undo/redo
command log, activity log). See `_docs/specs.md`.

## Build with Lovable

This project is connected to [Lovable](https://lovable.dev) — changes committed
to `main` sync into the Lovable editor. Keep the connected branch in a working
state and avoid rewriting pushed history.