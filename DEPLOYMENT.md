# AUMO v2 Deployment Guide

Complete guide to deploy AUMO v2 across multiple platforms.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│   AI Service    │
│    (Vercel)     │     │    (Render)     │     │ (Hugging Face)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │    MongoDB      │
                        │    (Atlas)      │
                        └─────────────────┘
```

---

## Step 1: Database Setup (MongoDB Atlas)

### 1.1 Create Account
1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Click **"Try Free"** and create an account
3. Verify your email

### 1.2 Create a New Cluster
1. After login, click **"Build a Database"**
2. Choose **"M0 FREE"** tier (Shared cluster)
3. Select your cloud provider: **AWS** (recommended)
4. Select region closest to your users (e.g., `us-east-1` for US, `ap-south-1` for India)
5. Cluster name: `aumo-cluster`
6. Click **"Create"**

### 1.3 Create Database User
1. Go to **Security** → **Database Access**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Set username: `aumo_admin`
5. Click **"Autogenerate Secure Password"** and **save it securely**
6. Database User Privileges: **"Read and write to any database"**
7. Click **"Add User"**

### 1.4 Configure Network Access
1. Go to **Security** → **Network Access**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - This is required for Render/Vercel since they use dynamic IPs
   - For production, you can restrict to specific IPs later
4. Click **"Confirm"**

### 1.5 Get Connection String
1. Go to **Deployment** → **Database**
2. Click **"Connect"** on your cluster
3. Select **"Connect your application"**
4. Choose **Driver**: Node.js, **Version**: 5.5 or later
5. Copy the connection string:
   ```
   mongodb+srv://aumo_admin:<password>@aumo-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=aumo-cluster
   ```
6. **Replace `<password>`** with your actual password
7. **Add database name** before the `?`:
   ```
   mongodb+srv://aumo_admin:YOUR_PASSWORD@aumo-cluster.xxxxx.mongodb.net/aumo?retryWrites=true&w=majority&appName=aumo-cluster
   ```

### 1.6 Create Database (Optional)
1. Click **"Browse Collections"** on your cluster
2. Click **"Add My Own Data"**
3. Database name: `aumo`
4. Collection name: `users`
5. Click **"Create"**

> **Note**: The database and collections will be created automatically when the backend first connects, so this step is optional.

---

## Step 2: AI Service Deployment (Hugging Face Spaces)

### 2.1 Create Hugging Face Account
1. Go to [https://huggingface.co/](https://huggingface.co/)
2. Sign up for a free account
3. Verify your email

### 2.2 Create a New Space
1. Click your profile → **"New Space"**
2. Configure:
   - **Space name**: `aumo-ai`
   - **License**: MIT
   - **SDK**: Docker
   - **Hardware**: CPU Basic (free) or upgrade for better performance
   - **Visibility**: Public (free) or Private (paid)
3. Click **"Create Space"**

### 2.3 Upload AI Service Code

**Option A: Using Git**
```bash
# Clone your new space
git clone https://huggingface.co/spaces/YOUR_USERNAME/aumo-ai
cd aumo-ai

