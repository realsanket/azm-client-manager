# azm-ui

Web UI for the [azm](https://github.com/realsanket/azm-client-manager) Azure Multi-Client Manager. Read-only Azure CLI command console with per-client isolation.

## Features

- **Dashboard** — See all Azure clients with real-time token status
- **Run** — Execute read-only Azure CLI commands against any client from the browser
- **Token Management** — Check expired tokens and manage authentication
- **Add/Remove Clients** — Manage client registrations from the UI
- **Team presets** — YAML-driven recipe groups under `team-presets/`

## Prerequisites

- [azm](https://github.com/realsanket/azm-client-manager) installed and on PATH
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/) installed
- Node.js 20+

## Quick Start

```bash
cd azm-ui
npm install
npm run dev
```

Starts backend (port 3001) and frontend (port 5173) concurrently.

Open http://localhost:5173

## Architecture

```
Browser (React + Tailwind)
    ↕ REST
Express.js Backend (port 3001)
    ↕ child_process
azm CLI → Azure CLI
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server and client in dev mode |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run dev:server` | Start only the Express backend |
| `npm run build` | Production build |
| `npm start` | Start production server |
