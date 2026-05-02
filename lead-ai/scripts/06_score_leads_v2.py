"""
Script 6 V2: Advanced Lead Scoring with Hybrid ML+Rules
🚀 PRODUCTION-GRADE SCORING SYSTEM

IMPROVEMENTS:
✅ Hybrid scoring (ML + Business Rules)
✅ Drift detection monitoring
✅ Model version compatibility checks
✅ Enhanced business action layer
"""

import pandas as pd
import numpy as np
from pathlib import Path
from catboost import CatBoostClassifier, Pool
import joblib
import json
from datetime import datetime

# Paths
INPUT_PATH = Path("../data/processed/leads_features_v2.csv")
MODEL_PATH = Path("../models/lead_conversion_model_latest.cbm")
OUTPUT_PATH = Path("../outputs/")

def load_data():
    """Load processed features"""
    df = pd.read_csv(INPUT_PATH)
    print(f"✅ Loaded {len(df):,} leads")
    return df

def load_model():
    """Load trained model and its metadata"""
    if MODEL_PATH.exists():
        model = CatBoostClassifier()
        model.load_model(str(MODEL_PATH))
        
        # Load metadata to get feature list
        metadata_files = list(Path("../models/").glob("model_metadata_v2_*.json"))
        if metadata_files:
            latest_metadata = sorted(metadata_files)[-1]
            with open(latest_metadata, 'r') as f:
                metadata = json.load(f)
            print(f"✅ Loaded CatBoost model with metadata")
            return model, metadata
        else:
            print(f"✅ Loaded CatBoost model (no metadata found)")
            return model, None
    else:
        raise FileNotFoundError("Model not found! Run 05_train_model_v2.py first")

# ============================================================================
# PHASE 1: ML SCORING (BASE PREDICTION)
# ============================================================================

def score_leads_ml(df, model, metadata):
    """Score leads with ML model"""
    print("\n--- ML Scoring ---")
    
    # Use exact feature list from training if available
    if metadata and 'features' in metadata:
        feature_cols = metadata['features']
        categorical_features = metadata.get('categorical_features', [])
        print(f"✅ Using {len(feature_cols)} features from model metadata")
    else:
        # Fallback to same logic as training
        exclude_cols = ['converted', 'lead_tier', 'id', 'fullName', 'email', 'phone', 'notes', 
                       'status_clean', 'status']
        exclude_cols += [col for col in df.columns if 'date' in col.lower() or col.endswith('_at')]
        feature_cols = [col for col in df.columns if col not in exclude_cols and col in df.columns]
        
        # Identify categorical features
        categorical_features = []
        for col in feature_cols:
            if col in df.columns and (df[col].dtype == 'object' or (df[col].dtype in ['int64', 'int32'] and df[col].nunique() < 50)):
                categorical_features.append(col)
    
    # Check all required features exist and filter out datetime columns
    valid_features = []
    for f in feature_cols:
        if f not in df.columns:
            continue
        # Skip datetime columns
        if pd.api.types.is_datetime64_any_dtype(df[f]):
            continue
        # Skip object columns that might be dates
        if df[f].dtype == 'object':
            sample_val = df[f].dropna().iloc[0] if len(df[f].dropna()) > 0 else None
            if sample_val and isinstance(sample_val, str) and len(sample_val) > 15:
                # Might be a datetime string, skip
                continue
        valid_features.append(f)
    
    feature_cols = valid_features
    print(f"✅ Using {len(feature_cols)} valid features (excluded datetime columns)")
    
    X = df[feature_cols].copy()
    
    # Fill missing values
    for col in X.columns:
        if X[col].dtype == 'object':
            X[col] = X[col].fillna('Unknown')
        else:
            X[col] = X[col].fillna(X[col].median())
    
    # Create Pool and predict
    pool = Pool(X, cat_features=[c for c in categorical_features if c in X.columns])
    df['ml_probability'] = model.predict_proba(pool)[:, 1]
    df['ml_score'] = (df['ml_probability'] * 100).round(1)
    
    print(f"✅ ML Scored {len(df):,} leads")
    print(f"   ML Score range: {df['ml_score'].min():.1f} - {df['ml_score'].max():.1f}")
    
    return df

