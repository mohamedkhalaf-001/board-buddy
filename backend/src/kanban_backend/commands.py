"""Command engine — payload validation + board mutation (mirrors mock-server.ts)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError

from .schemas import Board, Card, Column, CommandType, Label, Swimlane

# ── helpers ──────────────────────────────────────────────────────────────────


def uid() -> str:
    return uuid.uuid4().hex[:8]


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _find(lst: list, id: str):
    for item in lst:
        if item.id == id:
            return item
    return None


def _position_key(item: Any) -> int:
    return item.position


def _renumber(items: list) -> None:
    items.sort(key=_position_key)
    for i, item in enumerate(items):
        item.position = i


# ── payload validators ───────────────────────────────────────────────────────


class PayloadError(ValueError):
    """Raised when a command payload is invalid or an entity is missing."""


class _IdName(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str


class _Id(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str


class _Reorder(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    toIndex: int


class _SetWipLimit(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    wipLimit: int | None = None


class _CreateSwimlane(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    name: str


class _CreateColumn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    name: str


class _CreateCard(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    title: str
    description: str = ""
    columnId: str
    swimlaneId: str
    dueDate: str | None = None
    labelIds: list[str] = []


class _UpdateCard(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    changes: dict[str, Any] = {}


class _MoveCard(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    columnId: str
    swimlaneId: str
    toIndex: int | None = None


class _CreateLabel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    name: str
    color: str


class _RenameLabel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    color: str | None = None


class _AssignRemoveLabel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    cardId: str
    labelId: str


_PAYLOAD_MODELS: dict[CommandType, type[BaseModel]] = {
    CommandType.create_column: _CreateColumn,
    CommandType.rename_column: _IdName,
    CommandType.delete_column: _Id,
    CommandType.reorder_column: _Reorder,
    CommandType.set_wip_limit: _SetWipLimit,
    CommandType.create_swimlane: _CreateSwimlane,
    CommandType.rename_swimlane: _IdName,
    CommandType.delete_swimlane: _Id,
    CommandType.reorder_swimlane: _Reorder,
    CommandType.create_card: _CreateCard,
    CommandType.update_card: _UpdateCard,
    CommandType.delete_card: _Id,
    CommandType.move_card: _MoveCard,
    CommandType.create_label: _CreateLabel,
    CommandType.rename_label: _RenameLabel,
    CommandType.delete_label: _Id,
    CommandType.assign_label: _AssignRemoveLabel,
    CommandType.remove_label: _AssignRemoveLabel,
}


def parse_payload(cmd_type: CommandType, payload: dict[str, Any]) -> dict[str, Any]:
    """Validate and normalise a raw command payload dict."""
    model_cls = _PAYLOAD_MODELS.get(cmd_type)
    if model_cls is None:
        raise PayloadError(f"Unknown command type: {cmd_type}")
    try:
        parsed = model_cls(**payload)
    except ValidationError as exc:
        raise PayloadError(str(exc)) from exc
    return parsed.model_dump()


# ── apply ────────────────────────────────────────────────────────────────────


class Applied:
    __slots__ = ("action", "entityId", "entityType", "summary")

    def __init__(self, summary: str, action: str, entityType: str, entityId: str):
        self.summary = summary
        self.action = action
        self.entityType = entityType
        self.entityId = entityId


def apply_command(board: Board, cmd_type: CommandType, p: dict[str, Any]) -> Applied:
    """Mutate *board* in place according to *cmd_type* + *payload*."""
    c: Column
    s: Swimlane
    label: Label
    card: Card
    source: list[Card]
    target: list[Card]
    index: int

    if cmd_type == CommandType.create_column:
        cid = p.get("id") or f"col-{uid()}"
        board.columns.append(
            Column(id=cid, name=p["name"], position=len(board.columns), wipLimit=None)
        )
        return Applied(
            summary=f'Column "{p["name"]}" created',
            action="created",
            entityType="column",
            entityId=cid,
        )

    if cmd_type == CommandType.rename_column:
        c = _find(board.columns, p["id"])
        if c is None:
            raise PayloadError(f"Column not found: {p['id']}")
        old = c.name
        c.name = p["name"]
        return Applied(
            summary=f'Column "{old}" renamed to "{p["name"]}"',
            action="updated",
            entityType="column",
            entityId=c.id,
        )

    if cmd_type == CommandType.delete_column:
        c = _find(board.columns, p["id"])
        if c is None:
            raise PayloadError(f"Column not found: {p['id']}")
        board.columns = [x for x in board.columns if x.id != p["id"]]
        board.cards = [x for x in board.cards if x.columnId != p["id"]]
        _renumber(board.columns)
        return Applied(
            summary=f'Column "{c.name}" deleted',
            action="deleted",
            entityType="column",
            entityId=p["id"],
        )

    if cmd_type == CommandType.reorder_column:
        ordered = sorted(board.columns, key=_position_key)
        from_idx = next((i for i, x in enumerate(ordered) if x.id == p["id"]), None)
        if from_idx is None:
            raise PayloadError(f"Column not found: {p['id']}")
        moved = ordered.pop(from_idx)
        to_idx = max(0, min(p["toIndex"], len(ordered)))
        ordered.insert(to_idx, moved)
        _renumber(ordered)
        board.columns = ordered[:]
        return Applied(
            summary=f'Column "{moved.name}" reordered',
            action="moved",
            entityType="column",
            entityId=p["id"],
        )

    if cmd_type == CommandType.set_wip_limit:
        c = _find(board.columns, p["id"])
        if c is None:
            raise PayloadError(f"Column not found: {p['id']}")
        c.wipLimit = p.get("wipLimit")
        limit = c.wipLimit if c.wipLimit is not None else "none"
        return Applied(
            summary=f'WIP limit for "{c.name}" set to {limit}',
            action="updated",
            entityType="column",
            entityId=c.id,
        )

    if cmd_type == CommandType.create_swimlane:
        sid = p.get("id") or f"lane-{uid()}"
        board.swimlanes.append(
            Swimlane(id=sid, name=p["name"], position=len(board.swimlanes))
        )
        return Applied(
            summary=f'Swimlane "{p["name"]}" created',
            action="created",
            entityType="swimlane",
            entityId=sid,
        )

    if cmd_type == CommandType.rename_swimlane:
        s = _find(board.swimlanes, p["id"])
        if s is None:
            raise PayloadError(f"Swimlane not found: {p['id']}")
        old = s.name
        s.name = p["name"]
        return Applied(
            summary=f'Swimlane "{old}" renamed to "{p["name"]}"',
            action="updated",
            entityType="swimlane",
            entityId=s.id,
        )

    if cmd_type == CommandType.delete_swimlane:
        s = _find(board.swimlanes, p["id"])
        if s is None:
            raise PayloadError(f"Swimlane not found: {p['id']}")
        board.swimlanes = [x for x in board.swimlanes if x.id != p["id"]]
        board.cards = [x for x in board.cards if x.swimlaneId != p["id"]]
        _renumber(board.swimlanes)
        return Applied(
            summary=f'Swimlane "{s.name}" deleted',
            action="deleted",
            entityType="swimlane",
            entityId=p["id"],
        )

    if cmd_type == CommandType.reorder_swimlane:
        ordered = sorted(board.swimlanes, key=_position_key)
        from_idx = next((i for i, x in enumerate(ordered) if x.id == p["id"]), None)
        if from_idx is None:
            raise PayloadError(f"Swimlane not found: {p['id']}")
        moved = ordered.pop(from_idx)
        to_idx = max(0, min(p["toIndex"], len(ordered)))
        ordered.insert(to_idx, moved)
        _renumber(ordered)
        board.swimlanes = ordered[:]
        return Applied(
            summary=f'Swimlane "{moved.name}" reordered',
            action="moved",
            entityType="swimlane",
            entityId=p["id"],
        )

    if cmd_type == CommandType.create_card:
        card_id = p.get("id") or f"card-{uid()}"
        ts = now_iso()
        siblings = [
            c
            for c in board.cards
            if c.columnId == p["columnId"] and c.swimlaneId == p["swimlaneId"]
        ]
        board.cards.append(
            Card(
                id=card_id,
                title=p["title"],
                description=p.get("description", ""),
                columnId=p["columnId"],
                swimlaneId=p["swimlaneId"],
                position=len(siblings),
                dueDate=p.get("dueDate"),
                labelIds=list(p.get("labelIds", [])),
                createdAt=ts,
                updatedAt=ts,
            )
        )
        return Applied(
            summary=f'Card "{p["title"]}" created',
            action="created",
            entityType="card",
            entityId=card_id,
        )

    if cmd_type == CommandType.update_card:
        card = _find(board.cards, p["id"])
        if card is None:
            raise PayloadError(f"Card not found: {p['id']}")
        for k, v in p.get("changes", {}).items():
            setattr(card, k, v)
        card.updatedAt = now_iso()
        return Applied(
            summary=f'Card "{card.title}" updated',
            action="updated",
            entityType="card",
            entityId=card.id,
        )

    if cmd_type == CommandType.delete_card:
        card = _find(board.cards, p["id"])
        if card is None:
            raise PayloadError(f"Card not found: {p['id']}")
        board.cards = [x for x in board.cards if x.id != p["id"]]
        return Applied(
            summary=f'Card "{card.title}" deleted',
            action="deleted",
            entityType="card",
            entityId=p["id"],
        )

    if cmd_type == CommandType.move_card:
        card = _find(board.cards, p["id"])
        if card is None:
            raise PayloadError(f"Card not found: {p['id']}")
        source = sorted(
            [
                c
                for c in board.cards
                if c.columnId == card.columnId
                and c.swimlaneId == card.swimlaneId
                and c.id != card.id
            ],
            key=_position_key,
        )
        _renumber(source)
        card.columnId = p["columnId"]
        card.swimlaneId = p["swimlaneId"]
        target = sorted(
            [
                c
                for c in board.cards
                if c.columnId == p["columnId"]
                and c.swimlaneId == p["swimlaneId"]
                and c.id != card.id
            ],
            key=_position_key,
        )
        index = max(
            0,
            min(
                p.get("toIndex") if p.get("toIndex") is not None else len(target),
                len(target),
            ),
        )
        target.insert(index, card)
        _renumber(target)
        card.updatedAt = now_iso()
        col = _find(board.columns, p["columnId"])
        return Applied(
            summary=f'Card "{card.title}" moved to {col.name if col else "column"}',
            action="moved",
            entityType="card",
            entityId=card.id,
        )

    if cmd_type == CommandType.create_label:
        lab_id = p.get("id") or f"lab-{uid()}"
        board.labels.append(Label(id=lab_id, name=p["name"], color=p["color"]))
        return Applied(
            summary=f'Label "{p["name"]}" created',
            action="created",
            entityType="label",
            entityId=lab_id,
        )

    if cmd_type == CommandType.rename_label:
        label = _find(board.labels, p["id"])
        if label is None:
            raise PayloadError(f"Label not found: {p['id']}")
        label.name = p["name"]
        if "color" in p and p["color"] is not None:
            label.color = p["color"]
        return Applied(
            summary=f'Label renamed to "{p["name"]}"',
            action="updated",
            entityType="label",
            entityId=label.id,
        )

    if cmd_type == CommandType.delete_label:
        label = _find(board.labels, p["id"])
        if label is None:
            raise PayloadError(f"Label not found: {p['id']}")
        board.labels = [x for x in board.labels if x.id != p["id"]]
        for card in board.cards:
            card.labelIds = [lid for lid in card.labelIds if lid != p["id"]]
        return Applied(
            summary=f'Label "{label.name}" deleted',
            action="deleted",
            entityType="label",
            entityId=p["id"],
        )

    if cmd_type == CommandType.assign_label:
        card = _find(board.cards, p["cardId"])
        if card is None:
            raise PayloadError(f"Card not found: {p['cardId']}")
        if p["labelId"] not in card.labelIds:
            card.labelIds.append(p["labelId"])
        label = _find(board.labels, p["labelId"])
        name = label.name if label else p["labelId"]
        return Applied(
            summary=f'Label "{name}" added to "{card.title}"',
            action="label-added",
            entityType="card",
            entityId=card.id,
        )

    if cmd_type == CommandType.remove_label:
        card = _find(board.cards, p["cardId"])
        if card is None:
            raise PayloadError(f"Card not found: {p['cardId']}")
        card.labelIds = [lid for lid in card.labelIds if lid != p["labelId"]]
        label = _find(board.labels, p["labelId"])
        name = label.name if label else p["labelId"]
        return Applied(
            summary=f'Label "{name}" removed from "{card.title}"',
            action="label-removed",
            entityType="card",
            entityId=card.id,
        )

    raise PayloadError(f"Unhandled command type: {cmd_type}")
