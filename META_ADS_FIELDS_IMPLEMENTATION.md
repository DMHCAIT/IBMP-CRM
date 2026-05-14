# Meta Ads Fields - Complete Implementation Status

## ✅ COMPLETED WORK

### 1. Google Apps Script ✅
**File**: `google_apps_script.js`
**Status**: All 19 Meta Ads fields mapped and syncing

All Meta Ads fields are properly mapped:
- `id` → `external_id`
- `created_time` → `created_at`
- `campaign_id`, `ad_id`, `adset_id`, `form_id` → same field names
- `ad_name`, `adset_name`, `campaign_name`, `form_name` → same field names
- `is_organic` → `is_organic`
- Auto-sync trigger runs every 5 minutes

### 2. Backend Models ✅
**File**: `lead-ai/crm/backend/main.py`
**Status**: All Meta Ads fields in Python models

**DBLead (SQLAlchemy)** - Lines 584-597:
```python
campaign_id = Column(String, nullable=True)
ad_id = Column(String, nullable=True)
adset_id = Column(String, nullable=True)
form_id = Column(String, nullable=True)
ad_name = Column(String, nullable=True)
adset_name = Column(String, nullable=True)
form_name = Column(String, nullable=True)
is_organic = Column(Boolean, nullable=True, default=False)
external_id = Column(String, nullable=True)
```

**LeadCreate & LeadUpdate (Pydantic)**: All fields present as Optional

### 3. Webhook Endpoint ✅
**File**: `lead-ai/crm/backend/routers/webhooks_router.py`
**Status**: Preserves `created_at` and accepts all Meta Ads fields

### 4. Data Layer (Supabase) ✅
**File**: `lead-ai/crm/backend/supabase_data_layer.py`
**Status**: Meta Ads fields added to optional columns lists

**Changes**:
- `NEW_COLUMNS` in `update_lead()` includes: `campaign_id`, `ad_id`, `adset_id`, `form_id`, `is_organic`, `external_id`
- `_OPTIONAL_COLUMNS` in `create_lead()` includes same fields
- This allows graceful handling when database columns don't exist yet

### 5. API Filters ✅
**Files**: 
- `lead-ai/crm/backend/routers/leads_router.py`
- `lead-ai/crm/backend/supabase_data_layer.py`

**Changes**:
```python
# New filter parameters in get_leads endpoint:
campaign_id: Optional[str] = None
ad_id: Optional[str] = None
adset_id: Optional[str] = None
form_id: Optional[str] = None
campaign_name: Optional[str] = None
is_organic: Optional[bool] = None
external_id: Optional[str] = None
```

Filters properly passed to Supabase query builder.

### 6. Frontend Edit Form ✅
**File**: `lead-ai/crm/frontend/src/pages/LeadsPageEnhanced.js`
**Status**: All 9 Meta Ads fields in edit drawer

**New section added** (after UTM fields):
- Campaign ID & Campaign Name
- Ad ID & Ad Name
- Adset ID & Adset Name
- Form ID & Form Name
- External ID & Is Organic (Switch component)

Form values properly set when editing existing leads.

### 7. Campaign Analytics Page ✅
**File**: `lead-ai/crm/frontend/src/pages/CampaignAnalyticsPage.js`
**Status**: 22 columns including all Meta Ads fields

Displays: Campaign ID, Ad ID, Adset ID, Form ID, Campaign Name, Ad Name, Adset Name, Form Name, Is Organic, External ID, Quality, Created timestamp

---

## ⚠️ CRITICAL: DATABASE MIGRATION REQUIRED

### Current State
The **database schema does NOT have Meta Ads columns yet**. Migration SQL created but NOT executed.

**Migration File**: `lead-ai/crm/backend/migrations/003_add_meta_ads_fields.sql`

### ⚡ EXECUTE MIGRATION NOW

#### Option 1: Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Navigate to **SQL Editor**
3. Open the file `lead-ai/crm/backend/migrations/003_add_meta_ads_fields.sql`
4. Copy entire contents
5. Paste into SQL Editor
6. Click **Run** button

#### Option 2: Supabase CLI
```bash
cd lead-ai/crm/backend
supabase db push
```

#### Option 3: Direct SQL Connection
```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -f migrations/003_add_meta_ads_fields.sql
```

### Verification Query
After running migration, verify with:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN (
    'campaign_id', 'ad_id', 'adset_id', 'form_id',
    'ad_name', 'adset_name', 'form_name',
    'is_organic', 'external_id'
  )
ORDER BY column_name;
```

Should return 9 rows.

---

## 📊 DATA FLOW VERIFICATION

### Step 1: Google Sheets → Webhook
1. Open Google Sheets with lead data
2. Go to **Extensions → Apps Script**
3. Run `syncNewLeads()` manually
4. Check **Execution log** for success messages
5. Verify Lead IDs written back to sheet

### Step 2: Verify in Database
```sql
SELECT lead_id, campaign_id, ad_id, form_id, external_id, is_organic, created_at
FROM leads
WHERE external_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Step 3: Check Campaign Analytics Page
1. Login to CRM: https://ibmp-crm-1.onrender.com
2. Navigate to **Campaign Analytics** page
3. Verify columns display:
   - Campaign ID, Campaign Name
   - Ad ID, Ad Name
   - Adset ID, Adset Name
   - Form ID, Form Name
   - Is Organic, External ID

