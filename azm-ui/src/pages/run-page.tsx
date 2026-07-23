import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AzmClient, TeamRecipe } from "@/hooks/useAzm";

export function RunPage({
  busy,
  clients,
  command,
  presetName,
  recipes,
  selectedClient,
  onCommandChange,
  onRecipe,
  onRun,
}: {
  busy: boolean;
  clients: AzmClient[];
  command: string;
  presetName: string;
  recipes: TeamRecipe[];
  selectedClient: AzmClient | null;
  onCommandChange: (command: string) => void;
  onRecipe: (command: string) => void;
  onRun: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Read-only query
          </span>
          <h2 className="text-lg font-semibold font-mono">
            {selectedClient
              ? `azm run ${selectedClient.name}`
              : "azm run"}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-mono">{clients.length} clients</span>
          <span aria-hidden>·</span>
          <span className="font-medium text-foreground">{presetName}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="run-command" className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Command
        </Label>
        <Textarea
          id="run-command"
          disabled={!selectedClient || busy}
          value={command}
          onChange={(event) => onCommandChange(event.target.value)}
          placeholder="az group list --query [].{name:name,location:location} -o json"
          spellCheck={false}
          rows={4}
          className="font-mono text-sm resize-y min-h-24"
        />
        <p className="text-[11px] text-muted-foreground">
          Read-only Azure CLI only. Start with{" "}
          <code className="font-mono text-foreground">az</code>. Destructive verbs
          (<code className="font-mono">create/delete/update/…</code>) are blocked
          server-side.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Recipes
          </span>
          <span className="text-[11px] text-muted-foreground">
            {recipes.length} available
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {recipes.map((recipe) => (
            <button
              key={`${recipe.label}::${recipe.command}`}
              type="button"
              onClick={() => onRecipe(recipe.command)}
              disabled={busy}
              className={cn(
                "text-left rounded-md border bg-card px-3 py-2 cursor-pointer",
                "transition-colors duration-150 hover:border-foreground/40 hover:bg-accent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <span className="block text-xs font-medium mb-0.5">
                {recipe.label}
              </span>
              <code className="block text-[11px] font-mono text-muted-foreground truncate">
                {recipe.command}
              </code>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 sticky bottom-0 py-2 bg-background/85 backdrop-blur border-t -mx-6 px-6 sm:-mx-8 sm:px-8">
        <Button
          size="lg"
          onClick={onRun}
          disabled={!selectedClient || !command.trim() || busy}
          className="cursor-pointer min-w-32"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          {busy ? "Running…" : "Run"}
        </Button>
        {!selectedClient ? (
          <span className="text-xs text-muted-foreground">
            Select a client to run
          </span>
        ) : null}
      </div>
    </div>
  );
}
