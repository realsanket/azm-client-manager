# azm — Azure Multi-Client CLI Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Stop switching Azure accounts manually.** `azm` lets you manage multiple Azure tenants and subscriptions from a single terminal — each client gets an isolated profile, so credentials never leak between accounts.

```bash
# Register your clients
azm add acme acme.onmicrosoft.com admin@acme.com
azm add contoso contoso.com user@contoso.com

# Login once, stay logged in
azm login acme contoso

# Run Azure CLI commands against any client instantly
azm run acme az group list -o table
azm run contoso az vm list -o table

# Compare resources across clients
azm compare acme contoso az group list -o json
```

---

## Why azm?

If you work with **multiple Azure tenants** (consulting, MSP, multi-org), you know the pain:
- Constantly running `az login` and switching accounts
- Accidentally running commands against the wrong tenant
- Managing separate browser profiles for each client

**azm solves this** by giving each client an isolated `AZURE_CONFIG_DIR`. You log in once per client and run commands against any of them without switching.

---

## Features

- 🔐 **Isolated profiles** — each client's credentials, tokens, and config are completely separated
- 🔄 **Multi-client login** — log in to multiple clients in one go (`azm login client1 client2 ...`)
- ⚡ **Direct execution** — run Azure CLI commands against any client: `azm run <client> az ...`
- 🔍 **Compare** — run the same command against two clients and see the diff
- 📋 **Audit log** — every command is logged per client with timestamps
- 🎨 **Color output** — clear visual context showing which client you're operating on
- 💻 **Cross-platform** — works on macOS, Linux (Bash), and Windows (PowerShell)

---

## Installation

### Prerequisites

- [Azure CLI (`az`)](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) must be installed
- **macOS/Linux:** Bash 3.2+ (pre-installed on all modern systems)
- **Windows:** PowerShell 5.1+ (pre-installed) or [PowerShell 7+](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows)
- **Optional:** `jq` (for JSON diff in the `compare` command)

### macOS / Linux

```bash
# Clone and install
git clone https://github.com/<your-username>/azm-tool.git
cd azm-tool
chmod +x install.sh
./install.sh
```

The installer will:
1. Copy `azm` to `~/.azclients/bin/`
2. Add the directory to your PATH (detects zsh, bash, fish)
3. Restart your terminal and you're ready to go

**Manual install** (if you prefer):
```bash
mkdir -p ~/.azclients/bin
cp bin/azm ~/.azclients/bin/azm
chmod +x ~/.azclients/bin/azm
# Add to your shell profile:
export PATH="$HOME/.azclients/bin:$PATH"
```

### Windows

```powershell
# Clone and install
git clone https://github.com/<your-username>/azm-tool.git
cd azm-tool
.\install.ps1
```

The installer will:
1. Copy `azm.ps1` to `~\.azclients\bin\`
2. Create an `azm.cmd` wrapper for Command Prompt
3. Add to your user PATH
4. Add an `azm` function to your PowerShell profile

**Windows users can also use** WSL or Git Bash to run the Bash version directly.

---

## Usage

### Register a Client

```bash
azm add <name> <tenant> <email> [subscription-id]
```

- **name** — a short alias you'll use to refer to this client (e.g., `acme`)
- **tenant** — the Azure AD tenant domain or ID (e.g., `acme.onmicrosoft.com`)
- **email** — the account you sign in with for this tenant
- **subscription-id** — optional; auto-detected on first login if omitted

```bash
# Without subscription (auto-detected on login):
azm add acme acme.onmicrosoft.com admin@acme.com

# With subscription:
azm add acme acme.onmicrosoft.com admin@acme.com xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Login

```bash
azm login <name> [name2 name3 ...]   # Login one or more clients
azm login-all                         # Login every registered client
azm login-expired                     # Only re-login clients with expired tokens
```

A browser window opens for each client. Sign in and you're set — tokens are cached in each client's isolated profile.

**Dealing with token expiration:** If your organization enforces conditional access policies (e.g., 24-hour token lifetime), run `azm login-expired` daily to refresh only the sessions that actually expired, instead of re-authenticating everything.

### Check Token Validity

```bash
azm check <name> [name2 ...]   # Quick validation of specific clients
azm check-expired              # List all clients with expired tokens
```

**`azm check <name>`** returns exit code 0 if all specified clients have valid tokens, 1 if any expired. Useful in scripts:
```bash
azm check mycompany || azm login mycompany
```

**`azm check-expired`** checks all registered clients and displays a report:
```bash
azm check-expired
# Valid tokens (5):
#   ✓ client-a
#   ✓ client-b
# ...
# Expired/missing tokens (2):
#   ✗ client-c
#   ✗ client-d
```

### Run Commands

```bash
azm run <name> az <subcommand> [flags]
```

This is the core command. It runs any `az` command with the specified client's profile:

