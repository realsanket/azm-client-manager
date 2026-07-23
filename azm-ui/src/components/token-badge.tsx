import { cn } from "@/lib/utils";
import type { TokenState } from "@/lib/azm-format";

const dot: Record<TokenState, string> = {
  valid: "bg-success",
  expired: "bg-destructive",
  cached: "bg-warning",
  missing: "bg-muted-foreground/40",
};

const labels: Record<TokenState, string> = {
  valid: "valid",
  expired: "expired",
  cached: "cached",
  missing: "missing",
};

export function TokenBadge({
  state,
  className,
}: {
  state: TokenState;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted-foreground",
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot[state])} />
      {labels[state]}
    </span>
  );
}
