---
name: azm-full-control
description: >-
  Use this skill when azm is installed in full-control mode. Supports azm management commands and
  Azure CLI operations (read and write) through azm across multiple clients.
license: MIT
allowed-tools: replace_string_in_file, multi_replace_string_in_file, grep_search, run_in_terminal, execution_subagent
---

# azm Full-Control Mode

## Mode Contract
- This skill applies when installed mode is `full`.
- azm management commands are fully available.
- Azure CLI operations through `azm run` and `azm compare` are allowed, including mutating operations.

## Determine Active Mode
- Preferred: read `~/.azclients/install-mode`.
- If value is `full`, use this skill behavior.
- If value is `readonly`, switch to `azm-readonly-safe` behavior.
- If file is missing, assume `full` unless user indicates otherwise.

## Core Command Pattern

```bash
azm run <client-name> az <subcommand> [flags]
```

## Discovery and Execution Flow
1. If client name is clear, run command directly.
2. If client name is unclear, run `azm list --names` and ask for selection.
3. If user asks for all clients, iterate clients sequentially from `azm list --names`.
4. For mutating operations on multiple clients, ask confirmation first.

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

## Safety Rules in Full Mode
- Full mode allows mutating operations, but still apply explicit confirmation for high-risk operations:
  - bulk delete/update operations
  - production subscription changes
  - role or policy changes
- Do not execute destructive commands across all clients without confirmation.

## Example Commands

```bash
# Read-only query
azm run acme az group list -o table

# Mutating operation (allowed in full mode)
azm run acme az group create -g rg-demo -l eastus

# Compare between clients
azm compare acme contoso az vm list -o json
```

## Troubleshooting
- If auth fails: `azm login <name>` or `azm login-expired`.
- If client missing: `azm list --names`.
- If wrong subscription: `azm set-sub <name> <sub-id>`.
