import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: [string, string][] = [
  ["C", "New card"],
  ["/", "Focus search"],
  ["Ctrl / ⌘ + Z", "Undo"],
  ["Ctrl / ⌘ + Shift + Z", "Redo"],
  ["Ctrl / ⌘ + Enter", "Save card while editing"],
  ["?", "Show this help"],
  ["Esc", "Close dialogs"],
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work the board without reaching for the mouse.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border">
          {SHORTCUTS.map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between py-2">
              <dt className="text-sm text-muted-foreground">{desc}</dt>
              <dd>
                <kbd className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
