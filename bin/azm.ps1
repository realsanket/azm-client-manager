<#
.SYNOPSIS
    azm — Azure Multi-Client CLI Manager (PowerShell edition)

.DESCRIPTION
    Manages multiple Azure tenants/subscriptions with isolated CLI profiles.
    Each client gets its own AZURE_CONFIG_DIR so credentials, tokens, and
    config never leak across clients.

    This is the Windows-native PowerShell version of the azm tool.
    For macOS/Linux, use the Bash version (bin/azm).

.EXAMPLE
    azm add mycompany mycompany.onmicrosoft.com user@mycompany.com
    azm login mycompany
    azm run mycompany az group list -o table
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command,

    [Parameter(Position = 1, ValueFromRemainingArguments)]
    [string[]]$Arguments
)

$ErrorActionPreference = "Stop"

$script:AZM_VERSION = "1.0.0"

# ── paths ─────────────────────────────────────────────────────────────────
$script:AZM_HOME = if ($env:AZM_HOME) { $env:AZM_HOME } else { Join-Path $HOME ".azclients" }
$script:AZM_CLIENTS_FILE = Join-Path $script:AZM_HOME "clients.conf"
$script:AZM_PROFILES_DIR = Join-Path $script:AZM_HOME "profiles"
$script:AZM_LOGS_DIR = Join-Path $script:AZM_HOME "logs"

