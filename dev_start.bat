@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ==========================================
echo       fineSTEM Dev Start
echo ==========================================
echo.

echo [0/4] Cleaning up old processes...
taskkill /F /IM zeroclaw.exe >nul 2>&1
echo       Old processes cleaned.
echo.

echo [1/4] Checking ports...

set PORT_42617_IN_USE=0
set PORT_3200_IN_USE=0
set PORT_5184_IN_USE=0

for /f "tokens=*" %%a in ('netstat -ano ^| findstr ":42617 " ^| findstr "LISTENING"') do (
    set PORT_42617_IN_USE=1
)
for /f "tokens=*" %%a in ('netstat -ano ^| findstr ":3200 " ^| findstr "LISTENING"') do (
    set PORT_3200_IN_USE=1
)
for /f "tokens=*" %%a in ('netstat -ano ^| findstr ":5184 " ^| findstr "LISTENING"') do (
    set PORT_5184_IN_USE=1
)

if %PORT_42617_IN_USE%==1 (
    echo [WARN] Port 42617 ^(ZeroClaw^) is in use, daemon may fail to start
)
if %PORT_3200_IN_USE%==1 (
    echo [WARN] Port 3200 is in use, backend may fail to start
)
if %PORT_5184_IN_USE%==1 (
    echo [WARN] Port 5184 is in use, frontend may fail to start
)

echo.

echo [2/4] Starting ZeroClaw Daemon (port 42617)...
start "fineSTEM-ZeroClaw" cmd /k "cd /d H:\dev-env\zeroclaw && set ZEROCLAW_CONFIG_DIR=H:\dev-env\zeroclaw\config && set ZEROCLAW_DATA_DIR=H:\dev-env\zeroclaw\data && .\bin\zeroclaw.exe daemon"

echo       Waiting for daemon (3s)...
timeout /t 3 >nul
echo.

echo [3/4] Starting backend (port 3200)...
start "fineSTEM-Backend" cmd /k "cd /d %~dp0apps\backend && C:\Python312\python.exe -m uvicorn main:app --host 0.0.0.0 --port 3200 --reload"

echo       Waiting for backend (3s)...
timeout /t 3 >nul

echo [4/4] Starting frontend (port 5184)...
start "fineSTEM-Frontend" cmd /k "cd /d %~dp0apps\frontend && d:\nvm4w\nodejs\npm.cmd run dev"

echo       Waiting for frontend (5s)...
timeout /t 5 >nul

echo Opening browser...
start http://localhost:5184

echo.
echo ==========================================
echo       Dev server started!
echo ==========================================
echo   Frontend:  http://localhost:5184
echo   Backend:   http://localhost:3200/api/v1
echo   API Docs:  http://localhost:3200/docs
echo   ZeroClaw:  http://localhost:42617
echo ==========================================
echo.
echo Services:
echo   - ZeroClaw Daemon : port 42617
echo   - Backend (FastAPI): port 3200
echo   - Frontend (Vite)  : port 5184
echo.
echo Close this window to stop services
echo Or close the corresponding CMD windows
echo ==========================================
pause
