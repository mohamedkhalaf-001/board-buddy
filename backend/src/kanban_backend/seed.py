"""Seed data matching frontend/src/lib/kanban/mock-server.ts."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from .commands import now_iso, uid
from .schemas import ActivityLogEntry, Board, Card, Column, Label, Swimlane


def _day_offset(offset: int) -> str:
    return (datetime.now(UTC).date() + timedelta(days=offset)).isoformat()


def _mk(
    title: str,
    column_id: str,
    swimlane_id: str,
    position: int,
    *,
    description: str = "",
    label_ids: list[str] | None = None,
    due_date: str | None = None,
    ts: str = "",
) -> Card:
    ts = ts or now_iso()
    return Card(
        id=f"card-{uid()}",
        title=title,
        description=description,
        columnId=column_id,
        swimlaneId=swimlane_id,
        position=position,
        dueDate=due_date,
        labelIds=label_ids or [],
        createdAt=ts,
        updatedAt=ts,
    )


def seed_board() -> Board:
    ts = now_iso()
    cols = [
        Column(id="col-backlog", name="Backlog", position=0, wipLimit=None),
        Column(id="col-progress", name="In Progress", position=1, wipLimit=3),
        Column(id="col-review", name="Review", position=2, wipLimit=2),
        Column(id="col-done", name="Done", position=3, wipLimit=None),
    ]
    lanes = [
        Swimlane(id="lane-high", name="High urgency", position=0),
        Swimlane(id="lane-normal", name="Normal", position=1),
    ]
    labels = [
        Label(id="lab-bug", name="Bug", color="#e5484d"),
        Label(id="lab-feature", name="Feature", color="#30a46c"),
        Label(id="lab-chore", name="Chore", color="#f5a524"),
        Label(id="lab-design", name="Design", color="#8e6cf0"),
    ]
    cards = [
        _mk(
            "Command log survives refresh",
            "col-progress",
            "lane-high",
            0,
            description="Undo/redo must be re-derivable from the server log.",
            label_ids=["lab-feature"],
            due_date=_day_offset(0),
            ts=ts,
        ),
        _mk(
            "Drop into full column warns",
            "col-review",
            "lane-high",
            0,
            label_ids=["lab-bug"],
            due_date=_day_offset(-2),
            ts=ts,
        ),
        _mk(
            "Swimlane reordering",
            "col-backlog",
            "lane-normal",
            0,
            label_ids=["lab-feature", "lab-design"],
            ts=ts,
        ),
        _mk(
            "Tidy up SQLite schema",
            "col-backlog",
            "lane-normal",
            1,
            label_ids=["lab-chore"],
            due_date=_day_offset(5),
            ts=ts,
        ),
        _mk(
            "Keyboard shortcut help sheet",
            "col-done",
            "lane-normal",
            0,
            label_ids=["lab-design"],
            ts=ts,
        ),
    ]
    return Board(columns=cols, swimlanes=lanes, labels=labels, cards=cards)


def seed_activity() -> list[ActivityLogEntry]:
    return [
        ActivityLogEntry(
            id=uid(),
            action="created",
            entityType="board",
            entityId="board",
            summary="Board created with sample data",
            createdAt=now_iso(),
        )
    ]
