#!/bin/bash

###############################################################################
# Markov Audit System - Start Script
# Starts the audit engine in the background
###############################################################################

set -e

echo "🚀 Starting Markov Audit Engine..."

cd python

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "✗ Virtual environment not found. Run: npm run setup"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Start server in background
nohup python main.py > ../logs/markov-engine.log 2>&1 &

PID=$!

echo "✓ Markov Audit Engine started (PID: $PID)"
echo "✓ Logs: logs/markov-engine.log"
echo ""
echo "Check status with:"
echo "  curl http://localhost:8000/health"
echo ""
echo "Stop with:"
echo "  kill $PID"