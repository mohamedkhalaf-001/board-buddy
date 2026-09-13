# Board Buddy — Project Spec (v1)

> Single source of truth for the Kanban board's requirements, data model,
> API surface, and acceptance criteria. See also `README.md` for structure
> and running instructions.

## Overview

A single-user, single-board Kanban web application served on `localhost`.
It lets the user manage work items as cards across configurable columns, with
rich metadata, filtering, and a full activity trail. The app is a browser
frontend (React) talking to a local API (FastAPI) backed by SQLite.

---

## Tech Stack

| Layer        | Choice                                   |
|--------------|------------------------------------------|
| Frontend     | React + TypeScript, Vite (TanStack Start)|
| Backend      | Python FastAPI                           |
| Database     | SQLite (file-based, local)               |
| Drag & drop  | React DnD library (`@dnd-kit/core`)      |
| Run target   | Localhost only (single command to start) |
| Distribution | Single-user, single board. No auth.      |

Decisions / caveats:
- Frontend and backend are separate processes in dev; the backend serves the
  built frontend statically so one command runs the whole app in production
  mode.

---

## Data Model

### Board
- Single global board containing all columns, cards, swimlanes, labels.

### Column
- `id`, `name`, `position` (ordering).
- `wipLimit` (nullable int — max cards allowed in this column).

### Card
- `id`, `title`, `description`, `columnId`, `swimlaneId`, `position`.
- `dueDate` (nullable ISO date), `createdAt`, `updatedAt`.
- Mutable metadata: title/description/column/swimlane/due date.

### Label
- `id`, `name`, `color`.
- Many-to-many with cards (`card_labels` join table).

### Swimlane
- `id`, `name`, `position`.
- Cards are placed in a swimlane row × column cell.

### ActivityLogEntry
- `id`, `action` (created / updated / moved / deleted / label-added /
  label-removed), `entityType`, `entityId`, `payload` (JSON snapshot of the
  change), `createdAt`.

### Command / History (undo-redo)
- Server keeps an ordered log of every mutating command applied to the board.
- `id`, `commandType`, `payload` (full before/after state needed to reverse),
  `appliedAt`, `undoApplied` (bool).
- Undo/redo adjust the `undoApplied` flag; the board state is re-derived from
  the command log's top command. This keeps undo/redo surviving a refresh
  and makes the server the source of truth.

---

## Features (v1 — full pack)

### Core board
- Configurable columns: add, rename, reorder, delete.
- Card CRUD: create, edit title/description, delete.
- Drag-and-drop:
  - Cards between columns and swimlanes.
  - Reordering within a column.
  - Columns reordered.
- Position persistence via command log + re-derivation.

### Labels / tags
- Create/rename/delete labels with user-chosen colors.
- Assign/remove labels on cards.
- Filter and color-code UI accordingly.

### Metadata
- Optional due date per card (overdue highlight).
- Description (multi-line) per card.

### Search / filter
- Instant filter of the board by text (title/description).
- Filter by label, swimlane, and/or empty-state ("no due date", "due today",
  "overdue").

### WIP limits
- Per-column max card count.
- Column visually warns when at/near limit; card drop into a full column is
  either blocked or flagged (configurable at scaffold time — default:
  warn + allow).

### Swimlanes
- Horizontal rows (e.g. "High / Mid / Low urgency").
- Cards live in a (swimlane, column) cell.
- Add/rename/reorder/delete swimlanes.

### Undo / redo
- Keyboard: `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`).
- Server-backed history as described above. Survives refresh.

### Keyboard shortcuts + themes
- `C` new card, `?` shortcut help, `Escape` close modals, delete key flow.
- Dark/light theme toggle, persisted.

### Activity log
- Side panel showing recent board events (created, moved, labeled, deleted...)
- Pulled from `ActivityLogEntry`.

### Responsive layout
- Board renders with no horizontal scrollbar at any viewport width.
- Columns scale (`minmax(0, 1fr)` grid) to always fit the available width.

---

## API Surface (FastAPI)

- `GET /api/board` — full board state (columns, swimlanes, cards, labels, card-labels, wip limits).
- `POST /api/commands` — apply a mutating command `{type, payload}`.
- `POST /api/commands/{id}/undo`
- `POST /api/commands/{id}/redo`
- `GET /api/commands` — command history (for redo availability).
- `GET /api/activity` — activity log entries (paginated).
- Serve static build at `/` in production mode.

Command types (each serialized with enough payload to reverse):
`create_column`, `rename_column`, `delete_column`, `reorder_column`,
`set_wip_limit`, `create_swimlane`, `rename_swimlane`, `delete_swimlane`,
`reorder_swimlane`, `create_card`, `update_card`, `delete_card`, `move_card`,
`create_label`, `rename_label`, `delete_label`, `assign_label`, `remove_label`.

---

## Non-Goals (explicitly out of scope for v1)

- Multi-user, authentication, roles, or real-time collaboration.
- Multiple boards / board templates / sharing.
- Attachments, comments, checklists, sub-tasks/story points.
- Cloud deployment, CI/CD, Docker.
- Import/export to external tools (CSV/JSON export is a possible v2).

---

## Acceptance Criteria (definition of done)

- Single command starts backend + serves built frontend on localhost.
- Full board state survives restart (SQLite persistence).
- All v1 features work end-to-end through the UI.
- Undo/redo works across refresh.
- Activity log records every card/column/swimlane/label mutation.
- No horizontal scrollbar at any screen size.
- Browsers: latest Chrome/Firefox/Edge.

---

## Milestones

1. **Scaffold** — repo layout, FastAPI server + SQLite schema, Vite React+TS app, dev wiring, first `/api/board`.
2. **Core board** — columns + cards CRUD, drag-and-drop, persistence, command stream + undo/redo core.
3. **Rich features** — labels, due dates, descriptions, WIP limits, swimlanes.
4. **UX polish** — search/filter, shortcuts, themes, activity log, empty states.
5. **Hardening** — edge cases, refresh tests, single-command prod run.