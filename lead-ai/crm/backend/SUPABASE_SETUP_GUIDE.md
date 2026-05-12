# 🚀 Supabase Cloud Database Integration Guide

## Overview

Your Medical Education CRM now supports **Supabase PostgreSQL** for cloud deployment! This enables:
- ✅ Scalable cloud database
- ✅ Real-time data synchronization
- ✅ Automatic backups
- ✅ Production-ready infrastructure
- ✅ Multi-user access
- ✅ Row-level security (optional)

## Quick Start

### Step 1: Set Up Supabase Database

1. **Open Supabase Dashboard**
   - URL: https://goeybfakjdqcwztazfmk.supabase.co
   - Login with your credentials

2. **Run Database Migration**
   - Go to **SQL Editor** (left sidebar)
   - Click **New Query**
   - Copy the entire SQL from `supabase_migration.sql`
   - Click **Run** or press `Ctrl+Enter`

   ✅ This creates all tables, indexes, and triggers

3. **Get PostgreSQL Connection String**
   - Go to **Settings** > **Database**
   - Scroll to **Connection String** section
   - Select **Connection pooling** mode
   - Copy the **URI** (looks like):
     ```
     postgresql://postgres.goeybfakjdqcwztazfmk:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
     ```

4. **Update Environment Variables**
   - Open `.env` file
   - Replace `YOUR_PASSWORD` in `DATABASE_URL` with your actual database password
   - Find your password in Supabase Settings > Database > Database password

### Step 2: Test Connection

```bash
cd /Users/rubeenakhan/Desktop/ADVANCED\ AI\ LEAD\ SYSTEM/lead-ai/crm/backend
source venv/bin/activate
python -c "from supabase_client import supabase_manager; import asyncio; asyncio.run(supabase_manager.test_connection())"
```

Expected output:
```
✅ Supabase connection successful
```

### Step 3: Migrate Data (Optional)

If you have existing SQLite data, migrate it:

```bash
python migrate_to_supabase.py
```

### Step 4: Start Server with Supabase

```bash
uvicorn main:app --reload --port 8000
```

Check health status:
```bash
curl http://localhost:8000/health | python -m json.tool
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-12-25T12:00:00",
  "database": "postgresql (supabase)",
  "database_connection": "connected",
  "supabase": "configured",
  "supabase_connection": "connected"
}
```

## Environment Variables

### Required for Supabase

```env
# Supabase Configuration
SUPABASE_URL=https://goeybfakjdqcwztazfmk.supabase.co
SUPABASE_KEY=sb_publishable_yRyFt7TqtTsM1qxswzjA_w_FFxVnp7Q
SUPABASE_JWT_SECRET=mJWIVC+ikuaGqlHd4cJxCr+YpN8DjLX+PlQQHUWqcnp4WnF//y2TT6FKfvdnaXnNQ+Y3No3VgVI7HajHhsABoQ==

# PostgreSQL Connection (get from Supabase Dashboard)
DATABASE_URL=postgresql://postgres.goeybfakjdqcwztazfmk:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

### How to Get Your Database Password

1. Go to Supabase Dashboard
2. Settings > Database
3. Look for **Database Password** section
4. Click **Reset Database Password** if you forgot it
5. Copy the new password
6. Update `DATABASE_URL` in `.env`

## Database Schema

The migration creates these tables:

### Core Tables
- **users** - User accounts with authentication
- **leads** - Lead data with AI scoring
- **activities** - Lead activity tracking
- **notes** - Lead notes and comments
- **courses** - Course catalog with pricing
- **counselors** - Counselor profiles
- **hospitals** - Hospital partnerships

### Indexes Created
All indexes from Phase 6 are automatically created:
- Status, country, segment filters
- Date range queries
- Assignment lookups
- Composite indexes for common patterns

### Triggers
Auto-updating `updated_at` timestamps for:
- users
- leads
- notes

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (React/Next)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   FastAPI       │
│   Backend       │
└────────┬────────┘
         │
         ├──→ SQLAlchemy ORM
         │
         ↓
┌─────────────────┐      ┌──────────────────┐
│   SQLite        │  OR  │   Supabase       │
│   (Local Dev)   │      │   PostgreSQL     │
└─────────────────┘      └──────────────────┘
```

## Features

### Automatic Database Detection

The system automatically detects which database to use:

```python
# In .env file:
DATABASE_URL=sqlite:///./crm_database.db  # → Uses SQLite
DATABASE_URL=postgresql://...             # → Uses PostgreSQL
```

