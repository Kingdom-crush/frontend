@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
echo.
echo Press any key to close this window.
pause >nul
