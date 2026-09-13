/**
 * API client for the FastAPI backend (see ../_docs/openapi.yaml).
 * Defaults to the same-origin `/api` prefix (Vite dev server proxies it to
 * the backend on 127.0.0.1:8000). Override with VITE_API_URL if you need a
 * different base, e.g. VITE_API_URL=http://127.0.0.1:8000/api.
 */
import type { ActivityLogEntry, BoardState, Command, CommandType } from "./types";

const BASE = import.meta.env["VITE_API_URL"] ?? "/api";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  /** GET /api/board */
  getBoard(): Promise<BoardState> {
    return http<BoardState>("/board");
  },

  /** GET /api/commands */
  getCommands(): Promise<Command[]> {
    return http<Command[]>("/commands");
  },

  /** GET /api/activity */
  getActivity(limit = 50): Promise<ActivityLogEntry[]> {
    return http<ActivityLogEntry[]>(`/activity?limit=${limit}`);
  },

  /** POST /api/commands */
  postCommand(
    type: CommandType,
    payload: Record<string, unknown> = {},
  ): Promise<{ board: BoardState; commandId: string }> {
    return http("/commands", { method: "POST", body: JSON.stringify({ type, payload }) });
  },

  /** POST /api/commands/undo */
  undo(): Promise<BoardState> {
    return http("/commands/undo", { method: "POST" });
  },

  /** POST /api/commands/redo */
  redo(): Promise<BoardState> {
    return http("/commands/redo", { method: "POST" });
  },

  /** POST /api/reset */
  reset(): Promise<BoardState> {
    return http("/reset", { method: "POST" });
  },
};
