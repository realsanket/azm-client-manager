import { useCallback, useState } from "react";

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

export interface ClientCheckResult {
  name: string;
  valid: boolean;
  result: CommandResult;
}

export interface CheckExpiredResult {
  valid: string[];
  expired: string[];
  result: CommandResult;
}

export interface TeamRecipe {
  label: string;
  command: string;
}

export interface TeamPresetDefinition {
  id: string;
  name: string;
  description?: string;
  sourceFile: string;
  recipes: {
    command: TeamRecipe[];
  };
}

export interface TeamPresetIndex {
  directory: string;
  presets: TeamPresetDefinition[];
  errors: string[];
}

const API = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed with ${response.status}`);
  }
  return data as T;
}

export function useAzm() {
  const [clients, setClients] = useState<AzmClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<Record<string, boolean>>({});

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<AzmClient[]>("/clients");
      setClients(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkClient = useCallback(async (name: string) => {
    const data = await request<ClientCheckResult>(`/clients/${name}/check`);
    setTokenStatus((prev) => ({ ...prev, [name]: data.valid }));
    return data;
  }, []);

  const checkExpired = useCallback(async () => {
    const data = await request<CheckExpiredResult>("/check-expired");
    const status: Record<string, boolean> = {};
    data.valid.forEach((name) => {
      status[name] = true;
    });
    data.expired.forEach((name) => {
      status[name] = false;
    });
    setTokenStatus(status);
    return data;
  }, []);

  const runCommand = useCallback(
    (client: string, command: string) =>
      request<CommandResult>("/run", {
        method: "POST",
        body: JSON.stringify({ client, command }),
      }),
    []
  );

  const listTeamPresets = useCallback(
    () => request<TeamPresetIndex>("/team-presets"),
    []
  );

  const addClient = useCallback(
    async (name: string, tenant: string, email: string, subscription?: string) => {
      const result = await request<CommandResult>("/clients", {
        method: "POST",
        body: JSON.stringify({ name, tenant, email, subscription }),
      });
      if (result.exitCode === 0) await fetchClients();
      return result;
    },
    [fetchClients]
  );

  const removeClient = useCallback(
    async (name: string) => {
      const result = await request<CommandResult>(`/clients/${name}`, {
        method: "DELETE",
      });
      if (result.exitCode === 0) await fetchClients();
      return result;
    },
    [fetchClients]
  );

  const loginClient = useCallback(
    async (name: string) => {
      const result = await request<CommandResult>(`/clients/${name}/login`, {
        method: "POST",
      });
      await fetchClients();
      return result;
    },
    [fetchClients]
  );

  const loginAll = useCallback(async () => {
    const result = await request<CommandResult>("/login-all", { method: "POST" });
    await fetchClients();
    return result;
  }, [fetchClients]);

  const loginExpired = useCallback(async () => {
    const result = await request<CommandResult>("/login-expired", {
      method: "POST",
    });
    await fetchClients();
    return result;
  }, [fetchClients]);

  const setSubscription = useCallback(
    async (name: string, subscription: string) => {
      const result = await request<CommandResult>(
        `/clients/${name}/subscription`,
        {
          method: "PATCH",
          body: JSON.stringify({ subscription }),
        }
      );
      if (result.exitCode === 0) await fetchClients();
      return result;
    },
    [fetchClients]
  );

  const status = useCallback(
    (name: string) => request<CommandResult>(`/clients/${name}/status`),
    []
  );

  const log = useCallback(
    (name: string, lines: number) =>
      request<CommandResult>(`/clients/${name}/log?lines=${lines}`),
    []
  );

  const switchClient = useCallback(
    (name: string) => request<CommandResult>(`/clients/${name}/switch`),
    []
  );

  return {
    clients,
    loading,
    tokenStatus,
    addClient,
    checkClient,
    checkExpired,
    fetchClients,
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
  };
}
