#!/bin/bash
# Run Complete ML Pipeline
# This script runs all 6 steps in sequence

echo "🚀 Starting Advanced AI Lead System Pipeline"
echo "=============================================="
echo ""

# Check if virtual environment is activated
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "⚠️  Virtual environment not activated!"
    echo "Run: source venv/bin/activate"
    exit 1
fi

echo "✅ Virtual environment active"
echo ""

# Navigate to scripts directory
cd scripts

# Step 1: Clean Data
echo "📊 Step 1/6: Cleaning data..."
python 01_clean_data.py
if [ $? -ne 0 ]; then
    echo "❌ Step 1 failed. Fix errors and try again."
    exit 1
fi
echo ""

# Step 2: Parse Notes
echo "📝 Step 2/6: Parsing notes..."
python 02_parse_notes.py
if [ $? -ne 0 ]; then
    echo "❌ Step 2 failed. Fix errors and try again."
    exit 1
fi
echo ""

# Step 3: Feature Engineering
echo "🔧 Step 3/6: Engineering features..."
python 03_feature_engineering.py
if [ $? -ne 0 ]; then
    echo "❌ Step 3 failed. Fix errors and try again."
    exit 1
fi
echo ""

# Step 4: Label Creation
echo "🏷️  Step 4/6: Creating labels..."
python 04_label_creation.py
if [ $? -ne 0 ]; then
    echo "❌ Step 4 failed. Fix errors and try again."
    exit 1
fi
echo ""

# Step 5: Train Model
echo "🤖 Step 5/6: Training model..."
python 05_train_model.py
if [ $? -ne 0 ]; then
    echo "❌ Step 5 failed. Fix errors and try again."
    exit 1
fi
echo ""

# Step 6: Score Leads
echo "⭐ Step 6/6: Scoring leads..."
python 06_score_leads.py
if [ $? -ne 0 ]; then
    echo "❌ Step 6 failed. Fix errors and try again."
    exit 1
fi
echo ""

# Complete
echo "=============================================="
echo "✅ PIPELINE COMPLETE!"
echo "=============================================="
echo ""
echo "📂 Check your results:"
echo "   - Scored Leads: ../outputs/scored_leads.csv"
echo "   - Top 50 Leads: ../outputs/top_leads.csv"
echo "   - Trained Model: ../models/lead_scoring_model.pkl"
echo "   - Visualizations: ../outputs/*.png"
echo ""
echo "🎯 Next: Review your scored leads and take action!"