```bash
azm run acme az group list -o table
azm run contoso az vm list --query "[].{Name:name, Size:hardwareProfile.vmSize}" -o table
azm run acme az network vnet list -o table
```

### List Clients

```bash
azm list               # Human-readable table with login status
azm list --names       # Just client names, one per line (for scripting)
azm list --json        # Full details as JSON array
```

Shows all registered clients with login status:
```
CLIENT               TENANT                                   SUBSCRIPTION                           EMAIL
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
● acme               acme.onmicrosoft.com                     xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   admin@acme.com
○ contoso            contoso.com                                                                     user@contoso.com

  ● = token cache present (may be expired)   ○ = needs login

Note: If 'azm run' fails with auth error, the token is expired. Run: azm login <name>
```

### Compare Two Clients

```bash
azm compare <client1> <client2> az <command...>
```

Runs the same command against both clients and shows the diff:
```bash
azm compare acme contoso az group list -o json
```

### Other Commands

```bash
azm status [name]              # Show active context or client details
azm set-sub <name> <sub-id>   # Update subscription for a client
azm switch <name>              # Print export statement (eval $(azm switch acme))
azm check <name> [name2 ...]   # Quick token validation (specific clients)
azm check-expired              # List all clients with expired tokens
azm remove <name>              # Unregister and delete profile
azm log <name> [n]             # Show last n commands (default: 20)
azm version                    # Show version
azm help                       # Show help
```

---

## Handling Token Expiration & Conditional Access

If your organization enforces **conditional access policies** that limit token lifetime (e.g., 24 hours), your tokens will expire frequently even though the token file still exists.

**Solutions:**

1. **Quick fix** — run `azm login-expired` periodically (e.g., daily):
   ```bash
   azm check-expired       # See which clients need re-login
   azm login-expired       # Only re-authenticates expired sessions
   ```

2. **Before running commands** — check token validity:
   ```bash
   azm check mycompany && azm run mycompany az group list -o table
   ```

3. **For automation** — use service principals instead of user accounts:
   ```bash
   # Create a service principal
   az ad sp create-for-rbac --name "azm-automation" --role Contributor
   
   # Login with service principal (doesn't have conditional access restrictions)
   AZURE_CONFIG_DIR=~/.azclients/profiles/mycompany-sp az login --service-principal \
     -u <app-id> -p <password-or-cert> --tenant <tenant-id>
   ```

**Why tokens expire:**
- Refresh tokens: typically 90 days, but can be shorter with policies
- Conditional access: can require re-authentication every 1-24 hours
- The `●` indicator in `azm list` only means the token *file exists*, not that it's *valid*

---

## How It Works

```
~/.azclients/
├── bin/
│   └── azm                    # The CLI tool
├── clients.conf               # name|tenant|subscription|email per line
├── profiles/
│   ├── acme/                  # Isolated AZURE_CONFIG_DIR for acme
│   │   └── msal_token_cache.json
│   ├── contoso/               # Isolated AZURE_CONFIG_DIR for contoso
│   │   └── msal_token_cache.json
│   └── ...
└── logs/
    ├── acme.log               # Command audit log
    └── contoso.log
```

When you run `azm run acme az group list`, it sets `AZURE_CONFIG_DIR` to `~/.azclients/profiles/acme/` before executing the command. This means the Azure CLI uses acme's tokens and config — completely isolated from other clients.

---

## Platform Notes

| Feature | macOS / Linux (Bash) | Windows (PowerShell) |
|---------|---------------------|---------------------|
| Script | `bin/azm` | `bin/azm.ps1` |
| Installer | `install.sh` | `install.ps1` |
| Shell integration | `eval $(azm switch name)` | `$env:AZURE_CONFIG_DIR = (azm switch name)` |
| Base directory | `~/.azclients/` | `~\.azclients\` |
| Temp files | Uses `mktemp` | Uses `[IO.Path]::GetTempFileName()` |
| Color output | ANSI escape codes | PowerShell `Write-Host -ForegroundColor` |

---

## Copilot Integration

`azm` ships with a [GitHub Copilot skill](.github/skills/azm-client-manager/SKILL.md) that enables AI-assisted Azure management across all your clients. The skill teaches Copilot the `azm` command syntax and your client mappings.

To use it, customize the client table in the skill file with your own client names and tenants.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AZM_HOME` | `~/.azclients` | Base directory for all azm data |
| `AZURE_CONFIG_DIR` | (managed by azm) | Set automatically per-client during `azm run` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Auth error on `azm run` | Refresh token expired (>90 days) | `azm login <name>` |
| `○` in `azm list` | No token cache file | `azm login <name>` |
| Wrong subscription | Stale subscription in config | `azm set-sub <name> <sub-id>` |
| `az: command not found` | Azure CLI not installed | [Install Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test on your platform (bash syntax check: `bash -n bin/azm`)
5. Submit a pull request

---

## License

[MIT](LICENSE)
