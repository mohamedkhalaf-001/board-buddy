/**
 * MOCK BACKEND — stands in for the FastAPI + SQLite server.
 *
 * Everything in this file is throwaway: it emulates the real API surface
 * (`GET /api/board`, `POST /api/commands`, undo/redo, `GET /api/activity`)
 * against an in-memory store persisted to localStorage.
 *
 * To go live, delete this file and point `src/lib/kanban/api.ts` at the real
 * server — the request/response shapes are already the final ones.
 */
import type {
  ActivityLogEntry,
  BoardState,
  Card,
  Command,
  CommandType,
  ID,
} from "./types";

interface StoredCommand extends Command {
  before: BoardState;
  after: BoardState;
  summary: string;
}

interface Store {
  board: BoardState;
  commands: StoredCommand[];
  activity: ActivityLogEntry[];
}

const STORAGE_KEY = "kanban.mock.v1";
const LATENCY = 120;

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function seed(): Store {
  const ts = now();
  const cols = [
    { id: "col-backlog", name: "Backlog", position: 0, wipLimit: null },
    { id: "col-progress", name: "In Progress", position: 1, wipLimit: 3 },
    { id: "col-review", name: "Review", position: 2, wipLimit: 2 },
    { id: "col-done", name: "Done", position: 3, wipLimit: null },
  ];
  const lanes = [
    { id: "lane-high", name: "High urgency", position: 0 },
    { id: "lane-normal", name: "Normal", position: 1 },
  ];
  const labels = [
    { id: "lab-bug", name: "Bug", color: "#e5484d" },
    { id: "lab-feature", name: "Feature", color: "#30a46c" },
    { id: "lab-chore", name: "Chore", color: "#f5a524" },
    { id: "lab-design", name: "Design", color: "#8e6cf0" },
  ];
  const mk = (
    title: string,
    columnId: string,
    swimlaneId: string,
    position: number,
    extra: Partial<Card> = {},
  ): Card => ({
    id: `card-${uid()}`,
    title,
    description: "",
    columnId,
    swimlaneId,
    position,
    dueDate: null,
    labelIds: [],
    createdAt: ts,
    updatedAt: ts,
    ...extra,
  });
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

  const cards: Card[] = [
    mk("Command log survives refresh", "col-progress", "lane-high", 0, {
      description: "Undo/redo must be re-derivable from the server log.",
      labelIds: ["lab-feature"],
      dueDate: day(0),
    }),
    mk("Drop into full column warns", "col-review", "lane-high", 0, {
      labelIds: ["lab-bug"],
      dueDate: day(-2),
    }),
    mk("Swimlane reordering", "col-backlog", "lane-normal", 0, {
      labelIds: ["lab-feature", "lab-design"],
    }),
    mk("Tidy up SQLite schema", "col-backlog", "lane-normal", 1, {
      labelIds: ["lab-chore"],
      dueDate: day(5),
    }),
    mk("Keyboard shortcut help sheet", "col-done", "lane-normal", 0, {
      labelIds: ["lab-design"],
    }),
  ];

  return {
    board: { columns: cols, swimlanes: lanes, labels, cards },
    commands: [],
    activity: [
      {
        id: uid(),
        action: "created",
        entityType: "board",
        entityId: "board",
        summary: "Board created with sample data",
        createdAt: ts,
      },
    ],
  };
}

let store: Store | null = null;

function load(): Store {
  if (store) return store;
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        store = JSON.parse(raw) as Store;
        return store;
      } catch {
        /* fall through to seed */
      }
    }
  }
  store = seed();
  persist();
  return store;
}