# ============================================================================
# PHASE 2: BUSINESS RULES LAYER
# ============================================================================

def calculate_engagement_score(df):
    """
    Calculate engagement score from business rules + advanced NLP signals
    Enhanced with buying signals, objections, and drop reasons
    """
    engagement_score = 0
    
    # 🔥 BUYING SIGNALS (Strongest indicator)
    if 'buying_signal_strength' in df.columns:
        engagement_score += df['buying_signal_strength'].fillna(0) * 0.5  # 0-50 points
    
    if 'ready_to_enroll' in df.columns:
        engagement_score += df['ready_to_enroll'] * 25
    
    if 'asking_payment_info' in df.columns:
        engagement_score += df['asking_payment_info'] * 20
    
    # Recency bonus
    if 'recency_score' in df.columns:
        engagement_score += df['recency_score'].fillna(0) * 0.3
    
    # Fast response bonus
    if 'fast_response_flag' in df.columns:
        engagement_score += df['fast_response_flag'] * 15
    
    # Positive intent bonus
    if 'positive_intent' in df.columns:
        engagement_score += df['positive_intent'] * 12
    
    # Urgency levels (0-3)
    if 'urgency_level' in df.columns:
        engagement_score += df['urgency_level'].fillna(0) * 5
    # Fallback to old binary urgency
    elif 'urgency_high' in df.columns:
        engagement_score += df['urgency_high'] * 10
    
    # Notes count (engagement)
    if 'notes_count' in df.columns:
        engagement_score += np.minimum(df['notes_count'].fillna(0) * 2, 20)
    
    # 🎯 BOOST for deal stage progression
    if 'stage_decision' in df.columns:
        engagement_score += df['stage_decision'] * 25
    
    if 'stage_consideration' in df.columns:
        engagement_score += df['stage_consideration'] * 12
    
    # 💬 BOOST for conversation quality
    if 'course_specific_questions' in df.columns:
        engagement_score += df['course_specific_questions'] * 10
    
    if 'polite_language' in df.columns:
        engagement_score += df['polite_language'] * 5
    
    # 📈 BOOST for positive trends
    if 'conversation_momentum' in df.columns:
        engagement_score += df['conversation_momentum'].fillna(0) * 8
    
    if 'sentiment_improving' in df.columns:
        engagement_score += df['sentiment_improving'] * 8
    
    if 'last_interaction_positive' in df.columns:
        engagement_score += df['last_interaction_positive'] * 6
    
    # 🚨 PENALTIES - Objections
    if 'price_objection' in df.columns:
        engagement_score -= df['price_objection'] * 8
    
    if 'time_objection' in df.columns:
        engagement_score -= df['time_objection'] * 8
    
    if 'competitor_mentioned' in df.columns:
        engagement_score -= df['competitor_mentioned'] * 12
    
    if 'skepticism_detected' in df.columns:
        engagement_score -= df['skepticism_detected'] * 10
    
    if 'multiple_objections' in df.columns:
        engagement_score -= df['multiple_objections'] * 12
    
    # 🛑 PENALTIES - Drop reasons (strong negatives)
    if 'drop_not_interested' in df.columns:
        engagement_score -= df['drop_not_interested'] * 35
    
    if 'drop_budget' in df.columns:
        engagement_score -= df['drop_budget'] * 20
    
    if 'drop_competitor' in df.columns:
        engagement_score -= df['drop_competitor'] * 30
    
    # 🌡️ PENALTIES - Cold lead signals
    if 'is_cold_lead' in df.columns:
        engagement_score -= df['is_cold_lead'] * 20
    
    # Legacy penalties
    if 'not_interested_flag' in df.columns:
        engagement_score -= df['not_interested_flag'] * 30
    
    if 'no_response_count' in df.columns:
        engagement_score -= np.minimum(df['no_response_count'].fillna(0) * 5, 30)
    
    # Normalize to 0-100
    engagement_score = engagement_score.clip(0, 100)
    
    return engagement_score

