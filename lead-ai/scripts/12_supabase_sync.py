"""
Script 12: (OPTIONAL) Sync Scored Leads to Supabase
Push AI scores back to your Supabase database
Updates: ai_score, ai_segment, next_action columns
"""

import pandas as pd
import os
from pathlib import Path

# NOTE: This is a template script. You'll need to:
# 1. Install supabase client: pip install supabase
# 2. Set your Supabase credentials as environment variables
# 3. Uncomment the code below and configure

# Paths
SCORED_LEADS_PATH = Path("../outputs/leads_scored.csv")

def load_scored_leads():
    """Load scored leads from CSV"""
    if not SCORED_LEADS_PATH.exists():
        raise FileNotFoundError(
            f"Scored leads not found at {SCORED_LEADS_PATH}\n"
            f"Run 06_score_leads.py first!"
        )
    
    df = pd.read_csv(SCORED_LEADS_PATH)
    print(f"✅ Loaded {len(df):,} scored leads")
    return df

def setup_supabase_client():
    """
    Set up Supabase client
    
    Requirements:
    1. Install: pip install supabase
    2. Set environment variables:
       export SUPABASE_URL="https://your-project.supabase.co"
       export SUPABASE_KEY="your-service-role-key"
    """
    
    # Uncomment and use this code:
    """
    from supabase import create_client, Client
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    
    if not url or not key:
        raise ValueError(
            "Supabase credentials not found!\n"
            "Set SUPABASE_URL and SUPABASE_KEY environment variables"
        )
    
    supabase: Client = create_client(url, key)
    print("✅ Connected to Supabase")
    
    return supabase
    """
    
    print("⚠️ Supabase sync not configured yet!")
    print("\nTo enable:")
    print("1. Install: pip install supabase")
    print("2. Set environment variables:")
    print("   export SUPABASE_URL='https://your-project.supabase.co'")
    print("   export SUPABASE_KEY='your-service-role-key'")
    print("3. Uncomment code in this file")
    return None

def update_leads_in_supabase(supabase, df, table_name="leads"):
    """
    Update leads in Supabase with AI scores
    
    This will add/update columns:
    - ai_score (decimal)
    - ai_segment (text: Hot/Warm/Cold/Junk)
    - next_action (text: Call in 15 min / etc.)
    """
    
    if supabase is None:
        print("❌ Supabase not configured. See setup instructions above.")
        return
    
    # Uncomment to use:
    """
    print(f"\n🔄 Updating {len(df)} leads in Supabase...")
    
    batch_size = 100
    updated_count = 0
    
    for i in range(0, len(df), batch_size):
        batch = df.iloc[i:i+batch_size]
        
        for idx, row in batch.iterrows():
            try:
                # Update lead by ID
                result = supabase.table(table_name).update({
                    'ai_score': float(row['ai_score']),
                    'ai_segment': str(row['ai_segment']),
                    'next_action': str(row['next_action']),
                    'conversion_probability': float(row['conversion_probability']),
                    'action_priority': int(row['action_priority'])
                }).eq('id', row['id']).execute()
                
                updated_count += 1
                
                if updated_count % 100 == 0:
                    print(f"   Updated {updated_count:,} / {len(df):,} leads...")
                    
            except Exception as e:
                print(f"⚠️ Error updating lead {row['id']}: {e}")
    
    print(f"\n✅ Updated {updated_count:,} leads in Supabase!")
    """
    
    print("\n📝 Manual Alternative:")
    print("1. Download outputs/leads_scored.csv")
    print("2. Open Supabase dashboard")
    print("3. Go to Table Editor → leads")
    print("4. Import CSV (will update matching IDs)")
    print("5. Map columns: ai_score, ai_segment, next_action")

def verify_sync(supabase, sample_ids, table_name="leads"):
    """Verify that updates were successful"""
    
    if supabase is None:
        return
    
    # Uncomment to use:
    """
    print(f"\n🔍 Verifying sync (sample {len(sample_ids)} leads)...")
    
    for lead_id in sample_ids[:5]:
        result = supabase.table(table_name).select(
            "id, ai_score, ai_segment, next_action"
        ).eq('id', lead_id).execute()
        
        if result.data:
            lead = result.data[0]
            print(f"   {lead['id']}: Score={lead.get('ai_score')}, Segment={lead.get('ai_segment')}")
    
    print("✅ Sync verification complete!")
    """
    pass

if __name__ == "__main__":
    print("="*60)
    print("🔌 SUPABASE SYNC (OPTIONAL)")
    print("="*60)
    
    # Load scored leads
    df = load_scored_leads()
    
    # Setup Supabase (requires configuration)
    supabase = setup_supabase_client()
    
    if supabase:
        # Update leads
        update_leads_in_supabase(supabase, df)
        
        # Verify
        sample_ids = df['id'].head(10).tolist()
        verify_sync(supabase, sample_ids)
    else:
        print("\n" + "="*60)
        print("⚠️ SUPABASE SYNC NOT CONFIGURED")
        print("="*60)
        print("\nYour scored leads are saved in:")
        print(f"   {SCORED_LEADS_PATH}")
        print("\nYou can:")
        print("   1. Configure this script (see instructions above)")
        print("   2. Manually upload CSV to Supabase dashboard")
        print("   3. Use Supabase API directly")
        print("\n💡 The CSV is ready to use even without syncing!")
