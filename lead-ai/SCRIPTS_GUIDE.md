# 🔥 UPDATED SCRIPTS - READY FOR YOUR DATA

## ✅ Scripts Updated for Your Lead Data Structure

All 4 scripts have been customized to handle:
- JSON notes field (the MOST CRITICAL part)
- "Enrolled" status for conversion labels
- Your specific column names (createdAt, assignedTo, etc.)
- Duplicate columns cleanup

---

## 📊 STEP 5: Clean & Normalize Data

### Script: `01_clean_data.py`

**What it does:**
1. ✅ Removes duplicate columns (createdAt vs created_at)
2. ✅ Fixes date formats to datetime
3. ✅ Standardizes status values
4. ✅ Keeps only required fields

**Output:** `data/processed/leads_clean.csv`

**Run it:**
```bash
cd scripts
python 01_clean_data.py
```

**Expected Result:**
- ~19,000 leads cleaned
- Duplicate columns removed
- Dates properly formatted
- Status standardized

---

## 🔥 STEP 6: Parse Notes Field (CRITICAL!)

### Script: `02_parse_notes.py`

**What it does:**
Your notes field contains JSON like:
```json
[{"content":"not answering","author":"Vijayasri","timestamp":"2025-11-04T07:33:00.574Z"}]
```

This script extracts:
- `notes_count` - Total number of notes
- `last_note_date` - Most recent note timestamp
- `no_response_count` - How many "no response" mentions
- `callback_flag` - Callback requested (1/0)
- `not_interested_flag` - Marked not interested (1/0)
- `not_answering_count` - "Not answering" mentions
- `busy_count` - "Busy" mentions
- `whatsapp_sent_count` - WhatsApp messages sent
- `sentiment_score` - Overall sentiment (-1 to 1)
- `avg_note_length` - Average note length
- `unique_authors` - Number of different agents
- `days_since_last_note` - Recency

**Output:** `data/processed/leads_notes.csv`

**Run it:**
```bash
python 02_parse_notes.py
```

**Why This is Critical:**
🔥 This transforms unusable JSON strings into 12 ML features that capture:
- Lead engagement
- Agent effort
- Lead responsiveness
- Sentiment/interest level

---

## 🧠 STEP 7: Feature Engineering (AI Thinking)

### Script: `03_feature_engineering.py`

**What it creates:**

| Feature | Meaning | ML Value |
|---------|---------|----------|
| `lead_age_days` | How old is the lead | Older = colder |
| `last_activity_gap` | Days since last action | Recency matters |
| `engagement_score` | Notes + communications | High = interested |
| `urgency_score` | Recent activity + callbacks | Prioritization |
| `source_quality` | Source conversion rate | Some sources better |
| `agent_touch_count` | Sales effort invested | Higher = warmer |
| `response_rate` | % of times lead responded | Engagement signal |
| `lead_quality_score` | Composite 0-100 score | Overall quality |

**Output:** `data/processed/leads_features.csv`

**Run it:**
```bash
python 03_feature_engineering.py
```

**Result:**
- 50+ ML-ready features
- Categorical variables encoded
- Missing values handled
- Ready for modeling

---

## 🎯 STEP 8: Create Labels (Enrolled = Converted)

### Script: `04_label_creation.py`

**Label Rule:**
```python
converted = 1  →  status == "Enrolled"
converted = 0  →  all others (Follow Up, Not Interested, etc.)
```

**What it does:**
1. ✅ Creates binary `converted` label
2. ✅ Keeps original status as feature (important!)
3. ✅ Creates lead tiers (Hot/Warm/Cold)
4. ✅ Validates data quality
5. ✅ Does NOT remove any leads

**Output:** `data/processed/leads_labeled.csv`

**Run it:**
```bash
python 04_label_creation.py
```

**Expected Result:**
```
Conversion Labels Created:
   Converted (Enrolled): XXX (X.X%)
   Not Converted: XXX (XX.X%)

Lead Tier Distribution:
   Hot  : X,XXX (XX.X%)
   Warm : X,XXX (XX.X%)
   Cold : X,XXX (XX.X%)
```

---

## 🚀 Run All 4 Steps

```bash
cd "/Users/rubeenakhan/Desktop/ADVANCED AI LEAD SYSTEM/lead-ai"
source venv/bin/activate
cd scripts

python 01_clean_data.py
python 02_parse_notes.py
python 03_feature_engineering.py
python 04_label_creation.py
```

---

## 📊 What Happens to Your Data

**Before (Raw CSV):**
```
notes: "[{\"content\":\"not answering\",\"author\":\"Vijayasri\"...}]"
status: "Follow Up"
```

**After Step 6 (Notes Parsed):**
```
notes_count: 5
no_response_count: 3
sentiment_score: -0.61
callback_flag: 0
not_interested_flag: 0
```

**After Step 7 (Features):**
```
lead_age_days: 45
engagement_score: 12
urgency_score: 35
lead_quality_score: 42.3
source_quality: 15.2
```

**After Step 8 (Labeled):**
```
converted: 0 (because status is "Follow Up", not "Enrolled")
lead_tier: "Warm"
```

---

## ⚠️ Important Notes

1. **Don't Edit Raw Data**: `data/raw/leads.csv` stays untouched
2. **JSON Parsing**: Script handles malformed JSON gracefully
3. **Enrolled Status**: Only "Enrolled" status = converted = 1
4. **All Leads Kept**: No filtering, all 19K+ leads included
5. **Original Status**: Kept as feature for model to learn from

---

## 🎯 After Completion

You'll have:
- ✅ `leads_clean.csv` - Cleaned data
- ✅ `leads_notes.csv` - Parsed notes features
- ✅ `leads_features.csv` - Full feature set
- ✅ `leads_labeled.csv` - **READY FOR ML TRAINING**

Next: Train model with `05_train_model.py`

---

## 🆘 Troubleshooting

**If script fails:**
1. Check error message
2. Verify virtual environment is active: `source venv/bin/activate`
3. Ensure you're in `scripts/` directory
4. Check previous step completed successfully

**Common Issues:**
- "File not found": Run previous step first
- "Column not found": Check if raw data has expected columns
- "JSON parse error": Script handles this, just a warning

**Need to re-run?**
Safe to re-run any script - they overwrite previous output.

---

**Created**: December 24, 2025  
**Status**: ✅ Scripts customized for your data  
**Data**: 21.7 MB, ~19K leads with JSON notes  
**Next**: Run the 4 scripts in order
