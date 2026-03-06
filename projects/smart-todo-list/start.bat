@echo off
REM Smart Todo List Startup Script (Windows)
REM Port: 4003

cd /d "%~dp0"
set PORT=4003

echo === Starting Smart Todo List ===
echo Port: %PORT%
echo Path: %CD%
echo.

REM Check if port is in use
netstat -ano | findstr ":%PORT%" >nul
if %errorlevel% equ 0 (
    echo Error: Port %PORT% is already in use
    echo Please check if another service is running
    pause
    exit /b 1
)

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python not found
    pause
    exit /b 1
)

REM Start simple HTTP server
echo Starting application...
cd src
python -m http.server %PORT%

echo Application stopped
pause