# ── helpers ───────────────────────────────────────────────────────────────
function Write-Info  { param([string]$Msg) Write-Host "▸ $Msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Msg) Write-Host "✓ $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "⚠ $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "✗ $Msg" -ForegroundColor Red }

function Exit-WithError {
    param([string]$Msg)
    Write-Err $Msg
    exit 1
}

function Ensure-Dirs {
    if (-not (Test-Path $script:AZM_PROFILES_DIR)) { New-Item -ItemType Directory -Path $script:AZM_PROFILES_DIR -Force | Out-Null }
    if (-not (Test-Path $script:AZM_LOGS_DIR)) { New-Item -ItemType Directory -Path $script:AZM_LOGS_DIR -Force | Out-Null }
    if (-not (Test-Path $script:AZM_CLIENTS_FILE)) { New-Item -ItemType File -Path $script:AZM_CLIENTS_FILE -Force | Out-Null }
}

function Sanitize-Name {
    param([string]$Name)
    $Name.ToLower() -replace '[^a-z0-9-]', '-' -replace '-+', '-' -replace '^-|-$', ''
}

function Lookup-Client {
    param([string]$Name)
    $sanitized = Sanitize-Name $Name
    if (Test-Path $script:AZM_CLIENTS_FILE) {
        Get-Content $script:AZM_CLIENTS_FILE | Where-Object { $_ -match "^$sanitized\|" } | Select-Object -First 1
    }
}

function Test-ClientExists {
    param([string]$Name)
    $null -ne (Lookup-Client $Name) -and (Lookup-Client $Name) -ne ""
}

function Get-ClientField {
    param([string]$Line, [int]$Index)
    ($Line -split '\|')[$Index]
}

function Get-ProfileDir {
    param([string]$Name)
    $sanitized = Sanitize-Name $Name
    Join-Path $script:AZM_PROFILES_DIR $sanitized
}

function Get-LogFile {
    param([string]$Name)
    $sanitized = Sanitize-Name $Name
    Join-Path $script:AZM_LOGS_DIR "$sanitized.log"
}

function Write-AuditLog {
    param([string]$Name, [string]$Entry)
    $logFile = Get-LogFile $Name
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "$timestamp | $Entry"
}

function Show-Context {
    param([string]$Name)
    $line = Lookup-Client $Name
    $tenant = Get-ClientField $line 1
    $sub = Get-ClientField $line 2
    $email = Get-ClientField $line 3
    Write-Host "─────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "Client : " -NoNewline -ForegroundColor White; Write-Host $Name
    Write-Host "Tenant : " -NoNewline -ForegroundColor White; Write-Host $tenant
    Write-Host "Subscr : " -NoNewline -ForegroundColor White; Write-Host $sub
    Write-Host "Email  : " -NoNewline -ForegroundColor White; Write-Host $email
    Write-Host "─────────────────────────────────────────────" -ForegroundColor DarkGray
}

# ══════════════════════════════════════════════════════════════════════════
# COMMANDS
# ══════════════════════════════════════════════════════════════════════════

function Invoke-Add {
    param([string[]]$Args)
    if ($Args.Count -lt 3) {
        Exit-WithError "Usage: azm add <name> <tenant-id-or-domain> <email> [subscription-id]"
    }
    $rawName = $Args[0]; $tenant = $Args[1]; $email = $Args[2]
    $sub = if ($Args.Count -ge 4) { $Args[3] } else { "" }
    $name = Sanitize-Name $rawName

    if (Test-ClientExists $name) {
        Exit-WithError "Client '$name' already registered. Remove first with: azm remove $name"
    }
    if ([string]::IsNullOrEmpty($tenant)) { Exit-WithError "Tenant cannot be empty" }
    if ([string]::IsNullOrEmpty($email)) { Exit-WithError "Email cannot be empty" }

    $pdir = Get-ProfileDir $name
    if (-not (Test-Path $pdir)) { New-Item -ItemType Directory -Path $pdir -Force | Out-Null }

    Add-Content -Path $script:AZM_CLIENTS_FILE -Value "$name|$tenant|$sub|$email"
    Write-Ok "Registered client '$name'"
    Write-Info "Profile dir : $pdir"
    if ([string]::IsNullOrEmpty($sub)) { Write-Info "Subscription not provided — will be auto-detected on login" }
    Write-Info "Next step   : azm login $name"
}

function Invoke-List {
    param([string[]]$Args)
    if (-not (Test-Path $script:AZM_CLIENTS_FILE) -or (Get-Item $script:AZM_CLIENTS_FILE).Length -eq 0) {
        Write-Warn "No clients registered yet. Use: azm add <name> <tenant> <email>"
        return
    }

    # --names: machine-readable, one client name per line
    if ($Args.Count -ge 1 -and $Args[0] -eq "--names") {
        Get-Content $script:AZM_CLIENTS_FILE | ForEach-Object {
            if ([string]::IsNullOrWhiteSpace($_) -or $_.StartsWith("#")) { return }
            ($_ -split '\|')[0]
        }
        return
    }

    # --json: machine-readable JSON array
    if ($Args.Count -ge 1 -and $Args[0] -eq "--json") {
        $clients = @()
        Get-Content $script:AZM_CLIENTS_FILE | ForEach-Object {
            if ([string]::IsNullOrWhiteSpace($_) -or $_.StartsWith("#")) { return }
            $fields = $_ -split '\|'
            $pdir = Get-ProfileDir $fields[0]
            $loggedIn = (Test-Path (Join-Path $pdir "msal_token_cache.json")) -or
                        (Test-Path (Join-Path $pdir "accessTokens.json")) -or
                        (Test-Path (Join-Path $pdir "msal_token_cache.bin"))
            $clients += [PSCustomObject]@{
                name = $fields[0]; tenant = $fields[1]; subscription = $fields[2]; email = $fields[3]; logged_in = $loggedIn
            }
        }
        $clients | ConvertTo-Json -Depth 2
        return
    }

    Write-Host ("{0,-20} {1,-40} {2,-38} {3}" -f "CLIENT", "TENANT", "SUBSCRIPTION", "EMAIL") -ForegroundColor White
    Write-Host ("─" * 140)
    Get-Content $script:AZM_CLIENTS_FILE | ForEach-Object {
        if ([string]::IsNullOrWhiteSpace($_) -or $_.StartsWith("#")) { return }
        $fields = $_ -split '\|'
        $cname = $fields[0]; $ctenant = $fields[1]; $csub = $fields[2]; $cemail = $fields[3]
        $pdir = Get-ProfileDir $cname
        $hasToken = (Test-Path (Join-Path $pdir "msal_token_cache.json")) -or
                    (Test-Path (Join-Path $pdir "accessTokens.json")) -or
                    (Test-Path (Join-Path $pdir "msal_token_cache.bin"))
        if ($hasToken) {
            Write-Host "● " -NoNewline -ForegroundColor Green
        } else {
            Write-Host "○ " -NoNewline -ForegroundColor Red
        }
        Write-Host ("{0,-19} {1,-40} {2,-38} {3}" -f $cname, $ctenant, $csub, $cemail)
    }
    Write-Host ""
    Write-Host "  " -NoNewline; Write-Host "●" -NoNewline -ForegroundColor Green; Write-Host " = token cache present (may be expired)   " -NoNewline
    Write-Host "○" -NoNewline -ForegroundColor Red; Write-Host " = needs login"
    Write-Host ""
    Write-Info "Note: If 'azm run' fails with auth error, the token is expired. Run: azm login <name>"
}

function Invoke-LoginOne {
    param([string]$Name)
    if (-not (Test-ClientExists $Name)) {
        Write-Err "Client '$Name' not found. Run 'azm list' to see registered clients."
        return $false
    }

    $line = Lookup-Client $Name
    $tenant = Get-ClientField $line 1
    $sub = Get-ClientField $line 2
    $email = Get-ClientField $line 3
    $pdir = Get-ProfileDir $Name

    Show-Context $Name
    Write-Info "Logging in interactively for $Name ..."
    Write-Info "A browser window will open. Sign in as: $email"
    Write-Host ""

    $env:AZURE_CONFIG_DIR = $pdir
    try {
        az login --tenant $tenant --only-show-errors
    } finally {
        Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue
    }

    $env:AZURE_CONFIG_DIR = $pdir
    try {
        if (-not [string]::IsNullOrEmpty($sub)) {
            az account set --subscription $sub --only-show-errors
            Write-Info "Default subscription set to: $sub"
        } else {
            $detectedSub = az account show --query id -o tsv 2>$null
            if (-not [string]::IsNullOrEmpty($detectedSub)) {
                $content = Get-Content $script:AZM_CLIENTS_FILE
                $newContent = $content | ForEach-Object {
                    $fields = $_ -split '\|'
                    if ($fields[0] -eq $Name) {
                        "$($fields[0])|$($fields[1])|$detectedSub|$($fields[3])"
                    } else { $_ }
                }
                $newContent | Set-Content $script:AZM_CLIENTS_FILE
                Write-Info "Auto-detected subscription: $detectedSub (saved)"
                $sub = $detectedSub
            } else {
                Write-Warn "Could not detect subscription. Set it manually: azm set-sub $Name <sub-id>"
            }
        }
    } finally {
        Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue
    }

    Write-AuditLog $Name "LOGIN tenant=$tenant subscription=$sub"
    Write-Host ""
    Write-Ok "Login successful for '$Name'"
    return $true
}

function Invoke-Login {
    param([string[]]$Args)
    if ($Args.Count -lt 1) {
        Exit-WithError "Usage: azm login <client-name> [client2 client3 ...]"
    }

    if ($Args.Count -eq 1) {
        $name = Sanitize-Name $Args[0]
        Invoke-LoginOne $name
        return
    }

    $total = $Args.Count
    $failed = 0
    Write-Host "Logging in to $total clients sequentially..." -ForegroundColor White
    Write-Host ""

    for ($i = 0; $i -lt $total; $i++) {
        $name = Sanitize-Name $Args[$i]
        Write-Host "[$($i+1)/$total] " -NoNewline -ForegroundColor DarkGray
        Write-Host "Starting login for " -NoNewline; Write-Host $name -ForegroundColor White
        Write-Host ""
        $result = Invoke-LoginOne $name
        if (-not $result) { $failed++ }
        if ($i -lt ($total - 1)) {
            Write-Host "⏎  Press Enter to continue to next client..." -NoNewline -ForegroundColor Yellow
            Read-Host
            Write-Host ""
        }
    }

    Write-Host ""
    Write-Host "Login summary: $($total - $failed)/$total succeeded" -ForegroundColor White
    if ($failed -eq 0) { Write-Ok "All clients logged in successfully" }
    else { Write-Warn "$failed client(s) failed" }
}

function Invoke-LoginAll {
    if (-not (Test-Path $script:AZM_CLIENTS_FILE) -or (Get-Item $script:AZM_CLIENTS_FILE).Length -eq 0) {
        Exit-WithError "No clients registered. Use: azm add <name> <tenant> <email>"
    }

    $names = @()
    Get-Content $script:AZM_CLIENTS_FILE | ForEach-Object {
        if ([string]::IsNullOrWhiteSpace($_) -or $_.StartsWith("#")) { return }
        $names += ($_ -split '\|')[0]
    }

    Write-Info "Found $($names.Count) registered client(s): $($names -join ', ')"
    Write-Host ""
    Invoke-Login $names
}

function Invoke-Check {
    param([string[]]$Args)
    if ($Args.Count -lt 1) {
        Exit-WithError "Usage: azm check <client-name> [client2 client3 ...]`n  Validates token(s) without full status output."
    }

    $failed = 0
    foreach ($raw in $Args) {
        $name = Sanitize-Name $raw
        
        if (-not (Test-ClientExists $name)) {
            Write-Err "Client '$name' not found"
            $failed++
            continue
        }

        $pdir = Get-ProfileDir $name
        
        # Proper validation: az account get-access-token forces refresh token validation.
        # az account show only reads cached data and won't detect expired refresh tokens.
        $env:AZURE_CONFIG_DIR = $pdir
        try {
            $null = az account get-access-token --output none 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Ok "$name`: token valid"
            } else {
                Write-Err "$name`: token expired or not logged in"
                $failed++
            }
        } finally {
            Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue
        }
    }

    if ($failed -eq 0) { exit 0 } else { exit 1 }
}

