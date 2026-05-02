#!/usr/bin/env python3
"""
Migrate data from SQLite to Supabase PostgreSQL
"""
import sqlite3
import os
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime
import json

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# SQLite database path
SQLITE_DB = "./crm_database.db"

def init_supabase() -> Client:
    """Initialize Supabase client"""
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def get_sqlite_data():
    """Fetch all leads from SQLite and map to Supabase schema"""
    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM leads")
    rows = cursor.fetchall()
    
    # Exact Supabase columns from supabase_migration.sql
    supabase_columns = {
        'lead_id', 'full_name', 'email', 'phone', 'whatsapp', 'country',
        'source', 'course_interested', 'status', 'assigned_to',
        'ai_score', 'ai_segment', 'conversion_probability',
        'expected_revenue', 'actual_revenue', 'follow_up_date',
        'enrollment_deadline', 'feature_importance',
        'created_at', 'updated_at'
    }
    
    leads = []
    for row in rows:
        lead = dict(row)
        
        # Map and filter to Supabase columns only
        filtered_lead = {}
        for col in supabase_columns:
            if col in lead:
                filtered_lead[col] = lead[col]
        
        # Convert datetime strings to ISO format
        for date_field in ['created_at', 'updated_at', 'follow_up_date', 'enrollment_deadline']:
            if filtered_lead.get(date_field):
                try:
                    if isinstance(filtered_lead[date_field], str):
                        dt = datetime.fromisoformat(filtered_lead[date_field].replace('Z', '+00:00'))
                        filtered_lead[date_field] = dt.isoformat()
                except:
                    filtered_lead[date_field] = None
        
        # Handle JSON fields
        if filtered_lead.get('feature_importance'):
            if isinstance(filtered_lead['feature_importance'], str):
                try:
                    filtered_lead['feature_importance'] = json.loads(filtered_lead['feature_importance'])
                except:
                    filtered_lead['feature_importance'] = None
        
        leads.append(filtered_lead)
    
    conn.close()
    return leads

def migrate_to_supabase(batch_size=100):
    """Migrate data to Supabase in batches"""
    print("🚀 Starting migration from SQLite to Supabase...")
    
    # Initialize Supabase client
    supabase = init_supabase()
    print(f"✅ Connected to Supabase: {SUPABASE_URL}")
    
    # Get data from SQLite
    print(f"📁 Reading data from SQLite: {SQLITE_DB}")
    leads = get_sqlite_data()
    total_leads = len(leads)
    print(f"✅ Found {total_leads} leads in SQLite")
    
    # Clear existing data in Supabase (optional - comment out if you want to append)
    try:
        print("🗑️  Clearing existing Supabase data...")
        # Delete all existing records
        supabase.table('leads').delete().neq('lead_id', '').execute()
        print("✅ Existing data cleared")
    except Exception as e:
        print(f"⚠️  Warning: Could not clear existing data: {e}")
    
    # Insert data in batches
    print(f"\n🔄 Migrating {total_leads} leads in batches of {batch_size}...")
    
    imported_count = 0
    error_count = 0
    
    for i in range(0, total_leads, batch_size):
        batch = leads[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        
        try:
            # Insert batch
            response = supabase.table('leads').insert(batch).execute()
            imported_count += len(batch)
            print(f"  ✅ Batch {batch_num}: Imported {len(batch)} leads (Total: {imported_count}/{total_leads})")
        except Exception as e:
            error_count += len(batch)
            print(f"  ❌ Batch {batch_num} failed: {e}")
            
            # Try inserting one by one to identify problematic records
            for lead in batch:
                try:
                    supabase.table('leads').insert([lead]).execute()
                    imported_count += 1
                    error_count -= 1
                except Exception as inner_e:
                    print(f"    ❌ Failed to insert lead {lead.get('lead_id', 'unknown')}: {inner_e}")
    
    # Summary
    print("\n" + "="*60)
    print("📊 MIGRATION SUMMARY")
    print("="*60)
    print(f"✅ Successfully migrated: {imported_count} leads")
    print(f"❌ Errors: {error_count} leads")
    print(f"📈 Total processed: {total_leads} leads")
    print(f"📊 Success rate: {(imported_count/total_leads*100):.1f}%")
    print("="*60)
    
    if imported_count > 0:
        print("\n🎉 Migration completed successfully!")
        print(f"🌐 View your data at: {SUPABASE_URL}")
    else:
        print("\n⚠️  Migration completed with errors. Please check the output above.")
    
    return imported_count, error_count

if __name__ == "__main__":
    try:
        imported, errors = migrate_to_supabase(batch_size=100)
        
        if imported > 0:
            print("\n📝 Next steps:")
            print("1. Update backend/.env to use Supabase:")
            print("   Comment out: DATABASE_URL=sqlite:///./crm_database.db")
            print("   Uncomment and add password to PostgreSQL URL")
            print("2. Restart the backend server")
            print("3. Refresh your frontend to see the migrated data")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
