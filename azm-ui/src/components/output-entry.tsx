import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        "rounded-md border bg-card overflow-hidden",
        ok ? "border-border" : "border-destructive/40"
      )}
    >
      <header className="flex items-start justify-between gap-3 px-3 py-2 border-b bg-muted/30">
        <div className="min-w-0 flex-1">
          <strong className="block text-xs font-medium truncate">
            {entry.title}
          </strong>
          <code className="block text-[11px] text-muted-foreground truncate font-mono">
            {entry.command}
          </code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            {entry.createdAt.toLocaleTimeString("en", { hour12: false })}
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={copy}
            aria-label="Copy output"
            className="cursor-pointer"
          >
            {copied ? (
              <Check className="size-3 text-success" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-2 flex-wrap px-3 py-1.5 text-[11px] text-muted-foreground border-b">
        <Badge
          variant="outline"
          className={cn(
            "font-mono text-[10px] rounded-sm px-1.5",
            ok
              ? "bg-success/10 text-success border-success/30"
              : "bg-destructive/10 text-destructive border-destructive/30"
          )}
        >
          exit {entry.exitCode}
        </Badge>
        {parsed.running ? <span className="truncate">{parsed.running}</span> : null}
        {outputLines ? <span>{outputLines} lines</span> : null}
        {stderrLines ? <span>{stderrLines} stderr</span> : null}
      </div>

      {parsed.metadata.length ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-3 py-2 border-b bg-muted/20 text-[11px]">
          {parsed.metadata.map((item) => (
            <div key={item.label} className="min-w-0">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px] block">
                {item.label}
              </span>
              <strong className="font-mono block truncate">{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {visibleOutput.trim() ? (
        <pre className="px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre max-h-96">
          {visibleOutput.trim()}
        </pre>
      ) : null}
      {entry.stderr.trim() ? (
        <pre className="px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre max-h-64 text-destructive bg-destructive/5 border-t">
          {entry.stderr.trim()}
        </pre>
      ) : null}
      {!visibleOutput.trim() && !entry.stderr.trim() ? (
        <pre className="px-3 py-2 text-xs font-mono text-muted-foreground italic">
          (no output)
        </pre>
      ) : null}
    </article>
  );
}
