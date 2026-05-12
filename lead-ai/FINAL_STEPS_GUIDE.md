# 🎯 FINAL STEPS - MODEL TRAINING & SCORING

## ✅ Scripts Updated for Production ML

All scripts (5-6) are now production-ready with:
- CatBoost model (handles categorical + noisy CRM data)
- Evaluation using Precision, Recall, ROC-AUC (not just accuracy)
- Business action layer with ROI mapping
- Supabase-ready output format

---

## 🤖 STEP 9: TRAIN AI MODEL

### Script: `05_train_model.py`

**Why CatBoost?**
✅ Handles categorical data automatically (no manual encoding needed)  
✅ Works well with noisy CRM data  
✅ Minimal preprocessing required  
✅ Built-in regularization prevents overfitting  
✅ Fast training and prediction  

**Input:** `data/processed/leads_labeled.csv`

**Output:**
- `models/lead_conversion_model.cbm` (CatBoost native format)
- `models/lead_conversion_model.pkl` (Pickle backup)
- `outputs/model_metrics.csv` (Precision, Recall, ROC-AUC)
- `outputs/feature_importance.csv` (Top features)
- `outputs/confusion_matrix.png` (Visual evaluation)
- `outputs/precision_recall_curve.png` (Performance curve)

**Run it:**
```bash
cd scripts
python 05_train_model.py
```

**What You'll See:**
```
🤖 TRAINING CATBOOST MODEL
   Training set: 15,XXX samples (80%)
   Test set: 3,XXX samples (20%)
   
   Iterations: 1000 (with early stopping)
   Learning rate: 0.05
   
🎯 KEY METRICS (Production-Ready):
   Precision: 0.XXXX (How many predicted conversions are correct)
   Recall:    0.XXXX (How many actual conversions we catch)
   F1 Score:  0.XXXX (Balance of precision & recall)
   ROC-AUC:   0.XXXX (Overall ranking quality)
   
🔍 Top 15 Most Important Features:
   lead_quality_score          XX.XX
   engagement_score            XX.XX
   sentiment_score             XX.XX
   ...
```

**Time:** ~3-5 minutes

**Evaluation Focus:**
- ✅ **Precision**: Minimizes false alarms (wasted sales effort)
- ✅ **Recall**: Catches actual conversions (revenue opportunity)
- ✅ **ROC-AUC**: Overall lead ranking quality
- ❌ **NOT just accuracy** (misleading with imbalanced data)

---

## 🎯 STEP 10: SCORE ALL 19K LEADS

### Script: `06_score_leads.py`

**What it does:**
1. Loads trained CatBoost model
2. Scores all ~19K leads
3. Assigns conversion probability (0-1)
4. Creates AI score (0-100)
5. Applies business action layer (STEP 11)

**Input:** `data/processed/leads_labeled.csv`

**Output:**
- `outputs/leads_scored.csv` (All leads with scores)
- `outputs/hot_leads.csv` (Score >80, immediate action)
- `outputs/top_leads.csv` (Top 100 leads)
- `outputs/action_plan.csv` (Summary by segment)

**Run it:**
```bash
python 06_score_leads.py
```

**Sample Output Format:**
```json
{
  "lead_id": "00048167-5a42-4865-a064-2f58db92df34",
  "fullName": "Nawal Azhary",
  "email": "nanoomer122@gmail.com",
  "ai_score": 14.3,
  "conversion_probability": 0.143,
  "ai_segment": "Junk",
  "next_action": "Stop calling",
  "action_priority": 4
}
```

**Time:** ~1-2 minutes

---

## 💼 STEP 11: BUSINESS ACTION LAYER (WHERE ROI HAPPENS)

### Score-to-Action Mapping:

| Score Range | Segment | Next Action | Sales Strategy |
|-------------|---------|-------------|----------------|
| **>80** (>0.8) | 🔥 **Hot** | **Call in 15 min** | Immediate phone call, personal attention |
| **50-80** (0.5-0.8) | 🟡 **Warm** | **Schedule follow-up** | Book meeting, send calendar invite |
| **20-50** (0.2-0.5) | 🔵 **Cold** | **WhatsApp drip** | Automated nurture, educational content |
| **<20** (<0.2) | ⚫ **Junk** | **Stop calling** | Unsubscribe, save sales time |

**Why This Matters (ROI):**

🔥 **Hot Leads (>80)**
- Highest conversion probability
- Immediate revenue opportunity
- Deserve premium attention
- Example: "Called back twice, high sentiment, low churn risk"

🟡 **Warm Leads (50-80)**
- Good potential, needs nurturing
- Schedule in sales pipeline
- Example: "Engaged in notes, interested keywords, recent activity"

🔵 **Cold Leads (20-50)**
- Low engagement, automate follow-up
- Use marketing automation (WhatsApp, email)
- Example: "No response, negative sentiment, old lead"

⚫ **Junk Leads (<20)**
- Stop wasting time!
- Free up sales team for hot leads
- Example: "Not interested, no response count >5, very old"