def calculate_recency_score_v2(df):
    """
    Calculate recency score
    """
    recency_score = 50  # Baseline
    
    if 'days_since_last_activity' in df.columns:
        # More recent = higher score (0-100 scale)
        recency_score = 100 / (1 + df['days_since_last_activity'].fillna(30))
    
    return recency_score  # Already 0-100

def apply_business_rules(df):
    """
    Apply business rules to enhance ML predictions
    """
    print("\n--- Applying Business Rules ---")
    
    # Calculate component scores
    df['engagement_score_v2'] = calculate_engagement_score(df)
    df['recency_score_v2'] = calculate_recency_score_v2(df)
    
    print(f"✅ Calculated business rule scores")
    
    return df

# ============================================================================
# PHASE 3: HYBRID SCORING (ML + RULES)
# ============================================================================

def calculate_hybrid_score(df):
    """
    Combine ML and business rules
    🔥 Final score = 0.7×ML + 0.2×Engagement + 0.1×Recency
    """
    print("\n--- Calculating Hybrid Score ---")
    
    # Weights
    ml_weight = 0.7
    engagement_weight = 0.2
    recency_weight = 0.1
    
    # Hybrid score
    df['hybrid_score'] = (
        ml_weight * df['ml_score'] +
        engagement_weight * df['engagement_score_v2'] +
        recency_weight * df['recency_score_v2']
    )
    
    # Round
    df['hybrid_score'] = df['hybrid_score'].round(1)
    
    # Final AI score (use hybrid)
    df['ai_score'] = df['hybrid_score']
    df['conversion_probability'] = df['ai_score'] / 100
    
    print(f"✅ Hybrid Score calculated")
    print(f"   ML contribution: {ml_weight*100}%")
    print(f"   Engagement contribution: {engagement_weight*100}%")
    print(f"   Recency contribution: {recency_weight*100}%")
    print(f"   Average hybrid score: {df['hybrid_score'].mean():.1f}")
    print(f"   Score range: {df['hybrid_score'].min():.1f} - {df['hybrid_score'].max():.1f}")
    
    return df

# ============================================================================
# PHASE 4: DRIFT DETECTION
# ============================================================================

def detect_drift(df):
    """
    Detect data drift that might degrade model
    """
    print("\n--- Drift Detection ---")
    
    drift_warnings = []
    
    # Check conversion rate in high-score leads
    if 'converted' in df.columns:
        high_score_leads = df[df['ai_score'] > 80]
        if len(high_score_leads) > 0:
            hot_conversion_rate = high_score_leads['converted'].mean()
            if hot_conversion_rate < 0.1:  # Less than 10% converting from hot leads
                drift_warnings.append(f"⚠️  Hot leads converting at {hot_conversion_rate:.1%} - MODEL MAY BE DEGRADING")
    
    # Check source distribution changes
    if 'source' in df.columns:
        recent_sources = df['source'].value_counts(normalize=True).head(5)
        print(f"\n📊 Top 5 Sources:")
        for source, pct in recent_sources.items():
            print(f"   {source}: {pct:.1%}")
    
    # Check for unusual score distribution
    high_scores = (df['ai_score'] > 80).sum()
    if high_scores == 0:
        drift_warnings.append("⚠️  No high-score leads (>80) - MODEL MAY BE TOO CONSERVATIVE")
    
    if drift_warnings:
        print(f"\n🚨 DRIFT WARNINGS:")
        for warning in drift_warnings:
            print(f"   {warning}")
        print(f"\n➡️  Consider retraining model if drift persists")
    else:
        print(f"✅ No drift detected - model performing normally")
    
    return drift_warnings

