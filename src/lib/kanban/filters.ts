import type { BoardState, Card } from "./types";

export type DueFilter = "any" | "none" | "today" | "overdue";

export interface Filters {
  text: string;
  labelIds: string[];
  swimlaneId: string | "all";
  due: DueFilter;
}

export const emptyFilters: Filters = {
  text: "",
  labelIds: [],
  swimlaneId: "all",
  due: "any",
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function dueState(card: Card): "overdue" | "today" | "upcoming" | null {
  if (!card.dueDate) return null;
  const today = todayISO();
  if (card.dueDate < today) return "overdue";
  if (card.dueDate === today) return "today";
  return "upcoming";
}

export function matchesFilters(card: Card, f: Filters): boolean {
  if (f.text.trim()) {
    const q = f.text.trim().toLowerCase();
    if (
      !card.title.toLowerCase().includes(q) &&
      !card.description.toLowerCase().includes(q)
    )
      return false;
  }
  if (f.labelIds.length && !f.labelIds.every((id) => card.labelIds.includes(id)))
    return false;
  if (f.swimlaneId !== "all" && card.swimlaneId !== f.swimlaneId) return false;
  if (f.due === "none" && card.dueDate) return false;
  if (f.due === "today" && dueState(card) !== "today") return false;
  if (f.due === "overdue" && dueState(card) !== "overdue") return false;
  return true;
}

export function cardsInCell(
  board: BoardState,
  swimlaneId: string,
  columnId: string,
  filters: Filters,
): Card[] {
  return board.cards
    .filter((c) => c.swimlaneId === swimlaneId && c.columnId === columnId)
    .filter((c) => matchesFilters(c, filters))
    .sort((a, b) => a.position - b.position);
}

export const isFiltering = (f: Filters) =>
  Boolean(f.text.trim()) || f.labelIds.length > 0 || f.swimlaneId !== "all" || f.due !== "any";
