import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pencil, Plus, Trash2, Gauge } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Column, CommandType } from "@/lib/kanban/types";

interface Props {
  column: Column;
  count: number;
  run: (type: CommandType, payload?: Record<string, unknown>) => void;
  onAddCard: (columnId: string) => void;
}

export function ColumnHeader({ column, count, run, onAddCard }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `column:${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  const limit = column.wipLimit;
  const atLimit = limit !== null && count >= limit;
  const nearLimit = limit !== null && !atLimit && count >= limit - 1;

  const commitName = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) run("rename_column", { id: column.id, name: trimmed });
    else setName(column.name);
  };

  const askLimit = () => {
    const input = window.prompt(`WIP limit for "${column.name}" (blank for none)`, limit?.toString() ?? "");
    if (input === null) return;
    const value = input.trim() === "" ? null : Math.max(1, Number(input));
    if (value !== null && Number.isNaN(value)) return;
    run("set_wip_limit", { id: column.id, wipLimit: value });
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-xl border border-border bg-elevated px-2.5 py-2",
        isDragging && "opacity-50",
      )}
    >
      <button
        className="cursor-grab text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
        aria-label={`Reorder ${column.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {editing ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitName();
            if (e.key === "Escape") {
              setName(column.name);
              setEditing(false);
            }
          }}
          className="h-7 text-sm"
        />
      ) : (
        <button
          onDoubleClick={() => setEditing(true)}
          className="truncate text-sm font-semibold"
          title="Double-click to rename"
        >
          {column.name}
        </button>
      )}

      <span
        className={cn(
          "ml-auto rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
          atLimit
            ? "bg-destructive/15 text-destructive"
            : nearLimit
              ? "bg-warning/25 text-warning-foreground"
              : "bg-muted text-muted-foreground",
        )}
      >
        {count}
        {limit !== null && `/${limit}`}
      </span>

      <Button size="icon" variant="ghost" className="size-7" onClick={() => onAddCard(column.id)}>
        <Plus className="size-4" />
        <span className="sr-only">Add card to {column.name}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="size-7">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Column options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="size-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={askLimit}>
            <Gauge className="size-4" /> Set WIP limit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => run("delete_column", { id: column.id })}
          >
            <Trash2 className="size-4" /> Delete column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