### Connection Pooling

PostgreSQL connections use:
- **Pool Size**: 10 connections
- **Max Overflow**: 20 additional connections
- **Pre-ping**: Verifies connections before use
- **Auto-reconnect**: Handles connection drops

### Dual Mode Support

| Feature | SQLite (Local) | PostgreSQL (Supabase) |
|---------|----------------|------------------------|
| Development | ✅ Perfect | ⚠️ Slower due to network |
| Production | ❌ Not scalable | ✅ Recommended |
| Multi-user | ❌ Limited | ✅ Unlimited |
| Backups | Manual | ✅ Automatic |
| Real-time | ❌ No | ✅ Optional |
| Cloud Access | ❌ No | ✅ Yes |

## Production Deployment

### 1. Environment Setup

```bash
# Set environment variable
export DATABASE_URL="postgresql://postgres.goeybfakjdqcwztazfmk:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

# Or use .env file
echo 'DATABASE_URL=postgresql://...' > .env
```

### 2. Deploy to Cloud Platform

#### Vercel/Railway/Render

1. Connect GitHub repository
2. Set environment variables:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - All other API keys from `.env`

3. Deploy!

#### Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV DATABASE_URL="postgresql://..."

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Data Migration

### From SQLite to Supabase

```bash
# Create migration script
python migrate_to_supabase.py
```

This will:
1. Connect to both databases
2. Export all SQLite data
3. Import into Supabase
4. Verify record counts
5. Create backup

### Manual Migration

```sql
-- Export from SQLite
sqlite3 crm_database.db .dump > backup.sql

-- Import to PostgreSQL (modify syntax as needed)
psql [SUPABASE_CONNECTION_STRING] < backup_postgresql.sql
```

## Monitoring

### Health Check Endpoint

```bash
curl http://localhost:8000/health
```

Returns:
```json
{
  "status": "healthy",
  "database": "postgresql (supabase)",
  "database_connection": "connected",
  "supabase": "configured",
  "supabase_connection": "connected"
}
```

### Supabase Dashboard

Monitor in real-time:
- Database size
- Active connections
- Query performance
- Table statistics

Go to: https://goeybfakjdqcwztazfmk.supabase.co/project/_/database/tables

## Troubleshooting

### Connection Refused

**Problem**: Cannot connect to Supabase

**Solutions**:
1. Check internet connection
2. Verify Supabase credentials in `.env`
3. Check if Supabase project is paused (free tier auto-pauses)
4. Verify firewall/proxy settings

### Password Error

**Problem**: Authentication failed

**Solutions**:
1. Reset database password in Supabase Dashboard
2. Update `DATABASE_URL` with new password
3. Ensure no special characters break the URL (URL-encode if needed)

### SSL/TLS Error

**Problem**: SSL certificate verification failed

**Solution**:
```python
# In main.py, modify engine creation:
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"sslmode": "require"}
)
```

### Migration Fails

**Problem**: SQL migration errors

**Solutions**:
1. Run SQL statements one by one in Supabase SQL Editor
2. Check for existing tables (drop if needed)
3. Verify PostgreSQL version compatibility

## Best Practices

### 1. Use Connection Pooling

Already configured! The system maintains a pool of database connections for optimal performance.

### 2. Enable Row-Level Security (RLS)

For multi-tenant setups:

```sql
-- Enable RLS on leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY user_leads_policy ON leads
  FOR ALL
  USING (assigned_to = current_user);
```

### 3. Regular Backups

Supabase provides automatic backups, but you can also:

```bash
# Manual backup
pg_dump [CONNECTION_STRING] > backup_$(date +%Y%m%d).sql
```

### 4. Monitor Performance

- Use Supabase Performance monitoring
- Check slow queries in Dashboard
- Optimize indexes based on query patterns

### 5. Scale as Needed

Supabase Free Tier:
- 500 MB database
- Unlimited API requests
- Auto-pauses after 1 week inactivity

Upgrade to Pro for:
- 8 GB database
- No auto-pause
- Daily backups
- Point-in-time recovery

## Next Steps

1. ✅ Run migration SQL in Supabase Dashboard
2. ✅ Update `.env` with correct DATABASE_URL
3. ✅ Test health endpoint
4. ✅ Migrate existing data (if any)
5. ✅ Deploy to production
6. 🚀 Start using cloud database!

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Dashboard**: https://goeybfakjdqcwztazfmk.supabase.co
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

**Status**: Ready for production deployment! 🎉
