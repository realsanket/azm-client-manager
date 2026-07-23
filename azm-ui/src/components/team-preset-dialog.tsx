import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TeamPresetDefinition, TeamRecipe } from "@/hooks/useAzm";

function mergeRecipes(recipes: TeamRecipe[]) {
  const seen = new Set<string>();
  const merged: TeamRecipe[] = [];
  for (const recipe of recipes) {
    const label = recipe.label.trim();
    const command = recipe.command.trim();
    if (!label || !command) continue;
    const key = `${label.toLowerCase()}::${command.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ label, command });
  }
  return merged;
}

export function TeamPresetDialog({
  directory,
  errors,
  loadError,
  open,
  presets,
  selectedPresetIds,
  onOpenChange,
  onTogglePreset,
}: {
  directory: string;
  errors: string[];
  loadError: string | null;
  open: boolean;
  presets: TeamPresetDefinition[];
  selectedPresetIds: string[];
  onOpenChange: (open: boolean) => void;
  onTogglePreset: (id: string) => void;
}) {
  const visiblePresets = useMemo(
    () => presets.filter((p) => selectedPresetIds.includes(p.id)),
    [presets, selectedPresetIds]
  );
  const mergedCommandRecipes = useMemo(
    () => mergeRecipes(visiblePresets.flatMap((p) => p.recipes.command)),
    [visiblePresets]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            User settings
          </span>
          <DialogTitle>Team preset groups</DialogTitle>
          <DialogDescription>
            Toggle recipe groups loaded from{" "}
            <code className="font-mono text-foreground">{directory}</code>. At
            least one must remain selected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto -mx-1 px-1">
          {presets.map((preset) => {
            const selected = selectedPresetIds.includes(preset.id);
            const lockLast = selected && selectedPresetIds.length === 1;
            return (
              <Label
                key={preset.id}
                htmlFor={`preset-${preset.id}`}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                  selected
                    ? "bg-accent border-foreground/40"
                    : "hover:bg-accent/40",
                  lockLast && "cursor-not-allowed"
                )}
              >
                <Checkbox
                  id={`preset-${preset.id}`}
                  checked={selected}
                  disabled={lockLast}
                  onCheckedChange={() => onTogglePreset(preset.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{preset.name}</div>
                  <code className="block text-[11px] font-mono text-muted-foreground truncate">
                    {preset.sourceFile}
                  </code>
                  {preset.description ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {preset.description}
                    </p>
                  ) : null}
                </div>
              </Label>
            );
          })}
        </div>

        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Selected {visiblePresets.length}
              {visiblePresets.length === 1 ? " group" : " groups"}
            </span>
            <span className="font-mono tabular-nums">
              {mergedCommandRecipes.length} recipes
            </span>
          </div>
        </div>

        {loadError ? (
          <InlineWarning message={loadError} />
        ) : null}
        {errors.length > 0 ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 text-xs px-3 py-2 space-y-1">
            <div className="font-medium text-destructive">
              Some preset files could not be loaded:
            </div>
            <ul className="list-disc pl-4 font-mono">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineWarning({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 text-xs px-3 py-2">
      <AlertTriangle className="size-3.5 text-warning-foreground shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
