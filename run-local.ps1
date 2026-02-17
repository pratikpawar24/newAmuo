# ============================================
# AUMO v2 - Local Development Setup & Runner
# Runs all services without Docker
# ============================================

Write-Host "AUMO v2 - Local Development Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# ── Check prerequisites ──
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "   Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js not found. Please install Node.js 20+" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "   npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ npm not found" -ForegroundColor Red
    exit 1
}

# Check Python
try {
    $pythonVersion = python --version
    Write-Host "   Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Python not found. AI service will not run." -ForegroundColor Yellow
    $pythonAvailable = $false
}

# Check MongoDB
$mongoRunning = $false
try {
    $mongoTest = mongosh --version 2>$null
    if ($mongoTest) {
        Write-Host "   MongoDB Shell: Available" -ForegroundColor Green
        $mongoRunning = $true
    }
} catch {
    Write-Host "   ⚠️  MongoDB not found. Please install MongoDB or use Docker." -ForegroundColor Yellow
}

Write-Host ""

# ── Setup environment files ──
Write-Host "📝 Setting up environment files..." -ForegroundColor Yellow

if (!(Test-Path "frontend\.env.local")) {
    Copy-Item "frontend\.env.local.example" "frontend\.env.local"
    Write-Host "   Created frontend/.env.local" -ForegroundColor Green
}

if (!(Test-Path "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "   Created backend/.env" -ForegroundColor Green
}

Write-Host ""

# ── Install dependencies ──
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow

# Backend
Write-Host "   [1/3] Backend..." -ForegroundColor Cyan
Set-Location backend
if (!(Test-Path "node_modules")) {
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Backend installation failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "   ✅ Backend ready" -ForegroundColor Green

# Frontend
Set-Location ..\frontend
Write-Host "   [2/3] Frontend..." -ForegroundColor Cyan
if (!(Test-Path "node_modules")) {
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Frontend installation failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "   ✅ Frontend ready" -ForegroundColor Green

# AI Service
Set-Location ..\ai-service
Write-Host "   [3/3] AI Service..." -ForegroundColor Cyan
if ($pythonAvailable) {
    python -m pip install --upgrade pip --quiet
    pip install -r requirements.txt --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ⚠️  AI service installation had issues" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ AI service ready" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠️  Skipped (Python not available)" -ForegroundColor Yellow
}

Set-Location ..

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

if (!$mongoRunning) {
    Write-Host "⚠️  IMPORTANT: MongoDB is required!" -ForegroundColor Yellow
    Write-Host "   Option 1: Install MongoDB locally" -ForegroundColor White
    Write-Host "   Option 2: Use Docker: docker run -d -p 27017:27017 mongo:7" -ForegroundColor White
    Write-Host "   Option 3: Use MongoDB Atlas (cloud)" -ForegroundColor White
    Write-Host ""
    Write-Host "   Press Enter to continue anyway, or Ctrl+C to exit..." -ForegroundColor Yellow
    Read-Host
}

Write-Host "🚀 Starting all services..." -ForegroundColor Cyan
Write-Host ""

# ── Start services in separate terminals ──
Write-Host "📍 Service URLs:" -ForegroundColor Yellow
Write-Host "   Frontend:    http://localhost:3000" -ForegroundColor Green
Write-Host "   Backend:     http://localhost:5000" -ForegroundColor Green
Write-Host "   AI Service:  http://localhost:8000" -ForegroundColor Green
Write-Host ""

# Start Backend
Write-Host "▶️  Starting Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; npm run dev"

Start-Sleep -Seconds 2

# Start Frontend
Write-Host "▶️  Starting Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev"

Start-Sleep -Seconds 2

# Start AI Service
if ($pythonAvailable) {
    Write-Host "▶️  Starting AI Service..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\ai-service'; python main.py"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ All services started in separate windows!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Open your browser to: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "📚 Demo Credentials:" -ForegroundColor Yellow
Write-Host "   User:  priya@aumo.city / demo123" -ForegroundColor White
Write-Host "   Admin: admin@aumo.city / demo123" -ForegroundColor White
Write-Host ""
Write-Host "🛑 To stop all services: Close the PowerShell windows" -ForegroundColor Yellow
Write-Host ""
