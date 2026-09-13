import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ChevronDown,
  ChevronUp,
  Keyboard,
  Moon,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Sun,
  Tag,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ActivityPanel } from "@/components/kanban/activity-panel";
import { CardDialog } from "@/components/kanban/card-dialog";
import { CardTile, SortableCardTile } from "@/components/kanban/card-tile";
import { ColumnHeader } from "@/components/kanban/column-header";
import { ShortcutsDialog } from "@/components/kanban/shortcuts-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/hooks/use-theme";
import { cardsInCell, emptyFilters, isFiltering, type DueFilter, type Filters } from "@/lib/kanban/filters";
import { useBoard } from "@/lib/kanban/use-board";
import type { Card } from "@/lib/kanban/types";
import { cn } from "@/lib/utils";

const LABEL_COLORS = ["#e5484d", "#30a46c", "#f5a524", "#8e6cf0", "#0091ff", "#e93d82"];

function Cell({
  id,
  children,
  full,
}: {
  id: string;
  children: React.ReactNode;
  full: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-28 flex-col gap-2 rounded-xl border border-dashed border-transparent p-2 transition-colors",
        isOver && "border-primary/50 bg-primary/5",
        full && "bg-destructive/5",
      )}
    >
      {children}
    </div>
  );
}

export function KanbanBoard() {
  const { board, isLoading, activity, run, undo, redo, canUndo, canRedo, reset } = useBoard();
  const { theme, toggle } = useTheme();

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [cardDialog, setCardDialog] = useState<{
    open: boolean;
    card: Card | null;
    columnId: string;
    swimlaneId: string;
  }>({ open: false, card: null, columnId: "", swimlaneId: "" });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const columns = useMemo(
    () => [...board.columns].sort((a, b) => a.position - b.position),
    [board.columns],
  );
  const swimlanes = useMemo(
    () => [...board.swimlanes].sort((a, b) => a.position - b.position),
    [board.swimlanes],
  );
  const visibleLanes =
    filters.swimlaneId === "all"
      ? swimlanes
      : swimlanes.filter((s) => s.id === filters.swimlaneId);

  const openNewCard = (columnId?: string, swimlaneId?: string) =>
    setCardDialog({
      open: true,
      card: null,
      columnId: columnId ?? columns[0]?.id ?? "",
      swimlaneId: swimlaneId ?? visibleLanes[0]?.id ?? swimlanes[0]?.id ?? "",
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (typing) return;
      if (e.key === "c") {
        e.preventDefault();
        openNewCard();
      } else if (e.key === "?") {
        setShortcutsOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, columns, swimlanes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.["type"] === "card") setActiveCard(data["card"] as Card);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;

    if (active.data.current?.["type"] === "column") {
      const overId = String(over.id);
      if (!overId.startsWith("column:")) return;
      const toIndex = columns.findIndex((c) => `column:${c.id}` === overId);
      const columnId = active.data.current["columnId"] as string;
      if (toIndex >= 0 && columns[toIndex]!.id !== columnId)
        run("reorder_column", { id: columnId, toIndex });
      return;
    }

    const card = active.data.current?.["card"] as Card | undefined;
    if (!card) return;

    let laneId: string;
    let columnId: string;
    let toIndex: number;

    if (over.data.current?.["type"] === "card") {
      const target = over.data.current["card"] as Card;
      laneId = target.swimlaneId;
      columnId = target.columnId;
      toIndex = cardsInCell(board, laneId, columnId, filters).findIndex(
        (c) => c.id === target.id,
      );
    } else if (String(over.id).startsWith("cell:")) {
      const [, lane, col] = String(over.id).split(":");
      laneId = lane!;
      columnId = col!;
      toIndex = cardsInCell(board, laneId, columnId, filters).length;
    } else {
      return;
    }

    if (card.columnId === columnId && card.swimlaneId === laneId) {
      const list = cardsInCell(board, laneId, columnId, filters);
      if (list.findIndex((c) => c.id === card.id) === toIndex) return;
    } else {
      const column = columns.find((c) => c.id === columnId);
      const count = board.cards.filter((c) => c.columnId === columnId).length;
      if (column?.wipLimit != null && count >= column.wipLimit)
        toast.warning(`"${column.name}" is at its WIP limit (${column.wipLimit})`);
    }

    run("move_card", { id: card.id, columnId, swimlaneId: laneId, toIndex });
  };

  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(272px, 1fr))`,
  };

  const addColumn = () => {
    const name = window.prompt("New column name");
    if (name?.trim()) run("create_column", { name: name.trim() });
  };
  const addSwimlane = () => {
    const name = window.prompt("New swimlane name");
    if (name?.trim()) run("create_swimlane", { name: name.trim() });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-sidebar px-4 py-3">
        <h1 className="mr-2 text-lg font-semibold">Kanban</h1>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={filters.text}
            onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
            placeholder="Search cards…  ( / )"
            className="h-9 w-56 pl-8"
          />
        </div>

        <Select
          value={filters.swimlaneId}
          onValueChange={(v) => setFilters((f) => ({ ...f, swimlaneId: v }))}
        >
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All swimlanes</SelectItem>
            {swimlanes.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.due}
          onValueChange={(v) => setFilters((f) => ({ ...f, due: v as DueFilter }))}
        >
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any due date</SelectItem>
            <SelectItem value="none">No due date</SelectItem>
            <SelectItem value="today">Due today</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Tag className="size-4" />
              Labels
              {filters.labelIds.length > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                  {filters.labelIds.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3">
            <div className="space-y-1.5">
              {board.labels.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        labelIds: f.labelIds.includes(l.id)
                          ? f.labelIds.filter((x) => x !== l.id)
                          : [...f.labelIds, l.id],
                      }))
                    }
                    className={cn(
                      "flex-1 rounded-md px-2 py-1 text-left text-xs font-medium",
                      filters.labelIds.includes(l.id) ? "" : "text-muted-foreground",
                    )}
                    style={
                      filters.labelIds.includes(l.id)
                        ? { backgroundColor: `${l.color}22`, color: l.color }
                        : undefined
                    }
                  >
                    <span
                      className="mr-2 inline-block size-2 rounded-full align-middle"
                      style={{ backgroundColor: l.color }}
                    />
                    {l.name}
                  </button>
                  <button
                    aria-label={`Rename ${l.name}`}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const name = window.prompt("Rename label", l.name);
                      if (name?.trim()) run("rename_label", { id: l.id, name: name.trim() });
                    }}
                  >
                    edit
                  </button>
                  <button
                    aria-label={`Delete ${l.name}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => run("delete_label", { id: l.id })}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                const name = window.prompt("New label name");
                if (!name?.trim()) return;
                const color = LABEL_COLORS[board.labels.length % LABEL_COLORS.length];
                run("create_label", { name: name.trim(), color });
              }}
            >
              <Plus className="size-4" /> New label
            </Button>
          </PopoverContent>
        </Popover>

        {isFiltering(filters) && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => setFilters(emptyFilters)}>
            <X className="size-4" /> Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-9" disabled={!canUndo} onClick={undo}>
            <Undo2 className="size-4" /><span className="sr-only">Undo</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-9" disabled={!canRedo} onClick={redo}>
            <Redo2 className="size-4" /><span className="sr-only">Redo</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-9" onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="size-4" /><span className="sr-only">Shortcuts</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-9" onClick={toggle}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-9" onClick={() => void reset()}>
            <RotateCcw className="size-4" /><span className="sr-only">Reset demo data</span>
          </Button>
          <Button size="sm" className="h-9" onClick={() => openNewCard()}>
            <Plus className="size-4" /> New card
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="scrollbar-slim min-w-0 flex-1 overflow-auto p-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading board…</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setActiveCard(null)}
            >
              <div className="min-w-max">
                <SortableContext
                  items={columns.map((c) => `column:${c.id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="sticky top-0 z-10 grid gap-3 bg-background/85 pb-3 backdrop-blur" style={gridStyle}>
                    {columns.map((column) => (
                      <ColumnHeader
                        key={column.id}
                        column={column}
                        count={board.cards.filter((c) => c.columnId === column.id).length}
                        run={run}
                        onAddCard={(columnId) => openNewCard(columnId)}
                      />
                    ))}
                  </div>
                </SortableContext>

                {visibleLanes.map((lane, laneIndex) => (
                  <section key={lane.id} className="mb-4 rounded-2xl bg-lane p-2">
                    <div className="mb-1 flex items-center gap-1 px-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {lane.name}
                      </h2>
                      <div className="ml-auto flex items-center gap-0.5">
                        <Button
                          size="icon" variant="ghost" className="size-6"
                          disabled={laneIndex === 0}
                          onClick={() => run("reorder_swimlane", { id: lane.id, toIndex: lane.position - 1 })}
                        >
                          <ChevronUp className="size-3.5" /><span className="sr-only">Move lane up</span>
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="size-6"
                          disabled={laneIndex === visibleLanes.length - 1}
                          onClick={() => run("reorder_swimlane", { id: lane.id, toIndex: lane.position + 1 })}
                        >
                          <ChevronDown className="size-3.5" /><span className="sr-only">Move lane down</span>
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="size-6"
                          onClick={() => {
                            const name = window.prompt("Rename swimlane", lane.name);
                            if (name?.trim()) run("rename_swimlane", { id: lane.id, name: name.trim() });
                          }}
                        >
                          <span className="text-[10px] font-medium">Aa</span>
                          <span className="sr-only">Rename lane</span>
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="size-6 text-muted-foreground hover:text-destructive"
                          onClick={() => run("delete_swimlane", { id: lane.id })}
                        >
                          <Trash2 className="size-3.5" /><span className="sr-only">Delete lane</span>
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3" style={gridStyle}>
                      {columns.map((column) => {
                        const cards = cardsInCell(board, lane.id, column.id, filters);
                        const total = board.cards.filter((c) => c.columnId === column.id).length;
                        const full = column.wipLimit != null && total > column.wipLimit;
                        return (
                          <Cell key={column.id} id={`cell:${lane.id}:${column.id}`} full={full}>
                            <SortableContext
                              items={cards.map((c) => c.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {cards.map((card) => (
                                <SortableCardTile
                                  key={card.id}
                                  card={card}
                                  labels={board.labels}
                                  onOpen={(c) =>
                                    setCardDialog({
                                      open: true,
                                      card: c,
                                      columnId: c.columnId,
                                      swimlaneId: c.swimlaneId,
                                    })
                                  }
                                />
                              ))}
                            </SortableContext>
                            {cards.length === 0 && (
                              <button
                                onClick={() => openNewCard(column.id, lane.id)}
                                className="flex-1 rounded-lg border border-dashed border-border/80 py-4 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                              >
                                {isFiltering(filters) ? "No matching cards" : "+ Add card"}
                              </button>
                            )}
                          </Cell>
                        );
                      })}
                    </div>
                  </section>
                ))}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addColumn}>
                    <Plus className="size-4" /> Add column
                  </Button>
                  <Button variant="outline" size="sm" onClick={addSwimlane}>
                    <Plus className="size-4" /> Add swimlane
                  </Button>
                </div>
              </div>

              <DragOverlay>
                {activeCard && (
                  <CardTile card={activeCard} labels={board.labels} onOpen={() => {}} overlay />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </main>

        <ActivityPanel entries={activity} />
      </div>

      <CardDialog
        open={cardDialog.open}
        onOpenChange={(open) => setCardDialog((s) => ({ ...s, open }))}
        board={board}
        card={cardDialog.card}
        defaults={{ columnId: cardDialog.columnId, swimlaneId: cardDialog.swimlaneId }}
        run={run}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
