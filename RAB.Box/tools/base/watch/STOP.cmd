@echo off
node "%~dp0..\..\..\scripts\watcher.mjs" stop %*
exit /b %errorlevel%