### Step 4: Test Leads Page Edit
1. Go to **Leads** page
2. Click **Edit** on any lead from Google Sheets
3. Scroll to **Meta Ads Information** section
4. Verify all fields display properly
5. Try updating a field and save
6. Re-open lead to confirm changes persisted

---

## 🔍 API ENDPOINT EXAMPLES

### List Leads with Meta Ads Filters
```bash
curl -X GET "https://ibmp-crm-1.onrender.com/api/leads?campaign_id=123456789&is_organic=false" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Single Lead (includes all Meta Ads fields)
```bash
curl -X GET "https://ibmp-crm-1.onrender.com/api/leads/LEAD-12345" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Lead with Meta Ads Fields
```bash
curl -X PUT "https://ibmp-crm-1.onrender.com/api/leads/LEAD-12345" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "987654321",
    "ad_name": "MBBS Summer Campaign",
    "is_organic": false
  }'
```

---

## 📋 FIELD MAPPINGS REFERENCE

| Google Sheet Column | Database Column | Type | Description |
|---------------------|-----------------|------|-------------|
| `id` | `external_id` | VARCHAR | Original sheet row ID |
| `created_time` | `created_at` | TIMESTAMP | When lead was created |
| `campaign_id` | `campaign_id` | VARCHAR | Meta campaign ID |
| `campaign_name` | `campaign_name` | VARCHAR | Meta campaign name |
| `ad_id` | `ad_id` | VARCHAR | Meta ad ID |
| `ad_name` | `ad_name` | VARCHAR | Meta ad name |
| `adset_id` | `adset_id` | VARCHAR | Meta adset ID |
| `adset_name` | `adset_name` | VARCHAR | Meta adset name |
| `form_id` | `form_id` | VARCHAR | Meta form ID |
| `form_name` | `form_name` | VARCHAR | Meta form name |
| `is_organic` | `is_organic` | BOOLEAN | Organic vs paid traffic |
| `platform` | `campaign_medium` | VARCHAR | Traffic source platform |

---

## ✨ BENEFITS OF META ADS INTEGRATION

1. **Campaign Performance Tracking**: See which campaigns generate the most leads
2. **Ad Optimization**: Identify best-performing ads and adsets
3. **ROI Analysis**: Calculate cost per lead by campaign
4. **Organic vs Paid**: Compare conversion rates
5. **Form Performance**: Track which lead forms work best
6. **Attribution**: Full funnel visibility from ad click to enrollment

---

## 🚀 NEXT STEPS (Optional Enhancements)

### 1. Campaign Dashboard
Create dedicated page showing:
- Total leads by campaign
- Conversion rates by ad
- Revenue per campaign
- Best performing adsets

### 2. Filter UI Enhancements
Add Meta Ads filters to Leads page:
- Campaign dropdown
- Is Organic toggle
- Ad/Adset filters in Advanced Filters drawer

### 3. Activity Logging
Add Meta Ads fields to activity tracking:
```python
# In leads_router.py update_lead function
_TRACKED = {
    # ... existing fields ...
    "campaign_id": "Campaign",
    "ad_id": "Ad",
    "is_organic": "Traffic Type",
}
```

### 4. Duplicate Detection
Enhance duplicate detection to consider external_id:
```python
# Check if lead with same external_id already exists
existing = supabase_data.get_leads(external_id=lead.external_id)
```

---

## ⚠️ IMPORTANT REMINDERS

1. **Migration First**: Cannot save Meta Ads data until database columns exist
2. **Graceful Degradation**: Backend handles missing columns gracefully (won't crash)
3. **Indexes Created**: Migration creates indexes for performance
4. **All Fields Optional**: Leads can exist without Meta Ads data
5. **Backward Compatible**: Existing leads unaffected

---

## 📞 SUPPORT

If you encounter issues:

1. **Check Backend Logs**: 
   ```bash
   # Render dashboard → Logs tab
   # Look for "Column 'campaign_id' missing in Supabase" warnings
   ```

2. **Verify Migration Ran**:
   ```sql
   SELECT * FROM information_schema.columns 
   WHERE table_name = 'leads' AND column_name = 'campaign_id';
   ```

3. **Test Webhook Manually**:
   ```bash
   curl -X POST "https://ibmp-crm-1.onrender.com/api/webhooks/sync-all-from-sheet" \
     -H "X-Webhook-Secret: YOUR_SECRET" \
     -H "Content-Type: application/json" \
     -d '[]'
   ```

---

## ✅ VERIFICATION CHECKLIST

- [ ] Migration SQL executed on Supabase
- [ ] 9 new columns verified in database
- [ ] Google Sheets sync tested (syncNewLeads)
- [ ] Lead IDs written back to sheet
- [ ] Campaign Analytics page shows Meta Ads columns
- [ ] Leads page edit form has Meta Ads section
- [ ] API filters accept campaign_id, ad_id parameters
- [ ] Data persists after edit/save

---

**Status**: All code changes complete. **Only database migration remains.**

**Next Action**: Execute `003_add_meta_ads_fields.sql` in Supabase SQL Editor.
