@echo off
echo ==========================================
echo DBNet Text Detection Service Starter
echo ==========================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

where pip >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: pip is not installed or not in PATH
    echo Please install pip and try again
    pause
    exit /b 1
)

echo Checking Python version...
python --version
echo.

echo Installing Python dependencies...
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Starting DBNet Service on port 8090...
echo ==========================================
echo.
echo Service will be available at:
echo   - http://localhost:8090
echo   - Health check: http://localhost:8090/health
echo.
echo Press Ctrl+C to stop the service
echo.

python main.py
pause
