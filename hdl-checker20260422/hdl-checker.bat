@echo off
setlocal

rem Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

rem Find the JAR file
set "JAR_FILE=%SCRIPT_DIR%hdl-checker-1.0.0.jar"

if not exist "%JAR_FILE%" (
    echo Error: Cannot find %JAR_FILE%
    exit /b 1
)

rem Forward all arguments to the JAR
java -jar "%JAR_FILE%" %*
exit /b %ERRORLEVEL%
