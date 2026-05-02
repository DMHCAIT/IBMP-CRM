# ✅ SCRIPTS UPDATED - READY TO RUN

## 🎉 All Scripts Customized for Your Data!

I've updated scripts 1-4 to handle your specific lead data structure:

### ✅ What's Been Updated

| Script | Updated For | Key Features |
|--------|-------------|--------------|
| `01_clean_data.py` | Your column structure | Handles duplicate columns (createdAt vs created_at), standardizes status |
| `02_parse_notes.py` | JSON notes parsing | **CRITICAL** - Extracts 12 features from JSON notes |
| `03_feature_engineering.py` | Lead-specific features | Creates engagement, urgency, quality scores |
| `04_label_creation.py` | Enrolled = converted | Binary labels based on "Enrolled" status |

---

## 🚀 READY TO RUN - NEXT STEPS

### Step 1: Activate Environment
```bash
cd "/Users/rubeenakhan/Desktop/ADVANCED AI LEAD SYSTEM/lead-ai"
source venv/bin/activate
```

You should see `(venv)` in your terminal.

### Step 2: Run Data Processing Pipeline

**Option A: One command (uses run_pipeline.sh)**
```bash
./run_pipeline.sh
```

**Option B: Step by step (recommended first time)**
```bash
cd scripts

# Step 5: Clean data
python 01_clean_data.py

# Step 6: Parse JSON notes (CRITICAL!)
python 02_parse_notes.py

# Step 7: Feature engineering
python 03_feature_engineering.py

# Step 8: Create labels
python 04_label_creation.py

# Then continue with model training
python 05_train_model.py
python 06_score_leads.py
```

---

## 📊 What Each Script Does

### STEP 5: `01_clean_data.py`
**Input:** `data/raw/leads.csv` (21.7 MB, ~19K rows)

**Process:**
- Remove duplicate columns (createdAt ↔ created_at)
- Convert dates to datetime
- Standardize status values
- Keep only required fields

**Output:** `data/processed/leads_clean.csv`

**Time:** ~30 seconds

---

### STEP 6: `02_parse_notes.py` 🔥 MOST IMPORTANT
**Input:** `data/processed/leads_clean.csv`

**Process:**
Transforms this:
```json
"[{\"content\":\"not answering\",\"author\":\"Vijayasri\",\"timestamp\":\"2025-11-04T07:33:00.574Z\"}]"
```

Into these 12 features:
- `notes_count` - Total notes
- `last_note_date` - Most recent note
- `no_response_count` - "No response" mentions
- `callback_flag` - Callback requested
- `not_interested_flag` - Not interested
- `not_answering_count` - Not answering count
- `busy_count` - Busy mentions
- `whatsapp_sent_count` - WhatsApp sent
- `sentiment_score` - Overall sentiment
- `avg_note_length` - Average note length
- `unique_authors` - Different agents
- `days_since_last_note` - Recency

**Output:** `data/processed/leads_notes.csv`

**Time:** ~2-3 minutes (processing JSON for 19K leads)

**Why Critical:** This unlocks hidden patterns in notes that predict conversion!

---

### STEP 7: `03_feature_engineering.py`
**Input:** `data/processed/leads_notes.csv`

**Process:**
Creates AI-ready features:
- **Time features**: lead_age_days, last_activity_gap, days_to_followup
- **Engagement**: engagement_score, response_rate, agent_touch_count
- **Quality**: source_quality, lead_quality_score (0-100)
- **Urgency**: urgency_score (recent activity + callbacks)
- **Categorical**: One-hot and label encoding

**Output:** `data/processed/leads_features.csv` (50+ features)

**Time:** ~1-2 minutes

---

### STEP 8: `04_label_creation.py`
**Input:** `data/processed/leads_features.csv`

**Process:**
```python
# Label rule
converted = 1  if status == "Enrolled"
converted = 0  if status == anything else

# Also creates
lead_tier = "Hot" / "Warm" / "Cold" (based on quality score)
```

