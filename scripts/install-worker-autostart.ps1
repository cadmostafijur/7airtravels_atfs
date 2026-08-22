# Install ATFS office worker to start at Windows BOOT (no login, no terminal).
# Best used on a dedicated always-on mini PC next to the router/K50A.
# Run PowerShell as Administrator:
#   cd E:\7airtravels_atfs
#   npm run worker:autostart

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
Write-Host "Task: $taskName (At startup)"
Write-Host ""

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "Removed old task."
}

$action = New-ScheduledTaskAction -Execute $nodeExe -Argument $arguments -WorkingDirectory $repoRoot
# Boot time — does not wait for someone to open Windows desktop
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

# Current user: needs password for "run whether logged on or not" in GUI.
# AtStartup + interactive user still works after auto-login / always-on mini PC.
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "7 Air Travels ATFS - K50A sync and SMS. Starts at PC boot." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "OK — worker task installed (starts when PC powers on)." -ForegroundColor Green
Write-Host "Check: http://127.0.0.1:3001/health"
Write-Host ""
Write-Host "IMPORTANT: keep this PC powered ON. If PC is off, SMS stops."
Write-Host "Best: dedicated mini PC that never shuts down + website on Vercel."
Write-Host "Remove: npm run worker:autostart:remove"