function Invoke-CheckExpired {
    if (-not (Test-Path $script:AZM_CLIENTS_FILE) -or (Get-Item $script:AZM_CLIENTS_FILE).Length -eq 0) {
        Exit-WithError "No clients registered. Use: azm add <name> <tenant> <email>"
    }

    Write-Info "Checking all registered clients for expired tokens..."
    Write-Host ""

    $names = @()
    $expired = @()
    $valid = @()

    Get-Content $script:AZM_CLIENTS_FILE | ForEach-Object {
        if ([string]::IsNullOrWhiteSpace($_) -or $_.StartsWith("#")) { return }
        $names += ($_ -split '\|')[0]
    }

    # Check each client
    foreach ($name in $names) {
        $pdir = Get-ProfileDir $name
        $env:AZURE_CONFIG_DIR = $pdir
        try {
            $null = az account get-access-token --output none 2>$null
            if ($LASTEXITCODE -eq 0) {
                $valid += $name
            } else {
                $expired += $name
            }
        } finally {
            Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue
        }
    }

    # Report results
    if ($valid.Count -gt 0) {
        Write-Host "Valid tokens ($($valid.Count)):" -ForegroundColor White
        foreach ($name in $valid) {
            Write-Host "  " -NoNewline
            Write-Host "✓" -NoNewline -ForegroundColor Green
            Write-Host " $name"
        }
        Write-Host ""
    }

    if ($expired.Count -gt 0) {
        Write-Host "Expired/missing tokens ($($expired.Count)):" -ForegroundColor White
        foreach ($name in $expired) {
            Write-Host "  " -NoNewline
            Write-Host "✗" -NoNewline -ForegroundColor Red
            Write-Host " $name"
        }
        Write-Host ""
        Write-Info "To re-login expired clients, run: azm login-expired"
        exit 1
    } else {
        Write-Ok "All clients have valid tokens!"
        exit 0
    }
}

