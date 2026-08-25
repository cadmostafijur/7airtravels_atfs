# Remove ATFS worker from Windows Startup folder.
$ErrorActionPreference = "Stop"
$startupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$batPath = Join-Path $startupDir "7AirTravels-ATFS-Worker.bat"
$vbsPath = Join-Path $startupDir "7AirTravels-ATFS-Worker.vbs"

foreach ($path in @($vbsPath, $batPath)) {
  if (Test-Path $path) {
    Remove-Item $path -Force
    Write-Host "Removed: $path"
  }
}

Write-Host "Startup entry removed. If worker is still running, end node.exe in Task Manager or reboot."
