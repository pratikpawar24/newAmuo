# 🎉 AUMO v2 Setup Complete!

## ✅ What Was Just Installed

Your AUMO v2 application is now fully set up with:

1. **Frontend** (Next.js 14 + TypeScript + Tailwind CSS)
   - ✅ All dependencies installed
   - ✅ Location: `frontend/`
   - ✅ Port: 3000

2. **Backend** (Express.js + MongoDB + Socket.IO)
   - ✅ All dependencies installed
   - ✅ Location: `backend/`
   - ✅ Port: 5000

3. **AI Service** (FastAPI + PyTorch + scikit-learn)
   - ✅ All dependencies installed
   - ✅ Location: `ai-service/`
   - ✅ Port: 8000

## 🌐 Access Your Application

The script has opened 3 PowerShell windows running:

1. **Frontend**: http://localhost:3000
2. **Backend API**: http://localhost:5000/api
3. **AI Service**: http://localhost:8000/docs

**Open your browser to**: http://localhost:3000

## 🔐 Login Credentials

### Regular Users:
- **Email**: `priya@aumo.city` | **Password**: `demo123`
- **Email**: `rahul@aumo.city` | **Password**: `demo123`
- **Email**: `ananya@aumo.city` | **Password**: `demo123`

### Admin Dashboard:
- **URL**: http://localhost:3000/admin/login
- **Email**: `admin@aumo.city` | **Password**: `demo123`

## ⚠️ Important: MongoDB Required!

The application **requires MongoDB** to run. If you don't have it installed:

### Option 1: Docker (Easiest)
```powershell
docker run -d -p 27017:27017 --name aumo-mongo mongo:7
```

### Option 2: Local Installation
Download from: https://www.mongodb.com/try/download/community

### Option 3: MongoDB Atlas (Cloud - Free)
1. Create account: https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string
4. Update `backend/.env`:
   ```
   MONGODB_URI=your_atlas_connection_string
   ```

## 🗄️ Seed Demo Data

Once MongoDB is running, seed the database:

### Via Backend API:
```powershell
# The backend should be running on port 5000
curl -X POST http://localhost:5000/api/admin/seed
```

### Via Script:
```bash
cd scripts
bash seed-db.sh
```

This creates:
- 5 demo users (including 1 admin)
- Sample ride data
- 30 days of statistics

## 📂 Project Structure

```
AUMO2/
├── frontend/          # Next.js 14 App
│   ├── src/
│   │   ├── app/           # Pages (home, g-ride, chat, admin)
│   │   ├── components/    # React components
│   │   ├── lib/           # API client, Socket.IO, utils
│   │   ├── stores/        # Zustand stores
│   │   ├── hooks/         # Custom hooks
│   │   └── types/         # TypeScript types
│   └── package.json
│
├── backend/           # Express.js API
│   ├── src/
│   │   ├── models/        # MongoDB schemas
│   │   ├── controllers/   # Route handlers
│   │   ├── routes/        # API endpoints
│   │   ├── middleware/    # Auth, validation
│   │   ├── services/      # Business logic
│   │   ├── config/        # Database, Socket.IO
│   │   ├── cron/          # Background jobs
│   │   └── utils/         # Helpers
│   └── package.json
│
├── ai-service/        # FastAPI AI Engine
│   ├── models/            # LSTM model, trainer
│   ├── algorithms/        # A*, DBSCAN, emissions
│   ├── utils/             # Haversine, OSRM, Nominatim
│   ├── main.py            # FastAPI app
│   └── requirements.txt
│
├── scripts/           # Utility scripts
│   ├── seed-db.sh         # Database seeder
│   └── download-osm-data.sh  # OSM data downloader
│
├── start.ps1          # Windows launcher
├── run-local.sh       # Linux/Mac launcher
├── docker-compose.yml # Docker orchestration
└── README.md          # Main documentation
```

## 🔧 Troubleshooting

### Services Not Starting?

Check if ports are available:
```powershell
# Check port usage
netstat -ano | findstr :3000
netstat -ano | findstr :5000
netstat -ano | findstr :8000
```

### MongoDB Connection Error?

Make sure MongoDB is running:
```powershell
# Test connection
mongosh mongodb://localhost:27017/aumo
```

### Python Packages Error?

Create a virtual environment:
```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Build Error?

Clear and reinstall:
```powershell
cd frontend
rm -r node_modules, package-lock.json
npm install --legacy-peer-deps
```

## 🚦 Running Services Individually

If the automated script doesn't work, run each service manually:

### Terminal 1 - Backend:
```powershell
cd backend
npm run dev
```

### Terminal 2 - Frontend:
```powershell
cd frontend
npm run dev
```

### Terminal 3 - AI Service:
```powershell
cd ai-service
python main.py
```

## 🎯 Key Features to Try

1. **Route Planning** (Home Page)
   - Enter origin/destination
   - Adjust weight sliders (time/emissions/distance)
   - View AI-optimized routes on map

2. **Create a Ride** (`/g-ride/create`)
   - Set pickup/drop points
   - Choose departure time
   - Add vehicle details

3. **Browse Rides** (`/g-ride`)
   - Filter by availability
   - Request to join rides
   - View emissions savings

4. **Real-time Chat** (`/chat`)
   - Message other users
   - Negotiate ride details
   - See typing indicators

5. **Admin Dashboard** (`/admin/dashboard`)
   - View 30-day analytics
   - Manage users/rides
   - See Recharts visualizations

6. **Green Score** (`/profile`)
   - Track your eco-impact
   - Earn badges (5 tiers)
   - View CO₂ savings history

## 📚 API Documentation

### Backend REST API:
- Endpoints: http://localhost:5000/api
- Swagger docs: (add Swagger UI if needed)

### AI Service API:
- FastAPI Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🐳 Docker Deployment

To run the full stack with Docker:

```bash
docker-compose up --build
```

This starts all 4 services:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- AI Service: http://localhost:8000
- MongoDB: mongodb://localhost:27017

## 🛑 Stopping Services

To stop all services:
1. Close the 3 PowerShell windows
2. Or press `Ctrl+C` in each terminal

## 📝 Next Steps

1. ✅ **Install MongoDB** (if not already done)
2. ✅ **Seed the database** with demo data
3. ✅ **Open http://localhost:3000** in your browser
4. ✅ **Login** with demo credentials
5. ✅ **Test features** (create ride, chat, view map)
6. ✅ **Access admin dashboard** at `/admin/dashboard`

## 🤝 Need Help?

- Check `README.md` for detailed documentation
- Check `QUICKSTART.md` for step-by-step guide
- Review `.env.example` files for configuration
- Check backend/frontend console logs for errors

---

**Built with ❤️ for sustainable urban mobility**

Enjoy AUMO v2! 🚀🌱
