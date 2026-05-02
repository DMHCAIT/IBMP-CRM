"""
Script 2: Parse Notes
Extract features from JSON notes field
🔥 MOST IMPORTANT STEP for accuracy
"""

import pandas as pd
import json
from textblob import TextBlob
import re
from pathlib import Path
from datetime import datetime

# Paths
INPUT_PATH = '../data/processed/leads_clean.csv'
OUTPUT_PATH = '../data/processed/leads_notes.csv'

def load_data():
    """Load cleaned data"""
    df = pd.read_csv(INPUT_PATH, parse_dates=['created_at', 'updated_at', 'last_contact_at'])
    print(f"✅ Loaded {len(df)} rows")
    return df

def parse_json_notes(notes_str):
    """Parse JSON notes string and extract features"""
    
    # Default return values
    default_features = {
        'notes_count': 0,
        'last_note_date': None,
        'no_response_count': 0,
        'callback_flag': 0,
        'not_interested_flag': 0,
        'not_answering_count': 0,
        'busy_count': 0,
        'whatsapp_sent_count': 0,
        'sentiment_score': 0.0,
        'avg_note_length': 0,
        'unique_authors': 0,
        'days_since_last_note': 999
    }
    
    # Handle empty or NaN notes
    if pd.isna(notes_str) or notes_str == '' or notes_str == '[]':
        return default_features
    
    try:
        # Parse JSON string
        notes = json.loads(notes_str)
        
        if not notes or len(notes) == 0:
            return default_features
        
        # Initialize counters
        notes_count = len(notes)
        no_response_count = 0
        callback_flag = 0
        not_interested_flag = 0
        not_answering_count = 0
        busy_count = 0
        whatsapp_sent_count = 0
        
        all_content = []
        sentiments = []
        authors = set()
        
        last_note_date = None
        
        # Process each note
        for note in notes:
            content = note.get('content', '').lower()
            all_content.append(content)
            
            # Track authors
            author = note.get('author', '')
            if author:
                authors.add(author)
            
            # Get timestamp
            timestamp = note.get('timestamp', '')
            if timestamp:
                try:
                    note_date = pd.to_datetime(timestamp)
                    if last_note_date is None or note_date > last_note_date:
                        last_note_date = note_date
                except:
                    pass
            
            # Keyword detection
            if any(word in content for word in ['no response', 'not responding', 'didnt respond', "didn't respond", 'no reply']):
                no_response_count += 1
            
            if any(word in content for word in ['not answering', 'not ans', 'no answer', 'unreachable', 'not reachable']):
                not_answering_count += 1
            
            if any(word in content for word in ['callback', 'call back', 'will call', 'call later']):
                callback_flag = 1
            
            if any(word in content for word in ['not interested', 'not intrested', 'ni ', ' ni']):
                not_interested_flag = 1
            
            if any(word in content for word in ['busy', 'occupied', 'in meeting']):
                busy_count += 1
            
            if any(word in content for word in ['whatsapp', 'whats app', 'wa sent', 'msg sent', 'texted']):
                whatsapp_sent_count += 1
            
            # Sentiment analysis
            try:
                sentiment = TextBlob(content).sentiment.polarity
                sentiments.append(sentiment)
            except:
                sentiments.append(0)
        
        # Calculate aggregate metrics
        avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0
        avg_note_length = sum(len(c) for c in all_content) / len(all_content) if all_content else 0
        unique_authors = len(authors)
        
        # Days since last note
        days_since_last_note = 999
        if last_note_date:
            try:
                # Make datetime.now() timezone-aware if last_note_date has timezone
                now = datetime.now()
                if last_note_date.tz is not None:
                    now = now.replace(tzinfo=last_note_date.tz)
                days_since_last_note = (now - last_note_date).days
            except:
                days_since_last_note = 999
        
        return {
            'notes_count': notes_count,
            'last_note_date': last_note_date,
            'no_response_count': no_response_count,
            'callback_flag': callback_flag,
            'not_interested_flag': not_interested_flag,
            'not_answering_count': not_answering_count,
            'busy_count': busy_count,
            'whatsapp_sent_count': whatsapp_sent_count,
            'sentiment_score': round(avg_sentiment, 3),
            'avg_note_length': round(avg_note_length, 1),
            'unique_authors': unique_authors,
            'days_since_last_note': days_since_last_note
        }
    
    except json.JSONDecodeError as e:
        print(f"⚠️ JSON parse error: {e}")
        return default_features
    except Exception as e:
        print(f"⚠️ Error parsing notes: {e}")
        return default_features

def parse_notes(df):
    """Parse notes column and extract features"""
    print("\n--- Parsing JSON Notes Field ---")
    print("This is the MOST IMPORTANT STEP for ML accuracy\n")
    
    if 'notes' not in df.columns:
        print("❌ No 'notes' column found!")
        return df
    
    print(f"Parsing notes for {len(df)} leads...")
    
    # Apply parsing function
    note_features = df['notes'].apply(parse_json_notes)
    
    # Convert to DataFrame
    features_df = pd.DataFrame(note_features.tolist())
    
    # Add to original DataFrame
    df = pd.concat([df, features_df], axis=1)
    
    # Display statistics
    print(f"\n✅ Extracted {len(features_df.columns)} features from notes:")
    print(f"   - Average notes per lead: {features_df['notes_count'].mean():.1f}")
    print(f"   - Leads with no response: {(features_df['no_response_count'] > 0).sum()}")
    print(f"   - Leads with callback requests: {features_df['callback_flag'].sum()}")
    print(f"   - Leads marked not interested: {features_df['not_interested_flag'].sum()}")
    print(f"   - Average sentiment score: {features_df['sentiment_score'].mean():.3f}")
    
    print(f"\nAdded {len(features_df.columns)} text features")
    return df

def save_data(df):
    """Save data with parsed notes"""
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\nSaved data to {OUTPUT_PATH}")

if __name__ == "__main__":
    # Load data
    df = load_data()
    
    # Parse notes
    df = parse_notes(df)
    
    # Save
    save_data(df)
    
    print("\n✅ Note parsing complete!")