**Expected Distribution:**
```
📊 Segment Distribution:
   Hot   :    XXX (X.X%)  ← Call these NOW!
   Warm  :  X,XXX (XX.X%) ← Schedule follow-ups
   Cold  :  X,XXX (XX.X%) ← Marketing automation
   Junk  : XX,XXX (XX.X%) ← Stop calling
```

---

## 📊 Complete Pipeline Run

```bash
cd "/Users/rubeenakhan/Desktop/ADVANCED AI LEAD SYSTEM/lead-ai"
source venv/bin/activate
cd scripts

# Steps 5-8: Data Processing
python 01_clean_data.py           # ~30 sec
python 02_parse_notes.py          # ~2-3 min
python 03_feature_engineering.py  # ~1-2 min
python 04_label_creation.py       # ~30 sec

# Step 9: Train Model
python 05_train_model.py          # ~3-5 min

# Step 10: Score Leads
python 06_score_leads.py          # ~1-2 min
```

**Total Time:** ~10-15 minutes

---

## 📁 Final Output Files

After completion:

```
outputs/
├── leads_scored.csv          ← ALL leads with AI scores
├── hot_leads.csv             ← High priority (score >80)
├── top_leads.csv             ← Top 100 leads
├── action_plan.csv           ← Summary by segment
├── model_metrics.csv         ← Precision, Recall, ROC-AUC
├── feature_importance.csv    ← Top predictive features
├── feature_importance.png    ← Visual chart
├── confusion_matrix.png      ← Model performance
└── precision_recall_curve.png ← Trade-off curve

models/
├── lead_conversion_model.cbm ← Trained CatBoost model
└── lead_conversion_model.pkl ← Pickle backup
```

---

## 🔌 STEP 12: (OPTIONAL) CONNECT BACK TO SUPABASE

### Option A: Manual Upload
1. Download `outputs/leads_scored.csv`
2. In Supabase dashboard → Import CSV
3. Map columns: `ai_score`, `ai_segment`, `next_action`

### Option B: Python Script (Coming Next)
I can create a script to:
- Connect to Supabase API
- Update existing leads table
- Add columns: `ai_score`, `ai_segment`, `next_action`
- Bulk update all 19K rows

**Would you like me to create the Supabase sync script?**

---

## 🎯 Using Your Scored Leads

### For Sales Team:

**Morning Routine:**
```bash
1. Open hot_leads.csv
2. Sort by ai_score (descending)
3. Call top 10 leads immediately
4. Track conversion rate
```

**Weekly Planning:**
```bash
1. Review action_plan.csv
2. Assign Hot leads to senior reps
3. Schedule Warm leads for next week
4. Set up Cold lead automation
5. Unsubscribe Junk leads
```

### For Marketing:

**Segment Campaigns:**
- Hot: Personal outreach
- Warm: Nurture sequences
- Cold: Educational content
- Junk: Remove from campaigns

**Measure ROI:**
- Track conversion rate by segment
- Calculate cost per acquisition
- Compare to pre-AI baseline

---

## 🔍 Model Performance Interpretation

**Good Performance Indicators:**
- ✅ ROC-AUC > 0.70 (Good lead ranking)
- ✅ Precision > 0.50 (Few false alarms)
- ✅ Recall > 0.40 (Catching real conversions)

**If Performance is Low:**
1. Check feature importance → Are key features used?
2. Review data quality → Missing values? Errors?
3. Increase data size → More enrolled leads needed
4. Adjust scoring thresholds → Tune business rules

---

## ⚠️ Important Notes

**Model Retraining:**
- Retrain monthly as new data arrives
- Monitor performance drift
- Update when conversion patterns change

**Data Quality:**
- Garbage in = garbage out
- Keep notes field updated
- Accurate status labels critical

**Business Rules:**
- Adjust score thresholds based on results
- Customize actions for your sales process
- A/B test different strategies

---

## 🆘 Troubleshooting

**"Model not found" error in Step 10:**
```bash
# Run Step 9 first
python 05_train_model.py
```

**Low ROC-AUC score (<0.60):**
- Check if enough "Enrolled" leads in data
- Verify notes parsing worked correctly
- Review feature_importance.csv

**All leads scored as "Junk":**
- Model may be too conservative
- Adjust thresholds in 06_score_leads.py
- Check if features are scaled correctly

**Memory error during training:**
- Reduce CatBoost iterations (1000 → 500)
- Use smaller train/test split
- Process data in batches

---

## 🎉 YOU'RE READY!

Everything is configured. Just run:

```bash
cd scripts
python 05_train_model.py
python 06_score_leads.py
```

Then check `outputs/hot_leads.csv` and start calling! 📞

---

**Created:** December 24, 2025  
**Status:** ✅ Ready for production ML  
**Model:** CatBoost Classifier  
**Evaluation:** Precision, Recall, ROC-AUC  
**Output:** 19K leads scored with action plan
