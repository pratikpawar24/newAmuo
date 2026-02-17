# 🗄️ MongoDB Setup Guide for AUMO v2

AUMO v2 requires MongoDB to store user data, rides, messages, and statistics. Here are 3 ways to set it up:

---

## Option 1: Docker (⚡ Fastest - Recommended)

### Prerequisites:
- Install Docker Desktop: https://www.docker.com/products/docker-desktop

### Run MongoDB:
```powershell
# Pull and run MongoDB 7 container
docker run -d `
  --name aumo-mongo `
  -p 27017:27017 `
  -v aumo-data:/data/db `
  mongo:7

# Verify it's running
docker ps

# View logs
docker logs aumo-mongo
```

### Connect to it:
Your `backend/.env` should have:
```env
MONGODB_URI=mongodb://localhost:27017/aumo
```

### Manage Container:
```powershell
# Stop MongoDB
docker stop aumo-mongo

# Start MongoDB
docker start aumo-mongo

# Remove MongoDB (data persists in volume)
docker rm aumo-mongo

# Remove data volume (CAUTION: deletes all data)
docker volume rm aumo-data
```

---

## Option 2: Local Installation (Windows)

### Download:
1. Go to: https://www.mongodb.com/try/download/community
2. Select:
   - **Version**: 7.0.x (Current)
   - **Platform**: Windows x64
   - **Package**: MSI

### Install:
1. Run the downloaded `.msi` file
2. Choose "Complete" installation
3. **Install MongoDB as a Service** ✅ (recommended)
4. **Install MongoDB Compass** ✅ (GUI tool)
5. Data Directory: `C:\Program Files\MongoDB\Server\7.0\data`
6. Log Directory: `C:\Program Files\MongoDB\Server\7.0\log`

### Start MongoDB:
If installed as service, it starts automatically. Otherwise:

```powershell
# Start MongoDB service
net start MongoDB

# Stop MongoDB service
net stop MongoDB
```

### Connect:
Your `backend/.env` should have:
```env
MONGODB_URI=mongodb://localhost:27017/aumo
```

### Use MongoDB Compass:
- Open **MongoDB Compass** app
- Connection string: `mongodb://localhost:27017`
- Click **Connect**
- You can browse collections, view data, run queries

---

## Option 3: MongoDB Atlas (☁️ Cloud - Free Tier)

### Sign Up:
1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Create free account (no credit card required)
3. Choose **M0 Free** tier (512 MB storage)

### Create Cluster:
1. Click **Create** cluster
2. Choose **AWS** or **Azure** (any region close to you)
3. Cluster Name: `aumo-cluster` (or anything)
4. Click **Create Cluster** (takes 1-3 minutes)

### Setup Database Access:
1. Go to **Database Access** tab
2. Click **Add New Database User**
3. Authentication Method: **Password**
4. Username: `aumo_admin` (or anything)
5. Password: **Autogenerate Secure Password** (save it!)
6. Database User Privileges: **Read and write to any database**
7. Click **Add User**

### Setup Network Access:
1. Go to **Network Access** tab
2. Click **Add IP Address**
3. Click **Allow Access from Anywhere** (0.0.0.0/0)
   - ⚠️ For production, whitelist specific IPs only
4. Click **Confirm**

### Get Connection String:
1. Go to **Database** tab
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. Driver: **Node.js**, Version: **5.5 or later**
5. Copy connection string (looks like):
   ```
   mongodb+srv://aumo_admin:<password>@aumo-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Configure AUMO:
Update `backend/.env`:
```env
MONGODB_URI=mongodb+srv://aumo_admin:YOUR_PASSWORD@aumo-cluster.xxxxx.mongodb.net/aumo?retryWrites=true&w=majority
```

**Replace:**
- `YOUR_PASSWORD` with the actual password
- `xxxxx` with your cluster ID (auto-filled in connection string)

### Verify Connection:
```powershell
cd backend
npm run dev
```

Check backend console logs for:
```
✅ MongoDB Connected: aumo-cluster-shard-00-00.xxxxx.mongodb.net
```

---

## Verify MongoDB is Working

### Test Connection:

#### Using mongosh (MongoDB Shell):
```powershell
# Connect locally
mongosh mongodb://localhost:27017/aumo

