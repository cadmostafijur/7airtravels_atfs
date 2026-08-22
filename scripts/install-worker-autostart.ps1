# Install ATFS office worker to start automatically (no terminal needed).
# Website can be on Vercel; this PC only runs the worker for K50A + SMS.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\install-worker-autostart.ps1

$ErrorActionPreference = "Stop"
$taskName = "7AirTravels-ATFS-Worker"
$repoRoot = Split-Path -Parent $PSScriptRoot
$stub = Join-Path $repoRoot "scripts\stub-server-only.cjs"
$worker = Join-Path $repoRoot "src\server\worker.ts"
$tsxCli = Join-Path $repoRoot "node_modules\tsx\dist\cli.mjs"
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source

if (-not (Test-Path $tsxCli)) {
  Write-Host "Run npm install in the project first." -ForegroundColor Red
  exit 1
}

$arguments = "`"$tsxCli`" --require `"$stub`" `"$worker`""

Write-Host "Repo: $repoRoot"
Write-Host "Node: $nodeExe"
Write-Host "Task: $taskName"
Write-Host ""

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "Removed old task."
}

$action = New-ScheduledTaskAction -Execute $nodeExe -Argument $arguments -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "7 Air Travels ATFS - K50A sync and SMS worker" `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Installed. Worker starts at Windows logon and is running now." -ForegroundColor Green
Write-Host "Check: http://127.0.0.1:3001/health"
Write-Host ""
Write-Host "Remove later: npm run worker:autostart:remove"
Write-Host "Client website: deploy to Vercel. This PC only runs the worker."
