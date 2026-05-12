"""
Setup Supabase database schema and seed initial data
Run this script to create tables and populate data in Supabase
"""

import os
from supabase_client import supabase_manager
from logger_config import logger

def create_supabase_tables():
    """Create all required tables in Supabase"""
    
    client = supabase_manager.get_client()
    if not client:
        logger.error("❌ Supabase client not available. Check SUPABASE_URL and SUPABASE_KEY")
        return False
    
    logger.info("🔧 Setting up Supabase database schema...")
    
    # Note: Supabase tables are usually created via the Supabase Dashboard or SQL Editor
    # This script will check if tables exist and provide instructions
    
    try:
        # Test if leads table exists
        response = client.table('leads').select("count", count='exact').limit(0).execute()
        logger.info(f"✅ 'leads' table exists with {response.count} records")
    except Exception as e:
        logger.warning(f"⚠️  'leads' table may not exist: {e}")
        logger.info("📝 Please create tables in Supabase Dashboard using the SQL below:")
        print_table_creation_sql()
        return False
    
    try:
        # Test other tables
        tables = ['courses', 'hospitals', 'users', 'activities', 'notes']
        for table in tables:
            response = client.table(table).select("count", count='exact').limit(0).execute()
            logger.info(f"✅ '{table}' table exists with {response.count} records")
    except Exception as e:
        logger.warning(f"⚠️  Some tables may not exist: {e}")
    
    return True

def print_table_creation_sql():
    """Print SQL for creating tables in Supabase"""
    
    sql = """
-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    lead_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    country VARCHAR(100),
    source VARCHAR(100),
    course_interested VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Follow-up',
    assigned_to VARCHAR(255),
    ai_score FLOAT DEFAULT 0,
    ai_segment VARCHAR(50),
    follow_up_date TIMESTAMP,
    expected_revenue FLOAT DEFAULT 0,
    actual_revenue FLOAT DEFAULT 0,
    notes TEXT,
    buying_signal_strength FLOAT DEFAULT 0,
    primary_objection VARCHAR(255),
    churn_risk FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    specialization VARCHAR(255),
    duration VARCHAR(100),
    price FLOAT,
    description TEXT,
    eligibility TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    city VARCHAR(100),
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    collaboration_status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'counselor',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    activity_type VARCHAR(100),
    description TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    content TEXT,
    created_by VARCHAR(255),
    channel VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_segment ON leads(ai_segment);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_notes_lead ON notes(lead_id);
"""
    
    print("\n" + "="*80)
    print("SUPABASE TABLE CREATION SQL")
    print("="*80)
    print(sql)
    print("="*80)
    print("\n📋 Copy and paste the above SQL into Supabase SQL Editor:")
    print("   1. Go to https://supabase.com/dashboard")
    print("   2. Select your project")
    print("   3. Go to SQL Editor")
    print("   4. Paste and run the SQL above")
    print("\n")

if __name__ == "__main__":
    create_supabase_tables()
