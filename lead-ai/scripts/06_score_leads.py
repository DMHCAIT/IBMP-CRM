"""
Script 6: Score Leads & Apply Business Action Layer
Score all 19K+ leads and assign business actions
"""

import pandas as pd
import numpy as np
from pathlib import Path
from catboost import CatBoostClassifier, Pool
import joblib

# Paths
DATA_PATH = Path("../data/processed/leads_labeled.csv")
MODEL_PATH = Path("../models/lead_conversion_model.cbm")
MODEL_PKL_PATH = Path("../models/lead_conversion_model.pkl")
OUTPUT_PATH = Path("../outputs/leads_scored.csv")
HOT_LEADS_PATH = Path("../outputs/hot_leads.csv")
TOP_LEADS_PATH = Path("../outputs/top_leads.csv")
ACTION_PLAN_PATH = Path("../outputs/action_plan.csv")

def load_model():
    """Load trained model"""
    if MODEL_PATH.exists():
        model = CatBoostClassifier()
        model.load_model(MODEL_PATH)
        print(f"✅ Loaded CatBoost model")
    elif MODEL_PKL_PATH.exists():
        model = joblib.load(MODEL_PKL_PATH)
        print(f"✅ Loaded pickle model")
    else:
        raise FileNotFoundError("Model not found! Run 05_train_model.py first")
    return model

def score_leads(df, model):
    """Score all leads"""
    print("\n--- Scoring Leads ---")
    
    # Prepare features (same as training)
    exclude_cols = ['converted', 'lead_tier', 'id', 'fullName', 'email', 'phone', 'notes']
    exclude_cols += [col for col in df.columns if 'date' in col.lower() or col.endswith('_at')]
    feature_cols = [col for col in df.columns if col not in exclude_cols and col in df.columns]
    
    X = df[feature_cols].copy()
    
    # Identify categorical features (SAME logic as training: object dtype OR int with <50 unique values)
    categorical_features = []
    for col in X.columns:
        if X[col].dtype == 'object':
            X[col] = X[col].fillna('Unknown')
            categorical_features.append(col)
        elif X[col].dtype in ['int64', 'int32'] and X[col].nunique() < 50:
            # This is the key fix - integer columns with <50 unique values were marked as categorical in training
            categorical_features.append(col)
            X[col] = X[col].fillna(X[col].median())
        else:
            X[col] = X[col].fillna(X[col].median())
    
    # Create Pool for CatBoost prediction (handles categorical automatically)
    pool = Pool(X, cat_features=categorical_features)
    
    # Predict
    df['conversion_probability'] = model.predict_proba(pool)[:, 1]
    df['ai_score'] = (df['conversion_probability'] * 100).round(1)
    
    print(f"✅ Scored {len(df):,} leads")
    print(f"   Average score: {df['ai_score'].mean():.1f}")
    print(f"   Score range: {df['ai_score'].min():.1f} - {df['ai_score'].max():.1f}")
    
    return df

def apply_business_action_layer(df):
    """Apply score-to-action mapping"""
    print("\n--- Applying Business Action Layer ---")
    
    def assign_segment(score):
        if score > 80:
            return 'Hot', 'Call in 15 min'
        elif score >= 50:
            return 'Warm', 'Schedule follow-up'
        elif score >= 20:
            return 'Cold', 'WhatsApp drip'
        else:
            return 'Junk', 'Stop calling'
    
    df[['ai_segment', 'next_action']] = df['ai_score'].apply(
        lambda x: pd.Series(assign_segment(x))
    )
    
    # Distribution
    print(f"\n📊 Segment Distribution:")
    for segment in ['Hot', 'Warm', 'Cold', 'Junk']:
        count = (df['ai_segment'] == segment).sum()
        pct = count / len(df) * 100
        print(f"   {segment:8s}: {count:5,} ({pct:5.1f}%)")
    
    hot_count = (df['ai_segment'] == 'Hot').sum()
    warm_count = (df['ai_segment'] == 'Warm').sum()
    print(f"\n🎯 HIGH-VALUE LEADS: {hot_count + warm_count:,}")
    print(f"   Hot (immediate action): {hot_count:,}")
    print(f"   Warm (schedule): {warm_count:,}")
    
    return df

def create_action_plan(df):
    """Create action plan summary"""
    action_plan = df.groupby('ai_segment').agg({
        'id': 'count',
        'ai_score': ['mean', 'min', 'max']
    }).round(1)
    
    action_plan.columns = ['lead_count', 'avg_score', 'min_score', 'max_score']
    action_plan = action_plan.reset_index()
    action_plan = action_plan.sort_values('avg_score', ascending=False)
    
    return action_plan

def save_results(df, action_plan):
    """Save all outputs"""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # All leads
    output_cols = ['id', 'fullName', 'email', 'phone', 'status_clean', 
                   'ai_score', 'conversion_probability', 'ai_segment', 'next_action']
    output_cols = [col for col in output_cols if col in df.columns]
    df[output_cols].to_csv(OUTPUT_PATH, index=False)
    print(f"\n✅ Saved all leads: {OUTPUT_PATH}")
    
    # Hot leads
    hot_leads = df[df['ai_segment'] == 'Hot'].sort_values('ai_score', ascending=False)
    hot_leads[output_cols].to_csv(HOT_LEADS_PATH, index=False)
    print(f"✅ Saved {len(hot_leads):,} hot leads: {HOT_LEADS_PATH}")
    
    # Top 100
    df.sort_values('ai_score', ascending=False).head(100)[output_cols].to_csv(TOP_LEADS_PATH, index=False)
    print(f"✅ Saved top 100 leads: {TOP_LEADS_PATH}")
    
    # Action plan
    action_plan.to_csv(ACTION_PLAN_PATH, index=False)
    print(f"✅ Saved action plan: {ACTION_PLAN_PATH}")

if __name__ == "__main__":
    print("="*60)
    print("🎯 LEAD SCORING & BUSINESS ACTION LAYER")
    print("="*60)
    
    # Load data
    df = pd.read_csv(DATA_PATH)
    print(f"✅ Loaded {len(df):,} leads")
    
    # Load model
    model = load_model()
    
    # Score leads
    df = score_leads(df, model)
    
    # Apply business logic
    df = apply_business_action_layer(df)
    
    # Create action plan
    action_plan = create_action_plan(df)
    
    # Save results
    save_results(df, action_plan)
    
    print("\n" + "="*60)
    print("✅ LEAD SCORING COMPLETE!")
    print("="*60)
    print(f"\n🎯 Next: Call the {(df['ai_segment']=='Hot').sum():,} HOT leads!")
    print(f"📁 Check: {HOT_LEADS_PATH}")
