"""
Script 6: Score All Leads
Score all 19K leads using trained CatBoost model
Includes business action layer for ROI
"""

import pandas as pd
import numpy as np
from pathlib import Path
from catboost import CatBoostClassifier
import joblib
from datetime import datetime

# Paths
MODEL_PATH = Path("../models/lead_conversion_model.cbm")
def load_model():
    """Load trained CatBoost model"""
    print("🔍 Loading trained model...")
    
    # Try CatBoost format first
    if MODEL_PATH.exists():
        model = CatBoostClassifier()
        model.load_model(MODEL_PATH)
        print(f"✅ Loaded model from {MODEL_PATH}")
    elif MODEL_PKL_PATH.exists():
        model = joblib.load(MODEL_PKL_PATH)
        print(f"✅ Loaded model from {MODEL_PKL_PATH}")
    else:
        raise FileNotFoundError(
            f"Model not found! Train model first with 05_train_model.py"
        )
    
    return model

def prepare_features_for_scoring(df):
    """Prepare features matching training data structure"""
    print("\n🔧 Preparing features for scoring...")
    
    # Exclude non-feature columns (same as training)
    exclude_cols = [
        'converted', 
        'lead_tier',
        'id',
        'fullName',
        'email',
        'phone',
        'notes'
    ]
    
    # Exclude date columns
    exclude_cols += [col for col in df.columns if 'date' in col.lower() and df[col].dtype == 'object']
    exclude_cols += [col for col in df.columns if col.endswith('_at') and df[col].dtype == 'object']
    
    feature_cols = [col for col in df.columns if col not in exclude_cols]
    X = df[feature_cols].copy().fillna(0)
    
    print(f"✅ Prepared {len(feature_cols)} features for scoring")
    
    return X, df

def score_leads(model, X, df):
    """
    Score all leads using trained model
    Returns conversion probability for each lead
    """
    print("\n" + "="*60)
    print("🎯 SCORING ALL LEADS")
    print("="*60)
    
    print(f"\n📊 Scoring {len(df):,} leads...")
    
    # Get predictions
def create_action_plan(df):
    """Create detailed action plan for sales team"""
    print("\n📋 Creating Action Plan...")
    
    # Group by segment and priority
    action_plan = df.groupby(['ai_segment', 'next_action']).agg({
        'id': 'count',
        'ai_score': ['mean', 'min', 'max'],
        'conversion_probability': 'mean'
    }).round(2)
    
    action_plan.columns = ['lead_count', 'avg_score', 'min_score', 'max_score', 'avg_conv_prob']
    action_plan = action_plan.reset_index()
    action_plan = action_plan.sort_values('avg_score', ascending=False)
    
    # Save action plan
    action_plan.to_csv(ACTION_PLAN_PATH, index=False)
    print(f"✅ Saved action plan to {ACTION_PLAN_PATH}")
    
    return action_plan

def save_results(df):
    """Save scored leads and outputs"""
    print("\n" + "="*60)
    print("💾 SAVING RESULTS")
    print("="*60)
    
    # Prepare output columns
    output_cols = [
        'id', 'fullName', 'email', 'phone',
        'status', 'status_clean',
        'ai_score',
        'conversion_probability',
        'ai_segment',
        'next_action',
        'action_priority',
        'predicted_conversion'
    ]