# Copy AI service files
cp -r /path/to/AUMO2/ai-service/* .

# Push to Hugging Face
git add .
git commit -m "Initial deployment"
git push
```

**Option B: Using Hugging Face UI**
1. Go to your Space → **Files** tab
2. Click **"Add file"** → **"Upload files"**
3. Upload all files from the `ai-service/` folder:
   - `main.py`
   - `config.py`
   - `requirements.txt`
   - `Dockerfile`
   - `README.md`
   - `algorithms/` folder
   - `models/` folder
   - `utils/` folder

### 2.4 Configure Secrets
1. Go to your Space → **Settings** → **Variables and secrets**
2. Add these secrets:
   ```
   API_KEY=your-secure-api-key-here
   CORS_ORIGINS=https://aumo.vercel.app,https://aumo-api.onrender.com
   BACKEND_URL=https://aumo-api.onrender.com
   ```

### 2.5 Verify Deployment
1. Wait for the build to complete (check **Logs** tab)
2. Your AI service will be available at:
   ```
   https://YOUR_USERNAME-aumo-ai.hf.space
   ```
3. Test the health endpoint:
   ```bash
   curl https://YOUR_USERNAME-aumo-ai.hf.space/api/health
   ```

---

## Step 3: Backend Deployment (Render)

### 3.1 Create Render Account
1. Go to [https://render.com/](https://render.com/)
2. Sign up with GitHub for easy integration
3. Verify your email

### 3.2 Create Web Service

**Option A: Using render.yaml (Recommended)**
1. Push your code to GitHub
2. Go to Render Dashboard → **New** → **Blueprint**
3. Connect your GitHub repo
4. Select the `backend/` folder
5. Render will use the `render.yaml` configuration

**Option B: Manual Setup**
1. Go to Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `aumo-api`
   - **Region**: Oregon (or closest to you)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for better performance)

### 3.3 Configure Environment Variables
In Render dashboard, go to **Environment** and add:

```bash
# Required
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://aumo_admin:YOUR_PASSWORD@aumo-cluster.xxxxx.mongodb.net/aumo?retryWrites=true&w=majority

# JWT (use strong random strings!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-minimum-32-characters

# AI Service
AI_SERVICE_URL=https://YOUR_USERNAME-aumo-ai.hf.space
AI_API_KEY=your-secure-api-key-here

# CORS (your Vercel frontend URL)
CORS_ORIGIN=https://aumo.vercel.app

# OSRM (public demo server)
OSRM_URL=https://router.project-osrm.org

# Email (optional, for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Admin Account
ADMIN_EMAIL=admin@aumo.app
ADMIN_PASSWORD=YourSecureAdminPassword123!
```

### 3.4 Generate Secure Secrets
Use this command to generate secure JWT secrets:
```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### 3.5 Deploy
1. Click **"Create Web Service"**
2. Wait for the build to complete
3. Your backend will be at:
   ```
   https://aumo-api.onrender.com
   ```
4. Test the health endpoint:
   ```bash
   curl https://aumo-api.onrender.com/api/health
   ```

---

## Step 4: Frontend Deployment (Vercel)

### 4.1 Create Vercel Account
1. Go to [https://vercel.com/](https://vercel.com/)
2. Sign up with GitHub
3. Authorize Vercel to access your repos

### 4.2 Import Project
1. Click **"Add New..."** → **"Project"**
2. Select your GitHub repository
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### 4.3 Configure Environment Variables
Add these environment variables in Vercel:

```bash
# Backend API URL (your Render URL)
NEXT_PUBLIC_API_URL=https://aumo-api.onrender.com

# Socket.IO URL (same as API)
NEXT_PUBLIC_SOCKET_URL=https://aumo-api.onrender.com

# Map defaults (Bangalore, India)
NEXT_PUBLIC_DEFAULT_LAT=12.9716
NEXT_PUBLIC_DEFAULT_LNG=77.5946
NEXT_PUBLIC_DEFAULT_ZOOM=12

# Feature flags
NEXT_PUBLIC_ENABLE_TRAFFIC_OVERLAY=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
```

### 4.4 Deploy
1. Click **"Deploy"**
2. Wait for the build to complete
3. Your frontend will be at:
   ```
   https://aumo.vercel.app
   ```
   (Or your custom domain)

### 4.5 Custom Domain (Optional)
1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Configure DNS as instructed

---

## Step 5: Post-Deployment Configuration

### 5.1 Update CORS Origins
After all services are deployed, update CORS settings:

**Backend (Render):**
```
CORS_ORIGIN=https://aumo.vercel.app,https://www.your-domain.com
```

**AI Service (Hugging Face):**
```
CORS_ORIGINS=https://aumo.vercel.app,https://aumo-api.onrender.com
```

### 5.2 Update AI Service URL
In Render, update:
```
AI_SERVICE_URL=https://YOUR_USERNAME-aumo-ai.hf.space
```

### 5.3 Seed Database
After first deployment, seed the database with initial data:

```bash
# Create admin user and sample data
curl -X POST https://aumo-api.onrender.com/api/admin/seed \
  -H "Content-Type: application/json"
```

---

## Step 6: Verify Everything Works

### 6.1 Test Each Service

**1. Database Connection:**
```bash
curl https://aumo-api.onrender.com/api/health
# Should return: {"success":true,"data":{"status":"ok",...}}
```

**2. AI Service:**
```bash
curl https://YOUR_USERNAME-aumo-ai.hf.space/api/health
# Should return: {"status":"ok","model_loaded":true,...}
```

**3. Frontend:**
- Visit https://aumo.vercel.app
- Try to register a new user
- Login with the user
- Create a test ride

### 6.2 Test Socket.IO Connection
Open browser console on frontend and check for:
```
Socket connected: true
```

---

## Troubleshooting

### MongoDB Atlas Connection Issues
- Ensure Network Access includes `0.0.0.0/0` (Allow from anywhere)
- Verify connection string uses `mongodb+srv://` format
- Check username/password - URL encode special characters:
  - `@` → `%40`
  - `#` → `%23`
  - `$` → `%24`
- Ensure database name is included in the connection string (before `?`)
- Check cluster status is "Active" in Atlas dashboard

### CORS Errors
- Ensure all origins are listed in `CORS_ORIGIN`
- Check for trailing slashes (remove them)
- Verify protocol matches (https vs http)

### AI Service Not Responding
- Check Hugging Face Spaces logs for errors
- Ensure PORT is set to 7860 in Dockerfile
- Verify the model files are present

### Socket.IO Connection Failed
- Ensure `NEXT_PUBLIC_SOCKET_URL` is correct
- Check backend logs for WebSocket errors
- Verify `trust proxy` is enabled in production

### Render Free Tier Sleeping
- Free tier services sleep after 15 min of inactivity
- First request after sleep may take 30-60 seconds
- Consider upgrading to paid plan for production

---

## Environment Variables Summary

### Frontend (Vercel)
| Variable | Example Value |
|----------|---------------|
| `NEXT_PUBLIC_API_URL` | `https://aumo-api.onrender.com` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://aumo-api.onrender.com` |
| `NEXT_PUBLIC_DEFAULT_LAT` | `12.9716` |
| `NEXT_PUBLIC_DEFAULT_LNG` | `77.5946` |

### Backend (Render)
| Variable | Example Value |
|----------|---------------|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/aumo` |
| `JWT_SECRET` | `your-32-char-secret` |
| `JWT_REFRESH_SECRET` | `your-32-char-secret` |
| `AI_SERVICE_URL` | `https://user-aumo-ai.hf.space` |
| `CORS_ORIGIN` | `https://aumo.vercel.app` |
| `NODE_ENV` | `production` |

### AI Service (Hugging Face)
| Variable | Example Value |
|----------|---------------|
| `API_KEY` | `your-api-key` |
| `CORS_ORIGINS` | `https://aumo.vercel.app,https://aumo-api.onrender.com` |
| `BACKEND_URL` | `https://aumo-api.onrender.com` |

---

## Cost Estimation

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Vercel | 100GB bandwidth/month | From $20/month |
| Render | 750 hours/month, sleeps | From $7/month |
| Hugging Face | CPU Basic, public only | From $9/month |
| MongoDB Atlas | M0 Free (512MB, shared) | M10 from $57/month |

**Total Free Tier**: $0/month (with limitations)
**Recommended Production**: ~$100/month (with dedicated DB)

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong, unique JWT secrets (32+ characters)
- [ ] Enable HTTPS only (all platforms do this by default)
- [ ] Restrict CORS to your domains only
- [ ] Use environment variables for all secrets
- [ ] Enable rate limiting (already configured)
- [ ] Regularly rotate API keys
- [ ] Monitor logs for suspicious activity

---

## Next Steps

1. Set up monitoring (Render provides basic metrics)
2. Configure custom domain with SSL
3. Set up error tracking (Sentry, LogRocket)
4. Configure CI/CD pipeline for automatic deployments
5. Set up database backups in MongoDB Atlas
6. Configure Atlas alerts for performance monitoring
7. Enable Atlas Search for ride search functionality (optional)
8. Set up Atlas Charts for analytics dashboard (optional)

---

## MongoDB Atlas Tips

### Enable Performance Advisor
1. Go to your cluster → **Performance Advisor**
2. Review suggested indexes
3. Create recommended indexes for better query performance

### Set Up Alerts
1. Go to **Project** → **Alerts**
2. Create alerts for:
   - Connections > 80% of limit
   - Disk usage > 80%
   - Replication lag > 60 seconds

### Enable Backup (Paid tiers)
1. Go to cluster → **Backup**
2. Enable continuous backup
3. Configure snapshot schedule

### Monitor Performance
1. Go to cluster → **Metrics**
2. Monitor:
   - Connections
   - Operations/second
   - Query targeting
   - Index usage
