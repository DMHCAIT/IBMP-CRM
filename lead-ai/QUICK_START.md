# 🚀 Quick Start Guide

## ✅ Setup Complete!

Your Advanced AI Lead System is ready to use. Here's what's been set up:

### 📁 Project Structure
```
lead-ai/
├── data/
│   ├── raw/           ✅ leads.csv (your data is here)
│   └── processed/     ✅ Ready for processed data
├── scripts/           ✅ All 6 ML pipeline scripts created
├── models/            ✅ Ready for trained models
├── outputs/           ✅ Ready for results
├── venv/              ✅ Virtual environment created & activated
├── requirements.txt   ✅ All dependencies installed
└── README.md          ✅ Documentation

```

### 🔧 Virtual Environment
- ✅ Created: `venv/`
- ✅ Installed: pandas, numpy, scikit-learn, catboost, spacy, textblob, matplotlib, seaborn, joblib

### 📊 Your Data
- ✅ Located at: `data/raw/leads.csv`

---

## 🎯 Next Steps: Run the ML Pipeline

### How to Activate Virtual Environment
Every time you open a new terminal:

```bash
cd "/Users/rubeenakhan/Desktop/ADVANCED AI LEAD SYSTEM/lead-ai"
source venv/bin/activate
```

You should see `(venv)` in your terminal.

---

## 🏃 Run Scripts in Order

### Step 1: Clean Data
```bash
cd scripts
python 01_clean_data.py
```
**What it does**: Removes duplicates, handles missing values, standardizes data

### Step 2: Parse Notes
```bash
python 02_parse_notes.py
```
**What it does**: Extracts sentiment, keywords, urgency from text notes

### Step 3: Feature Engineering
```bash
python 03_feature_engineering.py
```
**What it does**: Creates ML features from your data (time features, encodings)

### Step 4: Create Labels
```bash
python 04_label_creation.py
```
**What it does**: Creates conversion labels and lead tiers

### Step 5: Train Model
```bash
python 05_train_model.py
```
**What it does**: Trains CatBoost model, shows performance metrics, saves model

### Step 6: Score Leads
```bash
python 06_score_leads.py
```
**What it does**: Scores all leads, creates priority tiers, saves results

---

## 📂 Where to Find Results

After running all scripts:

- **Scored Leads**: `outputs/scored_leads.csv`
- **Top 50 Leads**: `outputs/top_leads.csv`
- **Model**: `models/lead_scoring_model.pkl`
- **Visualizations**: `outputs/confusion_matrix.png`, `outputs/feature_importance.png`

---

## 🎨 Understanding Your Results

The final output will include:

1. **lead_score** (0-100): Overall lead quality score
2. **priority** (Low/Medium/High): Action priority
3. **conversion_probability** (0-1): Likelihood to convert
4. **predicted_conversion** (0/1): Binary prediction

### Priority Tiers:
- **High (60-100)**: Contact immediately
- **Medium (30-60)**: Nurture campaign
- **Low (0-30)**: Low priority follow-up

---

## 🔍 Troubleshooting

### If you see "command not found: python":
Use `python3` instead of `python`

### If virtual environment not activated:
```bash
source venv/bin/activate
```

### If scripts fail:
1. Check data is in `data/raw/leads.csv`
2. Make sure virtual environment is activated
3. Read error messages - scripts will guide you

---

## 📝 Customization Tips

Each script has clear comments. You can customize:

1. **01_clean_data.py**: Add your own data cleaning rules
2. **02_parse_notes.py**: Add industry-specific keywords
3. **04_label_creation.py**: Define your conversion criteria
4. **05_train_model.py**: Adjust model hyperparameters

---

## 🆘 Need Help?

Check the comments in each script - they explain what each section does.

**Created**: December 24, 2025
