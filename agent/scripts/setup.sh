#!/bin/bash

###############################################################################
# Markov Audit System - Setup Script
# Version: 2.0.0
# Updated: 2025-10-26 06:10:45 UTC
# Developer: charlesms-eth
# License: MIT (FREE OPEN SOURCE)
#
# Automated setup script for complete installation
###############################################################################

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "🚀 Markov Audit System - Automated Setup"
echo "═══════════════════════════════════════════════════════════════"
echo "Version: 2.0.0"
echo "Developer: charlesms-eth"
echo "License: MIT (FREE OPEN SOURCE)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "✗ Python 3 not found. Please install Python 3.10+"
    exit 1
fi
echo "✓ Python 3 found: $(python3 --version)"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found. Please install Node.js 16+"
    exit 1
fi
echo "✓ Node.js found: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "✗ npm not found. Please install npm"
    exit 1
fi
echo "✓ npm found: $(npm --version)"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📦 Installing Dependencies"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install
echo "✓ Node.js dependencies installed"

# Create Python virtual environment
echo ""
echo "🐍 Setting up Python environment..."
cd python

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1
echo "✓ pip upgraded"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt
echo "✓ Python dependencies installed"

cd ..

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "⚙️  Configuration"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Setup environment file
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.template .env
    echo "✓ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your configuration:"
    echo "   1. Add your Agentverse API key"
    echo "   2. Generate agent seeds with: python python/scripts/generate_seeds.py"
    echo "   3. Get mailbox keys from Agentverse dashboard"
else
    echo "✓ .env file already exists"
fi

# Create output directories
echo ""
echo "📁 Creating directories..."
mkdir -p audit-reports
mkdir -p logs
echo "✓ Directories created"

# Generate agent seeds
echo ""
echo "🔐 Generating agent seeds..."
cd python
source venv/bin/activate
python << 'EOF'
import secrets

agents = ["COORDINATOR", "REENTRANCY", "ACCESS_CONTROL", "INTEGER_OVERFLOW", "EXTERNAL_CALLS", "GAS_OPTIMIZATION"]

print("\n# Generated Agent Seeds (add to .env):")
print("# Copy these to your .env file\n")

for agent in agents:
    seed = secrets.token_hex(32)
    print(f"{agent}_AGENT_SEED={seed}")

print("\n✓ Seeds generated. Copy the above to your .env file!")
EOF

cd ..

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Setup Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Edit .env file with your API keys:"
echo "   nano .env"
echo ""
echo "2. Start the audit engine:"
echo "   cd python && source venv/bin/activate && python main.py"
echo ""
echo "3. In a new terminal, run an audit:"
echo "   npx hardhat markov audit"
echo ""
echo "4. (Optional) Register agents on Agentverse:"
echo "   npm run register-agents"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🆓 Markov is FREE and Open Source!"
echo "⭐ Star us: https://github.com/charlesms-eth/markov-audit"
echo "═══════════════════════════════════════════════════════════════"
echo ""