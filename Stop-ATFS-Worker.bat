@echo off
title 7 Air Travels - Stop ATFS Worker
cd /d "%~dp0"

echo.
echo  Stopping ATFS worker on port 3001...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$killed = $false; Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; $killed = $true }; if ($killed) { Write-Host '  Stopped.' } else { Write-Host '  No worker was listening on port 3001.' }"

echo.
pause
