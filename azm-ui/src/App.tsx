import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  useAzm,
  type AzmClient,
  type CommandResult,
  type TeamPresetDefinition,
  type TeamRecipe,
} from "./hooks/useAzm";
import { useTheme } from "./hooks/useTheme";

type View = "run" | "client" | "management";
type OutputTone = "success" | "danger" | "neutral";

interface OutputEntry {
  id: number;
  title: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  createdAt: Date;
  tone: OutputTone;
}

interface ParsedOutput {
  body: string;
  metadata: Array<{ label: string; value: string }>;
  running?: string;
}

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
  recipes: {
    command: defaultCommandRecipes,
  },
};

const tabs: { key: View; label: string }[] = [
  { key: "run", label: "Run" },
  { key: "client", label: "Client" },
  { key: "management", label: "azm management" },
];

let nextOutputId = 1;

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
    // Backward compatibility: previous versions stored a single id as plain text.
  }

  return [stored];
}

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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function asOutput(error: unknown): CommandResult {
  return {
    stdout: "",
    stderr: error instanceof Error ? error.message : "Unknown error",
    exitCode: 1,
  };
}

function displayName(client: AzmClient) {
  return client.name.slice(0, 2).toUpperCase();
}

function tokenLabel(client: AzmClient, tokenValid: boolean | undefined) {
  if (tokenValid === true) return "Valid";
  if (tokenValid === false) return "Expired";
  if (client.logged_in) return "Cached";
  return "Missing";
}

function tokenTone(client: AzmClient, tokenValid: boolean | undefined) {
  if (tokenValid === true) return "valid";
  if (tokenValid === false) return "expired";
  if (client.logged_in) return "cached";
  return "missing";
}

function isRule(line: string) {
  return /^[\s─═-]{8,}$/.test(line.trim());
}

function parseAzmOutput(output: string): ParsedOutput {
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  const metadata: ParsedOutput["metadata"] = [];
  let cursor = 0;

  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;

  if (isRule(lines[cursor] ?? "")) {
    cursor += 1;
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (isRule(line)) {
        cursor += 1;
        break;
      }

      const match = line.match(/^\s*([A-Za-z]+)\s*:\s*(.*)$/);
      if (match) {
        metadata.push({ label: match[1], value: match[2] || "not set" });
      } else if (line.trim()) {
        break;
      }
      cursor += 1;
    }
  }

  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;

  let running: string | undefined;
  const runningMatch = lines[cursor]?.match(/^\s*▸\s*Running:\s*(.*)$/);
  if (runningMatch) {
    running = runningMatch[1];
    cursor += 1;
  }

  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;

  return {
    body: lines.slice(cursor).join("\n").trimEnd(),
    metadata,
    running,
  };
}

function lineCount(value: string) {
  if (!value.trim()) return 0;
  return value.trimEnd().split("\n").length;
}

