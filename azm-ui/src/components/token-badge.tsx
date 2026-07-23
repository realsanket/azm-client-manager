import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TokenState } from "@/lib/azm-format";

const styles: Record<TokenState, string> = {
  valid:
    "bg-foreground/5 text-foreground border border-foreground/15",
  expired:
    "bg-destructive/10 text-destructive border border-destructive/25",
  cached:
    "bg-foreground/5 text-foreground border border-foreground/15",
  missing:
    "bg-muted text-muted-foreground border border-border",
};

const labels: Record<TokenState, string> = {
  valid: "Valid",
  expired: "Expired",
  cached: "Cached",
  missing: "Missing",
};

export function TokenBadge({
  state,
  className,
}: {
  state: TokenState;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px] uppercase tracking-wider rounded-sm px-1.5 py-0",
        styles[state],
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full mr-1",
          state === "valid" && "bg-success",
          state === "expired" && "bg-destructive",
          state === "cached" && "bg-warning",
          state === "missing" && "bg-muted-foreground/60"
        )}
      />
      {labels[state]}
    </Badge>
  );
}
