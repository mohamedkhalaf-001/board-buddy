import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "./api";
import type { BoardState, CommandType } from "./types";

const EMPTY: BoardState = { columns: [], swimlanes: [], labels: [], cards: [] };

export function useBoard() {
  const qc = useQueryClient();

  const boardQuery = useQuery({ queryKey: ["board"], queryFn: api.getBoard });
  const activityQuery = useQuery({ queryKey: ["activity"], queryFn: () => api.getActivity() });
  const commandsQuery = useQuery({ queryKey: ["commands"], queryFn: api.getCommands });

  const refreshSide = () => {
    void qc.invalidateQueries({ queryKey: ["activity"] });
    void qc.invalidateQueries({ queryKey: ["commands"] });
  };

  const commandMutation = useMutation({
    mutationFn: ({ type, payload }: { type: CommandType; payload?: Record<string, unknown> }) =>
      api.postCommand(type, payload ?? {}),
    onSuccess: (res) => {
      qc.setQueryData(["board"], res.board);
      refreshSide();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const undoMutation = useMutation({
    mutationFn: api.undo,
    onSuccess: (board) => {
      qc.setQueryData(["board"], board);
      refreshSide();
    },
    onError: (err: Error) => toast.message(err.message),
  });

  const redoMutation = useMutation({
    mutationFn: api.redo,
    onSuccess: (board) => {
      qc.setQueryData(["board"], board);
      refreshSide();
    },
    onError: (err: Error) => toast.message(err.message),
  });

  const commands = commandsQuery.data ?? [];

  return {
    board: boardQuery.data ?? EMPTY,
    isLoading: boardQuery.isLoading,
    activity: activityQuery.data ?? [],
    run: (type: CommandType, payload?: Record<string, unknown>) =>
      commandMutation.mutate({ type, payload }),
    undo: () => undoMutation.mutate(),
    redo: () => redoMutation.mutate(),
    canUndo: commands.some((c) => !c.undoApplied),
    canRedo: commands.some((c) => c.undoApplied),
    isMutating:
      commandMutation.isPending || undoMutation.isPending || redoMutation.isPending,
    reset: async () => {
      const board = await api.reset();
      qc.setQueryData(["board"], board);
      refreshSide();
    },
  };
}

export type BoardApi = ReturnType<typeof useBoard>;
