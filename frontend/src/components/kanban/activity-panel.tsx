import { cn } from "@/lib/utils";
import type { ActivityLogEntry } from "@/lib/kanban/types";

const dot: Record<string, string> = {
  created: "bg-success",
  updated: "bg-primary",
  moved: "bg-accent",
  deleted: "bg-destructive",
  "label-added": "bg-chart-5",
  "label-removed": "bg-chart-5",
  undo: "bg-muted-foreground",
  redo: "bg-muted-foreground",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ActivityPanel({ entries }: { entries: ActivityLogEntry[] }) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-sidebar xl:flex">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Activity</h2>
        <p className="text-xs text-muted-foreground">Every board mutation, newest first</p>
      </div>
      <ol className="scrollbar-slim flex-1 overflow-y-auto px-4 py-3">
        {entries.length === 0 && (
          <li className="text-xs text-muted-foreground">Nothing recorded yet.</li>
        )}
        {entries.map((e) => (
          <li key={e.id} className="flex gap-2.5 py-2">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot[e.action])} />
            <div className="min-w-0">
              <p className="text-xs leading-snug text-foreground">{e.summary}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(e.createdAt)}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
