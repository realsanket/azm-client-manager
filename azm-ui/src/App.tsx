import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelLeft } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AppSidebar } from "@/components/app-sidebar";
import { OutputPanel } from "@/components/output-panel";
import { AddClientDialog } from "@/components/add-client-dialog";
import { TeamPresetDialog } from "@/components/team-preset-dialog";
import {
  CommandPalette,
  type PaletteView,
} from "@/components/command-palette";
import { TokenBadge } from "@/components/token-badge";
import type { OutputEntry } from "@/components/output-entry";
import { RunPage } from "@/pages/run-page";
import { ClientPage } from "@/pages/client-page";
import { ManagementPage } from "@/pages/management-page";
import {
  useAzm,
  type CommandResult,
  type TeamPresetDefinition,
  type TeamRecipe,
} from "@/hooks/useAzm";
import { useTheme } from "@/hooks/useTheme";
import { isAzCommand, tokenState } from "@/lib/azm-format";

const defaultCommandRecipes: TeamRecipe[] = [
  { label: "Groups", command: "az group list -o table" },
  { label: "Account", command: "az account show -o table" },
  { label: "Virtual machines", command: "az vm list -o table" },
  { label: "VNets", command: "az network vnet list -o table" },
  { label: "Storage", command: "az storage account list -o table" },
  { label: "Subscriptions", command: "az account list -o table" },
];

const TEAM_PRESET_STORAGE_KEY = "azm.ui.teamPresetId";

const defaultTeamPreset: TeamPresetDefinition = {
  id: "general_team",
  name: "General Team",
  description: "Shared default read-only queries for all teams.",
  sourceFile: "general_team.yml",
  recipes: { command: defaultCommandRecipes },
};

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

function asOutput(error: unknown): CommandResult {
  return {
    stdout: "",
    stderr: error instanceof Error ? error.message : "Unknown error",
    exitCode: 1,
  };
}

function initialPresetIds() {
  if (typeof window === "undefined") return [defaultTeamPreset.id];
  const stored = window.localStorage.getItem(TEAM_PRESET_STORAGE_KEY)?.trim();
  if (!stored) return [defaultTeamPreset.id];
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (Array.isArray(parsed)) {
      const values = parsed
        .map((value) => String(value).trim())
        .filter(Boolean);
      return values.length ? Array.from(new Set(values)) : [defaultTeamPreset.id];
    }
  } catch {
    // legacy plain-text
  }
  return [stored];
}

let nextOutputId = 1;

type View = "run" | "client" | "management";