function Invoke-LoginExpired {
    if (-not (Test-Path $script:AZM_CLIENTS_FILE) -or (Get-Item $script:AZM_CLIENTS_FILE).Length -eq 0) {
        Exit-WithError "No clients registered. Use: azm add <name> <tenant> <email>"
    }

    Write-Info "Checking all registered clients for expired tokens..."
    Write-Host ""

    $names = @()
    $expired = @()

    Get-Content $script:AZM_CLIENTS_FILE | ForEach-Object {
        if ([string]::IsNullOrWhiteSpace($_) -or $_.StartsWith("#")) { return }
        $names += ($_ -split '\|')[0]
    }

    # Check each client - use get-access-token for proper validation
    foreach ($name in $names) {
        $pdir = Get-ProfileDir $name
        $env:AZURE_CONFIG_DIR = $pdir
        try {
            $null = az account get-access-token --output none 2>$null
            if ($LASTEXITCODE -ne 0) {
                $expired += $name
            }
        } finally {
            Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue
        }
    }

    if ($expired.Count -eq 0) {
        Write-Ok "All clients have valid tokens!"
        return
    }

    Write-Info "Found $($expired.Count) client(s) with expired/missing tokens: $($expired -join ', ')"
    Write-Host ""
    Invoke-Login $expired
}

