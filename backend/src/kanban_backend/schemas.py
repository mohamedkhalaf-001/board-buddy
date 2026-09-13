"""Pydantic models mirroring the shapes defined in _docs/openapi.yaml."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CommandType(StrEnum):
    create_column = "create_column"
    rename_column = "rename_column"
    delete_column = "delete_column"
    reorder_column = "reorder_column"
    set_wip_limit = "set_wip_limit"
    create_swimlane = "create_swimlane"
    rename_swimlane = "rename_swimlane"
    delete_swimlane = "delete_swimlane"
    reorder_swimlane = "reorder_swimlane"
    create_card = "create_card"
    update_card = "update_card"
    delete_card = "delete_card"
    move_card = "move_card"
    create_label = "create_label"
    rename_label = "rename_label"
    delete_label = "delete_label"
    assign_label = "assign_label"
    remove_label = "remove_label"


class ActivityAction(StrEnum):
    created = "created"
    updated = "updated"
    moved = "moved"
    deleted = "deleted"
    label_added = "label-added"
    label_removed = "label-removed"
    undo = "undo"
    redo = "redo"


class Column(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    position: int
    wipLimit: int | None = None


class Swimlane(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    position: int


class Label(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    color: str


class Card(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str = ""
    columnId: str
    swimlaneId: str
    position: int
    dueDate: str | None = None
    labelIds: list[str] = Field(default_factory=list)
    createdAt: str
    updatedAt: str


class Board(BaseModel):
    columns: list[Column]
    swimlanes: list[Swimlane]
    labels: list[Label]
    cards: list[Card]


class CommandRequest(BaseModel):
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)


class Command(BaseModel):
    id: str
    type: CommandType
    payload: dict[str, Any]
    appliedAt: str
    undoApplied: bool


class CommandResult(BaseModel):
    board: Board
    commandId: str


class ActivityLogEntry(BaseModel):
    id: str
    action: ActivityAction
    entityType: str
    entityId: str
    summary: str
    createdAt: str
