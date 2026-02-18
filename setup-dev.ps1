# AUMO v2 - Local Development Setup Script (Windows)
# Run this script from the project root directory

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AUMO v2 Local Development Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if Docker is running (for MongoDB)
$dockerRunning = Get-Process docker -ErrorAction SilentlyContinue
if (-not $dockerRunning) {
    Write-Host "`n[WARNING] Docker is not running. MongoDB container won't start." -ForegroundColor Yellow
}

# Create .env files if they don't exist
Write-Host "`n[1/5] Setting up environment files..." -ForegroundColor Green

if (-not (Test-Path "backend/.env")) {
    Copy-Item "backend/.env.example" "backend/.env"
    Write-Host "  Created backend/.env" -ForegroundColor Gray
}

if (-not (Test-Path "frontend/.env.local")) {
    Copy-Item "frontend/.env.example" "frontend/.env.local"
    Write-Host "  Created frontend/.env.local" -ForegroundColor Gray
}

if (-not (Test-Path "ai-service/.env")) {
    Copy-Item "ai-service/.env.example" "ai-service/.env"
    Write-Host "  Created ai-service/.env" -ForegroundColor Gray
}

# Install dependencies
Write-Host "`n[2/5] Installing dependencies..." -ForegroundColor Green

Write-Host "  Installing backend dependencies..." -ForegroundColor Gray
Set-Location backend
npm install
Set-Location ..

Write-Host "  Installing frontend dependencies..." -ForegroundColor Gray
Set-Location frontend
npm install
Set-Location ..

Write-Host "  Installing AI service dependencies..." -ForegroundColor Gray
Set-Location ai-service
if (Get-Command pip -ErrorAction SilentlyContinue) {
    pip install -r requirements.txt
} else {
    Write-Host "  [SKIP] Python/pip not found. Install manually." -ForegroundColor Yellow
}
Set-Location ..

# Start MongoDB (if Docker available)
Write-Host "`n[3/5] Starting MongoDB container..." -ForegroundColor Green
if ($dockerRunning) {
    docker compose up -d mongodb
    Start-Sleep -Seconds 5
    Write-Host "  MongoDB started on port 27017" -ForegroundColor Gray
} else {
    Write-Host "  [SKIP] Docker not running. Start MongoDB manually." -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nTo start the services, run these commands in separate terminals:" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 1 (Backend):" -ForegroundColor Yellow
Write-Host "    cd backend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Terminal 2 (Frontend):" -ForegroundColor Yellow
Write-Host "    cd frontend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Terminal 3 (AI Service):" -ForegroundColor Yellow
Write-Host "    cd ai-service && python main.py" -ForegroundColor Gray
Write-Host ""
Write-Host "URLs:" -ForegroundColor White
Write-Host "  Frontend:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend:    http://localhost:5000" -ForegroundColor Cyan
Write-Host "  AI Service: http://localhost:8000" -ForegroundColor Cyan
Write-Host "  MongoDB:    mongodb://localhost:27017/aumo" -ForegroundColor Cyan
Write-Host ""