function persist() {
  if (typeof window !== "undefined" && store) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

function renumber(items: { position: number }[]) {
  items.forEach((item, i) => {
    item.position = i;
  });
}

interface Applied {
  summary: string;
  action: ActivityLogEntry["action"];
  entityType: ActivityLogEntry["entityType"];
  entityId: ID;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function apply(board: BoardState, type: CommandType, p: any): Applied {
  const find = <T extends { id: ID }>(list: T[], id: ID) =>
    list.find((x) => x.id === id);

  switch (type) {
    case "create_column": {
      const id = p.id ?? `col-${uid()}`;
      board.columns.push({
        id,
        name: p.name,
        position: board.columns.length,
        wipLimit: null,
      });
      return { summary: `Column "${p.name}" created`, action: "created", entityType: "column", entityId: id };
    }
    case "rename_column": {
      const c = find(board.columns, p.id)!;
      const old = c.name;
      c.name = p.name;
      return { summary: `Column "${old}" renamed to "${p.name}"`, action: "updated", entityType: "column", entityId: c.id };
    }
    case "delete_column": {
      const c = find(board.columns, p.id)!;
      board.columns = board.columns.filter((x) => x.id !== p.id);
      board.cards = board.cards.filter((x) => x.columnId !== p.id);
      renumber(board.columns.sort(byPos));
      return { summary: `Column "${c.name}" deleted`, action: "deleted", entityType: "column", entityId: p.id };
    }
    case "reorder_column": {
      const ordered = board.columns.slice().sort(byPos);
      const from = ordered.findIndex((c) => c.id === p.id);
      const [moved] = ordered.splice(from, 1);
      ordered.splice(p.toIndex, 0, moved);
      renumber(ordered);
      return { summary: `Column "${moved.name}" reordered`, action: "moved", entityType: "column", entityId: p.id };
    }
    case "set_wip_limit": {
      const c = find(board.columns, p.id)!;
      c.wipLimit = p.wipLimit;
      return {
        summary: `WIP limit for "${c.name}" set to ${p.wipLimit ?? "none"}`,
        action: "updated",
        entityType: "column",
        entityId: c.id,
      };
    }
    case "create_swimlane": {
      const id = p.id ?? `lane-${uid()}`;
      board.swimlanes.push({ id, name: p.name, position: board.swimlanes.length });
      return { summary: `Swimlane "${p.name}" created`, action: "created", entityType: "swimlane", entityId: id };
    }
    case "rename_swimlane": {
      const s = find(board.swimlanes, p.id)!;
      const old = s.name;
      s.name = p.name;
      return { summary: `Swimlane "${old}" renamed to "${p.name}"`, action: "updated", entityType: "swimlane", entityId: s.id };
    }
    case "delete_swimlane": {
      const s = find(board.swimlanes, p.id)!;
      board.swimlanes = board.swimlanes.filter((x) => x.id !== p.id);
      board.cards = board.cards.filter((x) => x.swimlaneId !== p.id);
      renumber(board.swimlanes.sort(byPos));
      return { summary: `Swimlane "${s.name}" deleted`, action: "deleted", entityType: "swimlane", entityId: p.id };
    }
    case "reorder_swimlane": {
      const ordered = board.swimlanes.slice().sort(byPos);
      const from = ordered.findIndex((s) => s.id === p.id);
      const [moved] = ordered.splice(from, 1);
      ordered.splice(p.toIndex, 0, moved);
      renumber(ordered);
      return { summary: `Swimlane "${moved.name}" reordered`, action: "moved", entityType: "swimlane", entityId: p.id };
    }
    case "create_card": {
      const id = p.id ?? `card-${uid()}`;
      const ts = now();
      const siblings = board.cards.filter(
        (c) => c.columnId === p.columnId && c.swimlaneId === p.swimlaneId,
      );
      board.cards.push({
        id,
        title: p.title,
        description: p.description ?? "",
        columnId: p.columnId,
        swimlaneId: p.swimlaneId,
        position: siblings.length,
        dueDate: p.dueDate ?? null,
        labelIds: p.labelIds ?? [],
        createdAt: ts,
        updatedAt: ts,
      });
      return { summary: `Card "${p.title}" created`, action: "created", entityType: "card", entityId: id };
    }
    case "update_card": {
      const c = find(board.cards, p.id)!;
      Object.assign(c, p.changes, { updatedAt: now() });
      return { summary: `Card "${c.title}" updated`, action: "updated", entityType: "card", entityId: c.id };
    }
    case "delete_card": {
      const c = find(board.cards, p.id)!;
      board.cards = board.cards.filter((x) => x.id !== p.id);
      return { summary: `Card "${c.title}" deleted`, action: "deleted", entityType: "card", entityId: p.id };
    }
    case "move_card": {
      const c = find(board.cards, p.id)!;
      const source = board.cards
        .filter((x) => x.columnId === c.columnId && x.swimlaneId === c.swimlaneId && x.id !== c.id)
        .sort(byPos);
      renumber(source);
      c.columnId = p.columnId;
      c.swimlaneId = p.swimlaneId;
      const target = board.cards
        .filter((x) => x.columnId === p.columnId && x.swimlaneId === p.swimlaneId && x.id !== c.id)
        .sort(byPos);
      const index = Math.max(0, Math.min(p.toIndex ?? target.length, target.length));
      target.splice(index, 0, c);
      renumber(target);
      c.updatedAt = now();
      const col = find(board.columns, p.columnId);
      return { summary: `Card "${c.title}" moved to ${col?.name ?? "column"}`, action: "moved", entityType: "card", entityId: c.id };
    }
    case "create_label": {
      const id = p.id ?? `lab-${uid()}`;
      board.labels.push({ id, name: p.name, color: p.color });
      return { summary: `Label "${p.name}" created`, action: "created", entityType: "label", entityId: id };
    }
    case "rename_label": {
      const l = find(board.labels, p.id)!;
      l.name = p.name;
      if (p.color) l.color = p.color;
      return { summary: `Label renamed to "${p.name}"`, action: "updated", entityType: "label", entityId: l.id };
    }
    case "delete_label": {
      const l = find(board.labels, p.id)!;
      board.labels = board.labels.filter((x) => x.id !== p.id);
      board.cards.forEach((c) => {
        c.labelIds = c.labelIds.filter((x) => x !== p.id);
      });
      return { summary: `Label "${l.name}" deleted`, action: "deleted", entityType: "label", entityId: p.id };
    }
    case "assign_label": {
      const c = find(board.cards, p.cardId)!;
      if (!c.labelIds.includes(p.labelId)) c.labelIds.push(p.labelId);
      const l = find(board.labels, p.labelId);
      return { summary: `Label "${l?.name}" added to "${c.title}"`, action: "label-added", entityType: "card", entityId: c.id };
    }
    case "remove_label": {
      const c = find(board.cards, p.cardId)!;
      c.labelIds = c.labelIds.filter((x) => x !== p.labelId);
      const l = find(board.labels, p.labelId);
      return { summary: `Label "${l?.name}" removed from "${c.title}"`, action: "label-removed", entityType: "card", entityId: c.id };
    }
    default:
      throw new Error(`Unknown command: ${type}`);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function logActivity(s: Store, a: Applied) {
  s.activity.unshift({
    id: uid(),
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    summary: a.summary,
    createdAt: now(),
  });
  s.activity = s.activity.slice(0, 200);
}

export const mockServer = {
  async getBoard(): Promise<BoardState> {
    await sleep(LATENCY);
    return clone(load().board);
  },

  async getCommands(): Promise<Command[]> {
    await sleep(20);
    return load().commands.map(({ before: _b, after: _a, ...c }) => clone(c));
  },

  async getActivity(limit = 50): Promise<ActivityLogEntry[]> {
    await sleep(20);
    return clone(load().activity.slice(0, limit));
  },

  async postCommand(type: CommandType, payload: Record<string, unknown>) {
    await sleep(LATENCY);
    const s = load();
    // Applying a new command drops any undone commands (standard redo stack).
    s.commands = s.commands.filter((c) => !c.undoApplied);
    const before = clone(s.board);
    const result = apply(s.board, type, payload);
    const entry: StoredCommand = {
      id: uid(),
      type,
      payload,
      appliedAt: now(),
      undoApplied: false,
      before,
      after: clone(s.board),
      summary: result.summary,
    };
    s.commands.push(entry);
    logActivity(s, result);
    persist();
    return { board: clone(s.board), commandId: entry.id };
  },

  async undo() {
    await sleep(LATENCY);
    const s = load();
    const top = [...s.commands].reverse().find((c) => !c.undoApplied);
    if (!top) throw new Error("Nothing to undo");
    s.board = clone(top.before);
    top.undoApplied = true;
    logActivity(s, {
      summary: `Undid: ${top.summary}`,
      action: "undo",
      entityType: "board",
      entityId: "board",
    });
    persist();
    return clone(s.board);
  },

  async redo() {
    await sleep(LATENCY);
    const s = load();
    const next = s.commands.find((c) => c.undoApplied);
    if (!next) throw new Error("Nothing to redo");
    s.board = clone(next.after);
    next.undoApplied = false;
    logActivity(s, {
      summary: `Redid: ${next.summary}`,
      action: "redo",
      entityType: "board",
      entityId: "board",
    });
    persist();
    return clone(s.board);
  },

  async reset() {
    store = seed();
    persist();
    return clone(store.board);
  },
};
