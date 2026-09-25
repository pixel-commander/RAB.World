@echo off
node "%~dp0..\..\..\scripts\watcher.mjs" start %*
exit /b %errorlevel%