function Invoke-Run {
    param([string[]]$Args)
    if ($Args.Count -lt 2) {
        Exit-WithError "Usage: azm run <client-name> <az-command...>`n  Example: azm run mycompany az group list"
    }
    $name = Sanitize-Name $Args[0]
    $cmdArgs = $Args[1..($Args.Count - 1)]

    if (-not (Test-ClientExists $name)) {
        Exit-WithError "Client '$name' not found. Run 'azm list' to see registered clients."
    }

    $pdir = Get-ProfileDir $name
    if (-not (Test-Path $pdir)) {
        Exit-WithError "Profile directory missing for '$name'. Re-add the client."
    }

    Show-Context $name
    Write-Info "Running: $($cmdArgs -join ' ')"
    Write-Host ""

    Write-AuditLog $name ($cmdArgs -join ' ')

    $env:AZURE_CONFIG_DIR = $pdir
    try {
        & $cmdArgs[0] $cmdArgs[1..($cmdArgs.Count - 1)]
        $rc = $LASTEXITCODE
    } finally {
        Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue
    }

    if ($rc -ne 0) {
        Write-Host ""
        Write-Warn "Command exited with code $rc"
        if ($rc -eq 1) {
            Write-Info "If session expired, re-login with: azm login $name"
        }
    }
}

function Invoke-Switch {
    param([string[]]$Args)
    if ($Args.Count -lt 1) {
        Exit-WithError "Usage: azm switch <client-name>`nThen run: `$env:AZURE_CONFIG_DIR = (azm switch <client-name>)"
    }
    $name = Sanitize-Name $Args[0]
    if (-not (Test-ClientExists $name)) { Exit-WithError "Client '$name' not found." }
    $pdir = Get-ProfileDir $name
    Write-Output $pdir
}

function Invoke-Status {
    param([string[]]$Args)
    if ($Args.Count -ge 1) {
        $name = Sanitize-Name $Args[0]
        if (-not (Test-ClientExists $name)) { Exit-WithError "Client '$name' not found." }
        Show-Context $name
        $pdir = Get-ProfileDir $name
        Write-Info "Profile dir: $pdir"
        Write-Host ""
        Write-Info "Checking account status..."
        $env:AZURE_CONFIG_DIR = $pdir
        try {
            az account show --output table 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Warn "Not logged in or session expired. Run: azm login $name"
            }
        } finally {
            Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue
        }
        return
    }

    if ($env:AZURE_CONFIG_DIR) {
        Write-Info "Current AZURE_CONFIG_DIR: $env:AZURE_CONFIG_DIR"
    } else {
        Write-Info "No client switched in current shell (AZURE_CONFIG_DIR not set)"
        Write-Info "Use 'azm run <client> <command>' for isolated execution"
        Write-Info "Or set `$env:AZURE_CONFIG_DIR = (azm switch <client>)"
    }
}

function Invoke-Remove {
    param([string[]]$Args)
    if ($Args.Count -lt 1) { Exit-WithError "Usage: azm remove <client-name>" }
    $name = Sanitize-Name $Args[0]
    if (-not (Test-ClientExists $name)) { Exit-WithError "Client '$name' not found." }

    $content = Get-Content $script:AZM_CLIENTS_FILE | Where-Object { $_ -notmatch "^$name\|" }
    if ($null -eq $content) { $content = "" }
    $content | Set-Content $script:AZM_CLIENTS_FILE

    $pdir = Get-ProfileDir $name
    if (Test-Path $pdir) {
        Remove-Item -Recurse -Force $pdir
        Write-Info "Removed profile directory: $pdir"
    }

    $logFile = Get-LogFile $name
    if (Test-Path $logFile) { Remove-Item -Force $logFile }

    Write-Ok "Removed client '$name'"
}

