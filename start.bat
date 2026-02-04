@echo off
REM ForecastWell Dashboard - Windows Startup Script

echo ============================================
echo   ForecastWell Dashboard - Starting Up
echo   Weather-Based Demand Forecasting
echo ============================================
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        echo Please ensure Python is installed and in PATH
        pause
        exit /b 1
    )
    echo Virtual environment created successfully
    echo.
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

REM Check if dependencies are installed
echo.
echo Checking dependencies...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo Dependencies installed successfully
) else (
    echo Dependencies are already installed
)

REM Check if .env exists
if not exist ".env" (
    echo.
    echo Creating .env from template...
    copy .env.example .env
    echo Please configure .env file with your settings
    echo.
)

REM Start the application
echo.
echo ============================================
echo   Starting ForecastWell Dashboard...
echo   Dashboard will be available at:
echo   http://localhost:5000
echo ============================================
echo.
echo Press Ctrl+C to stop the server
echo.

python app.py

pause
