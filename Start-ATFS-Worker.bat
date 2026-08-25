@echo off
title 7 Air Travels - ATFS Worker
cd /d "%~dp0"

echo.
echo  Starting ATFS worker (K50A sync + SMS)...
echo.

REM Already running?
powershell -NoProfile -Command "try { Invoke-WebRequest http://127.0.0.1:3001/health -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL%==0 (
  echo  Worker is already running.
  echo  Health: http://127.0.0.1:3001/health
  echo.
  pause
  exit /b 0
)

if not exist "node_modules\tsx\dist\cli.mjs" (
  echo  ERROR: node_modules missing. Run: npm install
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo  ERROR: .env file not found in this folder.
  echo.
  pause
  exit /b 1
)

REM Start hidden in background (no console window stays open)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath 'node' -ArgumentList 'node_modules\tsx\dist\cli.mjs','--require','scripts\stub-server-only.cjs','src\server\worker.ts' -WorkingDirectory '%CD%' -WindowStyle Hidden"

timeout /t 4 /nobreak >nul

powershell -NoProfile -Command "try { $h = Invoke-WebRequest http://127.0.0.1:3001/health -UseBasicParsing -TimeoutSec 5; Write-Host '  OK - worker is running.'; Write-Host ('  ' + $h.Content) } catch { Write-Host '  Started, but health not ready yet.'; Write-Host '  Open http://127.0.0.1:3001/health in a few seconds.' }"

echo.
echo  Keep this PC ON and on office Wi-Fi.
echo  Stop later: double-click Stop-ATFS-Worker.bat
echo.
pause
