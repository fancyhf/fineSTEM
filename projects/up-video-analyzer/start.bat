@echo off
REM UP Video Content Analyzer Startup Script (Windows)
REM Port: 4002

cd /d "%~dp0"
set PORT=4002

echo === Starting UP Video Content Analyzer ===
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
pip install -r requirements.txt

REM Start application
echo Starting application...
python -m streamlit run src/main.py --server.port=%PORT% --server.headless=true

echo Application stopped
pause
