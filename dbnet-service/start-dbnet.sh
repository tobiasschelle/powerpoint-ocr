#!/bin/bash

echo "=========================================="
echo "DBNet Text Detection Service Starter"
echo "=========================================="
echo ""

check_command() {
    if command -v $1 &> /dev/null; then
        echo "✓ $1 is installed"
        return 0
    else
        echo "✗ $1 is not installed"
        return 1
    fi
}

echo "Checking dependencies..."
check_command python3
PYTHON_OK=$?
check_command pip3
PIP_OK=$?

if [ $PYTHON_OK -ne 0 ] || [ $PIP_OK -ne 0 ]; then
    echo ""
    echo "ERROR: Python 3 and pip3 are required"
    echo "Please install Python 3.8+ and try again"
    exit 1
fi

echo ""
echo "Python version:"
python3 --version

echo ""
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Failed to install dependencies"
    exit 1
fi

echo ""
echo "=========================================="
echo "Starting DBNet Service on port 8090..."
echo "=========================================="
echo ""
echo "Service will be available at:"
echo "  - http://localhost:8090"
echo "  - Health check: http://localhost:8090/health"
echo ""
echo "Press Ctrl+C to stop the service"
echo ""

python3 main.py
