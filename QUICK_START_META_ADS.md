# 🚀 QUICK START - Meta Ads Fields

## ⚡ 1-MINUTE SETUP

### Step 1: Run Database Migration
```bash
# Option A: Supabase Dashboard (Easiest)
1. Go to https://supabase.com/dashboard
2. Open SQL Editor
3. Paste: lead-ai/crm/backend/migrations/003_add_meta_ads_fields.sql
4. Click Run

# Option B: CLI
supabase db push
```

### Step 2: Test Sync
```javascript
// Google Apps Script → Run manually
syncNewLeads()
```

### Step 3: Verify
```bash
# Check database
SELECT campaign_id, ad_id, external_id FROM leads LIMIT 5;
```

---

## ✅ WHAT'S WORKING NOW

### Backend API ✅
- `GET /api/leads?campaign_id=123` - Filter by campaign
- `GET /api/leads?is_organic=true` - Filter by traffic type
- `PUT /api/leads/{id}` - Update Meta Ads fields
- All 9 Meta Ads fields in API responses

### Frontend UI ✅
- **Leads Page**: Edit drawer has "Meta Ads Information" section
- **Campaign Page**: Shows all Meta Ads columns (22 total)
- **Google Sheets**: Auto-syncs every 5 minutes

### Data Flow ✅
```
Google Sheets → Apps Script → Webhook → Database → API → UI
     ✓             ✓            ✓         ⚠️         ✓      ✓
                                     (needs migration)
```

---

## 📋 FIELDS INCLUDED

1. **campaign_id** - Meta campaign ID
2. **campaign_name** - Campaign name
3. **ad_id** - Ad ID
4. **ad_name** - Ad name
5. **adset_id** - Adset ID
6. **adset_name** - Adset name
7. **form_id** - Form ID
8. **form_name** - Form name
9. **external_id** - Sheet row ID
10. **is_organic** - Organic vs paid (boolean)

---

## 🔍 VERIFY IT'S WORKING

### Test 1: Check Campaign Analytics
1. Login to CRM
2. Go to **Campaign Analytics** page
3. See columns: Campaign ID, Ad ID, Form ID, etc.

### Test 2: Edit a Lead
1. Go to **Leads** page
2. Click **Edit** on any lead
3. Scroll down to "Meta Ads Information"
4. Fill in campaign_id: "TEST"
5. Save
6. Re-open → Should see "TEST"

### Test 3: API Filter
```bash
curl "https://ibmp-crm-1.onrender.com/api/leads?campaign_id=TEST" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚠️ IMPORTANT

**Before migration runs:**
- Backend won't crash (handles missing columns gracefully)
- Meta Ads data syncs from sheets but isn't saved
- Edit form shows fields but saves fail silently

**After migration:**
- All Meta Ads data saves properly ✅
- Full end-to-end functionality ✅

---

## 📚 FULL DOCS

See [META_ADS_FIELDS_IMPLEMENTATION.md](META_ADS_FIELDS_IMPLEMENTATION.md) for:
- Complete implementation details
- API endpoint examples
- Troubleshooting guide
- Advanced configurations

See [API_FIELD_VERIFICATION.md](API_FIELD_VERIFICATION.md) for:
- Field connection verification
- No mismatch confirmation
- Testing guide

---

## 🎯 NEXT STEP

**Run the migration SQL now** to enable full functionality!

Location: `lead-ai/crm/backend/migrations/003_add_meta_ads_fields.sql`
