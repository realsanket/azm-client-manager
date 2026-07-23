import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TokenState } from "@/lib/azm-format";

const styles: Record<TokenState, string> = {
  valid:
    "bg-success/15 text-success border border-success/30 hover:bg-success/20",
  expired:
    "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/20",
  cached:
    "bg-warning/15 text-warning-foreground border border-warning/30 hover:bg-warning/20 dark:text-warning",
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
