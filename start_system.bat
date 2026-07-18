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

echo       Probing backend /health (timeout 30s)...
setlocal enabledelayedexpansion
set BACKEND_READY=0
for /l %%i in (1,1,30) do (
    if !BACKEND_READY! equ 0 (
        timeout /t 1 >nul
        powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:3200/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            set BACKEND_READY=1
            echo       Backend ready after %%i second(s)
        )
    )
)

if !BACKEND_READY! equ 0 (
    echo [ERROR] Backend failed to respond on /health within 30 seconds.
    echo         Frontend will NOT be started. Please check the backend window for errors.
    endlocal
    pause
    exit /b 1
)
endlocal

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