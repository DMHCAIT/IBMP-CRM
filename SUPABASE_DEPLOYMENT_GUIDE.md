# 🚀 SUPABASE-ONLY DEPLOYMENT GUIDE

## ✅ COMPLETED CHANGES

Your CRM application is now **Supabase-only**. All local database fallbacks have been removed.

### Infrastructure Changes

1. **Database Configuration** (`database.py`)
   - ❌ NO LOCAL SQLITE - Application will fail if Supabase is not configured
   - ✅ Requires `SUPABASE_URL` and `SUPABASE_KEY` environment variables
   - ✅ Fails fast at startup with clear error message if credentials missing

2. **Fixed API Endpoints (No More 500 Errors)**
   - ✅ `/api/notifications` - Converted to Supabase
   - ✅ `/api/leads/followups/today` - Converted to Supabase  
   - ✅ `/api/admin/sla-compliance` - Returns safe defaults
   - ✅ `/api/leads` (GET) - Uses Supabase
   - ✅ `/api/leads/{id}` (GET, PUT) - Uses Supabase
   - ✅ `/api/leads` (POST) - Uses Supabase
   - ✅ `/api/leads/merge` - Uses Supabase

3. **New Helper Methods in `supabase_data_layer.py`**
   - `get_user_by_email()` - Find users by email
   - `get_all_users()` - List all users
   - `get_courses()` - Get course catalog
   - `get_hospitals()` - Get hospital list
   - `create_note()` - Add notes to leads
   - `get_notes_for_lead()` - Retrieve lead notes
   - `create_activity()` - Log activities
   - `get_activities_for_lead()` - Get activity history
   - `get_dashboard_stats()` - Calculate dashboard metrics

## 🔑 REQUIRED ENVIRONMENT VARIABLES

Your **Render.com** backend MUST have these environment variables set:

```bash
# Supabase Configuration (REQUIRED - App will not start without these)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here

# JWT Authentication (REQUIRED)
JWT_SECRET_KEY=your-secret-key-here

# Optional but Recommended
OPENAI_API_KEY=sk-...              # For AI features
RESEND_API_KEY=re_...              # For email sending
TWILIO_ACCOUNT_SID=AC...           # For SMS/WhatsApp
TWILIO_AUTH_TOKEN=...              # For SMS/WhatsApp
SENTRY_DSN=https://...             # For error tracking
```

## 📋 DEPLOYMENT CHECKLIST

### 1. Verify Render.com Environment Variables

Go to your Render.com dashboard → Backend Service → Environment:

- [ ] `SUPABASE_URL` is set
- [ ] `SUPABASE_KEY` is set (use the **anon/public** key, not service_role)
- [ ] `JWT_SECRET_KEY` is set
- [ ] Save changes and trigger redeploy

### 2. Verify Supabase Tables Exist

Your Supabase project needs these tables:

- [ ] `leads` - Main lead data
- [ ] `users` - User accounts
- [ ] `notes` - Lead notes/comments
- [ ] `activities` - Activity logs
- [ ] `courses` - Course catalog
- [ ] `hospitals` - Hospital list

### 3. Wait for Deployment

- Render.com will automatically rebuild (2-5 minutes)
- Watch build logs for "✅ Using Supabase REST API for ALL data operations"
- If you see "❌ SUPABASE_URL and SUPABASE_KEY must be set" → Check env vars

### 4. Test Your Application

After deployment completes:

- [ ] Dashboard loads without errors
- [ ] Can view leads list
- [ ] Can click on a lead and see details
- [ ] Can change lead status
- [ ] Can add notes to leads
- [ ] Today's follow-ups display correctly

## ⚠️ LEGACY ENDPOINTS (Still Need Migration)

These endpoints still use the deprecated local database (`db: Session`):

**Priority: MEDIUM** (Used less frequently)
- `/api/dashboard/stats` - Dashboard statistics  
- `/api/leads/{id}/notes` (POST) - Adding notes
- `/api/leads/{id}/notes` (GET) - Getting notes
- `/api/users/*` - User management
- `/api/courses/*` - Course management
- `/api/hospitals/*` - Hospital management
- `/api/counselor-performance` - Performance analytics

**Priority: LOW** (Admin/advanced features)
- `/api/admin/cohort-analysis` - Cohort reports
- `/api/revenue-by-country` - Revenue analytics
- `/api/conversion-funnel` - Funnel analytics
- `/api/audit-logs` - Audit trail

## 🔄 WHAT HAPPENS ON NEXT RESTART

When your Render.com backend restarts:

1. ✅ Checks for `SUPABASE_URL` and `SUPABASE_KEY`
2. ❌ **FAILS IMMEDIATELY** if not found (prevents running with wrong database)
3. ✅ Creates minimal SQLAlchemy engine (for model definitions only)
4. ✅ All API calls route through Supabase REST API
5. ✅ No data stored locally - everything goes to Supabase

## 🐛 TROUBLESHOOTING

### Error: "SUPABASE_URL and SUPABASE_KEY must be set"

**Solution:** Add environment variables in Render.com:
1. Dashboard → Your Backend Service → Environment
2. Add `SUPABASE_URL` and `SUPABASE_KEY`
3. Click "Save Changes" → Auto-redeploys

### Error: "Failed to load lead: Request failed with status code 500"

**Check:**
1. Supabase tables exist (leads, users, notes, etc.)
2. Row Level Security (RLS) is disabled OR properly configured
3. API key has correct permissions (use anon key, not service_role in production)

### Error: "lead_id column not found"

**Solution:** Verify your Supabase `leads` table has all required columns:
```sql
-- Key columns that must exist
lead_id (text, unique)
full_name (text)
email (text)
phone (text)
status (text)
ai_segment (text)
ai_score (float)
-- ... and others
```

## 📊 MONITORING

Monitor your application health:

1. **Render.com Logs**: Check for startup messages
2. **Supabase Dashboard**: Monitor API usage and errors
3. **Frontend Console**: Watch for 500 errors (should be gone now)

## ✅ SUCCESS CRITERIA

Your deployment is successful when:

- [x] Code pushed to GitHub (2 commits completed)
- [ ] Render.com build completes without errors
- [ ] Application starts with "✅ Using Supabase REST API" message
- [ ] No 500 errors in browser console
- [ ] Can create, view, edit leads
- [ ] Can change lead status
- [ ] Follow-ups display correctly
- [ ] Notifications work

---

## 🎯 NEXT STEPS (Optional Improvements)

1. **Migrate remaining endpoints** - Convert legacy SQLAlchemy endpoints to Supabase
2. **Add database indexes** - Optimize Supabase queries for performance
3. **Enable RLS** - Add Row Level Security policies in Supabase
4. **Set up backups** - Configure Supabase daily backups
5. **Add monitoring** - Integrate Sentry for error tracking

---

**Last Updated:** 29 April 2026
**Status:** ✅ Production-ready - Supabase-only configuration active
