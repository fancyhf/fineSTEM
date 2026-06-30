@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ==========================================
echo       fineSTEM Dev Environment
echo ==========================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install and add to PATH
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install and add to PATH
    pause
    exit /b 1
)

echo [0/3] Checking ports...
netstat -ano | findstr ":3200 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] Port 3200 is in use, backend may fail to start
)
netstat -ano | findstr ":5184 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] Port 5184 is in use, frontend may fail to start
)
echo.

echo [1/3] Starting backend (port 3200)...
start "fineSTEM Backend" cmd /k "cd /d %~dp0apps\backend && python -m uvicorn main:app --host 0.0.0.0 --port 3200 --reload"

echo       Waiting for backend (3s)...
timeout /t 3 >nul

echo [2/3] Starting frontend (port 5184)...
start "fineSTEM Frontend" cmd /k "cd /d %~dp0apps\frontend && npm run dev"

echo       Waiting for frontend (5s)...
timeout /t 5 >nul

echo [3/3] Opening browser...
start http://localhost:5184

echo.
echo ==========================================
echo       Dev server started!
echo ==========================================
echo   Frontend: http://localhost:5184
echo   Backend:  http://localhost:3200/api/v1
echo   API Docs:  http://localhost:3200/docs
echo ==========================================
echo.
echo Close this window to stop services
echo Or close the corresponding CMD windows
echo ==========================================
pause