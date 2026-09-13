export type ID = string;

export interface Column {
  id: ID;
  name: string;
  position: number;
  wipLimit: number | null;
}

export interface Swimlane {
  id: ID;
  name: string;
  position: number;
}

export interface Label {
  id: ID;
  name: string;
  color: string;
}

export interface Card {
  id: ID;
  title: string;
  description: string;
  columnId: ID;
  swimlaneId: ID;
  position: number;
  dueDate: string | null;
  labelIds: ID[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardState {
  columns: Column[];
  swimlanes: Swimlane[];
  labels: Label[];
  cards: Card[];
}

export type CommandType =
  | "create_column"
  | "rename_column"
  | "delete_column"
  | "reorder_column"
  | "set_wip_limit"
  | "create_swimlane"
  | "rename_swimlane"
  | "delete_swimlane"
  | "reorder_swimlane"
  | "create_card"
  | "update_card"
  | "delete_card"
  | "move_card"
  | "create_label"
  | "rename_label"
  | "delete_label"
  | "assign_label"
  | "remove_label";

export interface Command {
  id: ID;
  type: CommandType;
  payload: Record<string, unknown>;
  appliedAt: string;
  undoApplied: boolean;
}

export type ActivityAction =
  | "created"
  | "updated"
  | "moved"
  | "deleted"
  | "label-added"
  | "label-removed"
  | "undo"
  | "redo";

export interface ActivityLogEntry {
  id: ID;
  action: ActivityAction;
  entityType: "card" | "column" | "swimlane" | "label" | "board";
  entityId: ID;
  summary: string;
  createdAt: string;
}