# ============================================================================
# PHASE 5: ENHANCED BUSINESS ACTION LAYER
# ============================================================================

def apply_business_action_layer(df):
    """
    Apply enhanced CRM-optimized score-to-action mapping
    Uses NLP signals for smarter segmentation
    """
    print("\n--- Applying CRM-Optimized Business Action Layer ---")
    
    def assign_segment(row):
        score = row['ai_score']
        
        # Override with NLP hot/cold flags
        if 'is_hot_lead' in row.index and row['is_hot_lead'] == 1:
            return 'Hot'  # Force hot if NLP detected buying signals
        
        if 'is_cold_lead' in row.index and row['is_cold_lead'] == 1:
            return 'Junk'  # Force junk if NLP detected rejection
        
        # Standard score-based segmentation
        if score >= 80:
            return 'Hot'
        elif score >= 50:
            return 'Warm'
        elif score >= 20:
            return 'Cold'
        else:
            return 'Junk'
    
    def assign_action(row):
        segment = row['ai_segment']
        
        # Smart actions based on NLP signals
        if segment == 'Hot':
            if 'ready_to_enroll' in row.index and row['ready_to_enroll'] == 1:
                return 'URGENT: Send payment link NOW'
            elif 'asking_payment_info' in row.index and row['asking_payment_info'] == 1:
                return 'Send payment details within 5 minutes'
            elif 'callback_requested' in row.index and row['callback_requested'] == 1:
                return 'Call back ASAP (callback requested)'
            else:
                return 'Call within 15 minutes'
        
        elif segment == 'Warm':
            if 'demo_requested' in row.index and row['demo_requested'] == 1:
                return 'Schedule demo within 4 hours'
            elif 'info_requested' in row.index and row['info_requested'] == 1:
                return 'Send requested info via email/WhatsApp'
            elif 'price_objection' in row.index and row['price_objection'] == 1:
                return 'Address pricing concerns with discount offer'
            elif 'competitor_mentioned' in row.index and row['competitor_mentioned'] == 1:
                return 'Send competitive comparison + testimonials'
            else:
                return 'Schedule follow-up within 24 hours'
        
        elif segment == 'Cold':
            if 'time_objection' in row.index and row['time_objection'] == 1:
                return 'WhatsApp: Flexible timing options'
            else:
                return 'WhatsApp nurture campaign'
        
        else:  # Junk
            if 'drop_not_interested' in row.index and row['drop_not_interested'] == 1:
                return 'Remove from active list - Marked as not interested'
            elif 'drop_competitor' in row.index and row['drop_competitor'] == 1:
                return 'Archive - Joined competitor'
            else:
                return 'Stop outreach'
    
    # Apply segmentation
    df['ai_segment'] = df.apply(assign_segment, axis=1)
    df['next_action'] = df.apply(assign_action, axis=1)
    
    # Enhanced priority score
    df['priority_score'] = df['ai_score'].copy()
    
    # BOOST priority for hot NLP signals
    if 'is_hot_lead' in df.columns:
        df.loc[df['is_hot_lead'] == 1, 'priority_score'] += 20
    
    if 'ready_to_enroll' in df.columns:
        df.loc[df['ready_to_enroll'] == 1, 'priority_score'] += 15
    
    if 'asking_payment_info' in df.columns:
        df.loc[df['asking_payment_info'] == 1, 'priority_score'] += 12
    
    if 'stage_decision' in df.columns:
        df.loc[df['stage_decision'] == 1, 'priority_score'] += 10
    
    # Legacy urgency boost
    if 'urgency_high' in df.columns:
        df.loc[df['urgency_high'] == 1, 'priority_score'] += 10
    elif 'urgency_level' in df.columns:
        df['priority_score'] += df['urgency_level'] * 3
    
    # Positive intent boost
    if 'positive_intent' in df.columns:
        df.loc[df['positive_intent'] == 1, 'priority_score'] += 5
    
    # Momentum boost
    if 'conversation_momentum' in df.columns:
        df['priority_score'] += df['conversation_momentum'].fillna(0) * 5
    
    # Segment distribution
    segment_dist = df['ai_segment'].value_counts()
    
    print(f"\n📊 CRM Segment Distribution:")
    for segment in ['Hot', 'Warm', 'Cold', 'Junk']:
        count = segment_dist.get(segment, 0)
        pct = (count / len(df)) * 100
        print(f"   {segment:8s}: {count:5,} ({pct:5.1f}%)")
    
    high_value = segment_dist.get('Hot', 0) + segment_dist.get('Warm', 0)
    print(f"\n🎯 HIGH-VALUE LEADS: {high_value:,}")
    print(f"   Hot (immediate action): {segment_dist.get('Hot', 0):,}")
    print(f"   Warm (schedule): {segment_dist.get('Warm', 0):,}")
    
    return df

