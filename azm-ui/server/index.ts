import express from "express";
import cors from "cors";
import {
  addClient,
  checkAllExpired,
  checkClient,
  listClients,
  log,
  loginAllClients,
  loginClient,
  loginExpiredClients,
  removeClient,
  runCommand,
  setSubscription,
  status,
  switchClient,
} from "./azm.js";
import { listTeamPresets } from "./team-presets.js";

const app = express();
app.use(cors());
app.use(express.json());

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function lineCount(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "20"), 10);
  if (Number.isNaN(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 500);
}

app.get("/api/clients", async (_req, res) => {
  try {
    res.json(await listClients());
  } catch (error) {
    res.status(500).json({ error: messageFrom(error) });
  }
});

app.get("/api/team-presets", async (_req, res) => {
  try {
    res.json(await listTeamPresets());
  } catch (error) {
    res.status(500).json({ error: messageFrom(error) });
  }
});

app.get("/api/clients/:name/check", async (req, res) => {
  const result = await checkClient(req.params.name);
  res.json({ name: req.params.name, valid: result.exitCode === 0, result });
});

app.get("/api/check-expired", async (_req, res) => {
  res.json(await checkAllExpired());
});

app.get("/api/clients/:name/status", async (req, res) => {
  res.json(await status(req.params.name));
});

app.get("/api/clients/:name/log", async (req, res) => {
  res.json(await log(req.params.name, lineCount(req.query.lines)));
});

app.get("/api/clients/:name/switch", async (req, res) => {
  res.json(await switchClient(req.params.name));
});

app.post("/api/run", async (req, res) => {
  const { client, command } = req.body as { client?: string; command?: string };
  if (!client || !command) {
    return res.status(400).json({ error: "client and command required" });
  }
  res.json(await runCommand(client, command));
});

app.post("/api/clients", async (req, res) => {
  const { name, tenant, email, subscription } = req.body as {
    name?: string;
    tenant?: string;
    email?: string;
    subscription?: string;
  };
  if (!name || !tenant || !email) {
    return res.status(400).json({ error: "name, tenant, and email required" });
  }
  res.json(await addClient(name, tenant, email, subscription));
});

app.post("/api/clients/:name/login", async (req, res) => {
  res.json(await loginClient(req.params.name));
});

app.post("/api/login-all", async (_req, res) => {
  res.json(await loginAllClients());
});

app.post("/api/login-expired", async (_req, res) => {
  res.json(await loginExpiredClients());
});

app.patch("/api/clients/:name/subscription", async (req, res) => {
  const { subscription } = req.body as { subscription?: string };
  if (!subscription) {
    return res.status(400).json({ error: "subscription required" });
  }
  res.json(await setSubscription(req.params.name, subscription));
});

app.delete("/api/clients/:name", async (req, res) => {
  res.json(await removeClient(req.params.name));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`azm-ui server running on http://localhost:${PORT}`);
});
