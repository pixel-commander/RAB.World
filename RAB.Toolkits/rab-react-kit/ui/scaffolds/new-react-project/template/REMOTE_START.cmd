@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Usage: REMOTE_START.cmd ^<trusted-bind-address^>
  echo Example: REMOTE_START.cmd 192.168.1.25
  exit /b 1
)
call npm run dev -- --host "%~1" --port 5173 --strictPort
