"""
Script 4: Label Creation
Create target labels for supervised learning
🎯 Label rule: converted = 1 if status == "Enrolled", else 0
"""

import pandas as pd
import numpy as np
from pathlib import Path

# Paths
INPUT_PATH = Path("../data/processed/leads_features.csv")
OUTPUT_PATH = Path("../data/processed/leads_labeled.csv")

def load_data():
    """Load feature-engineered data"""
    df = pd.read_csv(INPUT_PATH)
    print(f"✅ Loaded {len(df)} rows with {len(df.columns)} columns")
    return df

def create_conversion_label(df):
    """
    Create conversion label based on Enrolled status
    🎯 converted = 1 if status == "Enrolled", else 0
    """
    print("\n--- Creating Conversion Labels ---")
    
    if 'status_clean' not in df.columns and 'status' not in df.columns:
        print("❌ ERROR: No status column found!")
        return df
    
    # Use status_clean if available, otherwise use status
    status_col = 'status_clean' if 'status_clean' in df.columns else 'status'
    
    print(f"Using column: '{status_col}'")
    print(f"\nStatus distribution:")
    print(df[status_col].value_counts())
    
    # Create binary conversion label
    # converted = 1 if "Enrolled", else 0
    df['converted'] = (df[status_col].str.lower().str.strip() == 'enrolled').astype(int)
    
    # Statistics
    conversion_rate = df['converted'].mean()
    total_converted = df['converted'].sum()
    total_not_converted = (df['converted'] == 0).sum()
    
    print(f"\n✅ Conversion Labels Created:")
    print(f"   Converted (Enrolled): {total_converted:,} ({conversion_rate:.2%})")
    print(f"   Not Converted: {total_not_converted:,} ({(1-conversion_rate):.2%})")
    
    # ⚠️ Important: Keep original status as feature
    print(f"\n⚠️ Keeping original '{status_col}' column as feature")
    
    # Class balance check
    if conversion_rate < 0.05:
        print(f"\n⚠️ WARNING: Very low conversion rate ({conversion_rate:.2%})")
        print(f"   Consider class balancing techniques in model training")
    elif conversion_rate > 0.95:
        print(f"\n⚠️ WARNING: Very high conversion rate ({conversion_rate:.2%})")
        print(f"   Model may have limited learning signal")
    else:
        print(f"\n✅ Conversion rate looks reasonable ({conversion_rate:.2%})")
    
    return df

def create_lead_score_tiers(df):
    """Create categorical lead score tiers based on quality"""
    print("\n--- Creating Lead Score Tiers ---")
    
    # Use lead_quality_score if available
    if 'lead_quality_score' in df.columns:
        score_col = 'lead_quality_score'
    elif 'engagement_score' in df.columns:
        score_col = 'engagement_score'
    else:
        print("⚠️ No quality score found, skipping tier creation")
        return df
    
    # Create tiers (Hot, Warm, Cold)
    df['lead_tier'] = pd.cut(
        df[score_col],
        bins=[0, 33, 66, 100],
        labels=['Cold', 'Warm', 'Hot'],
        include_lowest=True
    )
    
    print(f"\n✅ Lead Tier Distribution (based on {score_col}):")
    tier_counts = df['lead_tier'].value_counts()
    for tier in ['Hot', 'Warm', 'Cold']:
        if tier in tier_counts.index:
            count = tier_counts[tier]
            pct = count / len(df) * 100
            print(f"   {tier:6s}: {count:5,} ({pct:5.1f}%)")
    
    # Cross-tabulation with conversion
    if 'converted' in df.columns:
        print(f"\n📊 Conversion Rate by Tier:")
        tier_conversion = df.groupby('lead_tier')['converted'].agg(['sum', 'count', 'mean'])
        tier_conversion.columns = ['Converted', 'Total', 'Rate']
        tier_conversion['Rate'] = tier_conversion['Rate'] * 100
        print(tier_conversion.round(1))
    
    return df

def validate_data(df):
    """Validate data before saving"""
    print("\n--- Data Validation ---")
    
    # Check for required columns
    required_cols = ['id', 'converted']
    missing_cols = [col for col in required_cols if col not in df.columns]
    
    if missing_cols:
        print(f"❌ Missing required columns: {missing_cols}")
        return False
    
    # Check for duplicates
    dup_count = df.duplicated(subset=['id']).sum()
    if dup_count > 0:
        print(f"⚠️ Found {dup_count} duplicate IDs")
        df = df.drop_duplicates(subset=['id'], keep='first')
        print(f"   Removed duplicates, kept first occurrence")
    
    # Check label distribution
    if 'converted' in df.columns:
        null_labels = df['converted'].isna().sum()
        if null_labels > 0:
            print(f"⚠️ Found {null_labels} null labels, filling with 0")
            df['converted'] = df['converted'].fillna(0)
    
    print(f"✅ Data validation passed")
    return df

def save_data(df):
    """Save labeled data"""
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\n✅ Saved labeled data to {OUTPUT_PATH}")
    print(f"   Shape: {df.shape[0]:,} rows × {df.shape[1]} columns")

if __name__ == "__main__":
    # Load data
    df = load_data()
    
    # Create labels
    df = create_conversion_label(df)
    df = create_lead_score_tiers(df)
    df = validate_data(df)
    
    # Save
    save_data(df)
    
    print("\n" + "="*60)
    print("✅ LABEL CREATION COMPLETE!")
    print("="*60)
    print("\n📋 Summary:")
    print(f"   ✓ Conversion labels created (based on 'Enrolled' status)")
    print(f"   ✓ Lead tiers created (Hot/Warm/Cold)")
    print(f"   ✓ Original status kept as feature")
    print(f"   ✓ All leads included (no filtering)")
    print(f"\n🎯 Data is now READY FOR SUPERVISED ML")
    print(f"   Next step: Train model (05_train_model.py)")
    save_data(df)
    
    print("\n✅ Label creation complete!")
    print("\n⚠️ IMPORTANT: Review conversion label logic and adjust based on your data!")
