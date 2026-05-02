"""
Script 1: Data Cleaning
Clean and prepare raw lead data for analysis
📌 This step makes data machine-readable
"""

import pandas as pd
import numpy as np
from pathlib import Path

# Paths
RAW_DATA_PATH = Path("../data/raw/leads.csv")
PROCESSED_DATA_PATH = Path("../data/processed/leads_clean.csv")

def load_data():
    """Load raw data from CSV"""
    df = pd.read_csv(RAW_DATA_PATH, low_memory=False)
    print(f"✅ Loaded {len(df)} rows with {len(df.columns)} columns")
    return df

def remove_duplicate_columns(df):
    """Remove duplicate columns (e.g., createdAt vs created_at)"""
    print("\n--- Removing Duplicate Columns ---")
    
    initial_cols = len(df.columns)
    
    # Keep the preferred version of duplicate columns
    duplicate_pairs = {
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
        'assignedTo': 'assigned_to',
        'followUp': 'next_follow_up',
        'assignedcounselor': 'assigned_to',
    }
    
    cols_to_drop = []
    for old_col, new_col in duplicate_pairs.items():
        if old_col in df.columns and new_col in df.columns:
            # Keep the one with more data, drop the other
            if df[new_col].notna().sum() >= df[old_col].notna().sum():
                cols_to_drop.append(old_col)
                print(f"Dropping '{old_col}' (keeping '{new_col}')")
            else:
                cols_to_drop.append(new_col)
                print(f"Dropping '{new_col}' (keeping '{old_col}')")
    
    df = df.drop(columns=cols_to_drop, errors='ignore')
    print(f"Removed {initial_cols - len(df.columns)} duplicate columns")
    
    return df

def fix_date_formats(df):
    """Convert date columns to proper datetime format"""
    print("\n--- Fixing Date Formats ---")
    
    date_columns = ['created_at', 'updated_at', 'last_contact_at', 'next_follow_up', 'nextfollowup']
    
    for col in date_columns:
        if col in df.columns:
            try:
                df[col] = pd.to_datetime(df[col], errors='coerce')
                print(f"✅ Converted '{col}' to datetime")
            except Exception as e:
                print(f"⚠️ Could not convert '{col}': {e}")
    
    return df

def standardize_status(df):
    """Standardize status values"""
    print("\n--- Standardizing Status Values ---")
    
    if 'status' in df.columns:
        print(f"\nOriginal status values:")
        print(df['status'].value_counts())
        
        # Clean and standardize
        df['status'] = df['status'].str.strip()
        
        # Create standardized status
        status_mapping = {
            'enrolled': 'Enrolled',
            'enroll': 'Enrolled',
            'follow up': 'Follow Up',
            'followup': 'Follow Up',
            'not interested': 'Not Interested',
            'callback': 'Callback',
            'call back': 'Callback',
            'no response': 'No Response',
            'wrong number': 'Wrong Number',
            'duplicate': 'Duplicate',
        }
        
        df['status_clean'] = df['status'].str.lower().replace(status_mapping)
        df['status_clean'] = df['status_clean'].fillna(df['status'])
        
        print(f"\nStandardized status values:")
        print(df['status_clean'].value_counts())
    
    return df

def keep_required_fields(df):
    """Keep only required fields for ML"""
    print("\n--- Selecting Required Fields ---")
    
    # Define required fields
    required_fields = [
        'id',
        'fullName',
        'email',
        'phone',
        'country',
        'branch',
        'qualification',
        'source',
        'course',
        'status',
        'status_clean',
        'priority',
        'notes',
        'created_at',
        'updated_at',
        'last_contact_at',
        'experience',
        'location',
        'score',
        'communicationscount',
        'assigned_to',
        'next_follow_up',
        'lead_score',
        'churn_risk'
    ]
    
    # Keep only fields that exist in the dataframe
    available_fields = [col for col in required_fields if col in df.columns]
    df_clean = df[available_fields].copy()
    
    print(f"Kept {len(available_fields)} required fields:")
    print(available_fields)
    
    return df_clean

def clean_data(df):
    """Main cleaning pipeline"""
    print("\n--- Data Cleaning Pipeline ---")
    
    # Remove duplicates
    initial_rows = len(df)
    df = df.drop_duplicates(subset=['id'], keep='first')
    print(f"Removed {initial_rows - len(df)} duplicate rows")
    
    # Remove duplicate columns
    df = remove_duplicate_columns(df)
    
    # Fix date formats
    df = fix_date_formats(df)
    
    # Standardize status
    df = standardize_status(df)
    
    # Keep required fields
    df = keep_required_fields(df)
    
    print(f"\n✅ Final cleaned data shape: {df.shape}")
    print(f"   Rows: {df.shape[0]:,}")
    print(f"   Columns: {df.shape[1]}")
    
    return df

def save_cleaned_data(df):
    """Save cleaned data"""
    PROCESSED_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(PROCESSED_DATA_PATH, index=False)
    print(f"\nSaved cleaned data to {PROCESSED_DATA_PATH}")

if __name__ == "__main__":
    # Load raw data
    df = load_data()
    
    # Clean data
    df_clean = clean_data(df)
    
    # Save
    save_cleaned_data(df_clean)
    
    print("\n✅ Data cleaning complete!")
