#!/bin/bash

# Setup cleanup function on exit (Ctrl+C)
cleanup() {
    echo -e "\n\nStopping all services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "=================================================="
echo "          Starting MediGuard AI Locally           "
echo "=================================================="

# 1. Check if MongoDB is running
echo "Checking MongoDB connection..."
if ! nc -z localhost 27017 &>/dev/null; then
    echo "⚠️ Warning: MongoDB does not seem to be running on localhost:27017!"
    echo "Attempting to start MongoDB via brew (macOS)..."
    brew services start mongodb-community || echo "Could not start MongoDB automatically. Please ensure it is running."
fi

# 2. Start Backend
echo "Starting Backend (FastAPI)..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
python app.py &
BACKEND_PID=$!
cd ..

# 3. Start Frontend
echo "Starting Frontend (React)..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies (npm install)..."
    npm install
fi
npm run dev &
FRONTEND_PID=$!
cd ..

echo "=================================================="
echo "🚀 Services are starting up!"
echo "- Frontend: http://localhost:5173 or http://localhost:3000"
echo "- Backend: http://localhost:8000"
echo "Press Ctrl+C to stop all services."
echo "=================================================="

# Keep script running to capture Ctrl+C and forward output logs
wait
