<#
.SYNOPSIS
    azm installer — Windows (PowerShell)

.DESCRIPTION
    Installs the azm CLI tool for Windows.
    Copies azm.ps1 to ~/.azclients/bin/ and creates a wrapper function.

.EXAMPLE
    # From the repository directory:
    .\install.ps1

    # Or directly from GitHub:
    irm https://raw.githubusercontent.com/<owner>/azm-tool/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

$AZM_HOME = if ($env:AZM_HOME) { $env:AZM_HOME } else { Join-Path $HOME ".azclients" }
$BIN_DIR = Join-Path $AZM_HOME "bin"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor White
Write-Host "  ║   azm — Azure Multi-Client CLI Manager   ║" -ForegroundColor White
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor White
Write-Host ""

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
$BinSource = Join-Path $ScriptRoot "bin" "azm.ps1"
$RootSource = Join-Path $ScriptRoot "azm.ps1"

if (Test-Path $BinSource) {
    $SourceScript = $BinSource
} elseif (Test-Path $RootSource) {
    $SourceScript = $RootSource
} else {
    Write-Host "✗ Cannot find azm.ps1. Run this installer from the repository root." -ForegroundColor Red
    exit 1
}

# ── Install ──────────────────────────────────────────────────────────────
Write-Host "▸ Installing azm to $BIN_DIR ..." -ForegroundColor Cyan

if (-not (Test-Path $BIN_DIR)) {
    New-Item -ItemType Directory -Path $BIN_DIR -Force | Out-Null
}

Copy-Item $SourceScript (Join-Path $BIN_DIR "azm.ps1") -Force
Write-Host "✓ Installed azm.ps1 to $BIN_DIR" -ForegroundColor Green

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
Write-Host "▸ Quick start:" -ForegroundColor Cyan
Write-Host "  1. Restart your terminal"
Write-Host "  2. azm add <name> <tenant> <email>"
Write-Host "  3. azm login <name>"
Write-Host "  4. azm run <name> az group list -o table"
Write-Host ""
Write-Host "▸ Run 'azm help' for all commands." -ForegroundColor Cyan
Write-Host ""
