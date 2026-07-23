import { useEffect } from "react";
import {
  Users,
  Play,
  LayoutDashboard,
  Wrench,
  Sun,
  Moon,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { AzmClient, TeamRecipe } from "@/hooks/useAzm";

export type PaletteView = "run" | "client" | "management";

export function CommandPalette({
  clients,
  open,
  recipes,
  theme,
  onOpenChange,
  onSelectClient,
  onSelectView,
  onInsertRecipe,
  onAddClient,
  onOpenPresets,
  onToggleTheme,
}: {
  clients: AzmClient[];
  open: boolean;
  recipes: TeamRecipe[];
  theme: "dark" | "light";
  onOpenChange: (open: boolean) => void;
  onSelectClient: (name: string) => void;
  onSelectView: (view: PaletteView) => void;
  onInsertRecipe: (command: string) => void;
  onAddClient: () => void;
  onOpenPresets: () => void;
  onToggleTheme: () => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const runAndClose = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump between clients, tabs, and recipes"
    >
      <CommandInput placeholder="Search clients, tabs, recipes…" />
      <CommandList>
        <CommandEmpty>No matches</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => runAndClose(() => onSelectView("run"))}>
            <Play className="size-4" />
            <span>Run</span>
            <CommandShortcut>go</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runAndClose(() => onSelectView("client"))}
          >
            <LayoutDashboard className="size-4" />
            <span>Client</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runAndClose(() => onSelectView("management"))}
          >
            <Wrench className="size-4" />
            <span>Management</span>
          </CommandItem>
        </CommandGroup>

        {clients.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch client">
              {clients.map((client) => (
                <CommandItem
                  key={client.name}
                  value={`client ${client.name} ${client.tenant} ${client.email}`}
                  onSelect={() =>
                    runAndClose(() => onSelectClient(client.name))
                  }
                >
                  <Users className="size-4" />
                  <span>{client.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground truncate max-w-40">
                    {client.tenant}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {recipes.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Insert recipe">
              {recipes.map((recipe) => (
                <CommandItem
                  key={`${recipe.label}::${recipe.command}`}
                  value={`recipe ${recipe.label} ${recipe.command}`}
                  onSelect={() =>
                    runAndClose(() => onInsertRecipe(recipe.command))
                  }
                >
                  <Sparkles className="size-4" />
                  <span>{recipe.label}</span>
                  <span className="ml-auto text-[11px] font-mono text-muted-foreground truncate max-w-56">
                    {recipe.command}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runAndClose(onAddClient)}>
            <Plus className="size-4" />
            <span>Add client</span>
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(onOpenPresets)}>
            <Settings2 className="size-4" />
            <span>Team preset settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(onToggleTheme)}>
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
            <span>
              Switch to {theme === "dark" ? "light" : "dark"} theme
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
