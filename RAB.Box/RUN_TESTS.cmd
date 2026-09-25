@echo off
pushd "%~dp0"
node --test tests/*.test.mjs engine/tests/*.test.mjs
set CODE=%ERRORLEVEL%
popd
pause
exit /b %CODE%
