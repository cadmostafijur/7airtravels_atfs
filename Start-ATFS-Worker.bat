@echo off
title 7 Air Travels - ATFS Worker

REM Always use the project folder (works from Desktop too)
set "REPO=E:\7airtravels_atfs"
cd /d "%REPO%" 2>nul
if errorlevel 1 (
  echo  ERROR: Project folder not found: %REPO%
  echo.
  pause
  exit /b 1
)

echo.
echo  Starting ATFS worker (K50A sync + SMS)...
echo  Folder: %CD%
echo.

powershell -NoProfile -Command "try { Invoke-WebRequest http://127.0.0.1:3001/health -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL%==0 (
  echo  OK - worker is already running.
  echo  Open: http://127.0.0.1:3001/health
  echo.
  pause
  exit /b 0
)

if not exist "package.json" (
  echo  ERROR: package.json missing in %CD%
  pause
  exit /b 1
)

if not exist ".env" (
  echo  ERROR: .env file not found. Copy .env into this folder first.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo  node_modules missing. Running npm install - please wait...
  echo.
  call npm install
  if errorlevel 1 (
    echo  npm install failed. Check internet and try again.
    pause
    exit /b 1
  )
)

if not exist "node_modules\tsx\" (
  echo  ERROR: tsx missing after install. Run: npm install
  echo.
  pause
  exit /b 1
)

if not exist "logs\" mkdir logs

start "ATFS-Worker" /MIN cmd /c "npm run start:worker > logs\worker-out.log 2>&1"

echo  Waiting for health (up to 25 seconds)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok=$false; for($i=0;$i -lt 25;$i++){ try { $h=Invoke-WebRequest http://127.0.0.1:3001/health -UseBasicParsing -TimeoutSec 2; Write-Host '  OK - worker is ready.'; Write-Host ('  ' + $h.Content); $ok=$true; break } catch { Start-Sleep -Seconds 1 } }; if(-not $ok){ Write-Host '  FAILED - worker did not become ready.'; if(Test-Path 'logs\worker-out.log'){ Write-Host ''; Write-Host '  --- last log lines ---'; Get-Content 'logs\worker-out.log' -Tail 20 } }"

echo.
echo  Check anytime: http://127.0.0.1:3001/health
echo  Stop: Desktop Stop-ATFS-Worker.bat
echo.
pause
