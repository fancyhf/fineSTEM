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

echo [0/6] Cleaning up old processes...
REM Kill leftover esbuild processes that cause "service is no longer running" errors
taskkill /F /IM esbuild.exe >nul 2>&1
REM Kill existing zeroclaw daemon if running
taskkill /F /IM zeroclaw.exe >nul 2>&1
echo       Old processes cleaned.
echo.

echo [1/6] Checking ports...
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
netstat -ano | findstr ":5185 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] Port 5185 is still in use after cleanup
)
echo.

echo [2/6] Starting ZeroClaw Daemon (port 42617)...
start "fineSTEM ZeroClaw" cmd /k "cd /d H:\dev-env\zeroclaw && set ZEROCLAW_CONFIG_DIR=H:\dev-env\zeroclaw\config && set ZEROCLAW_DATA_DIR=H:\dev-env\zeroclaw\data && .\bin\zeroclaw.exe daemon"

REM ZeroClaw gateway has no /health HTTP endpoint (require_pairing=true, API-only).
REM Use TCP socket connect to verify the daemon is listening on its port.
echo       Probing ZeroClaw port 42617 (timeout 30s)...
setlocal enabledelayedexpansion
set ZEROCLAW_READY=0
for /l %%i in (1,1,30) do (
    if !ZEROCLAW_READY! equ 0 (
        timeout /t 1 >nul
        powershell -NoProfile -Command "try { $c=New-Object System.Net.Sockets.TcpClient('127.0.0.1',42617); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            set ZEROCLAW_READY=1
            echo       ZeroClaw ready after %%i second(s)
        )
    )
)

if !ZEROCLAW_READY! equ 0 (
    echo [WARN] ZeroClaw port 42617 not listening within 30 seconds.
    echo         Continuing anyway - check the ZeroClaw window for errors.
)
endlocal
echo.

echo [3/6] Starting backend (port 3200)...
start "fineSTEM Backend" cmd /k "cd /d %~dp0apps\backend && python -m uvicorn main:app --host 0.0.0.0 --port 3200 --reload"

echo       Probing backend /health (timeout 45s)...
setlocal enabledelayedexpansion
set BACKEND_READY=0
for /l %%i in (1,1,45) do (
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
    echo [WARN] Backend failed to respond on /health within 45 seconds.
    echo         Continuing anyway - check the backend window for errors.
)
endlocal

echo [4/6] Starting frontend (port 5184)...
start "fineSTEM Frontend" cmd /k "cd /d %~dp0apps\frontend && npm run dev"

echo       Waiting for frontend (5s)...
timeout /t 5 >nul

echo [5/6] Starting Know frontend (port 5185)...
start "fineSTEM Know" cmd /k "cd /d %~dp0apps\know && npm run dev"

echo       Waiting for Know frontend (5s)...
timeout /t 5 >nul

echo [6/6] Opening browser...
start http://localhost:5184
start http://localhost:5185

echo.
echo ==========================================
echo       Dev server started!
echo ==========================================
echo   Frontend:  http://localhost:5184
echo   Know:      http://localhost:5185
echo   Backend:   http://localhost:3200/api
echo   API Docs:  http://localhost:3200/docs
echo   ZeroClaw:  http://localhost:42617
echo ==========================================
echo.
echo Close this window to stop services
echo Or close the corresponding CMD windows
echo ==========================================
pause
