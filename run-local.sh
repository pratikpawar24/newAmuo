#!/usr/bin/env bash
# ============================================
# AUMO v2 — Local Development Setup & Runner
# Runs all services without Docker (Linux/Mac)
# ============================================

set -e

echo "🚀 AUMO v2 — Local Development Setup"
echo "======================================"
echo ""

# ── Check prerequisites ──
echo "✅ Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "   ❌ Node.js not found. Please install Node.js 20+"
    exit 1
fi
echo "   Node.js: $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "   ❌ npm not found"
    exit 1
fi
echo "   npm: $(npm --version)"

PYTHON_AVAILABLE=true
if ! command -v python3 &> /dev/null; then
    echo "   ⚠️  Python not found. AI service will not run."
    PYTHON_AVAILABLE=false
else
    echo "   Python: $(python3 --version)"
fi

MONGO_AVAILABLE=true
if ! command -v mongosh &> /dev/null && ! command -v mongo &> /dev/null; then
    echo "   ⚠️  MongoDB not found. Please install MongoDB or use Docker."
    MONGO_AVAILABLE=false
else
    echo "   MongoDB Shell: Available"
fi

echo ""

# ── Setup environment files ──
echo "📝 Setting up environment files..."

[ ! -f frontend/.env.local ] && cp frontend/.env.local.example frontend/.env.local && echo "   Created frontend/.env.local"
[ ! -f backend/.env ] && cp backend/.env.example backend/.env && echo "   Created backend/.env"

echo ""

# ── Install dependencies ──
echo "📦 Installing dependencies..."

# Backend
echo "   [1/3] Backend..."
cd backend
[ ! -d node_modules ] && npm install --legacy-peer-deps
echo "   ✅ Backend ready"

# Frontend
cd ../frontend
echo "   [2/3] Frontend..."
[ ! -d node_modules ] && npm install --legacy-peer-deps
echo "   ✅ Frontend ready"

# AI Service
cd ../ai-service
echo "   [3/3] AI Service..."
if [ "$PYTHON_AVAILABLE" = true ]; then
    python3 -m pip install --upgrade pip --quiet
    pip install -r requirements.txt --quiet
    echo "   ✅ AI service ready"
else
    echo "   ⚠️  Skipped (Python not available)"
fi

cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$MONGO_AVAILABLE" = false ]; then
    echo "⚠️  IMPORTANT: MongoDB is required!"
    echo "   Option 1: Install MongoDB locally"
    echo "   Option 2: Use Docker: docker run -d -p 27017:27017 mongo:7"
    echo "   Option 3: Use MongoDB Atlas (cloud)"
    echo ""
    echo "   Press Enter to continue anyway, or Ctrl+C to exit..."
    read
fi

echo "🚀 Starting all services..."
echo ""

# ── Start services in background ──
echo "📍 Service URLs:"
echo "   Frontend:    http://localhost:3000"
echo "   Backend:     http://localhost:5000"
echo "   AI Service:  http://localhost:8000"
echo ""

# Use trap to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    jobs -p | xargs -r kill 2>/dev/null
    exit
}
trap cleanup INT TERM

# Start Backend
echo "▶️  Starting Backend..."
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!

cd ..
sleep 2

# Start Frontend
echo "▶️  Starting Frontend..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

cd ..
sleep 2

# Start AI Service
if [ "$PYTHON_AVAILABLE" = true ]; then
    echo "▶️  Starting AI Service..."
    cd ai-service
    python3 main.py > ../logs/ai-service.log 2>&1 &
    AI_PID=$!
    cd ..
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Open your browser to: http://localhost:3000"
echo ""
echo "📚 Demo Credentials:"
echo "   User:  priya@aumo.city / demo123"
echo "   Admin: admin@aumo.city / demo123"
echo ""
echo "📋 Logs: Check logs/ directory"
echo "🛑 Press Ctrl+C to stop all services"
echo ""

# Wait for all background jobs
wait
