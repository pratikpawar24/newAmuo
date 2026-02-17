# AUMO v2 — AI-Powered Urban Mobility Optimizer

A production-ready, full-stack web application that combines AI-driven traffic prediction, eco-friendly routing, and smart carpooling to optimize urban mobility and reduce carbon emissions.

## Architecture

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Leaflet.js, Socket.IO, Recharts, Zustand
- **Backend**: Express.js, TypeScript, MongoDB/Mongoose, Socket.IO, JWT Auth
- **AI Service**: FastAPI, PyTorch (BiLSTM + Attention), scikit-learn (DBSCAN), A\* routing
- **Infrastructure**: Docker Compose, MongoDB 7+

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev)
- Python 3.11+ (for local dev)
- MongoDB 7+ (or use Docker)

### Using Docker Compose
```bash
docker-compose up --build
```

### Local Development

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

**AI Service:**
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js web application |
| Backend | 5000 | Express.js API server |
| AI Service | 8000 | FastAPI ML/routing service |
| MongoDB | 27017 | Database |

## Key Features

### Traffic Prediction (BiLSTM + Temporal Attention)
- Stacked Bidirectional LSTM with temporal attention mechanism
- Trained on synthetic data (90 days, 50 road segments)
- Predicts speed, flow, and congestion level

### Eco-Routing (Time-Dependent A\*)
- Multi-objective routing: time, emissions, distance
- COPERT IV emission model for CO₂ calculation
- Interactive weight sliders for user preferences

### Smart Carpooling (DBSCAN + Multi-Factor Scoring)
- DBSCAN clustering for pickup point grouping
- Composite matching: route overlap, time compatibility, proximity, preferences
- Real-time price negotiation via chat

### Green Mobility Score
- Gamified scoring system with badges
- Tracks CO₂ savings, ride sharing, consistency
- Leaderboard for community engagement

## Mathematical Models
See source code for exact implementations of:
- A1: Stacked BiLSTM with Temporal Attention
- A2: Time-Dependent A\* on OSM Graph
- A3: COPERT IV Emission Factor
- A4: DBSCAN + Detour Scoring
- A5: Green Mobility Score

## License
MIT