function Invoke-Log {
    param([string[]]$Args)
    if ($Args.Count -lt 1) { Exit-WithError "Usage: azm log <client-name> [lines]" }
    $name = Sanitize-Name $Args[0]
    $lines = if ($Args.Count -ge 2) { [int]$Args[1] } else { 20 }

    if (-not (Test-ClientExists $name)) { Exit-WithError "Client '$name' not found." }

    $logFile = Get-LogFile $name
    if (-not (Test-Path $logFile) -or (Get-Item $logFile).Length -eq 0) {
        Write-Info "No command log for '$name' yet."
        return
    }

    Write-Host "Last $lines commands for '$name':" -ForegroundColor White
    Get-Content $logFile | Select-Object -Last $lines
}

function Invoke-Compare {
    param([string[]]$Args)
    if ($Args.Count -lt 3) {
        Exit-WithError "Usage: azm compare <client1> <client2> <az-command...>"
    }
    $name1 = Sanitize-Name $Args[0]
    $name2 = Sanitize-Name $Args[1]
    $cmdArgs = $Args[2..($Args.Count - 1)]

    foreach ($n in @($name1, $name2)) {
        if (-not (Test-ClientExists $n)) { Exit-WithError "Client '$n' not found." }
    }

    $pdir1 = Get-ProfileDir $name1
    $pdir2 = Get-ProfileDir $name2

    $tmp1 = [System.IO.Path]::GetTempFileName()
    $tmp2 = [System.IO.Path]::GetTempFileName()

    Write-Host ""
    Write-Host "═══ $name1 ═══" -ForegroundColor White
    $env:AZURE_CONFIG_DIR = $pdir1
    try { & $cmdArgs[0] $cmdArgs[1..($cmdArgs.Count - 1)] 2>&1 | Tee-Object -FilePath $tmp1 }
    finally { Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue }
    Write-AuditLog $name1 "COMPARE $($cmdArgs -join ' ')"

    Write-Host ""
    Write-Host "═══ $name2 ═══" -ForegroundColor White
    $env:AZURE_CONFIG_DIR = $pdir2
    try { & $cmdArgs[0] $cmdArgs[1..($cmdArgs.Count - 1)] 2>&1 | Tee-Object -FilePath $tmp2 }
    finally { Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue }
    Write-AuditLog $name2 "COMPARE $($cmdArgs -join ' ')"

    Write-Host ""
    Write-Info "Diff (if any):"
    $diff = Compare-Object (Get-Content $tmp1) (Get-Content $tmp2)
    if ($diff) { $diff | Format-Table -AutoSize } else { Write-Info "No differences found." }

    Remove-Item $tmp1, $tmp2 -Force -ErrorAction SilentlyContinue
}

function Invoke-SetSub {
    param([string[]]$Args)
    if ($Args.Count -lt 2) { Exit-WithError "Usage: azm set-sub <client-name> <subscription-id>" }
    $name = Sanitize-Name $Args[0]
    $sub = $Args[1]

    if (-not (Test-ClientExists $name)) { Exit-WithError "Client '$name' not found." }

    $content = Get-Content $script:AZM_CLIENTS_FILE | ForEach-Object {
        $fields = $_ -split '\|'
        if ($fields[0] -eq $name) {
            "$($fields[0])|$($fields[1])|$sub|$($fields[3])"
        } else { $_ }
    }
    $content | Set-Content $script:AZM_CLIENTS_FILE

    $pdir = Get-ProfileDir $name
    if (Test-Path $pdir) {
        $env:AZURE_CONFIG_DIR = $pdir
        try { az account set --subscription $sub --only-show-errors 2>$null }
        finally { Remove-Item Env:\AZURE_CONFIG_DIR -ErrorAction SilentlyContinue }
    }

    Write-Ok "Subscription for '$name' updated to: $sub"
}

