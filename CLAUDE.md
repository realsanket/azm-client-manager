# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`azm` is a shell-only wrapper around Azure CLI (`az`) that isolates multiple Azure tenants/subscriptions into per-client profiles. No build system, no package manager, no tests. Source is four hand-maintained scripts in `bin/` plus two installers at repo root.

## Commands

Syntax check (only "build" this repo has):
```bash
bash -n bin/azm
bash -n bin/azm-readonly
bash -n install.sh
pwsh -NoProfile -Command "[void][System.Management.Automation.Language.Parser]::ParseFile('bin/azm.ps1',[ref]$null,[ref]$null)"
```

Local install for manual testing (writes to `~/.azclients/`):
```bash
./install.sh --install-full        # or --install-readonly
./install.ps1 -InstallFull         # or -InstallReadonly
```

Point install at a scratch dir instead of `$HOME/.azclients`:
```bash
AZM_HOME=/tmp/azm-test ./install.sh --install-full
AZM_HOME=/tmp/azm-test /tmp/azm-test/bin/azm list
```

Switch modes = rerun installer with opposite flag. Marker file `~/.azclients/install-mode` (`full` | `readonly`) is the sole source of truth for mode.

## Architecture

### Two-mode duplication is deliberate
`bin/azm` (full) and `bin/azm-readonly` are near-identical bash scripts; the readonly variant adds ~17 lines of blocklist logic inside `cmd_run` and `cmd_compare` (currently bin/azm-readonly:409 and :583) plus banner text changes. Same pattern for the `.ps1` pair. **Any change to command logic must be applied to both files in the pair.** Do not refactor to a single script with a runtime flag — the installer picks one file and copies it to `~/.azclients/bin/azm`, and that copy is what users run.

Readonly blocklist scans **positional args only** (stops at first `-flag`), lowercased, exact match:
```
create delete update set start stop restart redeploy deallocate remove add
deploy assign revoke regenerate reset move swap resize scale import attach
detach enable disable cancel invoke apply restore failover migrate purge
write put patch
```
Note `add` and `set` collide with legit read commands like `az network nsg rule add`; readonly mode is genuinely "list/show/get only".

### Per-client isolation via `AZURE_CONFIG_DIR`
Every Azure CLI invocation is prefixed with `AZURE_CONFIG_DIR=<profile-dir>`. That variable tells `az` where to read/write its token cache and defaults. Isolation is entirely through this env var — no wrapping, no keychain, no secrets stored by `azm` itself.

Runtime layout under `$AZM_HOME` (default `~/.azclients`):
```
bin/azm                  installed script
install-mode             "full" | "readonly"
clients.conf             name|tenant|subscription|email (pipe-separated)
profiles/<name>/         per-client AZURE_CONFIG_DIR
logs/<name>.log          "TIMESTAMP | cmd args" audit trail
```

### Token validation must force refresh
`az account show` reads cached data and will not detect expired refresh tokens. `cmd_check` / `cmd_check_expired` / `cmd_login_expired` all use `az account get-access-token --output none` on purpose — see comments at bin/azm:643-644. Do not "optimize" these back to `account show`.

### Bash 3.2 compatibility
macOS ships bash 3.2. No `${var,,}` lowercase, no associative arrays, no `mapfile`. Use `tr '[:upper:]' '[:lower:]'` for case folding (see `_sanitize_name`, readonly blocklist loop). `install.sh` special-cases mac bash to write `~/.bash_profile` instead of `~/.bashrc`.

### clients.conf is edited by awk/grep in place
Mutations use `awk -F'|' ... > $tmpfile && mv $tmpfile $conf` (see `_login_one` sub auto-detect, `cmd_set_sub`) or `grep -iv` for delete. Client name lookup is `grep -i "^${sanitized}|"` — hence the mandatory `_sanitize_name` (lowercase, `[a-z0-9-]` only) on every read/write path.

### Privacy masking
`_mask_value` (bin/azm:114) length-tiered: ≤2 → all `*`; ≤8 → `X***Y`; else `XXXX...YYYY`. Triggered by per-command `--mask` flag or `AZM_MASK_DETAILS=1` env. Applied in `list`, `status`, `run`, `_print_context`.

### Copilot skills are docs, not code
`.github/skills/azm-{client-manager,full-control,readonly-safe}/SKILL.md` are consumed by external tooling. The router skill reads `~/.azclients/install-mode` at runtime to dispatch. When changing runtime blocking behavior, update `azm-readonly-safe/SKILL.md` to match.

## Sharp edges when editing

- Both `bin/azm` and `bin/azm-readonly` (and both `.ps1` files) must stay in lockstep for shared logic. Diff them after any change to `cmd_run` / `cmd_compare` / helpers.
- Installer copies the source script to `~/.azclients/bin/azm` — the installed name is always `azm` regardless of mode. Do not rename inside the scripts.
- `set -euo pipefail` is on; use `|| true` around `grep`, `(( x++ ))`, and other commands that legitimately exit non-zero.
- Terminal color codes are stripped when stdout is not a TTY (bin/azm:44). Preserve that guard when adding output.
- `.gitignore` blocks `.azclients/`, `profiles/`, `logs/`, `clients.conf` — never commit runtime data if you test in-tree.
