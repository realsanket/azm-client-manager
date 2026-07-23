import { execFile, spawn } from "node:child_process";

export interface AzmClient {
  name: string;
  tenant: string;
  subscription: string;
  email: string;
  logged_in: boolean;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CheckExpiredResult {
  valid: string[];
  expired: string[];
  result: CommandResult;
}

const AZM_BIN = process.env.AZM_BIN || "azm";
const MAX_BUFFER = 10 * 1024 * 1024;
const ALLOWED_AZ_ACTIONS = new Set([
  "list",
  "show",
  "get",
  "export",
  "check",
  "query",
  "exists",
]);
const BLOCKED_AZ_ACTIONS = new Set([
  "create",
  "delete",
  "update",
  "set",
  "start",
  "stop",
  "restart",
  "redeploy",
  "deallocate",
  "remove",
  "add",
  "deploy",
  "assign",
  "revoke",
  "regenerate",
  "reset",
  "move",
  "swap",
  "resize",
  "scale",
  "import",
  "attach",
  "detach",
  "enable",
  "disable",
  "cancel",
  "invoke",
  "apply",
  "restore",
  "failover",
  "migrate",
  "purge",
  "write",
  "put",
  "patch",
  "open",
  "close",
  "upload",
  "download",
  "logout",
]);

function exitCodeFrom(error: { code?: string | number | null } | null): number {
  if (!error) return 0;
  const code = error.code;
  return typeof code === "number" ? code : 1;
}

function azm(args: string[], timeout = 120000): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      AZM_BIN,
      args,
      { timeout, maxBuffer: MAX_BUFFER },
      (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr: stderr || (error?.message ?? ""),
          exitCode: exitCodeFrom(error),
        });
      }
    );
  });
}

function azmAbortable(
  args: string[],
  timeout = 120000,
  signal?: AbortSignal
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(AZM_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let cancelled = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

    const appendStderr = (message: string) => {
      if (!message) return;
      if (stderr && !stderr.endsWith("\n")) stderr += "\n";
      stderr += message;
    };

    const killProcess = (killSignal: NodeJS.Signals) => {
      const pid = child.pid;
      if (!pid) return;

      if (process.platform !== "win32") {
        try {
          process.kill(-pid, killSignal);
          return;
        } catch {
          // Fall back to killing only the immediate child.
        }
      }

      try {
        child.kill(killSignal);
      } catch {
        // Ignore kill errors for already exited processes.
      }
    };

    const cleanup = (timeoutTimer: ReturnType<typeof setTimeout>, onAbort: () => void) => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
        forceKillTimer = null;
      }
      signal?.removeEventListener("abort", onAbort);
    };

    const finalize = (
      timeoutTimer: ReturnType<typeof setTimeout>,
      onAbort: () => void,
      exitCode: number,
      extraError?: string
    ) => {
      if (settled) return;
      settled = true;
      cleanup(timeoutTimer, onAbort);
      if (extraError) appendStderr(extraError);
      resolve({ stdout, stderr, exitCode });
    };

    const onAbort = () => {
      if (settled || cancelled) return;
      cancelled = true;
      appendStderr("Command cancelled by user.");
      killProcess("SIGTERM");
      forceKillTimer = setTimeout(() => {
        killProcess("SIGKILL");
      }, 1500);
    };

    const timeoutTimer = setTimeout(() => {
      if (settled || timedOut) return;
      timedOut = true;
      appendStderr(`Timed out while running azm ${args.join(" ")}`);
      killProcess("SIGTERM");
      forceKillTimer = setTimeout(() => {
        killProcess("SIGKILL");
      }, 1500);
    }, timeout);

    if (signal?.aborted) {
      onAbort();
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      finalize(timeoutTimer, onAbort, cancelled ? 130 : 1, error.message);
    });

    child.on("close", (code, closedSignal) => {
      if (cancelled || signal?.aborted) {
        finalize(timeoutTimer, onAbort, 130);
        return;
      }
      if (timedOut) {
        finalize(timeoutTimer, onAbort, 124);
        return;
      }
      if (closedSignal) {
        finalize(timeoutTimer, onAbort, 1, `Command terminated with signal ${closedSignal}.`);
        return;
      }
      finalize(timeoutTimer, onAbort, code ?? 1);
    });
  });
}

function azmInteractive(
  args: string[],
  timeout = 600000,
  autoContinue = false
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(AZM_BIN, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      resolve({
        stdout,
        stderr: `${stderr}\nTimed out while running azm ${args.join(" ")}`.trim(),
        exitCode: 124,
      });
    }, timeout);

    const handleOutput = (data: Buffer, target: "stdout" | "stderr") => {
      const text = data.toString();
      if (target === "stdout") stdout += text;
      else stderr += text;

      if (autoContinue && text.includes("Press Enter")) {
        child.stdin.write("\n");
      }
    };

    child.stdout.on("data", (chunk: Buffer) => handleOutput(chunk, "stdout"));
    child.stderr.on("data", (chunk: Buffer) => handleOutput(chunk, "stderr"));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr || error.message, exitCode: 1 });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

