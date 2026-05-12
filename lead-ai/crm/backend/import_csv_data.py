"""
CSV Data Import Script for Medical CRM
Maps raw CSV columns to database schema and imports data
"""

import pandas as pd
import sqlite3
import json
from datetime import datetime
import sys
import os

# Database path
DB_PATH = "/Users/rubeenakhan/Desktop/ADVANCED AI LEAD SYSTEM/lead-ai/crm/backend/crm_database.db"
CSV_PATH = "/Users/rubeenakhan/Desktop/ADVANCED AI LEAD SYSTEM/lead-ai/data/raw/leads.csv"

# Column mapping: CSV column -> Database column
COLUMN_MAPPING = {
    # Identity & Contact
    'id': 'lead_id',              # UUID from CSV
    'fullName': 'full_name',
    'email': 'email',
    'phone': 'phone',
    'phone': 'whatsapp',          # Use phone as whatsapp if no separate whatsapp field
    'country': 'country',
    
    # Lead source & course
    'source': 'source',
    'course': 'course_interested',
    
    # Status & priority
    'status': 'status',
    'priority': 'priority_level',
    
    # Assignment & follow-up
    'assignedTo': 'assigned_to',
    'followUp': 'follow_up_date',
    'nextfollowup': 'follow_up_date',  # Alternative field
    'next_follow_up': 'follow_up_date', # Alternative field
    
    # Timestamps
    'createdAt': 'created_at',
    'created_at': 'created_at',   # Alternative field
    'updatedAt': 'updated_at',
    'updated_at': 'updated_at',   # Alternative field
    'last_contact_at': 'last_contact_date',
    
    # AI/ML scores
    'score': 'ai_score',
    'lead_score': 'ml_score',
    'churn_risk': 'churn_risk',
    
    # Revenue
    'estimatedvalue': 'expected_revenue',
    'estimated_value': 'expected_revenue',  # Alternative field
    'sale_price': 'actual_revenue',
    'fees': 'actual_revenue',               # Alternative field
    
    # Actions
    'next_action': 'next_action',
    'next_action_priority': 'priority_level',
}

# Status mapping (normalize variations)
STATUS_MAPPING = {
    'Follow Up': 'Follow Up',
    'follow up': 'Follow Up',
    'FOLLOW UP': 'Follow Up',
    'Not Interested': 'Not Interested',
    'not interested': 'Not Interested',
    'NOT INTERESTED': 'Not Interested',
    'Interested': 'Interested',
    'interested': 'Interested',
    'Converted': 'Converted',
    'converted': 'Converted',
    'New': 'New',
    'new': 'New',
    'Lost': 'Lost',
    'lost': 'Lost',
}

def clean_phone(phone):
    """Clean and standardize phone numbers"""
    if pd.isna(phone):
        return None
    phone = str(phone).strip()
    # Remove common prefixes
    phone = phone.replace('+', '').replace('-', '').replace(' ', '')
    return phone if phone else None

def safe_float(value, default=0.0):
    """Safely convert value to float, handling text churn_risk values"""
    try:
        if pd.isna(value) or value == '' or value is None:
            return default
        # Handle text values for churn_risk
        if isinstance(value, str):
            value_lower = value.lower().strip()
            if value_lower in ['low', 'l']:
                return 0.2
            elif value_lower in ['medium', 'med', 'm']:
                return 0.5
            elif value_lower in ['high', 'h']:
                return 0.8
        return float(value)
    except (ValueError, TypeError):
        return default

def parse_notes(notes_json):
    """Extract latest note from JSON notes array"""
    if pd.isna(notes_json) or notes_json == '':
        return None
    try:
        notes = json.loads(notes_json)
        if isinstance(notes, list) and len(notes) > 0:
            # Get the latest note
            latest = notes[-1]
            return latest.get('content', '')[:500]  # Limit to 500 chars
    except:
        return str(notes_json)[:500] if notes_json else None
    return None

def calculate_ai_segment(score):
    """Calculate AI segment based on score"""
    if pd.isna(score):
        return 'Cold'
    score = float(score)
    if score >= 70:
        return 'Hot'
    elif score >= 40:
        return 'Warm'
    else:
        return 'Cold'

def parse_date(date_str):
    """Parse various date formats"""
    if pd.isna(date_str) or date_str == '':
        return None
    
    # Try different formats
    formats = [
        '%Y-%m-%d %H:%M:%S.%f%z',
        '%Y-%m-%d %H:%M:%S.%f',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d',
        '%m/%d/%Y',
    ]
    
    for fmt in formats:
        try:
            # Remove timezone info if present
            date_str_clean = str(date_str).split('+')[0].strip()
            return datetime.strptime(date_str_clean, fmt).strftime('%Y-%m-%d %H:%M:%S')
        except:
            continue
    
    return None

