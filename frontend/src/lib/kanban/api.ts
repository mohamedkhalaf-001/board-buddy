/**
 * API client. Today every call is served by the in-browser mock server.
 * Swap `USE_MOCK` to false (and set VITE_API_URL) once FastAPI is running —
 * the paths and payloads below already match the planned API surface.
 */
import { mockServer } from "./mock-server";
import type { ActivityLogEntry, BoardState, Command, CommandType } from "./types";

const USE_MOCK = true;
const BASE = "/api";

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
    return USE_MOCK ? mockServer.getBoard() : http<BoardState>("/board");
  },

  /** GET /api/commands */
  getCommands(): Promise<Command[]> {
    return USE_MOCK ? mockServer.getCommands() : http<Command[]>("/commands");
  },

  /** GET /api/activity */
  getActivity(limit = 50): Promise<ActivityLogEntry[]> {
    return USE_MOCK
      ? mockServer.getActivity(limit)
      : http<ActivityLogEntry[]>(`/activity?limit=${limit}`);
  },

  /** POST /api/commands */
  postCommand(
    type: CommandType,
    payload: Record<string, unknown> = {},
  ): Promise<{ board: BoardState; commandId: string }> {
    return USE_MOCK
      ? mockServer.postCommand(type, payload)
      : http("/commands", { method: "POST", body: JSON.stringify({ type, payload }) });
  },

  /** POST /api/commands/{id}/undo */
  undo(): Promise<BoardState> {
    return USE_MOCK ? mockServer.undo() : http("/commands/undo", { method: "POST" });
  },

  /** POST /api/commands/{id}/redo */
  redo(): Promise<BoardState> {
    return USE_MOCK ? mockServer.redo() : http("/commands/redo", { method: "POST" });
  },

  reset(): Promise<BoardState> {
    return mockServer.reset();
  },
};
