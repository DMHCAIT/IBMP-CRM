# 🚀 Complete Deployment Guide
## Deploy AI-CRM to Production (Vercel + Render + Supabase)

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION STACK                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [FRONTEND]          [BACKEND]           [DATABASE]    │
│   Vercel    ──────►   Render    ──────►  Supabase     │
│   React              FastAPI            PostgreSQL     │
│   Port: N/A          Port: 8000         Port: 5432     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

- ✅ Supabase account (free tier works)
- ✅ Render account (free tier available)
- ✅ Vercel account (free tier available)
- ✅ GitHub repository (optional but recommended)

---

## STEP 1: Deploy Database (Supabase) 🗄️

### 1.1 Create/Access Supabase Project

1. Go to: https://supabase.com/dashboard
2. Use your existing project or create new one
3. Your project URL: `https://goeybfakjdqcwztazfmk.supabase.co`

### 1.2 Run Database Migration

1. **Open SQL Editor** in Supabase Dashboard
2. Click **"New Query"**
3. Copy-paste the entire content from:
   ```
   lead-ai/crm/backend/supabase_migration.sql
   ```
4. Click **"Run"** or press `Ctrl+Enter`
5. Wait for confirmation: ✅ Success

### 1.3 Get Database Connection String

1. Go to **Settings** → **Database**
2. Scroll to **"Connection String"** section
3. Select **"Connection pooling"** mode (recommended for Render)
4. Copy the **URI** format:
   ```
   postgresql://postgres.goeybfakjdqcwztazfmk:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
5. **Important**: Replace `[YOUR-PASSWORD]` with your actual database password
   - Find it in: Settings → Database → Database password
   - If you don't have it, click "Reset Database Password"

### 1.4 Get Supabase API Keys

1. Go to **Settings** → **API**
2. Copy these values (you'll need them for Render):
   - **Project URL**: `https://goeybfakjdqcwztazfmk.supabase.co`
   - **anon/public key**: `sb_publishable_yRyFt7TqtTsM1qxswzjA_w_FFxVnp7Q`
   - **JWT Secret**: (scroll down to find it)

---

## STEP 2: Deploy Backend API (Render) 🔧

### 2.1 Create New Web Service on Render

1. Go to: https://render.com/dashboard
2. Click **"New +"** → **"Web Service"**
3. Choose **"Build and deploy from a Git repository"**
4. Connect your GitHub repository (or use manual deploy)

### 2.2 Configure Web Service

**Basic Settings:**
- **Name**: `ai-crm-backend` (or your preferred name)
- **Runtime**: `Python 3`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your branch name)
- **Root Directory**: `lead-ai/crm/backend`

**Build & Deploy:**
- **Build Command**: 
  ```bash
  pip install -r requirements.txt
  ```
- **Start Command**:
  ```bash
  uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

### 2.3 Add Environment Variables

Click **"Environment"** tab and add these variables:

```bash
# Database (from Supabase Step 1.3)
DATABASE_URL=postgresql://postgres.goeybfakjdqcwztazfmk:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

# Supabase (from Step 1.4)
SUPABASE_URL=https://goeybfakjdqcwztazfmk.supabase.co
SUPABASE_KEY=sb_publishable_yRyFt7TqtTsM1qxswzjA_w_FFxVnp7Q
SUPABASE_JWT_SECRET=mJWIVC+ikuaGqlHd4cJxCr+YpN8DjLX+PlQQHUWqcnp4WnF//y2TT6FKfvdnaXnNQ+Y3No3VgVI7HajHhsABoQ==

# JWT Authentication (change the secret!)
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production-12345
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Optional: AI Features (if you want AI assistant)
OPENAI_API_KEY=sk-your-openai-key-here

# Optional: Communication Services
RESEND_API_KEY=re_your_resend_api_key
FROM_EMAIL=crm@yourdomain.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### 2.4 Deploy Backend

1. Click **"Create Web Service"**
2. Wait 3-5 minutes for deployment
3. Your backend URL will be: `https://ai-crm-backend-2bmq.onrender.com` (or similar)
4. Test it: Visit `https://your-backend-url.onrender.com/docs`

**Expected Response:**
```json
{
  "name": "Medical Education CRM API",
  "version": "1.0.0",
  "status": "running"
}
```

---

## STEP 3: Deploy Frontend (Vercel) 🎨

### 3.1 Prepare Frontend

1. **Update Environment Variable**

Edit `lead-ai/crm/frontend/.env.production`:
```env
REACT_APP_API_URL=https://your-actual-render-url.onrender.com
```

Replace with your **actual Render backend URL** from Step 2.4

### 3.2 Deploy to Vercel

**Option A: Deploy via Vercel Dashboard (Recommended)**

1. Go to: https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Import your Git repository
4. Configure:
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `lead-ai/crm/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

5. Add Environment Variables:
   ```
   REACT_APP_API_URL=https://your-render-backend-url.onrender.com
   ```

6. Click **"Deploy"**
7. Wait 2-3 minutes
8. Your app will be live at: `https://your-app.vercel.app`

**Option B: Deploy via CLI**

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Navigate to frontend:
   ```bash
   cd lead-ai/crm/frontend
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel --prod
   ```

5. Follow prompts and enter:
   - Root directory: `./`
   - Build command: `npm run build`
   - Output directory: `build`

---

