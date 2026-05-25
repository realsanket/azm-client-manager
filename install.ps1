<#
.SYNOPSIS
    azm installer — Windows (PowerShell)

.DESCRIPTION
    Installs the azm CLI tool for Windows.
    Copies azm.ps1 to ~/.azclients/bin/ and creates a wrapper function.

.EXAMPLE
    # From the repository directory:
    .\install.ps1

    # Explicit install mode:
    .\install.ps1 -InstallFull
    .\install.ps1 -InstallReadonly

    # Or directly from GitHub:
    irm https://raw.githubusercontent.com/<owner>/azm-tool/main/install.ps1 | iex
#>

[CmdletBinding()]
param(
    [switch]$InstallFull,
    [switch]$InstallReadonly,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

$AZM_HOME = if ($env:AZM_HOME) { $env:AZM_HOME } else { Join-Path $HOME ".azclients" }
$BIN_DIR = Join-Path $AZM_HOME "bin"
$MODE_FILE = Join-Path $AZM_HOME "install-mode"

function Show-InstallerHelp {
    Write-Host @"
azm installer (Windows/PowerShell)

Usage:
  .\install.ps1 [-InstallFull | -InstallReadonly]

Options:
  -InstallFull       Install full-control mode
  -InstallReadonly   Install read-only-safe mode
  -Help              Show this help message

Behavior:
  - If no mode switch is provided and terminal is interactive, installer prompts for mode.
  - If no mode switch is provided and terminal is non-interactive, installer exits and asks for a mode switch.
"@
}

function Test-InteractiveSession {
    try {
        return [Environment]::UserInteractive -and (-not [Console]::IsInputRedirected) -and (-not [Console]::IsOutputRedirected)
    } catch {
        return $false
    }
}

if ($Help) {
    Show-InstallerHelp
    exit 0
}

if ($InstallFull -and $InstallReadonly) {
    Write-Host "✗ Conflicting mode options. Use either -InstallFull or -InstallReadonly." -ForegroundColor Red
    exit 1
}

$InstallMode = $null
if ($InstallFull) {
    $InstallMode = "full"
} elseif ($InstallReadonly) {
    $InstallMode = "readonly"
}

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor White
Write-Host "  ║   azm — Azure Multi-Client CLI Manager   ║" -ForegroundColor White
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor White
Write-Host ""

if (-not $InstallMode) {
    if (Test-InteractiveSession) {
        Write-Host "▸ No install mode provided. Choose a mode:" -ForegroundColor Cyan
        Write-Host "  1) Full-control mode"
        Write-Host "  2) Read-only-safe mode"

        while ($true) {
            $selection = Read-Host "Select mode [1/2] (default: 1)"
            if ([string]::IsNullOrWhiteSpace($selection)) { $selection = "1" }

            switch ($selection.ToLower()) {
                "1" { $InstallMode = "full"; break }
                "full" { $InstallMode = "full"; break }
                "2" { $InstallMode = "readonly"; break }
                "readonly" { $InstallMode = "readonly"; break }
                "safe" { $InstallMode = "readonly"; break }
                default {
                    Write-Host "⚠ Invalid selection '$selection'. Enter 1 or 2." -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "✗ No mode selected in non-interactive install. Re-run with -InstallFull or -InstallReadonly." -ForegroundColor Red
        exit 1
    }
}

if ($InstallMode -eq "readonly") {
    Write-Host "▸ Selected mode: READONLY" -ForegroundColor Cyan
} else {
    Write-Host "▸ Selected mode: FULL" -ForegroundColor Cyan
}

# ── Check prerequisites ──────────────────────────────────────────────────
Write-Host "▸ Checking prerequisites..." -ForegroundColor Cyan

$azPath = Get-Command az -ErrorAction SilentlyContinue
if (-not $azPath) {
    Write-Host "⚠ Azure CLI (az) not found. Install it first:" -ForegroundColor Yellow
    Write-Host "  https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows" -ForegroundColor Yellow
    Write-Host "  azm will be installed, but won't work until 'az' is available." -ForegroundColor Yellow
    Write-Host ""
}

# ── Find source script ──────────────────────────────────────────────────
$ScriptRoot = $PSScriptRoot
if (-not $ScriptRoot) { $ScriptRoot = Get-Location }

$SourceScript = $null
$BinSourceFull = Join-Path $ScriptRoot "bin" "azm.ps1"
$RootSourceFull = Join-Path $ScriptRoot "azm.ps1"
$BinSourceReadonly = Join-Path $ScriptRoot "bin" "azm-readonly.ps1"
$RootSourceReadonly = Join-Path $ScriptRoot "azm-readonly.ps1"

if ($InstallMode -eq "readonly") {
    if (Test-Path $BinSourceReadonly) {
        $SourceScript = $BinSourceReadonly
    } elseif (Test-Path $RootSourceReadonly) {
        $SourceScript = $RootSourceReadonly
    } else {
        Write-Host "✗ Cannot find readonly azm script (bin\azm-readonly.ps1). Run this installer from repository root." -ForegroundColor Red
        exit 1
    }
} else {
    if (Test-Path $BinSourceFull) {
        $SourceScript = $BinSourceFull
    } elseif (Test-Path $RootSourceFull) {
        $SourceScript = $RootSourceFull
    } else {
        Write-Host "✗ Cannot find full azm script (bin\azm.ps1). Run this installer from repository root." -ForegroundColor Red
        exit 1
    }
}

# ── Install ──────────────────────────────────────────────────────────────
Write-Host "▸ Installing azm to $BIN_DIR ..." -ForegroundColor Cyan

if (-not (Test-Path $BIN_DIR)) {
    New-Item -ItemType Directory -Path $BIN_DIR -Force | Out-Null
}

Copy-Item $SourceScript (Join-Path $BIN_DIR "azm.ps1") -Force
Write-Host "✓ Installed azm.ps1 to $BIN_DIR" -ForegroundColor Green
Set-Content -Path $MODE_FILE -Value $InstallMode -Encoding ASCII
Write-Host "✓ Saved install mode to $MODE_FILE" -ForegroundColor Green

# ── Create batch wrapper for CMD ─────────────────────────────────────────
$batWrapper = Join-Path $BIN_DIR "azm.cmd"
@"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0azm.ps1" %*
"@ | Set-Content -Path $batWrapper -Encoding ASCII
Write-Host "✓ Created azm.cmd wrapper for Command Prompt" -ForegroundColor Green

# ── Add to PATH ──────────────────────────────────────────────────────────
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$BIN_DIR*") {
    [Environment]::SetEnvironmentVariable("Path", "$BIN_DIR;$currentPath", "User")
    Write-Host "✓ Added $BIN_DIR to user PATH" -ForegroundColor Green
    Write-Host "▸ Note: Restart your terminal for PATH changes to take effect." -ForegroundColor Cyan
} else {
    Write-Host "▸ PATH already contains $BIN_DIR" -ForegroundColor Cyan
}

# ── Create PowerShell function (for current profile) ────────────────────
$profileDir = Split-Path $PROFILE -Parent
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

$funcBlock = @"

# azm — Azure Multi-Client CLI Manager
function azm { & "$BIN_DIR\azm.ps1" @args }
"@

if (Test-Path $PROFILE) {
    $profileContent = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
    if ($profileContent -notlike "*azm*") {
        Add-Content -Path $PROFILE -Value $funcBlock
        Write-Host "✓ Added 'azm' function to PowerShell profile" -ForegroundColor Green
    } else {
        Write-Host "▸ PowerShell profile already has azm configured" -ForegroundColor Cyan
    }
} else {
    Set-Content -Path $PROFILE -Value $funcBlock
    Write-Host "✓ Created PowerShell profile with 'azm' function" -ForegroundColor Green
}

# ── Done ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "✓ Installation complete!" -ForegroundColor Green
Write-Host ""
if ($InstallMode -eq "readonly") {
    Write-Host "▸ Installed mode: READONLY (destructive Azure CLI verbs blocked in azm run/compare)" -ForegroundColor Cyan
} else {
    Write-Host "▸ Installed mode: FULL (no read-only verb blocking in azm run/compare)" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "▸ Quick start:" -ForegroundColor Cyan
Write-Host "  1. Restart your terminal"
Write-Host "  2. azm add <name> <tenant> <email>"
Write-Host "  3. azm login <name>"
Write-Host "  4. azm run <name> az group list -o table"
Write-Host ""
Write-Host "▸ Switch mode later by rerunning installer with one of:" -ForegroundColor Cyan
Write-Host "  .\install.ps1 -InstallFull"
Write-Host "  .\install.ps1 -InstallReadonly"
Write-Host ""
Write-Host "▸ Run 'azm help' for all commands." -ForegroundColor Cyan
Write-Host ""