function Show-Help {
    Write-Host @"

  ╔═══════════════════════════════════════════════════════════╗
  ║    azm — Azure Multi-Client CLI Manager (PowerShell)     ║
  ╚═══════════════════════════════════════════════════════════╝

  COMMANDS:
    add <name> <tenant> <email> [subscription-id]
        Register a client. Subscription is optional — auto-detected on login.

    list
        Show all registered clients and their login status.

    login <name> [name2 name3 ...]
        Interactive browser login for one or more clients (sequential).

    login-all
        Login to every registered client sequentially.

    login-expired
        Check all clients and only re-login those with expired/invalid tokens.
        Useful after a weekend or when conditional access policies expire tokens.

    check <name> [name2 name3 ...]
        Validate specific client token(s) without full status output.
        Returns exit code 0 if all tokens valid, 1 if any expired.
        Example: azm check mycompany; if (!$?) { azm login mycompany }

    check-expired
        Check all clients and report which have expired/missing tokens.
        Does not perform login - just reports status grouped by valid/expired.
        Returns exit code 0 if all valid, 1 if any expired.

    run <name> <command...>
        Execute any command with that client's isolated Azure context.
        Example: azm run mycompany az group list -o table

    switch <name>
        Returns the profile directory path. Usage:
        `$env:AZURE_CONFIG_DIR = (azm switch mycompany)

    status [name]
        Show active context or details for a specific client.

    set-sub <name> <subscription-id>
        Manually set or update the subscription for a client.

    remove <name>
        Unregister a client and delete its profile/tokens.

    log <name> [lines]
        Show recent command log for a client (default: 20 lines).

    compare <name1> <name2> <command...>
        Run the same command against two clients and diff the output.

    version
        Show the azm version.

    help
        Show this help message.

  EXAMPLES:
    azm add mycompany mycompany.onmicrosoft.com user@mycompany.com
    azm login mycompany
    azm login mycompany othercompany    # login two back-to-back
    azm login-all                       # login every registered client
    azm login-expired                   # only re-login expired tokens

    # Check token validity (fast)
    azm check mycompany                 # single client
    azm check mycompany othercompany    # multiple clients
    azm check-expired                   # list all expired clients

    azm run mycompany az group list -o table
    azm compare mycompany othercompany az group list -o json

  CONDITIONAL ACCESS & TOKEN EXPIRATION:
    If your organization enforces conditional access policies (e.g., 24-hour max token
    lifetime), tokens will expire frequently. Run 'azm login-expired' periodically to
    refresh only the expired sessions, or use service principals for automation.

  PREREQUISITES:
    - Azure CLI (az) must be installed and on PATH
    - PowerShell 5.1+ or PowerShell 7+

  ENVIRONMENT:
    AZM_HOME     Base directory (default: ~/.azclients)

"@
}

# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════
Ensure-Dirs

if ([string]::IsNullOrEmpty($Command)) {
    Show-Help
    exit 0
}

switch ($Command) {
    "add"       { Invoke-Add $Arguments }
    "list"      { Invoke-List $Arguments }
    "ls"        { Invoke-List $Arguments }
    "login"     { Invoke-Login $Arguments }
    "login-all" { Invoke-LoginAll }
    "login-expired" { Invoke-LoginExpired }
    "check"     { Invoke-Check $Arguments }
    "check-expired" { Invoke-CheckExpired }
    "run"       { Invoke-Run $Arguments }
    "switch"    { Invoke-Switch $Arguments }
    "status"    { Invoke-Status $Arguments }
    "remove"    { Invoke-Remove $Arguments }
    "rm"        { Invoke-Remove $Arguments }
    "log"       { Invoke-Log $Arguments }
    "compare"   { Invoke-Compare $Arguments }
    "cmp"       { Invoke-Compare $Arguments }
    "set-sub"   { Invoke-SetSub $Arguments }
    "version"   { Write-Host "azm version $script:AZM_VERSION" }
    "-v"        { Write-Host "azm version $script:AZM_VERSION" }
    "--version" { Write-Host "azm version $script:AZM_VERSION" }
    "help"      { Show-Help }
    "-h"        { Show-Help }
    "--help"    { Show-Help }
    default     { Exit-WithError "Unknown command: $Command`nRun 'azm help' for usage." }
}
