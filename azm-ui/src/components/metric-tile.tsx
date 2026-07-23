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
    <div className="flex items-baseline gap-1.5 font-mono">
      <span className="text-[10px] tracking-wider uppercase text-muted-foreground/80 leading-none">
        {label}
      </span>
      <span className="flex-1 border-b border-dashed border-border/60 translate-y-[-2px]" />
      <span
        className={cn(
          "tabular-nums font-semibold text-sm leading-none text-foreground",
          tone === "danger" && value > 0 && "text-destructive",
          tone === "success" && value > 0 && "text-success"
        )}
      >
        {value}
      </span>
    </div>
  );
}
