# Install ATFS worker to start when THIS Windows user logs in (no Admin required).
# For boot-time without login, use Admin: npm run worker:autostart
#
#   cd E:\7airtravels_atfs
#   npm run worker:startup

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$stub = Join-Path $repoRoot "scripts\stub-server-only.cjs"
$worker = Join-Path $repoRoot "src\server\worker.ts"
$tsxCli = Join-Path $repoRoot "node_modules\tsx\dist\cli.mjs"
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$startupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$batPath = Join-Path $startupDir "7AirTravels-ATFS-Worker.bat"
$vbsPath = Join-Path $startupDir "7AirTravels-ATFS-Worker.vbs"

if (-not (Test-Path $tsxCli)) {
  Write-Host "Run npm install in the project first." -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path $startupDir | Out-Null

$bat = @"
@echo off
cd /d "$repoRoot"
"$nodeExe" "$tsxCli" --require "$stub" "$worker"
"@
Set-Content -Path $batPath -Value $bat -Encoding ASCII

$vbs = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "$batPath" & chr(34), 0
Set WshShell = Nothing
"@
Set-Content -Path $vbsPath -Value $vbs -Encoding ASCII

Write-Host "Repo: $repoRoot"
Write-Host "Startup: $vbsPath"
Write-Host ""

# Start now in background (hidden)
$proc = Start-Process -FilePath $nodeExe -ArgumentList "`"$tsxCli`" --require `"$stub`" `"$worker`"" -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 3

try {
  $health = Invoke-WebRequest -Uri "http://127.0.0.1:3001/health" -UseBasicParsing -TimeoutSec 5
  Write-Host "OK - worker started (PID $($proc.Id)). Health: $($health.Content)" -ForegroundColor Green
} catch {
  Write-Host "Worker process started (PID $($proc.Id)). Health check not ready yet - open http://127.0.0.1:3001/health" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "After you log into Windows, the worker starts automatically in the background."
Write-Host "Keep this PC powered ON. Turn off Sleep in Windows power settings."
Write-Host "Remove: npm run worker:startup:remove"