## STEP 4: Test Production Deployment ✅

### 4.1 Test Backend API

1. Visit: `https://your-backend.onrender.com/docs`
2. Expected: Interactive API documentation (Swagger UI)
3. Test health endpoint: `https://your-backend.onrender.com/health`

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-03-30T...",
  "supabase": "configured"
}
```

### 4.2 Test Frontend

1. Visit: `https://your-app.vercel.app`
2. Expected: Login page or dashboard
3. Check browser console for errors (F12)
4. Try creating a test lead

### 4.3 Test Database Connection

1. From frontend, create a test lead
2. Check Supabase dashboard → Table Editor → `leads` table
3. Verify the lead appears in database

---

## 🔒 STEP 5: Security & Final Steps

### 5.1 Update CORS in Backend

Edit `lead-ai/crm/backend/main.py` and update CORS origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://your-app.vercel.app",  # Add your Vercel domain
        "https://your-custom-domain.com"  # Add your custom domain if any
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Redeploy backend after this change.

### 5.2 Enable Row Level Security (Supabase)

For production security, enable RLS in Supabase:

1. Go to **Authentication** → **Policies**
2. Enable RLS for sensitive tables (leads, users, etc.)
3. Create policies based on your access rules

### 5.3 Set Up Custom Domain (Optional)

**For Vercel (Frontend):**
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

**For Render (Backend):**
1. Go to your web service → Settings
2. Add custom domain under "Custom Domains"
3. Update DNS records

---

## 📊 Environment Variables Summary

### Backend (Render)
```env
DATABASE_URL=postgresql://postgres.goeybfakjdqcwztazfmk:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://goeybfakjdqcwztazfmk.supabase.co
SUPABASE_KEY=sb_publishable_yRyFt7TqtTsM1qxswzjA_w_FFxVnp7Q
SUPABASE_JWT_SECRET=mJWIVC+ikuaGqlHd4cJxCr+YpN8DjLX+PlQQHUWqcnp4WnF//y2TT6FKfvdnaXnNQ+Y3No3VgVI7HajHhsABoQ==
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
OPENAI_API_KEY=sk-... (optional)
```

### Frontend (Vercel)
```env
REACT_APP_API_URL=https://your-backend.onrender.com
```

---

## 🐛 Troubleshooting

### Backend Not Starting on Render

**Issue**: "Application failed to respond"
**Solution**: 
1. Check logs in Render dashboard
2. Verify `DATABASE_URL` is correct
3. Ensure all required packages in `requirements.txt`
4. Check start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Frontend Can't Connect to Backend

**Issue**: Network errors or CORS issues
**Solution**:
1. Verify `REACT_APP_API_URL` in Vercel environment variables
2. Check CORS settings in `main.py`
3. Ensure backend is running: visit `/docs` endpoint
4. Redeploy frontend after env variable changes

### Database Connection Failed

**Issue**: "Could not connect to PostgreSQL"
**Solution**:
1. Verify Supabase database is active
2. Check connection string format
3. Try connection pooling endpoint (port 6543)
4. Verify password is correct

### 502 Bad Gateway (Render)

**Issue**: Backend crashes on startup
**Solution**:
1. Check Render logs for Python errors
2. Verify all dependencies installed
3. Check if database migration ran successfully
4. Try manual health check: `curl https://your-backend.onrender.com/health`

---

## 📝 Deployment Checklist

- [ ] Supabase project created
- [ ] Database migration SQL executed
- [ ] Database connection string copied
- [ ] Render web service created
- [ ] Backend environment variables configured
- [ ] Backend deployed and accessible at `/docs`
- [ ] Frontend `.env.production` updated with backend URL
- [ ] Vercel project created
- [ ] Frontend deployed successfully
- [ ] Can access frontend at Vercel URL
- [ ] CORS configured correctly
- [ ] Can create/view leads from frontend
- [ ] Database shows records in Supabase dashboard
- [ ] Custom domains configured (optional)
- [ ] SSL certificates working (automatic)

---

## 🎉 Success!

Your AI-CRM is now live in production!

**Access Points:**
- 🌐 **Frontend**: https://your-app.vercel.app
- 🔧 **Backend API**: https://your-backend.onrender.com
- 📚 **API Docs**: https://your-backend.onrender.com/docs
- 🗄️ **Database**: Supabase Dashboard

**Next Steps:**
1. Create admin user account
2. Import existing leads (if any)
3. Configure communication services (WhatsApp, Email)
4. Set up monitoring and alerts
5. Train your team on the new system

---

## 💰 Cost Breakdown

### Free Tier Limits:
- **Supabase**: 500MB database, 50,000 monthly active users
- **Render**: 750 hours/month free (sleeps after 15 min inactivity)
- **Vercel**: 100GB bandwidth, unlimited deployments

### Upgrades (if needed):
- **Supabase Pro**: $25/month (8GB database, no limits)
- **Render Standard**: $7/month (stays awake 24/7)
- **Vercel Pro**: $20/month (unlimited bandwidth)

**Total Monthly Cost**: $0 (free tier) or ~$52 (pro tier)

---

## 📞 Support

If you encounter issues:
1. Check Render logs (Dashboard → Logs)
2. Check Vercel deployment logs
3. Check browser console (F12)
4. Verify all environment variables
5. Test backend API directly via `/docs`

Good luck with your deployment! 🚀
