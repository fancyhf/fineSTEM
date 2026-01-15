@echo off
cd /d "%~dp0"
echo ==========================================
echo       FineSTEM System Launcher
echo ==========================================

echo.
echo [1/3] Starting Backend Server (Port 8001)...
start "FineSTEM Backend" cmd /k "cd apps\public-web\src\features\mvp\phase1\backend && python -m uvicorn main:app --reload --port 8001"

echo.
echo [2/3] Starting Frontend Server (Port 5174)...
start "FineSTEM Frontend" cmd /k "cd apps\public-web\src\features\mvp\phase1\web && npm run dev -- --port 5174"

echo.
echo [3/3] Waiting for services to initialize...
timeout /t 5 >nul

echo.
echo Opening Browser...
start http://localhost:5174

echo.
echo ==========================================
echo       System Started Successfully!
echo ==========================================
