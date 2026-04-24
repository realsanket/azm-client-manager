---
name: azm-client-manager
description: >-
  Manage, extend, and troubleshoot the `azm` Azure multi-client CLI tool (~/.azclients/bin/azm).
  Use when the user asks to add/remove clients, change azm behaviour, fix azm bugs,
  add new azm commands, or run Azure CLI operations across multiple tenants/subscriptions.
license: MIT
allowed-tools: replace_string_in_file, multi_replace_string_in_file, grep_search, run_in_terminal, execution_subagent
---

# azm — Agent Instructions

## How to Run Azure Queries

The binary path is `~/.azclients/bin/azm`. It is on PATH as `azm`.
The core command for running Azure queries is:

```
azm run <client-name> az <subcommand> [flags]
```

### Decision Flow

1. **User gives a clear client name** → run `azm run <name> az ...` directly. No discovery needed.
2. **Command fails with "not found"** → run `azm list --names` to discover clients, then ask the user which one they meant.
3. **User is ambiguous** (e.g., "check prod", "run on my company") → run `azm list --names` to get available clients, then ask the user to clarify.
4. **User says "all clients" or "every client"** → discover with `azm list --names`, then loop. Read-only commands: proceed. Mutating commands (create/delete/update resources): **confirm with user first**.
5. **No clients registered** (`azm list --names` returns nothing) → tell the user to register with `azm add`.

### Running a Command

```bash
# Direct — when client name is known
azm run mycompany az group list -o table
azm run mycompany az vm list --query "[].{Name:name, Size:hardwareProfile.vmSize}" -o table
azm run mycompany az network vnet show -g myRG -n myVnet -o json
```

### Running Across Multiple Clients

```bash
# Specific clients
for c in client-a client-b client-c; do echo "=== $c ==="; azm run $c az group list -o table; done

# All registered clients (machine-parseable discovery)
for c in $(azm list --names); do echo "=== $c ==="; azm run $c az group list -o table; done
```

Run sequentially (not parallel) — keeps output readable and avoids rate-limit issues.
If some clients fail (e.g., expired login), continue to the next and summarize failures at the end.

### Client Discovery

```bash
azm list --names     # One client name per line (for scripting/loops)
azm list --json      # Full details as JSON array (name, tenant, subscription, email, logged_in)
azm list             # Human-readable table with login status (● / ○)
```

Use `--names` for loops and enumeration. Use `--json` when you need tenant/subscription/email details.

## Management Commands (only when user explicitly asks)

```bash
azm add <name> <tenant> <email> [sub-id]     # Register new client
azm login <name> [name2 ...]                  # Browser login (one or more)
azm login-all                                 # Login every client sequentially
azm login-expired                             # Re-login only expired tokens
azm check <name> [name2 ...]                  # Validate token(s) quickly (exit code 0 = valid)
azm check-expired                             # List all clients with expired tokens (no login)
azm set-sub <name> <subscription-id>          # Set/update subscription
azm remove <name>                             # Unregister + wipe profile
azm log <name> [n]                            # Show last n audit log entries
azm compare <a> <b> az <cmd...>              # Same query on two clients + diff
azm list [--names|--json]                     # Show clients (table / names / JSON)
azm status <name>                             # Account details for one client
azm version                                   # Show version
```

## DO NOT Do

- Do NOT read `~/.azclients/bin/azm` unless editing a specific function in it
- Do NOT read `~/.azclients/clients.conf` directly — use `azm list --names` or `azm list --json`
- Do NOT run multiple exploratory commands; go straight to the Azure query when client is known
- Do NOT run mutating commands across all clients without confirming with the user first

## Optional: Client Alias Table

If you want faster lookups without running discovery, you can add a client alias table here.
This is **optional** — dynamic discovery via `azm list --names` works without it.

<!-- Uncomment and fill in to enable alias-based lookups:
| User might say | azm name | Notes |
|---|---|---|
| Acme, acme-corp | `acme` | Production tenant |
| Contoso, contoso-prod | `contoso` | Dev/test tenant |
-->

## File Locations (for editing the tool only)

| Path | Purpose |
|---|---|
| `~/.azclients/bin/azm` | Main bash executable (macOS/Linux) |
| `~/.azclients/bin/azm.ps1` | PowerShell executable (Windows) |
| `~/.azclients/clients.conf` | `name\|tenant\|subscription\|email` per line |
| `~/.azclients/profiles/<name>/` | Isolated AZURE_CONFIG_DIR per client |
| `~/.azclients/logs/<name>.log` | Audit log per client |

## Editing Rules (if modifying the azm bash script)

1. **Shebang** — `#!/usr/bin/env bash`. Keep bash 3.2+ compatible (macOS ships 3.2).
2. **Color variables** — `$'\033[...'` ANSI-C quoting only. Never single-quoted.
3. **`local` in loops** — declare above `while read` loops, assign inside.
4. **printf + color vars** — use `%b` format spec, not inline `${var}`.
5. **New command** — needs: function, case entry, help entry. Use `multi_replace_string_in_file`.
6. **clients.conf edits** — use `awk` with `-F'|'`, never `sed`.

## Diagnosing Errors

| Symptom | Cause | Fix |
|---|---|---|
| Auth error on `azm run` | Refresh token expired (>90 days) or conditional access policy | `azm login <name>` or `azm login-expired` |
| `○` in azm list | No token cache file | `azm login <name>` |
| `●` but still auth error | Token file exists but is expired (conditional access) | `azm check <name>` to verify, then `azm login <name>` |
| Wrong subscription | Field 3 in clients.conf is stale | `azm set-sub <name> <sub-id>` |
| Raw `\033[...` in output | Color var uses single quotes | Change to `$'\033[...'` quoting |
| `local pdir` printed in output | `local` declared inside while loop | Move `local` above the loop |
| `az: command not found` | Azure CLI not installed | Install from https://aka.ms/installazurecli |

## Token Expiration & Conditional Access

Many organizations enforce conditional access policies requiring frequent re-authentication (1-24 hours).
- `azm check <name>` — validates if token is still valid (fast)
- `azm login-expired` — batch re-login only expired sessions
- For automation: use service principals, not user accounts
