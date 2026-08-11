<#
.SYNOPSIS
    Completes the parts of the GYM MAP development environment that require
    administrator rights.

.DESCRIPTION
    The automated setup ran without elevation and could not install anything
    machine-wide. This script installs what is left:

        1. WSL 2                 - required by Docker Desktop on Windows 11 Home
        2. Docker Desktop        - runs the A-28 local stack
        3. Gitleaks (A-25)       - secret scanning, used by the pre-commit hook
        4. Trivy (A-25)          - vulnerability scanning

    Step 1 requires a REBOOT. Run the script again afterwards to finish.

.NOTES
    Run in an ADMINISTRATOR PowerShell:

        cd C:\Users\Mehdi\Desktop\GymMap
        powershell -ExecutionPolicy Bypass -File docs\setup\elevated-setup.ps1
#>

[CmdletBinding()]
param(
    [switch]$SkipDocker
)

$ErrorActionPreference = 'Stop'

function Write-Step { param($m) Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "  [ok]   $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "  [warn] $m" -ForegroundColor Yellow }

# ---------------------------------------------------------------------------
# Guard: must be elevated
# ---------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script must run as Administrator." -ForegroundColor Red
    Write-Host "Right-click PowerShell -> 'Run as administrator', then re-run." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# 1. WSL 2
#
# Docker Desktop on Windows 11 *Home* has no Hyper-V backend available, so WSL 2
# is not optional here.
# ---------------------------------------------------------------------------
Write-Step 'WSL 2'

$wslStatus = (wsl --status 2>&1 | Out-String) -replace "`0", ''
if ($wslStatus -match 'not installed') {
    Write-Host '  installing WSL 2 (no distribution - Docker provides its own)...'
    # --no-distribution keeps this to the kernel + platform only. Docker Desktop
    # creates docker-desktop as its own WSL instance; a full Ubuntu install is
    # not required and costs several GB.
    wsl --install --no-distribution
    Write-Warn 'REBOOT REQUIRED. Restart Windows, then run this script again.'
    Write-Warn 'Nothing further will be installed in this pass.'
    exit 0
}
else {
    Write-Ok 'WSL is already installed'
    wsl --set-default-version 2 2>&1 | Out-Null
    wsl --update 2>&1 | Out-Null
    Write-Ok 'WSL updated and defaulted to version 2'
}

# ---------------------------------------------------------------------------
# 2. Docker Desktop
# ---------------------------------------------------------------------------
if (-not $SkipDocker) {
    Write-Step 'Docker Desktop'

    if (Test-Path "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe") {
        Write-Ok 'Docker Desktop is already installed'
    }
    else {
        $free = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
        if ($free -lt 15) {
            Write-Warn "Only $free GB free on C:. Docker Desktop plus the A-28 images needs ~15 GB."
            Write-Warn 'Free some space first, or install to another drive manually.'
        }
        Write-Host '  installing (this takes several minutes)...'
        winget install --id Docker.DockerDesktop `
            --accept-package-agreements --accept-source-agreements
        Write-Ok 'Docker Desktop installed'
        Write-Warn 'Launch Docker Desktop once and let it finish first-run setup.'
        Write-Warn 'In Settings -> General, confirm "Use WSL 2 based engine" is ticked.'
    }
}

# ---------------------------------------------------------------------------
# 3. Security scanners (A-25) - referenced by .husky/pre-commit and CI
# ---------------------------------------------------------------------------
Write-Step 'Security scanners (A-25)'

foreach ($pkg in @(
        @{ Id = 'Gitleaks.Gitleaks'; Name = 'gitleaks' },
        @{ Id = 'AquaSecurity.Trivy'; Name = 'trivy' }
    )) {
    if (Get-Command $pkg.Name -ErrorAction SilentlyContinue) {
        Write-Ok "$($pkg.Name) already installed"
    }
    else {
        try {
            winget install --id $pkg.Id --accept-package-agreements --accept-source-agreements
            Write-Ok "$($pkg.Name) installed"
        }
        catch {
            Write-Warn "$($pkg.Name) failed: $($_.Exception.Message)"
        }
    }
}

# ---------------------------------------------------------------------------
# 4. Verify
# ---------------------------------------------------------------------------
Write-Step 'Verification'

foreach ($t in 'docker', 'gitleaks', 'trivy') {
    $c = Get-Command $t -ErrorAction SilentlyContinue
    if ($c) { Write-Ok "$t -> $($c.Source)" } else { Write-Warn "$t not on PATH (open a new terminal, or it is not installed)" }
}

Write-Host @'

Next steps
----------
  1. Open a NEW terminal so PATH changes take effect.
  2. Start Docker Desktop and wait for the whale icon to settle.
  3. From the repository root:

         pnpm infra:up
         pnpm infra:ps        # every service should read (healthy)

     First run pulls ~1.5 GB of images.

  4. Confirm the stack:

         docker exec gymmap-postgres psql -U postgres -d gymmap -c "SELECT postgis_version();"
         docker exec gymmap-redis redis-cli ping
         start http://localhost:8025      # Mailpit
         start http://localhost:9001      # MinIO console

'@ -ForegroundColor Cyan