**Important:**
- ✅ Keeps original status as feature
- ✅ Does NOT remove any leads
- ✅ All ~19K leads included

**Output:** `data/processed/leads_labeled.csv` ← **READY FOR ML**

**Time:** ~30 seconds

---

## 📈 Expected Output

After running all 4 steps, you'll see:

```
✅ STEP 5 COMPLETE: Data cleaned
   - Rows: 19,XXX
   - Columns: 23 (duplicates removed)

✅ STEP 6 COMPLETE: Notes parsed
   - Extracted 12 features from JSON notes
   - Average notes per lead: X.X
   - Leads with callbacks: XXX
   - Not interested: XXX

✅ STEP 7 COMPLETE: Features engineered
   - Total features: 50+
   - lead_quality_score: avg XX.X
   - Engagement score: avg XX.X

✅ STEP 8 COMPLETE: Labels created
   - Converted (Enrolled): XXX (X.X%)
   - Not Converted: XX,XXX (XX.X%)
   - Hot leads: X,XXX
   - Warm leads: X,XXX
   - Cold leads: X,XXX

🎯 DATA IS READY FOR SUPERVISED ML!
```

---

## 📁 Output Files

After completion:

```
data/processed/
├── leads_clean.csv      ← Step 5 output
├── leads_notes.csv      ← Step 6 output (with note features)
├── leads_features.csv   ← Step 7 output (full features)
└── leads_labeled.csv    ← Step 8 output (READY FOR ML)
```

---

## 🎯 Then Train the Model

After Step 8 completes:

```bash
# Step 5: Train CatBoost model
python 05_train_model.py

# Step 6: Score all leads
python 06_score_leads.py
```

**Final Output:**
- `outputs/scored_leads.csv` - All leads with scores 0-100
- `outputs/top_leads.csv` - Top 50 high-priority leads
- `models/lead_scoring_model.pkl` - Trained model
- `outputs/*.png` - Visualizations

---

## ⚠️ Important Reminders

1. **Virtual environment MUST be active**: `source venv/bin/activate`
2. **Run scripts in order**: 01 → 02 → 03 → 04 → 05 → 06
3. **Don't edit raw data**: `leads.csv` stays untouched
4. **Check each output**: Make sure each step completes before next
5. **JSON parsing**: Step 6 may show warnings for malformed JSON (normal)

---

## 🆘 If Something Goes Wrong

**Error: "File not found"**
- Make sure previous step completed successfully
- Check you're in the right directory

**Error: "Column not found"**
- Run from Step 1 again
- Check raw data has expected columns

**JSON warnings in Step 6**
- Normal - script handles malformed JSON
- As long as it completes, you're fine

**Low conversion rate warning**
- Expected if few leads are "Enrolled"
- Model will handle class imbalance

---

## 📊 Key Improvements Made

Your scripts now:

✅ Handle JSON notes properly (was plain text before)  
✅ Extract 12 meaningful features from notes  
✅ Use "Enrolled" status for labels (was generic before)  
✅ Remove duplicate columns automatically  
✅ Create lead-specific features (source quality, urgency, etc.)  
✅ Keep all leads (no filtering)  
✅ Proper date handling for your format  
✅ Calculate source conversion rates  
✅ Create composite quality scores  

---

## 🚀 YOU'RE READY!

Everything is set up. Just run:

```bash
cd "/Users/rubeenakhan/Desktop/ADVANCED AI LEAD SYSTEM/lead-ai"
source venv/bin/activate
cd scripts
python 01_clean_data.py
```

And follow through steps 2-6!

---

**Last Updated**: December 24, 2025  
**Scripts**: Customized for your lead data  
**Data**: 21.7 MB, ~19K leads  
**Status**: ✅ READY TO RUN

**Let's process those leads! 🎯**
