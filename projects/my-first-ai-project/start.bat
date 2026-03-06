@echo off
REM Literary Knowledge Card Startup Script (Windows)
REM Port: 4001

cd /d "%~dp0"
set PORT=4001

echo === Starting Literary Knowledge Card App ===
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

REM Install dependencies
echo Checking dependencies...
pip install Flask

REM Start application
echo Starting application...
cd src
set FLASK_APP=app.py
set FLASK_PORT=%PORT%
python app.py

echo Application stopped
pause
