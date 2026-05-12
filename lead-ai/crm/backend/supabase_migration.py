"""
Supabase Database Migration Script
Creates all necessary tables in Supabase PostgreSQL database
"""

import os
from dotenv import load_dotenv
from supabase import create_client
from logger_config import logger

load_dotenv()

# SQL for creating all tables
CREATE_TABLES_SQL = """
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    reports_to VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leads table
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
    status VARCHAR(50) DEFAULT 'Follow Up',
    assigned_to VARCHAR(255),
    ai_score FLOAT,
    ai_segment VARCHAR(50),
    conversion_probability FLOAT,
    expected_revenue FLOAT DEFAULT 0,
    actual_revenue FLOAT DEFAULT 0,
    follow_up_date TIMESTAMP,
    enrollment_deadline TIMESTAMP,
    feature_importance JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    duration VARCHAR(100),
    price FLOAT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Counselors table
CREATE TABLE IF NOT EXISTS counselors (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    specialization TEXT,
    performance_score FLOAT DEFAULT 0,
    active_leads INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
    id SERIAL PRIMARY KEY,
    hospital_name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    city VARCHAR(100),
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    partnership_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);
CREATE INDEX IF NOT EXISTS idx_leads_segment ON leads(ai_segment);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_status_segment ON leads(status, ai_segment);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_counselors_active ON counselors(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
"""

def run_migration():
    """Run database migration on Supabase"""
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        logger.error("❌ Supabase credentials not found in .env file")
        return False
    
    try:
        logger.info("🚀 Starting Supabase database migration...")
        
        # Note: Supabase doesn't directly support SQL execution via Python client
        # You need to run this SQL in Supabase Dashboard > SQL Editor
        
        logger.info("📋 Migration SQL generated successfully")
        logger.info("⚠️  Please run the SQL in Supabase Dashboard:")
        logger.info("   1. Go to https://goeybfakjdqcwztazfmk.supabase.co")
        logger.info("   2. Navigate to SQL Editor")
        logger.info("   3. Create a new query")
        logger.info("   4. Copy and paste the SQL from supabase_migration.sql")
        logger.info("   5. Run the query")
        
        # Save SQL to file
        with open("supabase_migration.sql", "w") as f:
            f.write(CREATE_TABLES_SQL)
        
        logger.info("✅ Migration SQL saved to: supabase_migration.sql")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        return False


if __name__ == "__main__":
    print("""
    🏥 MEDICAL EDUCATION CRM - SUPABASE MIGRATION
    =============================================
    
    This script will prepare your Supabase database schema.
    
    STEPS:
    1. This script generates the SQL file
    2. You need to run the SQL manually in Supabase Dashboard
    3. Then update the DATABASE_URL in .env with your Supabase PostgreSQL connection string
    
    """)
    
    success = run_migration()
    
    if success:
        print("\n✅ Migration SQL generated!")
        print("\n📝 Next Steps:")
        print("   1. Open Supabase Dashboard: https://goeybfakjdqcwztazfmk.supabase.co")
        print("   2. Go to SQL Editor")
        print("   3. Copy contents from: supabase_migration.sql")
        print("   4. Execute the SQL")
        print("   5. Get your PostgreSQL connection string from Settings > Database")
        print("   6. Update DATABASE_URL in .env file")
        print("\n" + CREATE_TABLES_SQL)
    else:
        print("\n❌ Migration preparation failed")
