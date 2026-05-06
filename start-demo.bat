@echo off
setlocal
set "ROOT=%~dp0"
set "PORT_FILE=%ROOT%hdl-web-backend\last-port.txt"

if exist "%PORT_FILE%" del "%PORT_FILE%"

start "HDL Web Backend" cmd /k "cd /d ""%ROOT%hdl-web-backend"" && run-backend.bat"

set "PORT="
for /L %%I in (1,1,20) do (
    if exist "%PORT_FILE%" (
        set /p PORT=<"%PORT_FILE%"
        goto :OPEN_UI
    )
    timeout /t 1 >nul
)

:OPEN_UI
if "%PORT%"=="" set "PORT=18080"
start "" "http://localhost:%PORT%/"
