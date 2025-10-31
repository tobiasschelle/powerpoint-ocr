#!/bin/bash

# CRAFT Text Detection Service Startup Script
# This script helps you quickly start the CRAFT service using different methods

set -e

echo "=================================="
echo "CRAFT Text Detection Service"
echo "=================================="
echo ""

# Check if Docker is available
if command -v docker &> /dev/null; then
    HAS_DOCKER=true
else
    HAS_DOCKER=false
fi

# Check if Python is available
if command -v python3 &> /dev/null; then
    HAS_PYTHON=true
    PYTHON_VERSION=$(python3 --version)
else
    HAS_PYTHON=false
fi

echo "System Check:"
echo "  Docker: $HAS_DOCKER"
echo "  Python: $HAS_PYTHON${PYTHON_VERSION:+ - $PYTHON_VERSION}"
echo ""

# Show menu
echo "Select CRAFT service startup method:"
echo ""
echo "  1) Docker - Pre-built image (bedapudi6788/keras-craft)"
echo "  2) Docker - Custom FastAPI image (build from Dockerfile)"
echo "  3) Python - Direct FastAPI service (no Docker)"
echo "  4) Exit"
echo ""

read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        if [ "$HAS_DOCKER" = false ]; then
            echo "Error: Docker is not installed"
            exit 1
        fi

        echo ""
        echo "Starting pre-built CRAFT Docker container..."
        echo "Port: 8500"
        echo "URL: http://localhost:8500"
        echo ""

        # Check if container is already running
        if docker ps | grep -q keras-craft; then
            echo "Container is already running!"
            docker ps | grep keras-craft
        else
            docker run --rm -d \
                --name craft-service \
                -p 8500:8500 \
                bedapudi6788/keras-craft:generic-english

            echo "Container started successfully!"
            echo ""
            echo "Set environment variable:"
            echo "  export CRAFT_SERVICE_URL=http://localhost:8500"
            echo ""
            echo "Or for Supabase Edge Functions (local):"
            echo "  export CRAFT_SERVICE_URL=http://host.docker.internal:8500"
            echo ""
            echo "To stop: docker stop craft-service"
        fi
        ;;

    2)
        if [ "$HAS_DOCKER" = false ]; then
            echo "Error: Docker is not installed"
            exit 1
        fi

        echo ""
        echo "Building custom CRAFT Docker image..."

        # Get the directory where this script is located
        SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

        docker build -t craft-service "$SCRIPT_DIR"

        echo ""
        echo "Starting custom CRAFT Docker container..."
        echo "Port: 8080"
        echo "URL: http://localhost:8080"
        echo ""

        docker run --rm -d \
            --name craft-service \
            -p 8080:8080 \
            craft-service

        echo "Container started successfully!"
        echo ""
        echo "Set environment variable:"
        echo "  export CRAFT_SERVICE_URL=http://localhost:8080"
        echo ""
        echo "Or for Supabase Edge Functions (local):"
        echo "  export CRAFT_SERVICE_URL=http://host.docker.internal:8080"
        echo ""
        echo "To stop: docker stop craft-service"
        ;;

    3)
        if [ "$HAS_PYTHON" = false ]; then
            echo "Error: Python 3 is not installed"
            exit 1
        fi

        echo ""
        echo "Starting FastAPI CRAFT service..."
        echo "Port: 8080"
        echo "URL: http://localhost:8080"
        echo ""

        # Get the directory where this script is located
        SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

        # Check if requirements are installed
        if ! python3 -c "import fastapi" 2>/dev/null; then
            echo "Installing dependencies..."
            pip install -r "$SCRIPT_DIR/requirements.txt"
        fi

        echo "Starting service..."
        echo ""
        echo "Set environment variable (in another terminal):"
        echo "  export CRAFT_SERVICE_URL=http://localhost:8080"
        echo ""
        echo "Press Ctrl+C to stop the service"
        echo ""

        cd "$SCRIPT_DIR"
        python3 main.py
        ;;

    4)
        echo "Exiting..."
        exit 0
        ;;

    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
