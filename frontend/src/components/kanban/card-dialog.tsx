import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BoardState, Card, CommandType } from "@/lib/kanban/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: BoardState;
  card: Card | null;
  defaults: { columnId: string; swimlaneId: string };
  run: (type: CommandType, payload?: Record<string, unknown>) => void;
}

export function CardDialog({ open, onOpenChange, board, card, defaults, run }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [columnId, setColumnId] = useState(defaults.columnId);
  const [swimlaneId, setSwimlaneId] = useState(defaults.swimlaneId);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(card?.title ?? "");
    setDescription(card?.description ?? "");
    setDueDate(card?.dueDate ?? "");
    setColumnId(card?.columnId ?? defaults.columnId);
    setSwimlaneId(card?.swimlaneId ?? defaults.swimlaneId);
    setLabelIds(card?.labelIds ?? []);
  }, [open, card, defaults.columnId, defaults.swimlaneId]);

  const toggleLabel = (id: string) =>
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = () => {
    if (!title.trim()) return;
    if (card) {
      run("update_card", {
        id: card.id,
        changes: {
          title: title.trim(),
          description,
          dueDate: dueDate || null,
          labelIds,
        },
      });
      if (columnId !== card.columnId || swimlaneId !== card.swimlaneId) {
        run("move_card", { id: card.id, columnId, swimlaneId });
      }
    } else {
      run("create_card", {
        title: title.trim(),
        description,
        dueDate: dueDate || null,
        labelIds,
        columnId,
        swimlaneId,
      });
    }
    onOpenChange(false);
  };

  const remove = () => {
    if (card) run("delete_card", { id: card.id });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{card ? "Edit card" : "New card"}</DialogTitle>
          <DialogDescription>
            {card ? "Update the details of this work item." : "Add a work item to the board."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="card-title">Title</FieldLabel>
            <Input
              id="card-title"
              autoFocus
              value={title}
              placeholder="What needs doing?"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="card-desc">Description</FieldLabel>
            <Textarea
              id="card-desc"
              rows={4}
              value={description}
              placeholder="Notes, acceptance criteria, links…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel>Column</FieldLabel>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {board.columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Swimlane</FieldLabel>
              <Select value={swimlaneId} onValueChange={setSwimlaneId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {board.swimlanes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="card-due">Due date</FieldLabel>
              <Input
                id="card-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Labels</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {board.labels.map((l) => {
                const active = labelIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      active ? "border-transparent" : "border-border text-muted-foreground",
                    )}
                    style={
                      active ? { backgroundColor: `${l.color}22`, color: l.color } : undefined
                    }
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {card ? (
            <Button variant="ghost" onClick={remove} className="text-destructive">
              <Trash2 className="size-4" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={!title.trim()}>
              {card ? "Save changes" : "Create card"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