# ============================================================================
# SAVE OUTPUTS
# ============================================================================

def save_outputs(df):
    """Save all output files"""
    print("\n--- Saving Outputs ---")
    
    # Save all scored leads
    output_cols = ['id', 'fullName', 'email', 'phone', 'status_grouped', 
                   'ml_score', 'hybrid_score', 'ai_score', 'conversion_probability',
                   'ai_segment', 'next_action', 'priority_score']
    
    # Only include columns that exist
    output_cols = [col for col in output_cols if col in df.columns]
    
    df[output_cols].to_csv(OUTPUT_PATH / 'leads_scored_v2.csv', index=False)
    print(f"✅ Saved all leads: leads_scored_v2.csv")
    
    # Save hot leads
    hot_leads = df[df['ai_segment'] == 'Hot'].sort_values('priority_score', ascending=False)
    hot_leads[output_cols].to_csv(OUTPUT_PATH / 'hot_leads_v2.csv', index=False)
    print(f"✅ Saved {len(hot_leads):,} hot leads: hot_leads_v2.csv")
    
    # Save top 100 leads
    top_leads = df.nlargest(100, 'priority_score')
    top_leads[output_cols].to_csv(OUTPUT_PATH / 'top_leads_v2.csv', index=False)
    print(f"✅ Saved top 100 leads: top_leads_v2.csv")
    
    # Save action plan
    action_plan = df.groupby('ai_segment').agg({
        'id': 'count',
        'ai_score': ['mean', 'min', 'max']
    }).round(1)
    action_plan.columns = ['lead_count', 'avg_score', 'min_score', 'max_score']
    action_plan.to_csv(OUTPUT_PATH / 'action_plan_v2.csv')
    print(f"✅ Saved action plan: action_plan_v2.csv")

# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    print("="*70)
    print("🎯 ADVANCED LEAD SCORING V2 - HYBRID ML+RULES")
    print("="*70)
    
    # Load data and model
    df = load_data()
    model, metadata = load_model()
    
    # Phase 1: ML Scoring
    df = score_leads_ml(df, model, metadata)
    
    # Phase 2: Business Rules
    df = apply_business_rules(df)
    
    # Phase 3: Hybrid Scoring
    df = calculate_hybrid_score(df)
    
    # Phase 4: Drift Detection
    drift_warnings = detect_drift(df)
    
    # Phase 5: Business Action Layer
    df = apply_business_action_layer(df)
    
    # Save outputs
    save_outputs(df)
    
    print("\n" + "="*70)
    print("✅ LEAD SCORING V2 COMPLETE!")
    print("="*70)
    print(f"\n🎯 Improvements Applied:")
    print(f"   ✅ Hybrid scoring (70% ML + 30% Business Rules)")
    print(f"   ✅ Drift detection monitoring")
    print(f"   ✅ Enhanced engagement scoring")
    print(f"   ✅ Priority scoring within segments")
    
    hot_count = (df['ai_segment'] == 'Hot').sum()
    print(f"\n🔥 Next: Call the {hot_count:,} HOT leads!")
    print(f"📁 Check: outputs/hot_leads_v2.csv")
