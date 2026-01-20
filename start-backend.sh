#!/bin/bash
# SkyWeave Backend Startup Script

cd "$(dirname "$0")/backend"

# Activate virtual environment
source venv/bin/activate

# Start the server
echo "Starting SkyWeave API Server..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000