export default function App() {
  const {
    addClient,
    checkClient,
    checkExpired,
    clients,
    fetchClients,
    loading,
    log,
    loginAll,
    loginClient,
    loginExpired,
    removeClient,
    runCommand,
    listTeamPresets,
    setSubscription,
    status,
    switchClient,
    tokenStatus,
  } = useAzm();
  const { theme, toggleTheme } = useTheme();

  const [activeView, setActiveView] = useState<View>("run");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showPresetSettings, setShowPresetSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<OutputEntry[]>([]);
  const [teamPresets, setTeamPresets] = useState<TeamPresetDefinition[]>([
    defaultTeamPreset,
  ]);
  const [selectedPresetIds, setSelectedPresetIds] = useState(initialPresetIds);
  const [teamPresetDirectory, setTeamPresetDirectory] = useState("team-presets");
  const [teamPresetErrors, setTeamPresetErrors] = useState<string[]>([]);
  const [teamPresetLoadError, setTeamPresetLoadError] = useState<string | null>(
    null
  );
  const [runInput, setRunInput] = useState("az group list -o table");
  const [logLines, setLogLines] = useState(20);
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<
    Record<string, string>
  >({});

  const selectedClient = useMemo(
    () =>
      clients.find((c) => c.name === selectedName) ?? clients[0] ?? null,
    [clients, selectedName]
  );

  const subscriptionDraft = selectedClient
    ? subscriptionDrafts[selectedClient.name] ??
      selectedClient.subscription ??
      ""
    : "";

  const counts = useMemo(() => {
    const checked = Object.values(tokenStatus);
    return {
      clients: clients.length,
      cached: clients.filter((c) => c.logged_in).length,
      valid: checked.filter(Boolean).length,
      expired: checked.filter((v) => v === false).length,
    };
  }, [clients, tokenStatus]);

  useEffect(() => {
    void fetchClients().catch((err) => {
      console.error(err);
      toast.error("Failed to load clients");
    });
  }, [fetchClients]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const index = await listTeamPresets();
        if (cancelled) return;
        const presets = index.presets.length ? index.presets : [defaultTeamPreset];
        setTeamPresets(presets);
        setTeamPresetDirectory(index.directory);
        setTeamPresetErrors(index.errors);
        setTeamPresetLoadError(
          index.presets.length
            ? null
            : "No valid team preset YAML found. Using built-in default."
        );
        setSelectedPresetIds((current) => {
          const valid = current.filter((id) =>
            presets.some((preset) => preset.id === id)
          );
          return valid.length
            ? Array.from(new Set(valid))
            : [presets[0].id];
        });
      } catch (err) {
        if (cancelled) return;
        setTeamPresets([defaultTeamPreset]);
        setTeamPresetErrors([]);
        setTeamPresetLoadError(
          err instanceof Error ? err.message : "Failed to load team presets."
        );
        setSelectedPresetIds([defaultTeamPreset.id]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listTeamPresets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      TEAM_PRESET_STORAGE_KEY,
      JSON.stringify(selectedPresetIds)
    );
  }, [selectedPresetIds]);

  const selectedTeamPresets = useMemo(() => {
    const selected = teamPresets.filter((p) =>
      selectedPresetIds.includes(p.id)
    );
    if (selected.length) return selected;
    return [teamPresets[0] ?? defaultTeamPreset];
  }, [teamPresets, selectedPresetIds]);

  const presetLabel =
    selectedTeamPresets.length === 1
      ? selectedTeamPresets[0].name
      : `${selectedTeamPresets.length} groups`;

  const commandRecipes = useMemo(() => {
    const merged = mergeRecipes(
      selectedTeamPresets.flatMap((p) => p.recipes.command)
    );
    return merged.length ? merged : defaultCommandRecipes;
  }, [selectedTeamPresets]);

  const togglePresetSelection = (presetId: string) => {
    setSelectedPresetIds((current) => {
      if (current.includes(presetId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== presetId);
      }
      return [...current, presetId];
    });
  };

  const appendOutput = (
    title: string,
    command: string,
    result: CommandResult
  ) => {
    setOutputs((current) =>
      [
        {
          id: nextOutputId++,
          title,
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          createdAt: new Date(),
        },
        ...current,
      ].slice(0, 40)
    );
  };

  const execute = async (
    title: string,
    command: string,
    action: () => Promise<CommandResult>,
    toastOnFail = true
  ) => {
    if (busy) {
      toast.warning("Another azm command is still running");
      return asOutput(new Error("Another azm command is still running"));
    }
    setBusy(command);
    try {
      const result = await action();
      appendOutput(title, command, result);
      if (result.exitCode !== 0 && toastOnFail) {
        toast.error(`${title} failed (exit ${result.exitCode})`, {
          description: (result.stderr || result.stdout || "").split("\n")[0],
        });
      }
      return result;
    } catch (err) {
      const result = asOutput(err);
      appendOutput(title, command, result);
      if (toastOnFail) {
        toast.error(title, { description: result.stderr });
      }
      return result;
    } finally {
      setBusy(null);
    }
  };

  const refreshClients = () =>
    execute("List clients", "azm list --json", async () => {
      const data = await fetchClients();
      return { stdout: JSON.stringify(data, null, 2), stderr: "", exitCode: 0 };
    });

  const runSelected = async () => {
    if (!selectedClient) return;
    const input = runInput.trim();
    if (!input) return;
    if (!isAzCommand(input)) {
      const result = asOutput(
        new Error(
          "Command must start with 'az'. Only read-only Azure CLI commands are supported."
        )
      );
      appendOutput(
        "Run Azure query",
        `azm run ${selectedClient.name} ${input}`,
        result
      );
      toast.error("Invalid command", { description: result.stderr });
      return;
    }
    const result = await execute(
      "Run Azure query",
      `azm run ${selectedClient.name} ${input}`,
      () => runCommand(selectedClient.name, input)
    );
    if (result.exitCode === 0) {
      toast.success("Query succeeded", { description: `azm run ${selectedClient.name}` });
    }
  };

  const addNewClient = async (
    name: string,
    tenant: string,
    email: string,
    subscription?: string
  ) => {
    const result = await execute(
      "Add client",
      `azm add ${name} ${tenant} ${email}${subscription ? ` ${subscription}` : ""}`,
      () => addClient(name, tenant, email, subscription),
      false
    );
    if (result.exitCode === 0) {
      toast.success(`Registered ${name}`);
      setSelectedName(name);
    } else {
      toast.error("Failed to add client", {
        description: (result.stderr || result.stdout || "").split("\n")[0],
      });
    }
    return result;
  };

  const currentToken = selectedClient
    ? tokenStatus[selectedClient.name]
    : undefined;

  return (
    <SidebarProvider>
      <AppSidebar
        busy={!!busy}
        clients={clients}
        counts={counts}
        loading={loading}
        selectedName={selectedClient?.name ?? null}
        tokenStatus={tokenStatus}
        onAdd={() => setShowAddClient(true)}
        onOpenPresets={() => setShowPresetSettings(true)}
        onOpenPalette={() => setShowPalette(true)}
        onRefresh={refreshClients}
        onCheckTokens={() =>
          void execute("Check expired tokens", "azm check-expired", async () => {
            const data = await checkExpired();
            return data.result;
          })
        }
        onSelect={(name) => {
          setSelectedName(name);
          setActiveView("run");
        }}
      />

      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6 bg-background/80 backdrop-blur sticky top-0 z-30">
          <SidebarTrigger className="cursor-pointer" aria-label="Toggle sidebar">
            <PanelLeft className="size-4" />
          </SidebarTrigger>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
              Active
            </span>
            <span className="font-mono font-semibold truncate">
              {selectedClient ? selectedClient.name : "No client selected"}
            </span>
            {selectedClient ? (
              <TokenBadge state={tokenState(selectedClient, currentToken)} />
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowPalette(true)}
            className="hidden sm:inline-flex items-center gap-2 rounded-md border bg-muted/40 hover:bg-muted transition-colors px-2.5 py-1 text-xs text-muted-foreground cursor-pointer"
          >
            <span>Search…</span>
            <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border bg-background px-1 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_min(28rem,40%)] flex-1 min-h-0">
          <main className="min-w-0 min-h-0 overflow-y-auto">
            <div className="p-4 md:p-8 max-w-5xl">
              <Tabs
                value={activeView}
                onValueChange={(v) => setActiveView(v as View)}
              >
                <TabsList className="mb-6">
                  <TabsTrigger value="run" className="cursor-pointer">
                    Run
                  </TabsTrigger>
                  <TabsTrigger value="client" className="cursor-pointer">
                    Client
                  </TabsTrigger>
                  <TabsTrigger value="management" className="cursor-pointer">
                    Management
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="run">
                  <RunPage
                    busy={!!busy}
                    clients={clients}
                    command={runInput}
                    presetName={presetLabel}
                    recipes={commandRecipes}
                    selectedClient={selectedClient}
                    onCommandChange={setRunInput}
                    onRecipe={setRunInput}
                    onRun={runSelected}
                  />
                </TabsContent>

                <TabsContent value="client">
                  <ClientPage
                    busy={!!busy}
                    client={selectedClient}
                    currentToken={currentToken}
                    logLines={logLines}
                    subscriptionDraft={subscriptionDraft}
                    onCheck={(client) =>
                      void execute(
                        "Check client",
                        `azm check ${client.name}`,
                        async () => {
                          const data = await checkClient(client.name);
                          return data.result;
                        }
                      )
                    }
                    onLogin={(client) =>
                      void execute(
                        "Login client",
                        `azm login ${client.name}`,
                        () => loginClient(client.name)
                      )
                    }
                    onLog={(client) =>
                      void execute(
                        "Client log",
                        `azm log ${client.name} ${logLines}`,
                        () => log(client.name, logLines)
                      )
                    }
                    onRemove={(client) => {
                      if (!window.confirm(`Remove ${client.name}?`)) return;
                      void execute(
                        "Remove client",
                        `azm remove ${client.name}`,
                        () => removeClient(client.name),
                        false
                      ).then((r) => {
                        if (r.exitCode === 0) {
                          toast.success(`Removed ${client.name}`);
                          setSelectedName(null);
                        }
                      });
                    }}
                    onSetLogLines={setLogLines}
                    onSetSubscription={(client) =>
                      void execute(
                        "Set subscription",
                        `azm set-sub ${client.name} ${subscriptionDraft}`,
                        () => setSubscription(client.name, subscriptionDraft)
                      )
                    }
                    onStatus={(client) =>
                      void execute(
                        "Client status",
                        `azm status ${client.name}`,
                        () => status(client.name)
                      )
                    }
                    onSubscriptionDraftChange={(value) => {
                      if (!selectedClient) return;
                      setSubscriptionDrafts((current) => ({
                        ...current,
                        [selectedClient.name]: value,
                      }));
                    }}
                    onSwitch={(client) =>
                      void execute(
                        "Switch client",
                        `azm switch ${client.name}`,
                        () => switchClient(client.name)
                      )
                    }
                  />
                </TabsContent>

                <TabsContent value="management">
                  <ManagementPage
                    busy={!!busy}
                    onCheckExpired={() =>
                      void execute(
                        "Check expired tokens",
                        "azm check-expired",
                        async () => {
                          const data = await checkExpired();
                          return data.result;
                        }
                      )
                    }
                    onLoginAll={() =>
                      void execute("Login all clients", "azm login-all", () =>
                        loginAll()
                      )
                    }
                    onLoginExpired={() =>
                      void execute(
                        "Login expired clients",
                        "azm login-expired",
                        () => loginExpired()
                      )
                    }
                  />
                </TabsContent>
              </Tabs>
            </div>
          </main>

          <div className="hidden lg:block min-h-0">
            <OutputPanel
              busy={busy}
              outputs={outputs}
              onClear={() => setOutputs([])}
            />
          </div>

          <div className="lg:hidden border-t max-h-[50vh] overflow-hidden">
            <OutputPanel
              busy={busy}
              outputs={outputs}
              onClear={() => setOutputs([])}
            />
          </div>
        </div>
      </SidebarInset>

      <AddClientDialog
        busy={!!busy}
        open={showAddClient}
        onAdd={addNewClient}
        onOpenChange={setShowAddClient}
      />

      <TeamPresetDialog
        directory={teamPresetDirectory}
        errors={teamPresetErrors}
        loadError={teamPresetLoadError}
        open={showPresetSettings}
        presets={teamPresets}
        selectedPresetIds={selectedTeamPresets.map((p) => p.id)}
        onOpenChange={setShowPresetSettings}
        onTogglePreset={togglePresetSelection}
      />

      <CommandPalette
        clients={clients}
        open={showPalette}
        recipes={commandRecipes}
        theme={theme}
        onOpenChange={setShowPalette}
        onSelectClient={(name) => {
          setSelectedName(name);
          setActiveView("run");
        }}
        onSelectView={(view: PaletteView) => setActiveView(view as View)}
        onInsertRecipe={(cmd) => {
          setRunInput(cmd);
          setActiveView("run");
        }}
        onAddClient={() => setShowAddClient(true)}
        onOpenPresets={() => setShowPresetSettings(true)}
        onToggleTheme={toggleTheme}
      />
    </SidebarProvider>
  );
}
