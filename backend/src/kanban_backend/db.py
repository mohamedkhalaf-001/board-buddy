"""Mock in-memory database — drop-in replacement target for SQLite later."""

from __future__ import annotations

from .commands import (
    PayloadError,
    apply_command,
    now_iso,
    parse_payload,
    uid,
)
from .schemas import (
    ActivityAction,
    ActivityLogEntry,
    Board,
    Command,
)


class ConflictError(Exception):
    """Raised when undo/redo cannot proceed."""


class StoredCommand:
    __slots__ = (
        "after",
        "appliedAt",
        "before",
        "id",
        "payload",
        "summary",
        "type",
        "undoApplied",
    )

    def __init__(
        self,
        *,
        id: str,
        type,
        payload,
        appliedAt,
        undoApplied: bool,
        before: Board,
        after: Board,
        summary: str,
    ):
        self.id = id
        self.type = type
        self.payload = payload
        self.appliedAt = appliedAt
        self.undoApplied = undoApplied
        self.before = before
        self.after = after
        self.summary = summary


def _deep(obj: Board) -> Board:
    return Board.model_validate_json(obj.model_dump_json())


ACTIVITY_CAP = 200


class MockDatabase:
    def __init__(self) -> None:
        self.board: Board = Board(columns=[], swimlanes=[], labels=[], cards=[])
        self.commands: list[StoredCommand] = []
        self.activity: list[ActivityLogEntry] = []
        self.reset()

    # ── read ──────────────────────────────────────────────────────────────

    def get_board(self) -> Board:
        return _deep(self.board)

    def get_commands(self) -> list[Command]:
        return [
            Command(
                id=c.id,
                type=c.type,
                payload=c.payload,
                appliedAt=c.appliedAt,
                undoApplied=c.undoApplied,
            )
            for c in self.commands
        ]

    def get_activity(self, limit: int = 50) -> list[ActivityLogEntry]:
        return [_deep_activity(e) for e in self.activity[:limit]]

    # ── mutate ────────────────────────────────────────────────────────────

    def post_command(self, cmd_type: str, payload: dict) -> tuple[Board, str]:
        from .schemas import CommandType

        try:
            type_enum = CommandType(cmd_type)
        except ValueError as exc:
            raise PayloadError(f"Unknown command type: {cmd_type}") from exc
        parsed = parse_payload(type_enum, payload)

        # Discard any undone (redoable) commands — standard redo-stack reset
        self.commands = [c for c in self.commands if not c.undoApplied]

        before = _deep(self.board)
        try:
            applied = apply_command(self.board, type_enum, parsed)
        except PayloadError:
            raise
        except Exception as exc:
            raise PayloadError(str(exc)) from exc

        cmd_id = uid()
        self.commands.append(
            StoredCommand(
                id=cmd_id,
                type=type_enum,
                payload=parsed,
                appliedAt=now_iso(),
                undoApplied=False,
                before=before,
                after=_deep(self.board),
                summary=applied.summary,
            )
        )
        self._log_activity(
            applied.summary, applied.action, applied.entityType, applied.entityId
        )
        return _deep(self.board), cmd_id

    def undo(self) -> Board:
        top = next((c for c in reversed(self.commands) if not c.undoApplied), None)
        if top is None:
            raise ConflictError("Nothing to undo")
        self.board = _deep(top.before)
        top.undoApplied = True
        self._log_activity(
            f"Undid: {top.summary}",
            "undo",
            "board",
            "board",
        )
        return _deep(self.board)

    def redo(self) -> Board:
        target = next((c for c in self.commands if c.undoApplied), None)
        if target is None:
            raise ConflictError("Nothing to redo")
        self.board = _deep(target.after)
        target.undoApplied = False
        self._log_activity(
            f"Redid: {target.summary}",
            "redo",
            "board",
            "board",
        )
        return _deep(self.board)

    def reset(self) -> Board:
        from .seed import seed_activity, seed_board

        self.board = seed_board()
        self.commands = []
        self.activity = seed_activity()
        return _deep(self.board)

    # ── internal ──────────────────────────────────────────────────────────

    def _log_activity(
        self,
        summary: str,
        action: str,
        entityType: str,
        entityId: str,
    ) -> None:
        entry = ActivityLogEntry(
            id=uid(),
            action=ActivityAction(action),
            entityType=entityType,
            entityId=entityId,
            summary=summary,
            createdAt=now_iso(),
        )
        self.activity.insert(0, entry)
        if len(self.activity) > ACTIVITY_CAP:
            self.activity = self.activity[:ACTIVITY_CAP]


def _deep_activity(e: ActivityLogEntry) -> ActivityLogEntry:
    return ActivityLogEntry.model_validate_json(e.model_dump_json())
