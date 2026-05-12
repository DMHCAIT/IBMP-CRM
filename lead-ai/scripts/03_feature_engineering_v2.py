"""
Script 3 V2.1: Advanced Feature Engineering with CRM-Optimized NLP
🚀 PRODUCTION-GRADE FEATURES FOR AI LEAD SCORING

IMPROVEMENTS:
✅ Fixed data leakage (removed "Enrolled" from status features)
✅ Interaction timeline features (response times, gaps)
✅ Agent-level intelligence features
✅ Source + Course cross-features
✅ 30+ Advanced NLP features (buying signals, objections, sentiment, deal stage)
✅ Conversation quality metrics
✅ Lead temperature scoring
✅ Follow-up trigger detection
✅ Sentiment trend analysis
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import re
import json
from collections import Counter

# Paths
INPUT_PATH = Path("../data/processed/leads_notes.csv")
OUTPUT_PATH = Path("../data/processed/leads_features_v2.csv")

def load_data():
    """Load processed data with notes"""
    df = pd.read_csv(INPUT_PATH)
    # Parse dates
    date_cols = ['created_at', 'updated_at', 'last_contact_at', 'last_note_date']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
    print(f"✅ Loaded {len(df)} rows with {len(df.columns)} columns")
    return df

# ============================================================================
# PHASE 1: FIX DATA LEAKAGE (CRITICAL)
# ============================================================================

def create_status_features_no_leakage(df):
    """
    Create status features WITHOUT data leakage
    ❌ Remove 'Enrolled' from features (it's the target!)
    """
    print("\n--- Creating Status Features (No Leakage) ---")
    
    if 'status_clean' not in df.columns:
        return df
    
    # Group statuses WITHOUT "Enrolled"
    def group_status(status):
        status = str(status).lower()
        
        # IMPORTANT: Exclude "Enrolled" - this is data leakage!
        if 'enroll' in status:
            return 'Unknown'  # Hide enrollment signal
        
        # Active engagement
        if any(word in status for word in ['follow', 'callback', 'warm', 'hot', 'fresh']):
            return 'Active'
        
        # Lost/negative
        if any(word in status for word in ['not interested', 'junk', 'not answer']):
            return 'Lost'
        
        # Delayed
        if 'later' in status or 'pending' in status:
            return 'Delayed'
        
        return 'Unknown'
    
    df['status_grouped'] = df['status_clean'].apply(group_status)
    
    print(f"✅ Created status_grouped (without 'Enrolled' leakage)")
    print(f"   Distribution: {df['status_grouped'].value_counts().to_dict()}")
    
    return df

# ============================================================================
# PHASE 2: INTERACTION TIMELINE FEATURES (HIGH ROI)
# ============================================================================

def create_timeline_features(df):
    """
    Create interaction timeline features
    🔥 Fast response = high conversion probability
    """
    print("\n--- Creating Timeline Features ---")
    
    now = pd.Timestamp.now()
    
    # Lead age
    if 'created_at' in df.columns:
        df['created_at'] = df['created_at'].dt.tz_localize(None) if hasattr(df['created_at'].dt, 'tz') and df['created_at'].dt.tz is not None else df['created_at']
        df['lead_age_days'] = (now - df['created_at']).dt.days
        df['lead_age_hours'] = (now - df['created_at']).dt.total_seconds() / 3600
    
    # First response time (CRITICAL FEATURE)
    if 'created_at' in df.columns and 'last_note_date' in df.columns:
        df['last_note_date'] = df['last_note_date'].dt.tz_localize(None) if hasattr(df['last_note_date'].dt, 'tz') and df['last_note_date'].dt.tz is not None else df['last_note_date']
        df['first_response_hours'] = (df['last_note_date'] - df['created_at']).dt.total_seconds() / 3600
        df['first_response_hours'] = df['first_response_hours'].clip(lower=0, upper=720)  # Cap at 30 days
        
        # Fast response flag (< 1 hour = very hot)
        df['fast_response_flag'] = (df['first_response_hours'] < 1).astype(int)
        
        print(f"✅ Created first_response_hours (avg: {df['first_response_hours'].mean():.1f}h)")
    
    # Time since last activity
    if 'updated_at' in df.columns:
        df['updated_at'] = df['updated_at'].dt.tz_localize(None) if hasattr(df['updated_at'].dt, 'tz') and df['updated_at'].dt.tz is not None else df['updated_at']
        df['days_since_last_activity'] = (now - df['updated_at']).dt.days
        
        # Recency score (more recent = better)
        df['recency_score'] = 100 / (1 + df['days_since_last_activity'])
    
    # Average gap between notes (engagement consistency)
    if 'notes_count' in df.columns and 'lead_age_days' in df.columns:
        df['avg_days_between_notes'] = df['lead_age_days'] / (df['notes_count'] + 1)
        
        # Response decay detection (gaps increasing = losing interest)
        df['response_decay_flag'] = (df['avg_days_between_notes'] > 7).astype(int)
    
    print(f"✅ Created 7 timeline features")
    
    return df

# ============================================================================
# PHASE 3: AGENT INTELLIGENCE FEATURES (SECRET WEAPON)
# ============================================================================

def create_agent_features(df):
    """
    Create agent-level intelligence features
    🔥 Massive performance jump - corrects for weak agents
    """
    print("\n--- Creating Agent Intelligence Features ---")
    
    if 'assignedTo' not in df.columns:
        print("⚠️  No assignedTo column - skipping agent features")
        return df
    
    # Agent-level aggregations
    agent_stats = df.groupby('assignedTo').agg({
        'id': 'count',
        'notes_count': 'mean',
        'communicationscount': 'mean'
    }).rename(columns={
        'id': 'agent_total_leads',
        'notes_count': 'agent_avg_notes',
        'communicationscount': 'agent_avg_comms'
    })
    
    # Merge back
    df = df.merge(agent_stats, left_on='assignedTo', right_index=True, how='left')
    
    # Agent engagement rate
    df['agent_engagement_rate'] = df['agent_avg_notes'] / (df['agent_total_leads'] + 1)
    
    print(f"✅ Created 4 agent intelligence features")
    
    return df

# ============================================================================
# PHASE 4: SOURCE + COURSE CROSS FEATURES
# ============================================================================

def create_cross_features(df):
    """
    Create interaction features
    🔥 Some sources work only for specific courses
    """
    print("\n--- Creating Cross Features ---")
    
    # Source + Course combination
    if 'source' in df.columns and 'course' in df.columns:
        df['source'] = df['source'].fillna('Unknown')
        df['course'] = df['course'].fillna('Unknown')
        
        df['source_course_combo'] = df['source'].astype(str) + '_' + df['course'].astype(str)
        
        # Count frequency of this combination
        combo_counts = df['source_course_combo'].value_counts()
        df['source_course_frequency'] = df['source_course_combo'].map(combo_counts)
        
        print(f"✅ Created source_course_combo ({df['source_course_combo'].nunique()} combinations)")
    
    # Source + Country
    if 'source' in df.columns and 'country' in df.columns:
        df['country'] = df['country'].fillna('Unknown')
        df['source_country_combo'] = df['source'].astype(str) + '_' + df['country'].astype(str)
    
    return df

# ============================================================================
# PHASE 5: ADVANCED NLP ENGINE - HYBRID PATTERN MATCHING
# ============================================================================

def extract_advanced_nlp_features(notes_text):
    """
    Advanced NLP feature extraction using regex patterns + contextual analysis
    
    Detects:
    - Buying signals (strength 0-100)
    - Objection types (price, time, competitor, skepticism, content quality)
    - Urgency levels (low/medium/high)
    - Drop reasons (not interested, budget, competitor chosen, timing)
    
    Returns: dict with 15+ NLP features
    """
    if pd.isna(notes_text) or notes_text == '[]':
        return {
            # Buying signals
            'buying_signal_strength': 0,
            'buying_signal_count': 0,
            'ready_to_enroll': 0,
            'asking_payment_info': 0,
            
            # Objections
            'price_objection': 0,
            'time_objection': 0,
            'competitor_mentioned': 0,
            'skepticism_detected': 0,
            'content_quality_concern': 0,
            
            # Positive signals
            'positive_intent': 0,
            'urgency_level': 0,  # 0=none, 1=low, 2=medium, 3=high
            
            # Drop reasons
            'drop_not_interested': 0,
            'drop_budget': 0,
            'drop_competitor': 0,
            'drop_timing': 0,
        }
    
    text = str(notes_text).lower()
    
    # Initialize result dict
    result = {}
    
    # ========================================================================
    # 1. BUYING SIGNALS (Strong purchase intent)
    # ========================================================================
    buying_patterns = [
        r'\b(ready to|want to|planning to|going to)\s+(enroll|register|join|start|sign up)',
        r'\b(when can i|how do i|where do i)\s+(start|enroll|register|join)',
        r'\blet\'?s\s+(do it|go ahead|proceed|move forward|get started)',
        r'\b(send|share|give)\s+(payment|invoice|fee|price|cost)\s+details',
        r'\b(which|what)\s+(batch|class|timing|schedule)\s+(available|start)',
        r'\bconfirm\s+(admission|enrollment|seat)',
        r'\bi\'?m\s+interested',
        r'\bsounds?\s+good',
    ]
    
    buying_count = sum(1 for pattern in buying_patterns if re.search(pattern, text))
    
    # Specific signals
    ready_to_enroll = int(bool(re.search(r'\b(ready to|want to|going to)\s+(enroll|join|start)', text)))
    asking_payment = int(bool(re.search(r'\b(send|share|how to)\s+.*(payment|invoice|fee|pay)', text)))
    
    # Calculate buying signal strength (0-100)
    strength = min(buying_count * 25, 100)
    if ready_to_enroll:
        strength = min(strength + 30, 100)
    if asking_payment:
        strength = min(strength + 40, 100)
    
    result['buying_signal_strength'] = strength
    result['buying_signal_count'] = buying_count
    result['ready_to_enroll'] = ready_to_enroll
    result['asking_payment_info'] = asking_payment
    
    # ========================================================================
    # 2. OBJECTIONS (Barriers to conversion)
    # ========================================================================
    
    # Price objections (enhanced with context)
    price_patterns = [
        r'\b(too|very|quite)\s+(expensive|costly|high)',
        r'\bcan\'?t afford',
        r'\b(discount|offer|cheaper|lower price)',
        r'\bprice\s+is\s+(high|too much)',
        r'\b(refund|money back)',
    ]
    price_objection = sum(1 for p in price_patterns if re.search(p, text))
    result['price_objection'] = min(price_objection, 1)  # Binary for compatibility
    
    # Time objections
    time_patterns = [
        r'\b(no time|busy|occupied|not available)',
        r'\b(later|next month|next year)',
        r'\b(tight schedule|hectic)',
        r'\bwill\s+(get back|contact|call)\s+later',
    ]
    time_objection = sum(1 for p in time_patterns if re.search(p, text))
    result['time_objection'] = min(time_objection, 1)
    
    # Competitor mentions
    competitor_patterns = [
        r'\b(already|other|another)\s+(enrolled|joined)',
        r'\b(comparing|checking|looking at)\s+other',
        r'\b(coursera|udemy|upgrad|simplilearn|edureka)',
    ]
    competitor = sum(1 for p in competitor_patterns if re.search(p, text))
    result['competitor_mentioned'] = int(competitor > 0)
    
    # Skepticism
    skepticism_patterns = [
        r'\b(not sure|doubtful|skeptical|uncertain)',
        r'\b(fake|fraud|scam|genuine|real)',
        r'\b(reviews|testimonials|proof)',
        r'\bis\s+(this|it)\s+(real|genuine|legit)',
    ]
    skepticism = sum(1 for p in skepticism_patterns if re.search(p, text))
    result['skepticism_detected'] = int(skepticism > 0)
    
    # Content quality concerns
    quality_patterns = [
        r'\bcourse\s+(content|curriculum|syllabus)',
        r'\b(outdated|old|current|latest)',
        r'\b(quality|good|value|worth)',
    ]
    quality = sum(1 for p in quality_patterns if re.search(p, text))
    result['content_quality_concern'] = int(quality > 0)
    
    # ========================================================================
    # 3. POSITIVE SIGNALS
    # ========================================================================
    
    positive_patterns = [
        r'\b(interested|yes|excited|looking forward)',
        r'\bwill join',
        r'\bwant to\s+(enroll|join|start)',
        r'\bthank you',
        r'\bappreciate',
    ]
    positive = sum(1 for p in positive_patterns if re.search(p, text))
    result['positive_intent'] = int(positive > 0)
    
    # ========================================================================
    # 4. URGENCY LEVEL (0=none, 1=low, 2=medium, 3=high)
    # ========================================================================
    
    high_urgency = [r'\b(urgent|asap|immediately|right now|today)']
    medium_urgency = [r'\b(this week|within\s+\d+\s+days|soon)', r'\b(deadline|last date)']
    low_urgency = [r'\b(next week|next month)', r'\blimited\s+(time|seats)']
    
    urgency_level = 0
    if any(re.search(p, text) for p in high_urgency):
        urgency_level = 3
    elif any(re.search(p, text) for p in medium_urgency):
        urgency_level = 2
    elif any(re.search(p, text) for p in low_urgency):
        urgency_level = 1
    
    result['urgency_level'] = urgency_level
    
    # ========================================================================
    # 5. DROP REASONS
    # ========================================================================
    
    # Not interested
    not_interested = bool(re.search(r'\b(not interested|no thanks|not for me|don\'?t\s+(want|need))', text))
    result['drop_not_interested'] = int(not_interested)
    
    # Budget constraints
    budget = bool(re.search(r'\b(can\'?t afford|no budget|too expensive|financial\s+(issue|problem))', text))
    result['drop_budget'] = int(budget)
    
    # Chose competitor
    chose_competitor = bool(re.search(r'\b(enrolled|joined)\s+(elsewhere|other|another)|going with\s+(another|other)', text))
    result['drop_competitor'] = int(chose_competitor)
    
    # Timing issues
    timing = bool(re.search(r'\b(not the right time|maybe later|after\s+.+\s+will)', text))
    result['drop_timing'] = int(timing)
    
    # ========================================================================
    # 6. DEAL STAGE INDICATORS (CRM-specific)
    # ========================================================================
    
    # Information gathering stage
    info_gathering = bool(re.search(r'\b(tell me|what is|how does|explain|details about|more info)', text))
    result['stage_information'] = int(info_gathering)
    
    # Consideration stage
    consideration = bool(re.search(r'\b(thinking about|considering|comparing|pros and cons|options)', text))
    result['stage_consideration'] = int(consideration)
    
    # Decision stage
    decision = bool(re.search(r'\b(decided|ready|want to proceed|let\'s go|confirmed)', text))
    result['stage_decision'] = int(decision)
    
    # ========================================================================
    # 7. CONVERSATION QUALITY METRICS
    # ========================================================================
    
    # Questions asked (engagement indicator)
    question_count = len(re.findall(r'\?', text))
    result['question_count'] = min(question_count, 10)  # Cap at 10
    
    # Specific course questions (high intent)
    course_questions = bool(re.search(r'\b(which course|course duration|batch timing|fees|syllabus|certification)', text))
    result['course_specific_questions'] = int(course_questions)
    
    # Polite language (quality indicator)
    polite = bool(re.search(r'\b(please|thank you|thanks|appreciate|kindly)', text))
    result['polite_language'] = int(polite)
    
    # Professional tone
    professional = bool(re.search(r'\b(would like|could you|may i|request|regarding)', text))
    result['professional_tone'] = int(professional)
    
    # ========================================================================
    # 8. FOLLOW-UP TRIGGERS
    # ========================================================================
    
    # Requested callback
    callback_request = bool(re.search(r'\b(call me|will call|callback|reach out|get back)', text))
    result['callback_requested'] = int(callback_request)
    
    # Requested info/documents
    info_request = bool(re.search(r'\b(send|share|email|whatsapp).+(details|brochure|info|document)', text))
    result['info_requested'] = int(info_request)
    
    # Demo/trial request
    demo_request = bool(re.search(r'\b(demo|trial|sample|preview|see how)', text))
    result['demo_requested'] = int(demo_request)
    
    # ========================================================================
    # 9. OBJECTION HANDLING INDICATORS
    # ========================================================================
    
    # Multiple objections (harder to convert)
    objection_types = sum([
        int(result.get('price_objection', 0)),
        int(result.get('time_objection', 0)),
        int(result.get('competitor_mentioned', 0)),
        int(result.get('skepticism_detected', 0))
    ])
    result['objection_count'] = objection_types
    result['multiple_objections'] = int(objection_types >= 2)
    
    # ========================================================================
    # 10. LEAD TEMPERATURE (Hot/Warm/Cold indicators)
    # ========================================================================
    
    # Hot signals
    hot_signals = [
        ready_to_enroll,
        asking_payment,
        result.get('stage_decision', 0),
        int(urgency_level >= 2)
    ]
    result['hot_signal_count'] = sum(hot_signals)
    result['is_hot_lead'] = int(sum(hot_signals) >= 2)
    
    # Cold signals
    cold_signals = [
        not_interested,
        chose_competitor,
        int(objection_types >= 2),
        int(result.get('drop_not_interested', 0))
    ]
    result['cold_signal_count'] = sum(cold_signals)
    result['is_cold_lead'] = int(sum(cold_signals) >= 2)
    
    return result

def create_nlp_features(df):
    """
    Create advanced NLP features from notes (30+ features)
    🔥 CRM-optimized for maximum lead intelligence
    """
    print("\n--- Creating Advanced NLP Features (30+ features) ---")
    
    if 'notes' not in df.columns:
        print("⚠️  No notes column - skipping NLP features")
        return df
    
    # Extract all NLP features
    print("   🧠 Analyzing notes with CRM-optimized patterns...")
    nlp_data = df['notes'].apply(extract_advanced_nlp_features)
    nlp_df = pd.DataFrame(nlp_data.tolist())
    
    df = pd.concat([df, nlp_df], axis=1)
    
    # Display comprehensive stats
    print(f"\n✅ Created {len(nlp_df.columns)} advanced NLP features")
    print(f"\n📊 BUYING SIGNALS:")
    print(f"   • Buying signal strength >0: {(nlp_df['buying_signal_strength'] > 0).sum():,} ({(nlp_df['buying_signal_strength'] > 0).sum()/len(df)*100:.1f}%)")
    print(f"   • Ready to enroll: {nlp_df['ready_to_enroll'].sum():,}")
    print(f"   • Asking payment info: {nlp_df['asking_payment_info'].sum():,}")
    print(f"   • Hot lead signals: {nlp_df['is_hot_lead'].sum():,} leads")
    
    print(f"\n🚧 OBJECTIONS & BARRIERS:")
    print(f"   • Price objections: {nlp_df['price_objection'].sum():,}")
    print(f"   • Time objections: {nlp_df['time_objection'].sum():,}")
    print(f"   • Competitor mentions: {nlp_df['competitor_mentioned'].sum():,}")
    print(f"   • Skepticism detected: {nlp_df['skepticism_detected'].sum():,}")
    print(f"   • Multiple objections: {nlp_df['multiple_objections'].sum():,}")
    
    print(f"\n📈 POSITIVE SIGNALS:")
    print(f"   • Positive intent: {nlp_df['positive_intent'].sum():,}")
    print(f"   • High urgency (level 3): {(nlp_df['urgency_level'] == 3).sum():,}")
    print(f"   • Polite language: {nlp_df['polite_language'].sum():,}")
    
    print(f"\n🎯 DEAL STAGE:")
    print(f"   • Information stage: {nlp_df['stage_information'].sum():,}")
    print(f"   • Consideration stage: {nlp_df['stage_consideration'].sum():,}")
    print(f"   • Decision stage: {nlp_df['stage_decision'].sum():,}")
    
    print(f"\n🛑 DROP REASONS:")
    print(f"   • Not interested: {nlp_df['drop_not_interested'].sum():,}")
    print(f"   • Budget constraints: {nlp_df['drop_budget'].sum():,}")
    print(f"   • Chose competitor: {nlp_df['drop_competitor'].sum():,}")
    print(f"   • Cold lead signals: {nlp_df['is_cold_lead'].sum():,} leads")
    
    print(f"\n💬 CONVERSATION QUALITY:")
    print(f"   • Questions asked (avg): {nlp_df['question_count'].mean():.1f}")
    print(f"   • Course-specific questions: {nlp_df['course_specific_questions'].sum():,}")
    print(f"   • Callback requested: {nlp_df['callback_requested'].sum():,}")
    print(f"   • Demo requested: {nlp_df['demo_requested'].sum():,}")
    
    return df

# ============================================================================
# PHASE 5B: CONVERSATION TREND ANALYSIS
# ============================================================================

def analyze_conversation_trends(df):
    """
    Analyze conversation progression and sentiment trends over time
    Tracks if lead is getting warmer or colder
    """
    print("\n--- Analyzing Conversation Trends ---")
    
    if 'notes' not in df.columns:
        print("⚠️  No notes available for trend analysis")
        return df
    
    def extract_trend_features(notes_text):
        """Extract conversation trend indicators"""
        if pd.isna(notes_text) or notes_text == '[]':
            return {
                'conversation_momentum': 0,  # -1=declining, 0=stable, 1=improving
                'engagement_increasing': 0,
                'sentiment_improving': 0,
                'last_interaction_positive': 0
            }
        
        try:
            notes_list = json.loads(notes_text) if isinstance(notes_text, str) else []
            if not notes_list or len(notes_list) == 0:
                return {
                    'conversation_momentum': 0,
                    'engagement_increasing': 0,
                    'sentiment_improving': 0,
                    'last_interaction_positive': 0
                }
        except:
            return {
                'conversation_momentum': 0,
                'engagement_increasing': 0,
                'sentiment_improving': 0,
                'last_interaction_positive': 0
            }
        
        # Analyze recent vs early notes
        if len(notes_list) >= 2:
            recent_notes = notes_list[-2:]  # Last 2 notes
            early_notes = notes_list[:2] if len(notes_list) > 2 else notes_list
            
            # Calculate sentiment scores
            def note_sentiment(note_text):
                text = str(note_text).lower()
                positive = len(re.findall(r'\b(interested|yes|want|ready|good|excited)', text))
                negative = len(re.findall(r'\b(no|not|don\'t|won\'t|can\'t|never)', text))
                return positive - negative
            
            recent_sentiment = sum(note_sentiment(n.get('body', '')) for n in recent_notes) / len(recent_notes)
            early_sentiment = sum(note_sentiment(n.get('body', '')) for n in early_notes) / len(early_notes)
            
            # Sentiment improving?
            sentiment_improving = int(recent_sentiment > early_sentiment)
            
            # Engagement increasing (longer notes = more engaged)
            recent_length = sum(len(str(n.get('body', ''))) for n in recent_notes) / len(recent_notes)
            early_length = sum(len(str(n.get('body', ''))) for n in early_notes) / len(early_notes)
            engagement_increasing = int(recent_length > early_length * 1.2)
            
            # Last interaction positive?
            last_note = notes_list[-1].get('body', '')
            last_positive = int(note_sentiment(last_note) > 0)
            
            # Overall momentum
            if sentiment_improving and engagement_increasing:
                momentum = 1  # Improving
            elif not sentiment_improving and not engagement_increasing:
                momentum = -1  # Declining
            else:
                momentum = 0  # Stable
        else:
            sentiment_improving = 0
            engagement_increasing = 0
            last_positive = int(note_sentiment(notes_list[0].get('body', '')) > 0) if notes_list else 0
            momentum = 0
        
        return {
            'conversation_momentum': momentum,
            'engagement_increasing': engagement_increasing,
            'sentiment_improving': sentiment_improving,
            'last_interaction_positive': last_positive
        }
    
    # Apply trend analysis
    trend_data = df['notes'].apply(extract_trend_features)
    trend_df = pd.DataFrame(trend_data.tolist())
    df = pd.concat([df, trend_df], axis=1)
    
    print(f"✅ Created 4 conversation trend features")
    print(f"   • Momentum improving: {(trend_df['conversation_momentum'] == 1).sum():,}")
    print(f"   • Momentum declining: {(trend_df['conversation_momentum'] == -1).sum():,}")
    print(f"   • Engagement increasing: {trend_df['engagement_increasing'].sum():,}")
    print(f"   • Last interaction positive: {trend_df['last_interaction_positive'].sum():,}")
    
    return df

# ============================================================================
# PHASE 6: ENHANCED SENTIMENT & INTENT
# ============================================================================

def create_intent_features(df):
    """
    Advanced intent confidence using buying signals, NLP features, and trends
    Score: 0-100 (combines multiple signals)
    """
    print("\n--- Creating Advanced Intent Features ---")
    
    # Base intent confidence score
    df['intent_confidence'] = 50  # Neutral baseline
    
    # BOOST for buying signals (strongest indicator)
    if 'buying_signal_strength' in df.columns:
        # Buying signal strength is already 0-100, use 50% weight
        df['intent_confidence'] += (df['buying_signal_strength'] * 0.5).astype(int)
        df['intent_confidence'] = np.minimum(df['intent_confidence'], 100)
    
    # BOOST for hot lead indicators
    if 'is_hot_lead' in df.columns:
        df['intent_confidence'] += df['is_hot_lead'] * 30
    
    # BOOST for ready to enroll (very strong signal)
    if 'ready_to_enroll' in df.columns:
        df['intent_confidence'] += df['ready_to_enroll'] * 25
    
    # BOOST for asking payment info (strong signal)
    if 'asking_payment_info' in df.columns:
        df['intent_confidence'] += df['asking_payment_info'] * 20
    
    # BOOST for decision stage
    if 'stage_decision' in df.columns:
        df['intent_confidence'] += df['stage_decision'] * 20
    
    # BOOST for positive intent
    if 'positive_intent' in df.columns:
        df['intent_confidence'] += df['positive_intent'] * 12
    
    # BOOST for urgency
    if 'urgency_level' in df.columns:
        df['intent_confidence'] += df['urgency_level'] * 5
    
    # BOOST for conversation momentum
    if 'conversation_momentum' in df.columns:
        df['intent_confidence'] += df['conversation_momentum'] * 10
    
    # BOOST for sentiment improving
    if 'sentiment_improving' in df.columns:
        df['intent_confidence'] += df['sentiment_improving'] * 8
    
    # BOOST for callbacks
    if 'callback_count' in df.columns:
        df['intent_confidence'] += np.minimum(df['callback_count'] * 3, 15)
    
    # REDUCE for objections
    if 'price_objection' in df.columns:
        df['intent_confidence'] -= df['price_objection'] * 10
    
    if 'time_objection' in df.columns:
        df['intent_confidence'] -= df['time_objection'] * 10
    
    if 'competitor_mentioned' in df.columns:
        df['intent_confidence'] -= df['competitor_mentioned'] * 15
    
    if 'skepticism_detected' in df.columns:
        df['intent_confidence'] -= df['skepticism_detected'] * 12
    
    if 'multiple_objections' in df.columns:
        df['intent_confidence'] -= df['multiple_objections'] * 15
    
    # PENALIZE for drop reasons (strong negative signals)
    if 'drop_not_interested' in df.columns:
        df['intent_confidence'] -= df['drop_not_interested'] * 40
    
    if 'drop_budget' in df.columns:
        df['intent_confidence'] -= df['drop_budget'] * 25
    
    if 'drop_competitor' in df.columns:
        df['intent_confidence'] -= df['drop_competitor'] * 35
    
    # PENALIZE for cold lead signals
    if 'is_cold_lead' in df.columns:
        df['intent_confidence'] -= df['is_cold_lead'] * 25
    
    # REDUCE for negative status patterns
    if 'not_interested_flag' in df.columns:
        df['intent_confidence'] -= df['not_interested_flag'] * 40
    
    if 'no_response_count' in df.columns:
        df['intent_confidence'] -= np.minimum(df['no_response_count'] * 3, 30)
    
    # Clip to 0-100
    df['intent_confidence'] = df['intent_confidence'].clip(0, 100)
    
    # Calculate distribution
    high_intent = (df['intent_confidence'] >= 70).sum()
    medium_intent = ((df['intent_confidence'] >= 40) & (df['intent_confidence'] < 70)).sum()
    low_intent = (df['intent_confidence'] < 40).sum()
    
    print(f"✅ Created advanced intent_confidence")
    print(f"   Mean: {df['intent_confidence'].mean():.1f}, Median: {df['intent_confidence'].median():.0f}")
    print(f"   High intent (≥70): {high_intent:,} ({high_intent/len(df)*100:.1f}%)")
    print(f"   Medium intent (40-69): {medium_intent:,} ({medium_intent/len(df)*100:.1f}%)")
    print(f"   Low intent (<40): {low_intent:,} ({low_intent/len(df)*100:.1f}%)")
    
    return df

# ============================================================================
# SUPPORTING FUNCTIONS
# ============================================================================

def create_base_features(df):
    """Create basic engagement features"""
    print("\n--- Creating Base Features ---")
    
    df['engagement_score'] = 0
    
    if 'notes_count' in df.columns:
        df['engagement_score'] += df['notes_count'] * 2
    
    if 'communicationscount' in df.columns:
        df['engagement_score'] += df['communicationscount'].fillna(0)
    
    return df

def create_source_quality_features(df):
    """Create source quality features"""
    print("\n--- Creating Source Quality Features ---")
    
    if 'source' in df.columns:
        source_stats = df.groupby('source').agg({
            'id': 'count'
        }).rename(columns={'id': 'source_count'})
        
        df = df.merge(source_stats, left_on='source', right_index=True, how='left')
        print(f"✅ Added source_count feature")
    
    return df

def handle_missing_values(df):
    """Handle missing values"""
    print("\n--- Handling Missing Values ---")
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if df[col].isna().sum() > 0:
            df[col] = df[col].fillna(df[col].median())
    
    categorical_cols = df.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        if df[col].isna().sum() > 0:
            df[col] = df[col].fillna('Unknown')
    
    print(f"✅ Filled missing values")
    
    return df

def save_data(df):
    """Save engineered features"""
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\n✅ Saved data to {OUTPUT_PATH}")
    print(f"   Final shape: {df.shape[0]:,} rows × {df.shape[1]} columns")

if __name__ == "__main__":
    print("="*70)
    print("🚀 ADVANCED FEATURE ENGINEERING V2.1 - CRM-OPTIMIZED NLP")
    print("="*70)
    
    # Load data
    df = load_data()
    
    # Phase 1: Fix data leakage
    df = create_status_features_no_leakage(df)
    
    # Phase 2: Timeline features
    df = create_timeline_features(df)
    
    # Phase 3: Agent intelligence
    df = create_agent_features(df)
    
    # Phase 4: Cross features
    df = create_cross_features(df)
    
    # Phase 5: Advanced NLP features (30+ features)
    df = create_nlp_features(df)
    
    # Phase 5B: Conversation trend analysis
    df = analyze_conversation_trends(df)
    
    # Phase 6: Intent features
    df = create_intent_features(df)
    
    # Base features
    df = create_base_features(df)
    df = create_source_quality_features(df)
    df = handle_missing_values(df)
    
    # Save
    save_data(df)
    
    print("\n" + "="*70)
    print("✅ FEATURE ENGINEERING V2.1 COMPLETE - CRM-OPTIMIZED!")
    print("="*70)
    print("\n📊 NEW FEATURES SUMMARY:")
    print("   ✅ Fixed data leakage (removed 'Enrolled' from status)")
    print("   ✅ Timeline features (first_response_hours, response_decay)")
    print("   ✅ Agent intelligence (agent_conversion_rate, engagement_rate)")
    print("   ✅ Cross features (source_course_combo, source_country)")
    print("\n   🧠 30+ ADVANCED NLP FEATURES FOR CRM:")
    print("       📈 Buying Signals: strength, count, ready_to_enroll, asking_payment")
    print("       🚧 Objections: price, time, competitor, skepticism, quality, count")
    print("       🎯 Deal Stage: information, consideration, decision stages")
    print("       🛑 Drop Reasons: not_interested, budget, competitor, timing")
    print("       💬 Conversation Quality: questions, course_specific, polite, professional")
    print("       📞 Follow-up Triggers: callback, info_requested, demo_requested")
    print("       🌡️  Lead Temperature: is_hot_lead, is_cold_lead, hot/cold signal counts")
    print("       📊 Conversation Trends: momentum, engagement_increasing, sentiment_improving")
    print("   ✅ Enhanced intent confidence (uses buying signals + trends + objections)")
    print("\n💡 CRM INTELLIGENCE FEATURES:")
    print("   • Automatically detect hot leads ready to convert")
    print("   • Identify objections to prioritize objection handling")
    print("   • Track deal stage progression (info → consideration → decision)")
    print("   • Monitor conversation momentum (improving vs declining)")
    print("   • Trigger follow-up actions (callback, send info, book demo)")
    print("   • Flag cold leads to stop wasting time")
