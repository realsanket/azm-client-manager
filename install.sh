#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# azm installer — macOS / Linux
# ═══════════════════════════════════════════════════════════════════════════
# Installs the azm CLI tool to ~/.azclients/bin/ and adds it to PATH.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/<owner>/azm-tool/main/install.sh | bash
#   # or
#   git clone https://github.com/<owner>/azm-tool.git && cd azm-tool && ./install.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

C_RESET=$'\033[0m'
C_GREEN=$'\033[0;32m'
C_CYAN=$'\033[0;36m'
C_YELLOW=$'\033[0;33m'
C_RED=$'\033[0;31m'
C_BOLD=$'\033[1m'

info()  { printf "${C_CYAN}▸${C_RESET} %s\n" "$*"; }
ok()    { printf "${C_GREEN}✓${C_RESET} %s\n" "$*"; }
warn()  { printf "${C_YELLOW}⚠${C_RESET} %s\n" "$*"; }
err()   { printf "${C_RED}✗${C_RESET} %s\n" "$*" >&2; exit 1; }

AZM_HOME="${AZM_HOME:-$HOME/.azclients}"
BIN_DIR="$AZM_HOME/bin"

echo
printf "${C_BOLD}  ╔═══════════════════════════════════════════╗${C_RESET}\n"
printf "${C_BOLD}  ║   azm — Azure Multi-Client CLI Manager   ║${C_RESET}\n"
printf "${C_BOLD}  ╚═══════════════════════════════════════════╝${C_RESET}\n"
echo

# ── Check prerequisites ──────────────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v az &>/dev/null; then
    warn "Azure CLI (az) not found. Install it first:"
    warn "  https://learn.microsoft.com/en-us/cli/azure/install-azure-cli"
    warn "azm will be installed, but won't work until 'az' is available."
    echo
fi

if ! command -v bash &>/dev/null; then
    err "bash is required but not found."
fi

# ── Determine script source ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_SCRIPT=""

if [[ -f "$SCRIPT_DIR/bin/azm" ]]; then
    SOURCE_SCRIPT="$SCRIPT_DIR/bin/azm"
elif [[ -f "$SCRIPT_DIR/azm" && "$(head -1 "$SCRIPT_DIR/azm")" == "#!/usr/bin/env bash"* ]]; then
    SOURCE_SCRIPT="$SCRIPT_DIR/azm"
else
    err "Cannot find azm script. Run this installer from the repository root."
fi

# ── Install ──────────────────────────────────────────────────────────────
info "Installing azm to $BIN_DIR ..."
mkdir -p "$BIN_DIR"
cp "$SOURCE_SCRIPT" "$BIN_DIR/azm"
chmod +x "$BIN_DIR/azm"
ok "Installed azm to $BIN_DIR/azm"

# ── Add to PATH ──────────────────────────────────────────────────────────
PATH_LINE="export PATH=\"$BIN_DIR:\$PATH\""
ADDED_PATH=false

add_to_shell_rc() {
    local rc_file="$1"
    if [[ -f "$rc_file" ]]; then
        if ! grep -qF "$BIN_DIR" "$rc_file" 2>/dev/null; then
            echo "" >> "$rc_file"
            echo "# azm — Azure Multi-Client CLI Manager" >> "$rc_file"
            echo "$PATH_LINE" >> "$rc_file"
            ok "Added to PATH in $rc_file"
            ADDED_PATH=true
        else
            info "PATH already configured in $rc_file"
            ADDED_PATH=true
        fi
    fi
}

# Detect current shell and configure
CURRENT_SHELL="$(basename "${SHELL:-/bin/bash}")"
case "$CURRENT_SHELL" in
    zsh)
        add_to_shell_rc "$HOME/.zshrc"
        ;;
    bash)
        if [[ "$(uname)" == "Darwin" ]]; then
            add_to_shell_rc "$HOME/.bash_profile"
        else
            add_to_shell_rc "$HOME/.bashrc"
        fi
        ;;
    fish)
        FISH_CONFIG="$HOME/.config/fish/config.fish"
        if [[ -f "$FISH_CONFIG" ]]; then
            if ! grep -qF "$BIN_DIR" "$FISH_CONFIG" 2>/dev/null; then
                echo "" >> "$FISH_CONFIG"
                echo "# azm — Azure Multi-Client CLI Manager" >> "$FISH_CONFIG"
                echo "set -gx PATH $BIN_DIR \$PATH" >> "$FISH_CONFIG"
                ok "Added to PATH in $FISH_CONFIG"
                ADDED_PATH=true
            else
                info "PATH already configured in $FISH_CONFIG"
                ADDED_PATH=true
            fi
        fi
        ;;
esac

if [[ "$ADDED_PATH" == false ]]; then
    warn "Could not auto-detect shell config. Add this to your shell profile:"
    echo "  $PATH_LINE"
fi

# ── Done ─────────────────────────────────────────────────────────────────
echo
ok "Installation complete!"
echo
info "Quick start:"
echo "  1. Restart your terminal (or run: source ~/.${CURRENT_SHELL}rc)"
echo "  2. azm add <name> <tenant> <email>"
echo "  3. azm login <name>"
echo "  4. azm run <name> az group list -o table"
echo
info "Run 'azm help' for all commands."
echo
