@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ==========================================
echo       fineSTEM Dev Environment
echo       (with ZeroClaw Daemon)
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

echo [0/5] Cleaning up old processes...
REM Kill leftover node/esbuild processes that cause "service is no longer running" errors
taskkill /F /IM esbuild.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
REM Kill existing zeroclaw daemon if running
taskkill /F /IM zeroclaw.exe >nul 2>&1
echo       Old processes cleaned.
echo.

echo [1/5] Checking ports...
netstat -ano | findstr ":42617 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] Port 42617 (ZeroClaw) is still in use after cleanup
)
netstat -ano | findstr ":3200 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] Port 3200 is still in use after cleanup
)
netstat -ano | findstr ":5184 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] Port 5184 is still in use after cleanup
)
echo.

echo [2/5] Starting ZeroClaw Daemon (port 42617)...
REM Check if zeroclaw exists
if not exist "H:\dev-env\zeroclaw\bin\zeroclaw.exe" (
    echo [ERROR] ZeroClaw not found at H:\dev-env\zeroclaw\bin\zeroclaw.exe
    echo         Please install ZeroClaw or update the path in this script.
    pause
    exit /b 1
)

start "fineSTEM ZeroClaw Daemon" cmd /k "cd /d H:\dev-env\zeroclaw && set ZEROCLAW_CONFIG_DIR=H:\dev-env\zeroclaw\config && set ZEROCLAW_DATA_DIR=H:\dev-env\zeroclaw\data && .\bin\zeroclaw.exe daemon"

echo       Probing ZeroClaw /health (timeout 30s)...
setlocal enabledelayedexpansion
set ZEROCLAW_READY=0
for /l %%i in (1,1,30) do (
    if !ZEROCLAW_READY! equ 0 (
        timeout /t 1 >nul
        powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:42617/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            set ZEROCLAW_READY=1
            echo       ZeroClaw ready after %%i second(s)
        )
    )
)

if !ZEROCLAW_READY! equ 0 (
    echo [ERROR] ZeroClaw failed to respond on /health within 30 seconds.
    echo         Backend and Frontend will NOT be started.
    echo         Please check the ZeroClaw window for errors.
    endlocal
    pause
    exit /b 1
)
endlocal
echo.

echo [3/5] Starting Backend (port 3200)...
start "fineSTEM Backend" cmd /k "cd /d %~dp0apps\backend && python -m uvicorn main:app --host 0.0.0.0 --port 3200 --reload"

echo       Probing Backend /health (timeout 30s)...
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
echo.

echo [4/5] Starting Frontend (port 5184)...
start "fineSTEM Frontend" cmd /k "cd /d %~dp0apps\frontend && npm run dev"

echo       Waiting for frontend (5s)...
timeout /t 5 >nul
echo.

echo [5/5] Opening browser...
start http://localhost:5184

echo.
echo ==========================================
echo       Dev server started!
echo ==========================================
echo   Frontend:  http://localhost:5184
echo   Backend:   http://localhost:3200/api/v1
echo   API Docs:  http://localhost:3200/docs
echo   ZeroClaw:  http://localhost:42617 (WebSocket: ws://localhost:42617/ws)
echo ==========================================
echo.
echo Services:
echo   - ZeroClaw Daemon : port 42617
echo   - Backend (FastAPI): port 3200
echo   - Frontend (Vite)  : port 5184
echo.
echo Close this window to stop all services
echo Or close the corresponding CMD windows individually
echo ==========================================
pause
