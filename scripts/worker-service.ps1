# 7 Air Travels ATFS - Windows Service (NSSM) for the K50A sync worker.
#
# First-time install (Administrator PowerShell):
#   cd E:\7airtravels_atfs
#   npm run service:install
#
# Daily use does not require Administrator.

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("install", "uninstall", "start", "stop", "restart", "status")]
  [string]$Action
)

$ErrorActionPreference = "Stop"

$ServiceName = "7AirTravels-ATFS-Worker"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$RunWorker = Join-Path $RepoRoot "scripts\run-worker.cjs"
$LogDir = Join-Path $RepoRoot "logs\worker"
$StdoutLog = Join-Path $LogDir "stdout.log"
$StderrLog = Join-Path $LogDir "stderr.log"
$NssmDir = Join-Path $RepoRoot "tools\nssm"
$NssmExe = Join-Path $NssmDir "nssm.exe"
$HealthUrl = "http://127.0.0.1:3001/health"
$LegacyTaskName = "7AirTravels-ATFS-Worker"

function Test-Administrator {
  $current = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($current)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Require-Administrator {
  if (-not (Test-Administrator)) {
    Write-Host ""
    Write-Host "ERROR: This action requires Administrator PowerShell." -ForegroundColor Red
    Write-Host "Right-click PowerShell -> Run as administrator, then run:"
    Write-Host "  cd $RepoRoot"
    Write-Host "  npm run service:$Action"
    Write-Host ""
    exit 1
  }
}

function Get-NodeExecutable {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "Node.js not found on PATH. Install Node.js 20+ and reopen PowerShell."
  }
  return $node.Source
}

function Ensure-Nssm {
  if (Test-Path $NssmExe) {
    return $NssmExe
  }

  $onPath = Get-Command nssm.exe -ErrorAction SilentlyContinue
  if ($onPath) {
    return $onPath.Source
  }

  Write-Host "NSSM not found. Downloading to $NssmDir ..."
  New-Item -ItemType Directory -Force -Path $NssmDir | Out-Null

  $zipUrl = "https://nssm.cc/release/nssm-2.24.zip"
  $zipPath = Join-Path $env:TEMP "nssm-2.24.zip"
  $extractRoot = Join-Path $env:TEMP "nssm-2.24-extract"

  if (Test-Path $extractRoot) {
    Remove-Item -Recurse -Force $extractRoot
  }

  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
  Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

  $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
  $downloaded = Get-ChildItem -Path $extractRoot -Recurse -Filter "nssm.exe" |
    Where-Object { $_.FullName -like "*\$arch\*" } |
    Select-Object -First 1

  if (-not $downloaded) {
    throw "Could not find nssm.exe in downloaded archive. Install NSSM manually from https://nssm.cc/download"
  }

  Copy-Item $downloaded.FullName $NssmExe -Force
  Write-Host "NSSM installed at $NssmExe" -ForegroundColor Green
  return $NssmExe
}

function Remove-LegacyScheduledTask {
  $existing = Get-ScheduledTask -TaskName $LegacyTaskName -ErrorAction SilentlyContinue
  if ($existing) {
    Stop-ScheduledTask -TaskName $LegacyTaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $LegacyTaskName -Confirm:$false
    Write-Host "Removed legacy scheduled task: $LegacyTaskName"
  }
}

function Get-ServiceStatusText {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $svc) {
    return "NOT INSTALLED"
  }
  return $svc.Status.ToString()
}

