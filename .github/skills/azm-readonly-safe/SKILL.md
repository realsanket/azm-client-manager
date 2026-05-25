---
name: azm-readonly-safe
description: >-
  Use this skill when azm is installed in readonly-safe mode. Allows azm management commands while
  restricting Azure CLI operations through azm to read-only verbs.
license: MIT
allowed-tools: replace_string_in_file, multi_replace_string_in_file, grep_search, run_in_terminal, execution_subagent
---

# azm Readonly-Safe Mode

## Mode Contract
- This skill applies when installed mode is `readonly`.
- azm management commands are fully available.
- Azure CLI operations through `azm run` and `azm compare` are restricted to read-only operations.
- Destructive verbs are blocked by the runtime scripts.

## Determine Active Mode
- Preferred: read `~/.azclients/install-mode`.
- If value is `readonly`, use this skill behavior.
- If value is `full`, switch to `azm-full-control` behavior.
- If file is missing, ask user to confirm intended mode before mutating operations.

## Core Command Pattern

```bash
azm run <client-name> az <subcommand> [flags]
```

## Allowed azm Management Commands

```bash
azm add <name> <tenant> <email> [sub-id]
azm login <name> [name2 ...]
azm login-all
azm login-expired
azm check <name> [name2 ...]
azm check-expired
azm set-sub <name> <subscription-id>
azm remove <name>
azm log <name> [n]
azm compare <a> <b> az <cmd...>
azm list [--names|--json]
azm status [name]
azm version
```

## Azure CLI Restrictions in Readonly Mode

Blocked verbs include:
- `create`, `delete`, `update`, `set`, `start`, `stop`, `restart`, `redeploy`, `deallocate`
- `remove`, `add`, `deploy`, `assign`, `revoke`, `regenerate`, `reset`, `move`, `swap`
- `resize`, `scale`, `import`, `attach`, `detach`, `enable`, `disable`, `cancel`, `invoke`
- `apply`, `restore`, `failover`, `migrate`, `purge`, `write`, `put`, `patch`

Typical allowed verbs:
- `list`, `show`, `get`, `export`, `check`

## Required Refusal Response for Blocked Azure CLI Operations

If user asks to run blocked Azure CLI operations through azm in readonly mode, respond with:

"This Azure CLI operation is not permitted in readonly mode. azm currently allows only read-only Azure CLI commands (list, show, get, export, and similar query commands)."

## Example Commands

```bash
# Allowed query
azm run acme az group list -o table

# Blocked in readonly mode
azm run acme az group create -g rg-demo -l eastus
```

## Troubleshooting
- If auth fails: `azm login <name>` or `azm login-expired`.
- If client missing: `azm list --names`.
- If user needs mutating operations, switch install mode to full and rerun installer.
