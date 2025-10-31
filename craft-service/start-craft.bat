@echo off
REM CRAFT Text Detection Service Startup Script for Windows

echo ==================================
echo CRAFT Text Detection Service
echo ==================================
echo.

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    set HAS_DOCKER=true
) else (
    set HAS_DOCKER=false
)

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set HAS_PYTHON=true
    for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
) else (
    set HAS_PYTHON=false
)

echo System Check:
echo   Docker: %HAS_DOCKER%
if "%HAS_PYTHON%"=="true" (
    echo   Python: %HAS_PYTHON% - %PYTHON_VERSION%
) else (
    echo   Python: %HAS_PYTHON%
)
echo.

echo Select CRAFT service startup method:
echo.
echo   1^) Docker - Pre-built image ^(bedapudi6788/keras-craft^)
echo   2^) Docker - Custom FastAPI image ^(build from Dockerfile^)
echo   3^) Python - Direct FastAPI service ^(no Docker^)
echo   4^) Exit
echo.

set /p choice="Enter choice [1-4]: "

if "%choice%"=="1" goto docker_prebuilt
if "%choice%"=="2" goto docker_custom
if "%choice%"=="3" goto python_direct
if "%choice%"=="4" goto exit_script
echo Invalid choice
goto :eof

:docker_prebuilt
if "%HAS_DOCKER%"=="false" (
    echo Error: Docker is not installed
    goto :eof
)

echo.
echo Starting pre-built CRAFT Docker container...
echo Port: 8500
echo URL: http://localhost:8500
echo.

docker ps | findstr keras-craft >nul 2>&1
if %errorlevel% equ 0 (
    echo Container is already running!
    docker ps | findstr keras-craft
) else (
    docker run --rm -d --name craft-service -p 8500:8500 bedapudi6788/keras-craft:generic-english
    echo Container started successfully!
    echo.
    echo Set environment variable:
    echo   set CRAFT_SERVICE_URL=http://localhost:8500
    echo.
    echo Or for PowerShell:
    echo   $env:CRAFT_SERVICE_URL="http://localhost:8500"
    echo.
    echo To stop: docker stop craft-service
)
goto :eof

:docker_custom
if "%HAS_DOCKER%"=="false" (
    echo Error: Docker is not installed
    goto :eof
)

echo.
echo Building custom CRAFT Docker image...

docker build -t craft-service "%~dp0"

echo.
echo Starting custom CRAFT Docker container...
echo Port: 8080
echo URL: http://localhost:8080
echo.

docker run --rm -d --name craft-service -p 8080:8080 craft-service

echo Container started successfully!
echo.
echo Set environment variable:
echo   set CRAFT_SERVICE_URL=http://localhost:8080
echo.
echo Or for PowerShell:
echo   $env:CRAFT_SERVICE_URL="http://localhost:8080"
echo.
echo To stop: docker stop craft-service
goto :eof

:python_direct
if "%HAS_PYTHON%"=="false" (
    echo Error: Python is not installed
    goto :eof
)

echo.
echo Starting FastAPI CRAFT service...
echo Port: 8080
echo URL: http://localhost:8080
echo.

REM Check if requirements are installed
python -c "import fastapi" 2>nul
if %errorlevel% neq 0 (
    echo Installing dependencies...
    pip install -r "%~dp0requirements.txt"
)

echo Starting service...
echo.
echo Set environment variable ^(in another terminal^):
echo   set CRAFT_SERVICE_URL=http://localhost:8080
echo.
echo Or for PowerShell:
echo   $env:CRAFT_SERVICE_URL="http://localhost:8080"
echo.
echo Press Ctrl+C to stop the service
echo.

cd /d "%~dp0"
python main.py
goto :eof

:exit_script
echo Exiting...
goto :eof
