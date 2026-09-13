import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, CalendarClock } from "lucide-react";

import { cn } from "@/lib/utils";
import { dueState } from "@/lib/kanban/filters";
import type { Card, Label } from "@/lib/kanban/types";

interface Props {
  card: Card;
  labels: Label[];
  onOpen: (card: Card) => void;
  dragging?: boolean;
  overlay?: boolean;
}

function formatDue(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CardTile({ card, labels, onOpen, dragging, overlay }: Props) {
  const due = dueState(card);
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));

  return (
    <button
      type="button"
      onClick={() => onOpen(card)}
      className={cn(
        "group w-full min-w-0 rounded-xl border border-border bg-card p-3 text-left shadow-card transition-all",
        "hover:-translate-y-px hover:border-primary/40 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging && "opacity-40",
        overlay && "rotate-2 shadow-lift",
      )}
    >
      {cardLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {cardLabels.map((l) => (
            <span
              key={l.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${l.color}22`, color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      <p className="text-sm font-medium leading-snug break-words text-card-foreground">{card.title}</p>
      {(card.description || card.dueDate) && (
        <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
          {card.description && <AlignLeft className="size-3.5" aria-hidden />}
          {card.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                due === "overdue" && "bg-destructive/12 text-destructive",
                due === "today" && "bg-warning/20 text-warning-foreground",
              )}
            >
              <CalendarClock className="size-3.5" aria-hidden />
              {formatDue(card.dueDate)}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export function SortableCardTile(props: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.card.id, data: { type: "card", card: props.card } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="min-w-0"
      {...attributes}
      {...listeners}
    >
      <CardTile {...props} dragging={isDragging} />
    </div>
  );
}
