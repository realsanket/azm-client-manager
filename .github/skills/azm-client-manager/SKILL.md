---
name: azm-client-manager
description: >-
  Router skill for azm. Determines installed mode (full or readonly) and applies
  the corresponding mode-specific guidance via azm-full-control or azm-readonly-safe.
license: MIT
allowed-tools: replace_string_in_file, multi_replace_string_in_file, grep_search, run_in_terminal, execution_subagent
---

# azm Router Skill

## Purpose
- This skill decides which mode-specific azm skill behavior to apply.
- It routes to one of:
  - `azm-full-control`
  - `azm-readonly-safe`

## Mode Detection
1. Read `~/.azclients/install-mode`.
2. If value is `full`, follow `azm-full-control` behavior.
3. If value is `readonly`, follow `azm-readonly-safe` behavior.
4. If file is missing, assume `full` for backward compatibility, but ask user before risky mutating operations.

## Shared Command Surface

```bash
azm add <name> <tenant> <email> [sub-id]
azm list [--names|--json]
azm login <name> [name2 ...]
azm login-all
azm login-expired
azm check <name> [name2 ...]
azm check-expired
azm run <name> az <subcommand> [flags]
azm compare <a> <b> az <subcommand> [flags]
azm set-sub <name> <subscription-id>
azm remove <name>
azm log <name> [n]
azm status [name]
azm version
```

## Routing Rules
- Always determine mode first for Azure CLI execution semantics.
- Management commands (`add`, `remove`, `set-sub`, login commands, listing/status) are valid in both modes.
- For Azure CLI mutating operations:
  - In `full` mode: allowed, with sensible confirmations for high-risk scope.
  - In `readonly` mode: disallowed by runtime script; use readonly-safe refusal guidance.

## Skill File Locations
- `.github/skills/azm-client-manager/SKILL.md` (this router)
- `.github/skills/azm-full-control/SKILL.md`
- `.github/skills/azm-readonly-safe/SKILL.md`

## Runtime Mode Source of Truth
- Installed mode is written by installers to `~/.azclients/install-mode`.
- Valid values: `full` or `readonly`.
