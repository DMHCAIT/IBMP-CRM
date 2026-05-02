#!/usr/bin/env python3
"""
Add ML scoring columns to existing database
"""

import sqlite3
from pathlib import Path

# Connect to database
db_path = Path("crm_database.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("🔧 Adding ML scoring columns to database...")

# Add new columns if they don't exist
new_columns = [
    ("ml_score", "FLOAT"),
    ("rule_score", "FLOAT"),
    ("confidence", "FLOAT"),
    ("scoring_method", "VARCHAR"),
    ("feature_importance", "TEXT"),
]

for col_name, col_type in new_columns:
    try:
        cursor.execute(f"ALTER TABLE leads ADD COLUMN {col_name} {col_type}")
        print(f"✅ Added column: {col_name}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print(f"⏭️  Column '{col_name}' already exists, skipping")
        else:
            print(f"❌ Error adding {col_name}: {e}")

conn.commit()
conn.close()

print("\n✅ Database schema migration complete!")
