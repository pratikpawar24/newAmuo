# 🚀 AUMO v2 — Quick Start Guide

## Prerequisites

- **Node.js 20+** (Required) — [Download](https://nodejs.org/)
- **MongoDB 7+** (Required) — [Download](https://www.mongodb.com/try/download/community) or use Docker/Atlas
- **Python 3.11+** (Optional, for AI service) — [Download](https://www.python.org/downloads/)

## Option 1: Run with Script (Easiest)

### Windows:
```powershell
.\run-local.ps1
```

### Linux/Mac:
```bash
chmod +x run-local.sh
./run-local.sh
```

This will:
- ✅ Check prerequisites
- ✅ Create environment files
- ✅ Install all dependencies
- ✅ Start all services in separate windows/processes

## Option 2: Manual Setup

### 1. Setup Environment Files

```bash
# Copy environment examples
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env
```

### 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# AI Service
cd ../ai-service
pip install -r requirements.txt
```

### 3. Start MongoDB

**Option A - Docker:**
```bash
docker run -d -p 27017:27017 --name aumo-mongo mongo:7
```

**Option B - Local Installation:**
```bash
mongod --dbpath ./data/db
```

**Option C - MongoDB Atlas (Cloud):**
Update `backend/.env` with your Atlas connection string.

### 4. Seed Database (Optional)

```bash
# Using the backend API (recommended)
cd backend
npm run dev  # Start backend first
# In another terminal:
curl -X POST http://localhost:5000/api/admin/seed

# OR using mongosh
cd scripts
bash seed-db.sh
```

### 5. Start Services

Open 3 separate terminals:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

**Terminal 3 - AI Service:**
```bash
cd ai-service
python main.py
# Runs on http://localhost:8000
```

## Option 3: Docker Compose (If Docker Installed)

```bash
docker-compose up --build
```

This starts all 4 services (frontend, backend, ai-service, mongodb) automatically.

## 🌐 Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **AI Service:** http://localhost:8000/docs (FastAPI Swagger UI)

## 🔐 Demo Credentials

### User Accounts:
- **Email:** `priya@aumo.city` | **Password:** `demo123`
- **Email:** `rahul@aumo.city` | **Password:** `demo123`
- **Email:** `ananya@aumo.city` | **Password:** `demo123`

### Admin Account:
- **Email:** `admin@aumo.city` | **Password:** `demo123`

## 🛠️ Development Commands

### Backend:
```bash
npm run dev      # Start dev server with hot reload
npm run build    # Compile TypeScript
npm start        # Run production build
npm run lint     # Run ESLint
```

### Frontend:
```bash
npm run dev      # Start Next.js dev server
npm run build    # Build for production
npm start        # Run production server
npm run lint     # Run ESLint
```

### AI Service:
```bash
python main.py                    # Start FastAPI server
uvicorn main:app --reload         # Start with auto-reload
python models/trainer.py          # Train LSTM model
```

## 📊 Admin Dashboard

Access the admin dashboard at:
- http://localhost:3000/admin/login

Features:
- 📈 Real-time statistics (30-day charts)
- 👥 User management (role toggle, delete)
- 🚗 Ride monitoring (status, emissions)
- 📊 Daily aggregated stats (Recharts visualizations)

## 🗺️ Download OSM Data (Optional)

For better routing (AI service):

```bash
cd scripts
bash download-osm-data.sh mumbai
# Supports: mumbai, delhi, bangalore, chennai, pune
```

Update `ai-service/.env`:
```env
OSM_DATA_PATH=./data/mumbai_roads.json
```

## 🧪 API Testing

### Using cURL:

```bash
# Health check
curl http://localhost:5000/api/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"test123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@aumo.city","password":"demo123"}'

# Get route (AI service)
curl -X POST http://localhost:8000/api/route \
  -H "Content-Type: application/json" \
  -d '{"origin":{"lat":19.076,"lng":72.8777},"destination":{"lat":19.0176,"lng":72.8562},"preferences":{"w_time":0.4,"w_emissions":0.35,"w_distance":0.25}}'
```

## 🐛 Troubleshooting

### Port Already in Use:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### MongoDB Connection Error:
- Ensure MongoDB is running
- Check connection string in `backend/.env`
- Default: `mongodb://localhost:27017/aumo`

### Python Dependencies Error:
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### Node Modules Error:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## 📚 Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Leaflet.js, Socket.IO, Zustand
- **Backend:** Express.js, MongoDB, Mongoose, Socket.IO, JWT, bcrypt
- **AI Service:** FastAPI, PyTorch, scikit-learn, NetworkX, OSRM
- **Database:** MongoDB 7+

## 🌍 Features

- 🗺️ **Real-time Map** with Leaflet + OpenStreetMap
- 🤖 **AI-Powered Routing** (BiLSTM + A* + COPERT IV)
- 🚗 **Ride Sharing** with dynamic seat allocation
- 💬 **Real-time Chat** via Socket.IO
- 🏆 **Green Mobility Score** & gamification
- 📊 **Admin Dashboard** with analytics
- 🌓 **Dark/Light Mode** system-wide
- 📱 **Responsive Design** (320px+)

## 📖 Documentation

- Backend API docs: `backend/README.md`
- AI service docs: `ai-service/README.md`
- Frontend components: `frontend/src/components/README.md`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Built with ❤️ for sustainable urban mobility**
