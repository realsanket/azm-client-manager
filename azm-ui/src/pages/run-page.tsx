import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { hueForClient } from "@/lib/client-hue";
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
  const hue = selectedClient ? hueForClient(selectedClient.name) : "#888";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow">read-only query</span>
          <h2
            className="mt-1 text-2xl font-serif tracking-tight flex items-baseline gap-2 min-w-0"
            style={{ fontVariationSettings: '"opsz" 48, "SOFT" 40' }}
          >
            <span
              className="shrink-0 text-lg leading-none translate-y-[-1px]"
              style={{ color: hue }}
              aria-hidden
            >
              ▸
            </span>
            <span className="font-mono text-lg text-foreground truncate">
              {selectedClient ? `azm run ${selectedClient.name}` : "azm run"}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span>{clients.length} clients</span>
          <span className="text-border">│</span>
          <span className="text-foreground/80">{presetName}</span>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">command</span>
          <span className="font-mono text-[10px] text-muted-foreground/70">
            press ⌘↵ to run
          </span>
        </div>
        <Textarea
          disabled={!selectedClient || busy}
          value={command}
          onChange={(event) => onCommandChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onRun();
            }
          }}
          placeholder="az group list --query [].{name:name,location:location} -o json"
          spellCheck={false}
          rows={4}
          className="font-mono text-sm resize-y min-h-24 border-border rounded-sm"
        />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Read-only. Destructive verbs (
          <code className="font-mono text-foreground/80">
            create · delete · update · deploy · assign …
          </code>
          ) blocked server-side.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <span className="eyebrow">recipes</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {recipes.length} available
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe, i) => (
            <button
              key={`${recipe.label}::${recipe.command}`}
              type="button"
              onClick={() => onRecipe(recipe.command)}
              disabled={busy}
              className={cn(
                "text-left px-3 py-2.5 cursor-pointer group border-border/70",
                "border-t border-l",
                i % 3 === 2 && "lg:border-r",
                "sm:[&:nth-child(2n)]:border-r lg:sm:[&:nth-child(2n)]:border-r-0",
                i === recipes.length - 1 && "border-r border-b",
                "hover:bg-accent/60 transition-colors duration-150",
                "focus-visible:outline-none focus-visible:bg-accent",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <span className="block text-sm font-medium text-foreground mb-0.5 leading-tight">
                {recipe.label}
              </span>
              <code className="block text-[11px] font-mono text-muted-foreground truncate">
                {recipe.command}
              </code>
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <Button
          size="lg"
          onClick={onRun}
          disabled={!selectedClient || !command.trim() || busy}
          className="cursor-pointer font-mono rounded-sm gap-2 min-w-32"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <span className="text-base leading-none" style={{ color: hue }}>
              ▸
            </span>
          )}
          {busy ? "running" : "run"}
        </Button>
        {!selectedClient ? (
          <span className="text-xs text-muted-foreground font-mono">
            select a client first
          </span>
        ) : null}
      </div>
    </div>
  );
}
