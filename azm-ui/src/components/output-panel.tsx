import { Terminal, Eraser, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OutputEntryCard, type OutputEntry } from "@/components/output-entry";

export function OutputPanel({
  busy,
  outputs,
  onClear,
}: {
  busy: string | null;
  outputs: OutputEntry[];
  onClear: () => void;
}) {
  return (
    <aside className="flex flex-col h-full min-h-0 border-l bg-card/20">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-background/70 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="size-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block leading-tight">
              Output
            </span>
            <h2 className="text-sm font-semibold leading-tight">
              {busy ? "Running…" : "Results"}
            </h2>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={outputs.length === 0}
          onClick={onClear}
          className="cursor-pointer"
        >
          <Eraser className="size-3.5" />
          Clear
        </Button>
      </header>

      {busy ? (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-mono text-muted-foreground">
          <Loader2 className="size-3 animate-spin text-foreground" />
          <span className="truncate">{busy}</span>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {outputs.length === 0 ? (
          <div className="h-full min-h-40 flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
            No command output yet
          </div>
        ) : null}
        {outputs.map((entry) => (
          <OutputEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </aside>
  );
}
