@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 22 or newer is required.
  pause
  exit /b 1
)
node demo.mjs
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" echo Finished with an error. The details are above.
pause
exit /b %RESULT%
