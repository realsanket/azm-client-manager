import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  return (
    <div className="flex items-baseline gap-1.5 py-1 font-mono text-xs">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
        {label}
      </span>
      <span className="text-muted-foreground/50 select-none">│</span>
      <span
        className={cn(
          "tabular-nums font-semibold text-foreground",
          tone === "danger" && value > 0 && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  );
}
