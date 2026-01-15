@echo off
echo ========================================
echo Starting fineSTEM Backend Service
echo ========================================
echo.

cd /d "%~dp0"
echo Current directory: %CD%
echo.

echo Checking Python version...
python --version
echo.

echo Checking if uvicorn is installed...
python -c "import uvicorn; print(f'uvicorn version: {uvicorn.__version__}')" 2>nul
if errorlevel 1 (
    echo ERROR: uvicorn is not installed!
    echo Please run: pip install -r requirements_py38.txt
    pause
    exit /b 1
)
echo.

echo Starting backend server...
echo API endpoint: http://localhost:8000/finestem/api
echo Press Ctrl+C to stop the server
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --root-path /finestem/api

pause
