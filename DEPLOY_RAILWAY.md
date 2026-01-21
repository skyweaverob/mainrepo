# SkyWeave Railway Deployment Guide

This guide walks you through deploying SkyWeave to Railway with persistent data storage.

## Prerequisites

1. A [Railway account](https://railway.app) (free tier available)
2. [Railway CLI](https://docs.railway.app/develop/cli) installed (optional but recommended)
3. Git repository for your code

## Architecture on Railway

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway Project                          │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │───>│   Backend    │───>│   Volume     │  │
│  │   (Next.js)  │    │  (FastAPI)   │    │  (Data)      │  │
│  │   Port 3000  │    │   Port 8000  │    │  /data       │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Prepare Your Code

1. Initialize a git repository (if not already done):
   ```bash
   cd /Users/rob/Desktop/NK\ PROTOTYPE/skyweave
   git init
   git add .
   git commit -m "Initial commit for Railway deployment"
   ```

2. Push to GitHub:
   ```bash
   gh repo create skyweave --private --source=. --push
   ```

## Step 2: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account and select your `skyweave` repository

## Step 3: Deploy Backend Service

1. In your Railway project, click **"New Service"** → **"GitHub Repo"**
2. Select your repo and set the **Root Directory** to `backend`
3. Railway will auto-detect the Dockerfile

4. **Add Environment Variables** (click on the service → Variables):
   ```
   DATA_PATH=/data
   ALLOWED_ORIGINS=https://your-frontend-url.railway.app
   AIRLABS_API_KEY=your_key_here
   SERP_API_KEY=your_key_here
   OPENWEATHERMAP_API_KEY=your_key_here
   SEARCHAPI_KEY=your_key_here
   ```

5. **Add a Volume** for persistent data:
   - Click on the backend service
   - Go to **Settings** → **Volumes**
   - Click **"Mount Volume"**
   - Mount path: `/data`
   - This creates persistent storage for your data files

6. **Generate Domain**:
   - Go to **Settings** → **Networking**
   - Click **"Generate Domain"**
   - Note the URL (e.g., `skyweave-backend-production.up.railway.app`)

## Step 4: Upload Your Data Files

After the backend deploys with the volume, upload your data files:

**Option A: Using Railway CLI**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Open a shell in your backend service
railway shell

# Your volume is at /data - upload files here
```

**Option B: Create a data upload endpoint (already in your API)**
Use the existing `/api/upload` endpoint to upload files through the frontend.

**Option C: Use Railway's volume UI**
1. Go to your backend service
2. Click on the Volume
3. Use the file browser to upload files

**Required Data Files:**
- `ASG mkt level_0711data_RR.xlsx` - Network market data
- `spirit_fleet_2026.csv` - Fleet data
- `spirit_crew_roster_2026.csv` - Crew data
- `spirit_mro_schedule_2026.csv` - MRO schedule
- `scraped_fares.csv` - Competitive fares
- `nk_routes.csv` - Route definitions
- `T_100_OCT.csv` - DOT traffic data

## Step 5: Deploy Frontend Service

1. In your Railway project, click **"New Service"** → **"GitHub Repo"**
2. Select your repo (root directory, not `backend`)
3. Railway will auto-detect the Dockerfile

4. **Add Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
   ```
   Replace with your actual backend URL from Step 3.

5. **Add Build Arguments** (in Settings → Build):
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
   ```

6. **Generate Domain**:
   - Go to **Settings** → **Networking**
   - Click **"Generate Domain"**

## Step 6: Update CORS Settings

Go back to your backend service and update `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://your-frontend-url.railway.app,http://localhost:3000
```

## Step 7: Verify Deployment

1. Open your frontend URL in a browser
2. Check the Network Intelligence dashboard loads
3. Verify data is displayed correctly

## Troubleshooting

### Backend won't start
- Check logs in Railway dashboard
- Verify all environment variables are set
- Ensure volume is mounted at `/data`

### Frontend can't connect to backend
- Check `NEXT_PUBLIC_API_URL` is correct
- Verify `ALLOWED_ORIGINS` includes frontend URL
- Check backend is running (visit backend URL + `/api/status`)

### Data not loading
- Verify files are in the `/data` volume
- Check file names match expected names
- Look at backend logs for loading errors

### Volume issues
- Volumes persist across deployments
- Use Railway CLI to inspect volume contents
- Data survives service restarts

## Cost Estimate

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month (includes $5 credit)
- **Pro Plan**: Usage-based, ~$10-30/month for this app

Estimated usage for SkyWeave:
- Backend: ~512MB RAM, moderate CPU
- Frontend: ~256MB RAM, low CPU
- Volume: ~500MB-2GB storage

## Custom Domain (Optional)

1. Go to your frontend service → Settings → Networking
2. Click **"Custom Domain"**
3. Add your domain (e.g., `skyweave.yourdomain.com`)
4. Update DNS records as shown
5. Railway provides free SSL certificates

## Backup Your Data

Railway volumes are persistent but not backed up automatically. To backup:

```bash
# Using Railway CLI
railway shell
tar -czf /tmp/backup.tar.gz /data
# Then download the backup
```

Or set up automated backups to S3/Cloud Storage using a scheduled job.
