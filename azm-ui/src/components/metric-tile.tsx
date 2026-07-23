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
    <div
      className={cn(
        "rounded-md border bg-card/40 px-2.5 py-2 flex flex-col gap-0.5"
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <strong
        className={cn(
          "text-lg font-mono font-semibold leading-none tabular-nums",
          tone === "success" && "text-success",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning-foreground"
        )}
      >
        {value}
      </strong>
    </div>
  );
}
