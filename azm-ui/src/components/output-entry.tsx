import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { lineCount, parseAzmOutput } from "@/lib/azm-format";

export interface OutputEntry {
  id: number;
  title: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  createdAt: Date;
}

function pad(value: string) {
  return value.padEnd(2, "0");
}

function fmtTime(d: Date) {
  return `${pad(String(d.getHours()))}:${pad(String(d.getMinutes()))}:${pad(String(d.getSeconds()))}`;
}

export function OutputEntryCard({ entry }: { entry: OutputEntry }) {
  const [copied, setCopied] = useState(false);
  const parsed = parseAzmOutput(entry.stdout);
  const visibleOutput = parsed.body;
  const outputLines = lineCount(visibleOutput);
  const stderrLines = lineCount(entry.stderr);
  const ok = entry.exitCode === 0;

  const copy = async () => {
    const payload = [entry.stdout, entry.stderr].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article
      className={cn(
        "rounded-sm border bg-card overflow-hidden",
        ok ? "border-border" : "border-destructive/40"
      )}
    >
      <header className="flex items-start justify-between gap-3 px-3 py-2 border-b border-border/60">
        <div className="min-w-0 flex-1">
          <div
            className="font-serif text-[15px] leading-tight tracking-tight text-foreground truncate"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 30' }}
          >
            {entry.title}
          </div>
          <code className="block text-[11px] text-muted-foreground truncate font-mono mt-0.5">
            {entry.command}
          </code>
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy output"
          className="shrink-0 size-6 grid place-items-center rounded-sm cursor-pointer hover:bg-accent transition-colors duration-150 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </button>
      </header>

      <div className="flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] text-muted-foreground border-b border-border/60">
        <span
          className={cn(
            "select-none",
            ok ? "text-foreground" : "text-destructive"
          )}
        >
          ─── exit {entry.exitCode}
        </span>
        {parsed.running ? (
          <>
            <span className="text-border">│</span>
            <span className="truncate">{parsed.running}</span>
          </>
        ) : null}
        {outputLines ? (
          <>
            <span className="text-border">│</span>
            <span>{outputLines} lines</span>
          </>
        ) : null}
        {stderrLines ? (
          <>
            <span className="text-border">│</span>
            <span className="text-destructive">{stderrLines} stderr</span>
          </>
        ) : null}
        <span className="ml-auto tabular-nums">{fmtTime(entry.createdAt)}</span>
      </div>

      {parsed.metadata.length ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 px-3 py-2 border-b border-border/60 text-[11px] font-mono">
          {parsed.metadata.map((item) => (
            <div key={item.label} className="min-w-0 flex items-baseline gap-1.5">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                {item.label}
              </span>
              <span className="text-border">│</span>
              <span className="truncate">{item.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {visibleOutput.trim() ? (
        <pre className="px-3 py-2 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre max-h-96 bg-card text-foreground">
          {visibleOutput.trim()}
        </pre>
      ) : null}
      {entry.stderr.trim() ? (
        <pre className="px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre max-h-64 text-destructive bg-destructive/5 border-t border-destructive/20">
          {entry.stderr.trim()}
        </pre>
      ) : null}
      {!visibleOutput.trim() && !entry.stderr.trim() ? (
        <pre className="px-3 py-2 text-xs font-mono text-muted-foreground/60">
          (no output)
        </pre>
      ) : null}
    </article>
  );
}