def import_leads_from_csv():
    """Main import function"""
    
    print("🚀 Starting CSV Import Process...")
    print(f"📁 Reading CSV from: {CSV_PATH}")
    
    # Read CSV
    try:
        df = pd.read_csv(CSV_PATH)
        print(f"✅ Loaded {len(df)} rows from CSV")
        print(f"📊 Columns found: {len(df.columns)}")
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        return
    
    # Connect to database
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        print(f"✅ Connected to database: {DB_PATH}")
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        return
    
    # Get existing lead IDs to avoid duplicates
    cursor.execute("SELECT lead_id FROM leads")
    existing_ids = set(row[0] for row in cursor.fetchall())
    print(f"📊 Found {len(existing_ids)} existing leads in database")
    
    # Prepare data
    imported_count = 0
    skipped_count = 0
    error_count = 0
    
    print("\n🔄 Processing rows...")
    
    for idx, row in df.iterrows():
        try:
            # Check if lead already exists
            lead_id = row.get('id')
            if pd.isna(lead_id) or lead_id in existing_ids:
                skipped_count += 1
                continue
            
            # Map columns
            lead_data = {
                'lead_id': lead_id,
                'full_name': row.get('fullName', row.get('full_name', '')),
                'email': row.get('email', ''),
                'phone': clean_phone(row.get('phone')),
                'whatsapp': clean_phone(row.get('phone')),  # Use phone as whatsapp
                'country': row.get('country', ''),
                'source': row.get('source', 'Unknown'),
                'course_interested': row.get('course', row.get('course_interested', '')),
                'status': STATUS_MAPPING.get(row.get('status'), 'New'),
                'assigned_to': row.get('assignedTo', row.get('assigned_to', row.get('assignedcounselor', ''))),
                'priority_level': row.get('priority', 'medium'),
            }
            
            # Dates
            lead_data['created_at'] = parse_date(row.get('createdAt', row.get('created_at'))) or datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            lead_data['updated_at'] = parse_date(row.get('updatedAt', row.get('updated_at'))) or datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            lead_data['follow_up_date'] = parse_date(row.get('followUp', row.get('nextfollowup', row.get('next_follow_up'))))
            lead_data['last_contact_date'] = parse_date(row.get('last_contact_at'))
            
            # Scores
            ai_score = row.get('score', row.get('lead_score', 0))
            lead_data['ai_score'] = float(ai_score) if not pd.isna(ai_score) else 0.0
            lead_data['ml_score'] = float(row.get('lead_score', 0)) if not pd.isna(row.get('lead_score')) else None
            lead_data['ai_segment'] = calculate_ai_segment(lead_data['ai_score'])
            lead_data['churn_risk'] = safe_float(row.get('churn_risk', 0), default=0.0)
            
            # Revenue
            expected_rev = row.get('estimatedvalue', row.get('estimated_value', 0))
            actual_rev = row.get('sale_price', row.get('fees', 0))
            lead_data['expected_revenue'] = float(expected_rev) if not pd.isna(expected_rev) else 0.0
            lead_data['actual_revenue'] = float(actual_rev) if not pd.isna(actual_rev) else 0.0
            
            # Probability & next action
            lead_data['conversion_probability'] = lead_data['ai_score'] / 100.0 if lead_data['ai_score'] else 0.0
            lead_data['next_action'] = row.get('next_action', 'Follow up with lead')
            
            # Calculate buying signal
            lead_data['buying_signal_strength'] = min(lead_data['ai_score'] / 100.0, 1.0)
            
            # Primary objection from notes
            notes = row.get('notes', '')
            if notes and not pd.isna(notes):
                parsed_note = parse_notes(notes)
                lead_data['primary_objection'] = parsed_note if parsed_note else 'None recorded'
            else:
                lead_data['primary_objection'] = 'None recorded'
            
            # Insert into database
            columns = ', '.join(lead_data.keys())
            placeholders = ', '.join(['?' for _ in lead_data])
            sql = f"INSERT INTO leads ({columns}) VALUES ({placeholders})"
            
            cursor.execute(sql, list(lead_data.values()))
            imported_count += 1
            
            if (imported_count + skipped_count) % 100 == 0:
                print(f"  Processed: {imported_count + skipped_count} rows (Imported: {imported_count}, Skipped: {skipped_count})")
                conn.commit()  # Commit every 100 rows
            
        except Exception as e:
            error_count += 1
            if error_count <= 5:  # Show first 5 errors
                print(f"⚠️  Error at row {idx}: {str(e)[:100]}")
    
    # Final commit
    conn.commit()
    conn.close()
    
    print("\n" + "="*60)
    print("📊 IMPORT SUMMARY")
    print("="*60)
    print(f"✅ Successfully imported: {imported_count} leads")
    print(f"⏭️  Skipped (duplicates):  {skipped_count} leads")
    print(f"❌ Errors:                {error_count} leads")
    print(f"📈 Total processed:       {imported_count + skipped_count + error_count} rows")
    print("="*60)
    
    if imported_count > 0:
        print("\n🎉 Import completed successfully!")
        print(f"💾 Database updated: {DB_PATH}")
    else:
        print("\n⚠️  No new leads imported. All records may already exist.")

if __name__ == "__main__":
    import_leads_from_csv()