function isAzCommand(value: string) {
  return /^az\s+/i.test(value.trim());
}

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
  const [busy, setBusy] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<OutputEntry[]>([]);
  const [teamPresets, setTeamPresets] = useState<TeamPresetDefinition[]>([defaultTeamPreset]);
  const [selectedPresetIds, setSelectedPresetIds] = useState(initialPresetIds);
  const [teamPresetDirectory, setTeamPresetDirectory] = useState("team-presets");
  const [teamPresetErrors, setTeamPresetErrors] = useState<string[]>([]);
  const [teamPresetLoadError, setTeamPresetLoadError] = useState<string | null>(null);
  const [runInput, setRunInput] = useState("az group list -o table");
  const [logLines, setLogLines] = useState(20);
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<Record<string, string>>({});

  const selectedClient = useMemo(
    () =>
      clients.find((client) => client.name === selectedName) ??
      clients[0] ??
      null,
    [clients, selectedName]
  );

  const subscriptionDraft = selectedClient
    ? subscriptionDrafts[selectedClient.name] ?? selectedClient.subscription ?? ""
    : "";

  const counts = useMemo(() => {
    const checked = Object.values(tokenStatus);
    return {
      clients: clients.length,
      cached: clients.filter((client) => client.logged_in).length,
      valid: checked.filter(Boolean).length,
      expired: checked.filter((value) => value === false).length,
    };
  }, [clients, tokenStatus]);

  useEffect(() => {
    void fetchClients().catch(console.error);
  }, [fetchClients]);

  useEffect(() => {
    let cancelled = false;

    const loadPresets = async () => {
      try {
        const index = await listTeamPresets();
        if (cancelled) return;

        const presets = index.presets.length ? index.presets : [defaultTeamPreset];
        setTeamPresets(presets);
        setTeamPresetDirectory(index.directory);
        setTeamPresetErrors(index.errors);
        setTeamPresetLoadError(
          index.presets.length ? null : "No valid team preset YAML found, using default preset."
        );
        setSelectedPresetIds((current) => {
          const valid = current.filter((id) => presets.some((preset) => preset.id === id));
          return valid.length ? Array.from(new Set(valid)) : [presets[0].id];
        });
      } catch (error) {
        if (cancelled) return;
        setTeamPresets([defaultTeamPreset]);
        setTeamPresetErrors([]);
        setTeamPresetLoadError(
          error instanceof Error ? error.message : "Failed to load team presets."
        );
        setSelectedPresetIds([defaultTeamPreset.id]);
      }
    };

    void loadPresets();

    return () => {
      cancelled = true;
    };
  }, [listTeamPresets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TEAM_PRESET_STORAGE_KEY, JSON.stringify(selectedPresetIds));
  }, [selectedPresetIds]);

  const selectedTeamPresets = useMemo(() => {
    const selected = teamPresets.filter((preset) => selectedPresetIds.includes(preset.id));
    if (selected.length) return selected;
    return [teamPresets[0] ?? defaultTeamPreset];
  }, [teamPresets, selectedPresetIds]);

  const selectedPresetLabel =
    selectedTeamPresets.length === 1
      ? selectedTeamPresets[0].name
      : `${selectedTeamPresets.length} groups`;

  const commandRecipes = useMemo(() => {
    const merged = mergeRecipes(selectedTeamPresets.flatMap((preset) => preset.recipes.command));
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
    const tone: OutputTone = result.exitCode === 0 ? "success" : "danger";
    setOutputs((current) => [
      {
        id: nextOutputId++,
        title,
        command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        createdAt: new Date(),
        tone,
      },
      ...current,
    ].slice(0, 40));
  };

  const execute = async (
    title: string,
    command: string,
    action: () => Promise<CommandResult>
  ) => {
    if (busy) return asOutput(new Error("Another azm command is still running"));

    setBusy(command);
    try {
      const result = await action();
      appendOutput(title, command, result);
      return result;
    } catch (error) {
      const result = asOutput(error);
      appendOutput(title, command, result);
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
      return;
    }

    await execute(
      "Run Azure query",
      `azm run ${selectedClient.name} ${input}`,
      () => runCommand(selectedClient.name, input)
    );
  };

  const clearResults = () => {
    setOutputs([]);
  };

  const addNewClient = (
    name: string,
    tenant: string,
    email: string,
    subscription?: string
  ) =>
    execute(
      "Add client",
      `azm add ${name} ${tenant} ${email}${subscription ? ` ${subscription}` : ""}`,
      () => addClient(name, tenant, email, subscription)
    );

  const currentToken = selectedClient
    ? tokenStatus[selectedClient.name]
    : undefined;

  return (
    <div className="azm-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">azm</div>
          <div className="brand-copy">
            <h1>Azure Multi-Client</h1>
            <span>Read-only Azure command console</span>
          </div>
        </div>

        <div className="metric-grid">
          <Metric label="Clients" value={counts.clients} />
          <Metric label="Cached" value={counts.cached} />
          <Metric label="Valid" value={counts.valid} />
          <Metric label="Expired" value={counts.expired} tone="danger" />
        </div>

        <div className="side-actions">
          <button className="azm-button" onClick={refreshClients} disabled={loading || !!busy}>
            Refresh
          </button>
          <button
            className="azm-button"
            onClick={() =>
              void execute("Check expired tokens", "azm check-expired", async () => {
                const data = await checkExpired();
                return data.result;
              })
            }
            disabled={!!busy}
          >
            Check tokens
          </button>
          <button className="azm-button primary" onClick={() => setShowAddClient(true)} disabled={!!busy}>
            Add
          </button>
        </div>

        <div className="client-list">
          {loading && clients.length === 0 ? (
            <div className="empty-block">Loading clients</div>
          ) : null}
          {!loading && clients.length === 0 ? (
            <div className="empty-block">No clients registered</div>
          ) : null}
          {clients.map((client) => {
            const tone = tokenTone(client, tokenStatus[client.name]);
            return (
              <button
                key={client.name}
                className={cx(
                  "client-row",
                  selectedClient?.name === client.name && "selected"
                )}
                onClick={() => {
                  setSelectedName(client.name);
                  setActiveView("run");
                }}
              >
                <span className="client-avatar">{displayName(client)}</span>
                <span className="client-main">
                  <span className="client-name">{client.name}</span>
                  <span className="client-tenant">{client.tenant}</span>
                </span>
                <span className={cx("token-pill", tone)}>
                  {tokenLabel(client, tokenStatus[client.name])}
                </span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <button
            className="azm-icon-button"
            onClick={() => setShowPresetSettings(true)}
            title="Team query settings"
            type="button"
          >
            Settings
          </button>
          <button className="azm-icon-button" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="selected-summary">
            <span className="eyebrow">Active client</span>
            <div className="selected-title">
              {selectedClient ? selectedClient.name : "No client selected"}
              {selectedClient ? (
                <span className={cx("status-dot", tokenTone(selectedClient, currentToken))} />
              ) : null}
            </div>
          </div>

          <nav className="tab-strip" aria-label="azm workspace">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={cx("tab-button", activeView === tab.key && "active")}
                onClick={() => setActiveView(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="workspace">
          <section className="workbench">
            {activeView === "client" ? (
              <ClientOverview
                busy={!!busy}
                client={selectedClient}
                currentToken={currentToken}
                logLines={logLines}
                onCheck={(client) =>
                  void execute("Check client", `azm check ${client.name}`, async () => {
                    const data = await checkClient(client.name);
                    return data.result;
                  })
                }
                onLogin={(client) =>
                  void execute("Login client", `azm login ${client.name}`, () =>
                    loginClient(client.name)
                  )
                }
                onLog={(client) =>
                  void execute("Client log", `azm log ${client.name} ${logLines}`, () =>
                    log(client.name, logLines)
                  )
                }
                onRemove={(client) => {
                  if (!window.confirm(`Remove ${client.name}?`)) return;
                  void execute("Remove client", `azm remove ${client.name}`, () =>
                    removeClient(client.name)
                  );
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
                  void execute("Client status", `azm status ${client.name}`, () =>
                    status(client.name)
                  )
                }
                onSwitch={(client) =>
                  void execute("Switch client", `azm switch ${client.name}`, () =>
                    switchClient(client.name)
                  )
                }
                subscriptionDraft={subscriptionDraft}
                tokenStatus={tokenStatus}
                onSubscriptionDraftChange={(value) => {
                  if (!selectedClient) return;
                  setSubscriptionDrafts((current) => ({
                    ...current,
                    [selectedClient.name]: value,
                  }));
                }}
              />
            ) : null}

            {activeView === "run" ? (
              <RunWorkbench
                busy={!!busy}
                clients={clients}
                command={runInput}
                recipes={commandRecipes}
                presetName={selectedPresetLabel}
                selectedClient={selectedClient}
                onCommandChange={setRunInput}
                onRecipe={setRunInput}
                onRun={runSelected}
              />
            ) : null}

            {activeView === "management" ? (
              <ManagementWorkbench
                busy={!!busy}
                onCheckExpired={() =>
                  void execute("Check expired tokens", "azm check-expired", async () => {
                    const data = await checkExpired();
                    return data.result;
                  })
                }
                onLoginAll={() =>
                  void execute("Login all clients", "azm login-all", () => loginAll())
                }
                onLoginExpired={() =>
                  void execute("Login expired clients", "azm login-expired", () =>
                    loginExpired()
                  )
                }
              />
            ) : null}
          </section>

          <OutputPanel
            busy={busy}
            outputs={outputs}
            onClear={clearResults}
          />
        </div>
      </main>

      <AddClientDialog
        busy={!!busy}
        open={showAddClient}
        onAdd={addNewClient}
        onClose={() => setShowAddClient(false)}
      />

      <TeamPresetDialog
        directory={teamPresetDirectory}
        errors={teamPresetErrors}
        loadError={teamPresetLoadError}
        onClose={() => setShowPresetSettings(false)}
        onTogglePreset={togglePresetSelection}
        open={showPresetSettings}
        presets={teamPresets}
        selectedPresetIds={selectedTeamPresets.map((preset) => preset.id)}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: OutputTone;
}) {
  return (
    <div className={cx("metric", tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ClientOverview({
  busy,
  client,
  currentToken,
  logLines,
  onCheck,
  onLogin,
  onLog,
  onRemove,
  onSetLogLines,
  onSetSubscription,
  onStatus,
  onSubscriptionDraftChange,
  onSwitch,
  subscriptionDraft,
  tokenStatus,
}: {
  busy: boolean;
  client: AzmClient | null;
  currentToken: boolean | undefined;
  logLines: number;
  onCheck: (client: AzmClient) => void;
  onLogin: (client: AzmClient) => void;
  onLog: (client: AzmClient) => void;
  onRemove: (client: AzmClient) => void;
  onSetLogLines: (value: number) => void;
  onSetSubscription: (client: AzmClient) => void;
  onStatus: (client: AzmClient) => void;
  onSubscriptionDraftChange: (value: string) => void;
  onSwitch: (client: AzmClient) => void;
  subscriptionDraft: string;
  tokenStatus: Record<string, boolean>;
}) {
  if (!client) {
    return <div className="empty-state">Select or add a client</div>;
  }

  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Client context</span>
          <h2>{client.name}</h2>
        </div>
        <span className={cx("token-pill", tokenTone(client, currentToken))}>
          {tokenLabel(client, tokenStatus[client.name])}
        </span>
      </div>

      <div className="detail-grid">
        <Detail label="Tenant" value={client.tenant} />
        <Detail label="Subscription" value={client.subscription || "Not set"} />
        <Detail label="Email" value={client.email} />
        <Detail label="Token cache" value={client.logged_in ? "Present" : "Missing"} />
      </div>

      <div className="control-grid">
        <button className="azm-button primary" onClick={() => onStatus(client)} disabled={busy}>
          Status
        </button>
        <button className="azm-button" onClick={() => onCheck(client)} disabled={busy}>
          Check token
        </button>
        <button className="azm-button" onClick={() => onLogin(client)} disabled={busy}>
          Login
        </button>
        <button className="azm-button" onClick={() => onSwitch(client)} disabled={busy}>
          Switch
        </button>
      </div>

      <div className="form-band">
        <label className="field">
          <span>Subscription ID</span>
          <input
            value={subscriptionDraft}
            onChange={(event) => onSubscriptionDraftChange(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <button
          className="azm-button primary"
          onClick={() => onSetSubscription(client)}
          disabled={busy || !subscriptionDraft.trim()}
        >
          Set subscription
        </button>
      </div>

      <div className="form-band">
        <label className="field compact">
          <span>Log lines</span>
          <input
            min={1}
            max={500}
            type="number"
            value={logLines}
            onChange={(event) => onSetLogLines(Number(event.target.value))}
          />
        </label>
        <button className="azm-button" onClick={() => onLog(client)} disabled={busy}>
          Show log
        </button>
        <button className="azm-button danger" onClick={() => onRemove(client)} disabled={busy}>
          Remove
        </button>
      </div>
    </div>
  );
}

function RunWorkbench({
  busy,
  clients,
  command,
  presetName,
  onCommandChange,
  onRecipe,
  onRun,
  recipes,
  selectedClient,
}: {
  busy: boolean;
  clients: AzmClient[];
  command: string;
  presetName: string;
  onCommandChange: (command: string) => void;
  onRecipe: (command: string) => void;
  onRun: () => void;
  recipes: TeamRecipe[];
  selectedClient: AzmClient | null;
}) {
  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Read-only query</span>
          <h2>{selectedClient ? `azm run ${selectedClient.name}` : "azm run"}</h2>
        </div>
        <span className="small-chip">{clients.length} clients | {presetName}</span>
      </div>

      <CommandTextarea
        command={command}
        disabled={!selectedClient || busy}
        onChange={onCommandChange}
        placeholder="az group list --query [].{name:name,location:location} -o json"
      />

      <div className="planner-card">
        <div>
          <span className="eyebrow">Direct command + azm</span>
          <strong>Run read-only Azure CLI command directly</strong>
          <p>
            Executes exactly the Azure CLI query you type through azm run. Start with az.
          </p>
        </div>
        <span className="small-chip">read-only</span>
      </div>

      <div className="recipe-grid">
        {recipes.map((recipe) => (
          <button
            className="recipe-button"
            key={recipe.label}
            onClick={() => onRecipe(recipe.command)}
            disabled={busy}
          >
            <span>{recipe.label}</span>
            <code>{recipe.command}</code>
          </button>
        ))}
      </div>

      <div className="action-row">
        <button
          className="azm-button primary wide"
          onClick={onRun}
          disabled={!selectedClient || !command.trim() || busy}
        >
          Run command
        </button>
      </div>
    </div>
  );
}

function ManagementWorkbench({
  busy,
  onCheckExpired,
  onLoginAll,
  onLoginExpired,
}: {
  busy: boolean;
  onCheckExpired: () => void;
  onLoginAll: () => void;
  onLoginExpired: () => void;
}) {
  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Common actions</span>
          <h2>azm management</h2>
        </div>
      </div>

      <div className="control-grid two">
        <button className="azm-button primary" onClick={onLoginExpired} disabled={busy}>
          Login expired
        </button>
        <button className="azm-button" onClick={onLoginAll} disabled={busy}>
          Login all
        </button>
        <button className="azm-button" onClick={onCheckExpired} disabled={busy}>
          Check expired
        </button>
      </div>
    </div>
  );
}

function CommandTextarea({
  command,
  disabled,
  onChange,
  placeholder,
}: {
  command: string;
  disabled: boolean;
  onChange: (command: string) => void;
  placeholder: string;
}) {
  return (
    <label className="command-box">
      <span>Command</span>
      <textarea
        disabled={disabled}
        value={command}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OutputPanel({
  busy,
  outputs,
  onClear,
}: {
  busy: string | null;
  outputs: OutputEntry[];
  onClear: () => void;
}) {
  return (
    <aside className="output-panel">
      <div className="output-header">
        <div>
          <span className="eyebrow">Command output</span>
          <h2>{busy ? "Running" : "Results"}</h2>
        </div>
        <div className="output-header-actions">
          <button
            className="azm-button"
            disabled={outputs.length === 0}
            onClick={onClear}
            type="button"
          >
            Clear
          </button>
          {busy ? <span className="busy-pill">active</span> : null}
        </div>
      </div>

      {busy ? (
        <div className="running-command">
          <span>{busy}</span>
        </div>
      ) : null}

      <div className="output-list">
        {outputs.length === 0 ? (
          <div className="empty-state small">No command output yet</div>
        ) : null}
        {outputs.map((entry) => {
          const parsed = parseAzmOutput(entry.stdout);
          const visibleOutput = parsed.body;
          const outputLines = lineCount(visibleOutput);
          const stderrLines = lineCount(entry.stderr);

          return (
            <article className="output-entry" data-tone={entry.tone} key={entry.id}>
              <header>
                <div>
                  <strong>{entry.title}</strong>
                  <code>{entry.command}</code>
                </div>
                <div className="output-actions">
                  <span>{entry.createdAt.toLocaleTimeString("en", { hour12: false })}</span>
                  <button
                    className="copy-button"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        [entry.stdout, entry.stderr].filter(Boolean).join("\n")
                      )
                    }
                    type="button"
                  >
                    Copy
                  </button>
                </div>
              </header>

              <div className="result-meta-row">
                <span className={cx("exit-badge", entry.exitCode === 0 ? "ok" : "fail")}>
                  exit {entry.exitCode}
                </span>
                {parsed.running ? <span>{parsed.running}</span> : null}
                {outputLines ? <span>{outputLines} lines</span> : null}
                {stderrLines ? <span>{stderrLines} stderr lines</span> : null}
              </div>

              {parsed.metadata.length ? (
                <div className="context-grid">
                  {parsed.metadata.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {visibleOutput.trim() ? (
                <div className="terminal-frame">
                  <pre>{visibleOutput.trim()}</pre>
                </div>
              ) : null}
              {entry.stderr.trim() ? (
                <div className="terminal-frame stderr">
                  <pre>{entry.stderr.trim()}</pre>
                </div>
              ) : null}
              {!visibleOutput.trim() && !entry.stderr.trim() ? (
                <div className="terminal-frame">
                  <pre>(no output)</pre>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function TeamPresetDialog({
  directory,
  errors,
  loadError,
  onClose,
  onTogglePreset,
  open,
  presets,
  selectedPresetIds,
}: {
  directory: string;
  errors: string[];
  loadError: string | null;
  onClose: () => void;
  onTogglePreset: (id: string) => void;
  open: boolean;
  presets: TeamPresetDefinition[];
  selectedPresetIds: string[];
}) {
  if (!open) return null;

  const selectedPresets = presets.filter((preset) => selectedPresetIds.includes(preset.id));
  const visiblePresets = selectedPresets.length
    ? selectedPresets
    : [presets[0] ?? defaultTeamPreset];
  const mergedCommandRecipes = mergeRecipes(
    visiblePresets.flatMap((preset) => preset.recipes.command)
  );

  return (
    <div className="modal-layer" onMouseDown={onClose}>
      <div className="modal team-settings-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">User settings</span>
            <h2>Team query preset</h2>
          </div>
          <button type="button" className="azm-icon-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div>
          <span className="eyebrow">Preset groups</span>
          <div className="preset-selection-list" role="group" aria-label="Preset groups">
            {presets.map((preset) => {
              const selected = selectedPresetIds.includes(preset.id);
              return (
                <label
                  className={cx("preset-option", selected && "active")}
                  key={preset.id}
                >
                  <input
                    checked={selected}
                    disabled={selected && selectedPresetIds.length === 1}
                    onChange={() => onTogglePreset(preset.id)}
                    type="checkbox"
                  />
                  <div>
                    <strong>{preset.name}</strong>
                    <span>{preset.sourceFile}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <span className="preset-selection-hint">
            Select one or more groups. At least one group must stay selected.
          </span>
        </div>

        <div className="preset-meta">
          <strong>Selected groups ({visiblePresets.length})</strong>
          <ul className="preset-selected-list">
            {visiblePresets.map((preset) => (
              <li key={preset.id}>
                <span>{preset.name}</span>
                {preset.description ? <small>{preset.description}</small> : null}
              </li>
            ))}
          </ul>
          <span>Loaded from {directory}</span>
        </div>

        <div className="detail-grid">
          <Detail label="Command recipes" value={String(mergedCommandRecipes.length)} />
        </div>

        {loadError ? <div className="inline-error">{loadError}</div> : null}

        {errors.length > 0 ? (
          <div className="inline-error">
            <strong>Some preset files could not be loaded:</strong>
            <ul className="preset-error-list">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="azm-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function AddClientDialog({
  busy,
  onAdd,
  onClose,
  open,
}: {
  busy: boolean;
  onAdd: (
    name: string,
    tenant: string,
    email: string,
    subscription?: string
  ) => Promise<CommandResult>;
  onClose: () => void;
  open: boolean;
}) {
  const [name, setName] = useState("");
  const [tenant, setTenant] = useState("");
  const [email, setEmail] = useState("");
  const [subscription, setSubscriptionValue] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const result = await onAdd(name, tenant, email, subscription || undefined);
    if (result.exitCode === 0) {
      setName("");
      setTenant("");
      setEmail("");
      setSubscriptionValue("");
      onClose();
    } else {
      setError((result.stderr || result.stdout || "Failed to add client").trim());
    }
  };

  return (
    <div className="modal-layer" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">azm add</span>
            <h2>Add client</h2>
          </div>
          <button type="button" className="azm-icon-button" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="field">
          <span>Name</span>
          <input
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="client-name"
          />
        </label>
        <label className="field">
          <span>Tenant</span>
          <input
            required
            value={tenant}
            onChange={(event) => setTenant(event.target.value)}
            placeholder="tenant.onmicrosoft.com"
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@company.com"
          />
        </label>
        <label className="field">
          <span>Subscription</span>
          <input
            value={subscription}
            onChange={(event) => setSubscriptionValue(event.target.value)}
            placeholder="optional"
          />
        </label>

        {error ? <div className="inline-error">{error}</div> : null}

        <div className="modal-actions">
          <button type="button" className="azm-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="azm-button primary"
            disabled={busy || !name || !tenant || !email}
          >
            Add client
          </button>
        </div>
      </form>
    </div>
  );
}