export function splitCommand(command: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaping = false;

  const push = () => {
    if (current.length > 0) {
      args.push(current);
      current = "";
    }
  };

  for (const char of command.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      push();
      continue;
    }

    current += char;
  }

  if (escaping) current += "\\";
  if (quote) throw new Error("Unclosed quote in command");
  push();

  return args;
}

export function assertReadOnlyAzCommand(command: string): string[] {
  const args = splitCommand(command);
  if (args.length === 0) throw new Error("Command is required");
  if (args[0] !== "az") {
    throw new Error("Only Azure CLI commands that start with 'az' can be run through azm run.");
  }

  const positional: string[] = [];
  for (const arg of args) {
    if (arg.startsWith("-")) break;
    positional.push(arg.toLowerCase());
  }

  const blocked = positional.find((arg) =>
    arg.split("-").some((part) => BLOCKED_AZ_ACTIONS.has(part))
  );
  if (blocked) {
    throw new Error(
      `Read-only mode: '${blocked}' operations are not permitted. Use list, show, get, export, or check commands.`
    );
  }

  const readOnlyAction = positional
    .slice(1)
    .find(
      (arg) =>
        ALLOWED_AZ_ACTIONS.has(arg) ||
        /^(list|show|check|export|query|exists)-/.test(arg)
    );
  if (!readOnlyAction) {
    throw new Error(
      "Read-only mode: command must use a read-only Azure CLI operation such as list, show, get, export, check, query, or exists."
    );
  }

  return args;
}

function parseTokenCheck(output: string, allNames: string[], exitCode: number) {
  const valid: string[] = [];
  const expired: string[] = [];
  let section: "valid" | "expired" | null = null;

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.includes("Valid tokens")) {
      section = "valid";
      continue;
    }
    if (line.includes("Expired/missing tokens")) {
      section = "expired";
      continue;
    }

    if (section === "valid" && line.includes("✓")) {
      const name = line.replace(/^.*✓\s*/, "").trim();
      if (name) valid.push(name);
    }

    if (section === "expired" && line.includes("✗")) {
      const name = line.replace(/^.*✗\s*/, "").trim();
      if (name) expired.push(name);
    }
  }

  if (exitCode === 0 && valid.length === 0 && expired.length === 0) {
    valid.push(...allNames);
  }

  return { valid, expired };
}

export async function listClients(): Promise<AzmClient[]> {
  const result = await azm(["list", "--json"], 15000);
  if (result.exitCode !== 0) return [];

  try {
    return JSON.parse(result.stdout.trim()) as AzmClient[];
  } catch {
    return [];
  }
}

export async function listClientNames(): Promise<string[]> {
  const result = await azm(["list", "--names"], 15000);
  if (result.exitCode !== 0) return [];
  return result.stdout.trim().split("\n").filter(Boolean);
}

export async function checkClient(name: string): Promise<CommandResult> {
  return azm(["check", name], 30000);
}

export async function checkAllExpired(): Promise<CheckExpiredResult> {
  const [result, names] = await Promise.all([
    azm(["check-expired"], 120000),
    listClientNames(),
  ]);
  const parsed = parseTokenCheck(result.stdout + result.stderr, names, result.exitCode);
  return { ...parsed, result };
}

export async function loginClient(name: string): Promise<CommandResult> {
  return azmInteractive(["login", name], 600000);
}

export async function loginAllClients(): Promise<CommandResult> {
  return azmInteractive(["login-all"], 1200000, true);
}

export async function loginExpiredClients(): Promise<CommandResult> {
  return azmInteractive(["login-expired"], 1200000, true);
}

export async function runCommand(
  clientName: string,
  command: string,
  signal?: AbortSignal
): Promise<CommandResult> {
  try {
    const args = assertReadOnlyAzCommand(command);
    return azmAbortable(["run", clientName, ...args], 120000, signal);
  } catch (error) {
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : "Invalid command",
      exitCode: 1,
    };
  }
}

export async function addClient(
  name: string,
  tenant: string,
  email: string,
  subscription?: string
): Promise<CommandResult> {
  const args = ["add", name, tenant, email];
  if (subscription) args.push(subscription);
  return azm(args, 15000);
}

export async function removeClient(name: string): Promise<CommandResult> {
  return azm(["remove", name], 15000);
}

export async function setSubscription(
  name: string,
  subscription: string
): Promise<CommandResult> {
  return azm(["set-sub", name, subscription], 30000);
}

export async function status(name: string): Promise<CommandResult> {
  return azm(["status", name], 30000);
}

export async function log(name: string, lines = 20): Promise<CommandResult> {
  return azm(["log", name, String(lines)], 15000);
}

export async function switchClient(name: string): Promise<CommandResult> {
  return azm(["switch", name], 15000);
}