if __name__ == "__main__":
    print("="*60)
    print("🚀 ADVANCED AI LEAD SYSTEM - LEAD SCORING")
    print("="*60)
    
    # Load model
    model = load_model()
    
    # Load data
    df = load_data()
    
    # Prepare features
    X, df = prepare_features_for_scoring(df)
    
    # Score all leads
    df = score_leads(model, X, df)
    
    # Apply business action layer (STEP 11)
    df = apply_business_action_layer(df)
    
    # Create action plan
    action_plan = create_action_plan(df)
    
    # Save results
    save_results(df)
    
    print("\n" + "="*60)
    print("✅ LEAD SCORING COMPLETE!")
    print("="*60)
    
    print(f"\n📁 Output Files:")
    print(f"   1. {OUTPUT_PATH}")
    print(f"      → All {len(df):,} leads scored")
    print(f"   2. {OUTPUT_PATH.parent / 'hot_leads.csv'}")
    print(f"      → Hot leads (score >80) for immediate action")
    print(f"   3. {TOP_LEADS_PATH}")
    print(f"      → Top 100 highest-scoring leads")
    print(f"   4. {ACTION_PLAN_PATH}")
    print(f"      → Detailed action plan by segment")
    
    print(f"\n🎯 Next Steps:")
    print(f"   1. Review hot_leads.csv → Call these leads in 15 min!")
    print(f"   2. Check action_plan.csv → Prioritize your team's time")
    print(f"   3. Use leads_scored.csv → Filter by segment for campaigns")
    
    print(f"\n💡 Optional (STEP 12):")
    print(f"   Push leads_scored.csv back to Supabase:")
    print(f"   - Update ai_score column")
    print(f"   - Update ai_segment column")
    print(f"   - Update next_action column")
    
    print(f"\n🎉 Your AI lead scoring system is now operational!")
    print(f"✅ Saved {len(hot_leads):,} HOT leads to:")
    print(f"   {hot_leads_path}")
    
    # Save top 100 leads
    df_output.head(100).to_csv(TOP_LEADS_PATH, index=False)
    print(f"✅ Saved top 100 leads to:")
    print(f"   {TOP_LEADS_PATH}")
    
    # Create sample output for verification
    print(f"\n📄 Sample Output (Top 3 Leads):")
    print("-" * 60)
    for idx, row in df_output.head(3).iterrows():
        print(f"Lead ID: {row.get('id', 'N/A')}")
        print(f"  AI Score: {row['ai_score']:.1f}")
        print(f"  Conversion Probability: {row['conversion_probability']:.2f}")
        print(f"  Segment: {row['ai_segment']}")
        print(f"  Next Action: {row['next_action']}")
        print("-" * 60)
            return 'Cold', 'WhatsApp drip'
        else:
            return 'Junk', 'Stop calling'
    
    # Apply segmentation
    df[['ai_segment', 'next_action']] = df['ai_score'].apply(
        lambda x: pd.Series(assign_segment_and_action(x))
    )
    
    # Generate action priority
    segment_priority = {'Hot': 1, 'Warm': 2, 'Cold': 3, 'Junk': 4}
    df['action_priority'] = df['ai_segment'].map(segment_priority)
    
    # Statistics
    print(f"\n📊 Segment Distribution:")
    segment_counts = df['ai_segment'].value_counts()
    for segment in ['Hot', 'Warm', 'Cold', 'Junk']:
        if segment in segment_counts.index:
            count = segment_counts[segment]
            pct = count / len(df) * 100
            print(f"   {segment:6s}: {count:6,} ({pct:5.1f}%)")
    
    print(f"\n🎯 Action Plan:")
    action_counts = df['next_action'].value_counts()
    for action, count in action_counts.items():
        pct = count / len(df) * 100
        print(f"   {action:25s}: {count:6,} ({pct:5.1f}%)")
    
    # Calculate potential ROI
    hot_leads = (df['ai_segment'] == 'Hot').sum()
    warm_leads = (df['ai_segment'] == 'Warm').sum()
    
    print(f"\n💰 Potential Impact:")
    print(f"   Immediate action (Hot): {hot_leads:,} leads")
    print(f"   Schedule follow-up (Warm): {warm_leads:,} leads")
    print(f"   Total high-value leads: {hot_leads + warm_leads:,}")
    
    return df

def score_leads(df, model, feature_cols):
    """Score leads using model"""
    print("\n--- Scoring Leads ---")
    
    # Get predictions
    df['conversion_probability'] = model.predict_proba(X)[:, 1]
    df['predicted_conversion'] = model.predict(X)
    
    # Create lead score (0-100)
    df['lead_score'] = (df['conversion_probability'] * 100).round(1)
    
    # Create priority tier
    df['priority'] = pd.cut(
        df['lead_score'],
        bins=[0, 30, 60, 100],
        labels=['Low', 'Medium', 'High']
    )
    
    return df

def generate_insights(df):
    """Generate insights and recommendations"""
    print("\n--- Lead Insights ---")
    
    print(f"\nLead Score Distribution:")
    print(df['lead_score'].describe())
    
    print(f"\nPriority Distribution:")
    print(df['priority'].value_counts())
    
    # Top leads
    top_leads = df.nlargest(10, 'lead_score')[['lead_score', 'priority', 'conversion_probability']]
    print(f"\nTop 10 Leads:")
    print(top_leads)
    
    # Summary stats by priority
    print(f"\nAverage Score by Priority:")
    print(df.groupby('priority')['lead_score'].mean())
    
    return df

def save_results(df):
    """Save scored leads"""
    # Select relevant columns for output
    output_cols = [col for col in df.columns if col not in ['converted']]
    df_output = df[output_cols]
    
    # Sort by lead score
    df_output = df_output.sort_values('lead_score', ascending=False)
    
    df_output.to_csv(OUTPUT_PATH, index=False)
    print(f"\n✅ Saved scored leads to {OUTPUT_PATH}")
    
    # Also save top leads
    top_leads_path = OUTPUT_PATH.parent / 'top_leads.csv'
    df_output.head(50).to_csv(top_leads_path, index=False)
    print(f"✅ Saved top 50 leads to {top_leads_path}")

if __name__ == "__main__":
    # Load model
    model = load_model()
    
    # Load data
    df = load_data()
    
    # Prepare features
    X, df = prepare_features_for_scoring(df)
    
    # Score leads
    df = score_leads(model, X, df)
    
    # Generate insights
    df = generate_insights(df)
    
    # Save results
    save_results(df)
    
    print("\n✅ Lead scoring complete!")
    print(f"\n📊 Next steps:")
    print(f"1. Review scored leads in {OUTPUT_PATH}")
    print(f"2. Prioritize High priority leads for immediate action")
    print(f"3. Set up nurture campaigns for Medium priority leads")
