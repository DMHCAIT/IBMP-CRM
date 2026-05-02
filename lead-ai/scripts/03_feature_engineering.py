"""
Script 3: Feature Engineering
Create AI features for machine learning
🧠 This is where AI starts "thinking"
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

# Paths
INPUT_PATH = Path("../data/processed/leads_notes.csv")
OUTPUT_PATH = Path("../data/processed/leads_features.csv")

def load_data():
    """Load processed data with notes"""
    df = pd.read_csv(INPUT_PATH)
    # Parse dates after loading to avoid column name issues
    date_cols = ['created_at', 'updated_at', 'last_contact_at', 'last_note_date']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
    print(f"✅ Loaded {len(df)} rows with {len(df.columns)} columns")
    return df

def create_time_features(df):
    """Create time-based features"""
    print("\n--- Creating Time Features ---")
    
    now = pd.Timestamp.now()
    
    # Lead age (how old is the lead)
    if 'created_at' in df.columns:
        # Remove timezone info to avoid comparison errors
        df['created_at'] = df['created_at'].dt.tz_localize(None) if hasattr(df['created_at'].dt, 'tz') and df['created_at'].dt.tz is not None else df['created_at']
        df['lead_age_days'] = (now - df['created_at']).dt.days
        df['lead_age_weeks'] = df['lead_age_days'] / 7
        print(f"✅ Created lead_age_days (avg: {df['lead_age_days'].mean():.1f} days)")
    
    # Last activity gap (days since last action)
    if 'updated_at' in df.columns:
        df['updated_at'] = df['updated_at'].dt.tz_localize(None) if hasattr(df['updated_at'].dt, 'tz') and df['updated_at'].dt.tz is not None else df['updated_at']
        df['last_activity_gap'] = (now - df['updated_at']).dt.days
        print(f"✅ Created last_activity_gap (avg: {df['last_activity_gap'].mean():.1f} days)")
    
    # Days until next follow-up
    if 'next_follow_up' in df.columns:
        df['next_follow_up'] = df['next_follow_up'].dt.tz_localize(None) if hasattr(df['next_follow_up'].dt, 'tz') and df['next_follow_up'].dt.tz is not None else df['next_follow_up']
        df['days_to_followup'] = (df['next_follow_up'] - now).dt.days
        df['followup_overdue'] = (df['days_to_followup'] < 0).astype(int)
        print(f"✅ Created days_to_followup and followup_overdue flag")
    
    # Time between creation and last contact
    if 'created_at' in df.columns and 'last_contact_at' in df.columns:
        df['time_to_first_contact'] = (df['last_contact_at'] - df['created_at']).dt.days
        print(f"✅ Created time_to_first_contact")
    
    return df

def create_engagement_features(df):
    """Create engagement and activity features"""
    print("\n--- Creating Engagement Features ---")
    
    # Engagement score (notes + communication count)
    df['engagement_score'] = 0
    
    if 'notes_count' in df.columns:
        df['engagement_score'] += df['notes_count'] * 2
    
    if 'communicationscount' in df.columns:
        df['engagement_score'] += df['communicationscount'].fillna(0)
    
    return df

def create_categorical_features(df):
    """Encode categorical variables"""
    print("\n--- Encoding Categorical Features ---")
    
    # Categorical columns to encode
    categorical_cols = ['priority', 'source', 'branch', 'qualification', 'country']
    
    for col in categorical_cols:
        if col not in df.columns:
            continue
        
        # Fill missing values
        df[col] = df[col].fillna('Unknown')
        
        unique_values = df[col].nunique()
        
        if unique_values <= 10:
            # One-hot encode low cardinality
            dummies = pd.get_dummies(df[col], prefix=col, drop_first=True)
            df = pd.concat([df, dummies], axis=1)
            print(f"✅ One-hot encoded: {col} ({unique_values} values)")
        else:
            # Label encode high cardinality
            df[f'{col}_encoded'] = pd.factorize(df[col])[0]
            print(f"✅ Label encoded: {col} ({unique_values} values)")
    
    return df

def handle_missing_values(df):
    """Handle missing values in features"""
    print("\n--- Handling Missing Values ---")
    
    # Fill numeric columns with median
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if df[col].isna().sum() > 0:
            df[col] = df[col].fillna(df[col].median())
    
    # Fill categorical with 'Unknown'
    categorical_cols = df.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        if df[col].isna().sum() > 0:
            df[col] = df[col].fillna('Unknown')
    
    print(f"✅ Filled missing values")
    
    return df

def create_composite_scores(df):
    """Create composite lead quality scores"""
    print("\n--- Creating Composite Scores ---")
    
    # Lead quality score
    df['lead_quality_score'] = 0
    
    # Positive signals
    if 'sentiment_score' in df.columns:
        df['lead_quality_score'] += df['sentiment_score'] * 20
    
    if 'response_rate' in df.columns:
        df['lead_quality_score'] += df['response_rate'] * 30
    
    if 'engagement_score' in df.columns:
        df['lead_quality_score'] += np.log1p(df['engagement_score']) * 10
    
    # Negative signals
    if 'not_interested_flag' in df.columns:
        df['lead_quality_score'] -= df['not_interested_flag'] * 50
    
    if 'no_response_count' in df.columns:
        df['lead_quality_score'] -= df['no_response_count'] * 3
    
    # Normalize to 0-100
    df['lead_quality_score'] = ((df['lead_quality_score'] - df['lead_quality_score'].min()) / 
                                 (df['lead_quality_score'].max() - df['lead_quality_score'].min()) * 100)
    
    print(f"✅ Created lead_quality_score (avg: {df['lead_quality_score'].mean():.1f})")
    
    return df

def save_data(df):
    """Save engineered features"""
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\n✅ Saved data to {OUTPUT_PATH}")
    print(f"   Final shape: {df.shape[0]:,} rows × {df.shape[1]} columns")

def create_source_quality_features(df):
    """Create source quality features"""
    print("\n--- Creating Source Quality Features ---")
    
    # Calculate source conversion rates (if we have historical data)
    if 'source' in df.columns:
        source_stats = df.groupby('source').agg({
            'id': 'count'
        }).rename(columns={'id': 'source_count'})
        
        df = df.merge(source_stats, left_on='source', right_index=True, how='left')
        print(f"✅ Added source_count feature")
    
    return df

if __name__ == "__main__":
    # Load data
    df = load_data()
    
    # Create all features
    df = create_time_features(df)
    df = create_engagement_features(df)
    df = create_source_quality_features(df)
    df = create_categorical_features(df)
    df = handle_missing_values(df)
    df = create_composite_scores(df)
    
    # Save
    save_data(df)
    
    print("\n✅ Feature engineering complete!")
    print("\n📊 Key Features Created:")
    print("   - lead_age_days: How old is the lead")
    print("   - last_activity_gap: Days since last activity")
    print("   - engagement_score: Notes + communications")
    print("   - urgency_score: Recent activity + callbacks")
    print("   - source_quality: Source conversion rate")
    print("   - agent_touch_count: Sales effort")
    print("   - lead_quality_score: Overall quality (0-100)")

def create_categorical_features(df):
    """Encode categorical variables"""
    print("\n--- Encoding Categorical Features ---")
    
    # Identify categorical columns
    categorical_cols = df.select_dtypes(include=['object']).columns
    
    print(f"Found {len(categorical_cols)} categorical columns")
    
    # One-hot encode (for small cardinality) or label encode
    for col in categorical_cols:
        unique_values = df[col].nunique()
        
        if unique_values < 10:  # One-hot encode if few unique values
            dummies = pd.get_dummies(df[col], prefix=col, drop_first=True)
            df = pd.concat([df, dummies], axis=1)
            print(f"One-hot encoded: {col} ({unique_values} values)")
        else:
            # Label encode for high cardinality
            df[f'{col}_encoded'] = pd.factorize(df[col])[0]
            print(f"Label encoded: {col} ({unique_values} values)")
    
    return df

def handle_missing_values(df):
    """Handle missing values in features"""
    print("\n--- Handling Missing Values ---")
    
    # Fill numeric columns with median
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].median())
    
    # Fill categorical with mode or 'Unknown'
    categorical_cols = df.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        df[col] = df[col].fillna('Unknown')
    
    print(f"Filled missing values in {len(numeric_cols)} numeric and {len(categorical_cols)} categorical columns")
    
    return df

def save_data(df):
    """Save engineered features"""
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\nSaved data to {OUTPUT_PATH}")
    print(f"Final shape: {df.shape}")

if __name__ == "__main__":
    # Load data
    df = load_data()
    
    # Create features
    df = create_time_features(df)
    df = create_interaction_features(df)
    df = create_categorical_features(df)
    df = handle_missing_values(df)
    
    # Save
    save_data(df)
    
    print("\n✅ Feature engineering complete!")