function Invoke-Install {
  Require-Administrator

  Write-Host ""
  Write-Host "=== 7 Air Travels ATFS - Install Windows Service ===" -ForegroundColor Cyan
  Write-Host "Repo:   $RepoRoot"
  Write-Host "Service: $ServiceName"
  Write-Host ""

  if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
    throw "node_modules missing. Run: npm ci"
  }

  if (-not (Test-Path (Join-Path $RepoRoot ".env"))) {
    Write-Host "WARNING: .env not found at $RepoRoot\.env" -ForegroundColor Yellow
    Write-Host "Copy .env.example to .env and set Neon, SMS, and sync settings before relying on the service."
    Write-Host ""
  }

  $nodeExe = Get-NodeExecutable
  Write-Host "Node:   $nodeExe"

  Push-Location $RepoRoot
  try {
    Write-Host ""
    Write-Host "Building production worker bundle ..."
    npm run build:worker
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build:worker failed."
    }

    Write-Host ""
    Write-Host "Generating Prisma client ..."
    npm run db:generate
    if ($LASTEXITCODE -ne 0) {
      throw "npm run db:generate failed."
    }
  }
  finally {
    Pop-Location
  }

  if (-not (Test-Path $RunWorker)) {
    throw "Missing launcher: $RunWorker"
  }

  if (-not (Test-Path (Join-Path $RepoRoot "dist\atfs-worker.mjs"))) {
    throw "Missing worker bundle. build:worker did not produce dist\atfs-worker.mjs"
  }

  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  if (-not (Test-Path (Join-Path $LogDir ".gitkeep"))) {
    New-Item -ItemType File -Force -Path (Join-Path $LogDir ".gitkeep") | Out-Null
  }

  $nssm = Ensure-Nssm
  Remove-LegacyScheduledTask

  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Stopping and removing existing service ..."
    & $nssm stop $ServiceName 2>$null | Out-Null
    Start-Sleep -Seconds 2
    & $nssm remove $ServiceName confirm 2>$null | Out-Null
    Start-Sleep -Seconds 1
  }

  Write-Host ""
  Write-Host "Registering Windows service with NSSM ..."

  & $nssm install $ServiceName $nodeExe $RunWorker
  if ($LASTEXITCODE -ne 0) {
    throw "nssm install failed."
  }

  & $nssm set $ServiceName AppDirectory $RepoRoot
  & $nssm set $ServiceName DisplayName "7 Air Travels ATFS Worker"
  & $nssm set $ServiceName Description "K50A attendance sync to Neon PostgreSQL and SMS. Polls device on LAN."
  & $nssm set $ServiceName Start SERVICE_AUTO_START
  & $nssm set $ServiceName AppStdout $StdoutLog
  & $nssm set $ServiceName AppStderr $StderrLog
  & $nssm set $ServiceName AppStdoutCreationDisposition 4
  & $nssm set $ServiceName AppStderrCreationDisposition 4
  & $nssm set $ServiceName AppRotateFiles 1
  & $nssm set $ServiceName AppRotateOnline 1
  & $nssm set $ServiceName AppRotateBytes 10485760
  & $nssm set $ServiceName AppExit Default Restart
  & $nssm set $ServiceName AppRestartDelay 10000
  & $nssm set $ServiceName AppThrottle 30000

  Write-Host ""
  Write-Host "Starting service ..."
  & $nssm start $ServiceName
  if ($LASTEXITCODE -ne 0) {
    throw "nssm start failed. Check $StderrLog"
  }

  Start-Sleep -Seconds 4
  Invoke-Status

  Write-Host ""
  Write-Host "OK - Windows service installed and started." -ForegroundColor Green
  Write-Host ""
  Write-Host "After reboot the worker starts automatically (no terminal, no Cursor)."
  Write-Host "Logs: $LogDir"
  Write-Host "Health: $HealthUrl"
  Write-Host ""
  Write-Host "Manage:"
  Write-Host "  npm run service:status"
  Write-Host "  npm run service:restart"
  Write-Host "  npm run service:stop"
  Write-Host "  npm run service:uninstall"
}

function Invoke-Uninstall {
  Require-Administrator

  $nssm = Ensure-Nssm

  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $existing) {
    Write-Host "Service not installed: $ServiceName"
    exit 0
  }

  Write-Host "Stopping service ..."
  & $nssm stop $ServiceName 2>$null | Out-Null
  Start-Sleep -Seconds 2

  Write-Host "Removing service ..."
  & $nssm remove $ServiceName confirm
  if ($LASTEXITCODE -ne 0) {
    throw "nssm remove failed."
  }

  Write-Host ""
  Write-Host "OK - service removed: $ServiceName" -ForegroundColor Green
  Write-Host "Log files were kept in $LogDir"
}

function Invoke-Start {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $svc) {
    throw "Service not installed. Run: npm run service:install (as Administrator)"
  }
  if ($svc.Status -eq "Running") {
    Write-Host "Service already running: $ServiceName"
    return
  }
  Start-Service -Name $ServiceName
  Start-Sleep -Seconds 3
  Invoke-Status
}

function Invoke-Stop {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $svc) {
    throw "Service not installed."
  }
  if ($svc.Status -eq "Stopped") {
    Write-Host "Service already stopped: $ServiceName"
    return
  }
  Stop-Service -Name $ServiceName -Force
  Start-Sleep -Seconds 2
  Invoke-Status
}

function Invoke-Restart {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $svc) {
    throw "Service not installed. Run: npm run service:install (as Administrator)"
  }
  Restart-Service -Name $ServiceName -Force
  Start-Sleep -Seconds 4
  Invoke-Status
}

function Invoke-Status {
  $status = Get-ServiceStatusText
  Write-Host ""
  Write-Host "Service: $ServiceName"
  Write-Host "Status:  $status"

  if ($status -eq "Running") {
    try {
      $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
      Write-Host "Health:  $($response.StatusCode) $($response.Content)"
    }
    catch {
      Write-Host "Health:  not responding yet ($HealthUrl)" -ForegroundColor Yellow
    }
  }

  if (Test-Path $StdoutLog) {
    Write-Host ""
    Write-Host "Recent stdout (last 5 lines):"
    Get-Content $StdoutLog -Tail 5 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" }
  }

  if (Test-Path $StderrLog) {
    $stderrTail = Get-Content $StderrLog -Tail 3 -ErrorAction SilentlyContinue
    if ($stderrTail) {
      Write-Host ""
      Write-Host "Recent stderr (last 3 lines):"
      $stderrTail | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    }
  }

  Write-Host ""
  Write-Host "Logs: $LogDir"
}

switch ($Action) {
  "install" { Invoke-Install }
  "uninstall" { Invoke-Uninstall }
  "start" { Invoke-Start }
  "stop" { Invoke-Stop }
  "restart" { Invoke-Restart }
  "status" { Invoke-Status }
}
