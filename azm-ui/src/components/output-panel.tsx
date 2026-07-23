import { Eraser, Loader2 } from "lucide-react";
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
    <aside className="flex flex-col h-full min-h-0 border-l border-border/70 bg-background">
      <header className="flex items-end justify-between px-4 py-3 border-b border-border/70 sticky top-0 bg-background/85 backdrop-blur z-10">
        <div className="min-w-0">
          <span className="eyebrow">output</span>
          <h2
            className="mt-0.5 font-serif text-lg tracking-tight leading-tight"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 40' }}
          >
            {busy ? "running" : "results"}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={outputs.length === 0}
          onClick={onClear}
          className="cursor-pointer font-mono text-[11px] h-7 gap-1"
        >
          <Eraser className="size-3.5" />
          clear
        </Button>
      </header>

      {busy ? (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/70 bg-muted/40 text-xs font-mono text-muted-foreground">
          <Loader2 className="size-3 animate-spin text-foreground" />
          <span className="truncate">{busy}</span>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {outputs.length === 0 ? (
          <div className="h-full min-h-40 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-[11px]">(no output yet)</span>
            <span className="max-w-56 text-center leading-relaxed">
              Pick a client. Type an <code className="font-mono">az</code>{" "}
              command. Read the result.
            </span>
          </div>
        ) : null}
        {outputs.map((entry) => (
          <OutputEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </aside>
  );
}