# Or connect to Atlas
mongosh "mongodb+srv://aumo_admin:PASSWORD@aumo-cluster.xxxxx.mongodb.net/aumo"

# Inside mongosh:
show dbs
use aumo
show collections
```

#### Using Backend Health Check:
```powershell
# Start backend
cd backend
npm run dev

# In another terminal:
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "timestamp": "2026-02-16T17:30:00.000Z",
    "mongodb": "Connected"
  }
}
```

---

## Seed Demo Data

Once MongoDB is connected, seed the database:

### Method 1: Via Backend API (Easiest)
```powershell
# Make sure backend is running
cd backend
npm run dev

# In another terminal:
curl -X POST http://localhost:5000/api/admin/seed
```

### Method 2: Via Script
```bash
cd scripts
bash seed-db.sh
```

### Method 3: Manually via mongosh
```javascript
mongosh mongodb://localhost:27017/aumo

use aumo

// Insert demo admin user
db.users.insertOne({
  name: "Admin User",
  email: "admin@aumo.city",
  password: "$2b$12$LJ3m4ys3Lk0TSwHjfY2fuuvRRqBnXxAv8e7FN9FN/s.X0kRq2vDaS",
  role: "admin",
  greenScore: 92,
  totalRides: 45,
  totalCO2Saved: 12500,
  totalDistance: 890000,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Verify
db.users.find({email: "admin@aumo.city"})
```

Password hash is for: `demo123`

---

## Troubleshooting

### Error: "MongoServerError: Authentication failed"
- Check username/password in connection string
- Ensure user has correct permissions in Atlas

### Error: "connect ECONNREFUSED ::1:27017"
- MongoDB is not running
- Start MongoDB service or Docker container

### Error: "MongooseServerSelectionError"
- Check if MongoDB is accessible
- Verify connection string in `.env`
- Check firewall/network settings

### Can't connect to Atlas
- Check IP whitelist (add 0.0.0.0/0 for testing)
- Verify connection string format
- Check if cluster is running (not paused)

### Collections not showing in Compass
- Make sure backend has created data
- Seed the database first
- Refresh connection in Compass

---

## MongoDB Compass GUI

MongoDB Compass is a great visual tool to:
- Browse collections
- View/edit documents
- Run aggregation pipelines
- Analyze schema
- Monitor performance

### Connect:
1. Open **MongoDB Compass**
2. Connection string:
   - Local: `mongodb://localhost:27017`
   - Atlas: `mongodb+srv://...` (your Atlas string)
3. Click **Connect**

### Useful Collections in AUMO:
- `users` - User accounts and profiles
- `rides` - Ride listings
- `messages` - Chat messages
- `sitestats` - Daily aggregated statistics
- `trafficdata` - Real-time traffic data
- `notifications` - User notifications

---

## Recommended: MongoDB Compass Queries

### Find all rides departing today:
```javascript
{
  "departureTime": {
    "$gte": new Date("2026-02-16T00:00:00Z"),
    "$lt": new Date("2026-02-17T00:00:00Z")
  }
}
```

### Find users with green score > 80:
```javascript
{
  "greenScore": { "$gt": 80 }
}
```

### Find all admin users:
```javascript
{
  "role": "admin"
}
```

---

## Quick Reference

| Feature | Local | Docker | Atlas |
|---------|-------|--------|-------|
| **Setup Time** | 5 min | 30 sec | 10 min |
| **Internet Required** | Download only | Download only | Always |
| **Free** | ✅ | ✅ | ✅ (512MB) |
| **Best For** | Production/Dev | Dev/Testing | Cloud/Demo |
| **Connection String** | `mongodb://localhost:27017/aumo` | `mongodb://localhost:27017/aumo` | `mongodb+srv://...` |

---

**Choose your preferred method and follow the steps above!**

For AUMO v2, any of these options will work perfectly. 🚀
