$ErrorActionPreference = "Stop"
$taskName = "7AirTravels-ATFS-Worker"

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Host "Task not found: $taskName"
  exit 0
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Removed scheduled task: $taskName" -ForegroundColor Green
Write-Host "If a worker process is still running, end it in Task Manager (node.exe) or reboot."
