"""
Database migration to add communication_history table
For storing WhatsApp, Email, and Call records for ML training
"""

from sqlalchemy import text
from database import engine

def create_communication_history_table():
    """Create communication_history table if it doesn't exist"""
    
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS communication_history (
        id SERIAL PRIMARY KEY,
        lead_id VARCHAR(50),
        communication_type VARCHAR(20) NOT NULL,
        direction VARCHAR(10) NOT NULL,
        content TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20),
        metadata TEXT,
        sender VARCHAR(255),
        recipient VARCHAR(255),
        used_for_training BOOLEAN DEFAULT FALSE,
        sentiment_score FLOAT,
        ai_insights TEXT,
        
        CONSTRAINT fk_lead
            FOREIGN KEY(lead_id)
            REFERENCES leads(lead_id)
            ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_comm_lead_id ON communication_history(lead_id);
    CREATE INDEX IF NOT EXISTS idx_comm_type ON communication_history(communication_type);
    CREATE INDEX IF NOT EXISTS idx_comm_timestamp ON communication_history(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_comm_training ON communication_history(used_for_training);
    """
    
    try:
        with engine.connect() as connection:
            connection.execute(text(create_table_sql))
            connection.commit()
            print("✅ communication_history table created successfully!")
    except Exception as e:
        print(f"❌ Error creating table: {e}")
        print("Note: If using SQLite, adjust the SQL syntax accordingly")

if __name__ == "__main__":
    print("🔄 Running communication_history migration...")
    create_communication_history_table()
    print("✅ Migration complete!")
