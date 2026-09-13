import { createFileRoute } from "@tanstack/react-router";

import { KanbanBoard } from "@/components/kanban/kanban-board";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kanban Board — Plan, move, ship" },
      {
        name: "description",
        content:
          "A single-board Kanban app with swimlanes, labels, WIP limits, due dates, search, undo/redo and a full activity log.",
      },
      { property: "og:title", content: "Kanban Board — Plan, move, ship" },
      {
        property: "og:description",
        content:
          "Drag cards across columns and swimlanes, filter by label or due date, and undo anything.",
      },
    ],
  }),
  component: KanbanBoard,
});
