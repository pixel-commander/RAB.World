@echo off
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto missing
node server.mjs --open
popd
pause
exit /b
:missing
echo Install Node.js 22 or newer, then run this again.
popd
pause
exit /b 1
