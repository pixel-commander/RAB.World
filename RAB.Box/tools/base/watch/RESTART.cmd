@echo off
node "%~dp0..\..\..\scripts\watcher.mjs" restart %*
exit /b %errorlevel%
