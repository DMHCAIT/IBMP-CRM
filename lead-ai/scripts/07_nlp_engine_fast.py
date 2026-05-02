#!/usr/bin/env python3
"""
OPTIMIZED NLP Engine for Lead Intelligence - FAST VERSION
Uses lightweight models + regex for speed

Analyzes:
- Notes
- WhatsApp messages  
- Call transcripts

Detects:
- Buying signals (ready to purchase, asking about pricing, timeline)
- Objections (price, time, competitor, skepticism)
- Urgency (immediate need, deadline-driven)
- Drop reasons (not interested, budget issues, competitor chosen)

PERFORMANCE:
- ~2000 leads/second using regex patterns
- Optional BERT/RoBERTa for deep analysis (slower: ~10 leads/second)
"""

import pandas as pd
import numpy as np
import re
from datetime import datetime
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# NLP Libraries (lightweight)
import spacy
from collections import Counter

print("=" * 80)
print("🚀 FAST NLP ENGINE - Optimized for Production")
print("=" * 80)


class FastNLPEngine:
    """
    Lightning-fast NLP engine for lead intelligence extraction
    Uses regex + spaCy (no heavy BERT models)
    """
    
    def __init__(self, use_deep_learning=False):
        print("\n🔧 Initializing lightweight NLP models...")
        
        # Load spaCy for linguistic features
        print("  📚 Loading spaCy (en_core_web_sm)...")
        self.nlp = spacy.load('en_core_web_sm', disable=['parser', 'ner'])  # Faster
        
        self.use_deep_learning = use_deep_learning
        
        if use_deep_learning:
            print("  🤖 Loading BERT models (SLOW - only use for sample data)...")
            from transformers import pipeline
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                device=-1
            )
        else:
            print("  ⚡ Using fast regex-based analysis (RECOMMENDED for full dataset)")
        
        print("✅ NLP models loaded successfully!\n")
        
        # Initialize detection patterns
        self._initialize_patterns()
    
    def _initialize_patterns(self):
        """Initialize regex patterns and keyword lists"""
        
        # BUYING SIGNALS - Strong intent to purchase
        self.buying_signal_keywords = [
            'ready to enroll', 'want to join', 'planning to start', 'going to register',
            'when can i start', 'how do i enroll', 'let\'s do it', 'let\'s proceed',
            'send payment details', 'send invoice', 'how to pay', 'which batch',
            'confirm admission', 'i\'m interested', 'sounds good', 'yes i want'
        ]
        
        self.buying_signal_patterns = [
            r'\b(ready to|want to|planning to|going to)\s+(enroll|register|join|start|sign up)',
            r'\b(when can i|how do i|where do i)\s+(start|enroll|register|join|sign up)',
            r'\blet\'?s\s+(do it|go ahead|proceed|move forward|get started)',
            r'\b(send|share|give)\s+(payment|invoice|fee|price|cost)\s+details',
            r'\b(accept|take|process)\s+(payment|card|upi|transfer)',
            r'\bhow to\s+(pay|make payment|transfer)',
            r'\b(which|what)\s+(batch|class|timing|schedule)\s+(available|start)',
            r'\bconfirm\s+(admission|enrollment|seat|registration)',
            r'\bi\'?m\s+interested',
            r'\bsounds?\s+good',
            r'\byes,?\s+(i|we)\s+(want|need|would like)',
        ]
        
        # OBJECTION TYPES
        self.objection_patterns = {
            'price': [
                r'\b(too|very|quite)\s+(expensive|costly|high|much)',
                r'\b(can\'?t afford|budget|expensive)',
                r'\b(discount|offer|deal|cheaper|lower price|reduce)',
                r'\bprice\s+is\s+(high|too much)',
                r'\bany\s+(discount|offer|scholarship)',
                r'\b(refund|money back)',
            ],
            'time': [
                r'\b(no time|busy|occupied|not available)',
                r'\b(later|next month|next year|after)',
                r'\b(tight schedule|hectic)',
                r'\bwill\s+(get back|contact|call)\s+later',
                r'\btoo\s+busy',
            ],
            'competitor': [
                r'\b(already|other|another)\s+(enrolled|joined|registered)',
                r'\b(comparing|checking|looking at)\s+other',
                r'\b(coursera|udemy|upgrad|simplilearn|edureka|udacity)',
            ],
            'skepticism': [
                r'\b(not sure|doubtful|skeptical|uncertain)',
                r'\b(fake|fraud|scam|genuine|real)',
                r'\b(reviews|testimonials|proof)',
                r'\bis\s+(this|it)\s+(real|genuine|legit)',
            ],
            'content_quality': [
                r'\b(quality|good|value|worth)',
                r'\bcourse\s+(content|curriculum|syllabus)',
                r'\b(outdated|old|current|latest)',
            ]
        }
        
        # URGENCY SIGNALS
        self.urgency_patterns = [
            r'\b(urgent|asap|immediately|right now|today)',
            r'\b(deadline|last date|closing soon)',
            r'\bneed\s+(it|this|to start)\s+(now|soon|urgently)',
            r'\b(limited|running out|few seats)',
            r'\b(this week|within\s+\d+\s+days)',
        ]
        
        # DROP REASONS
        self.drop_reason_patterns = {
            'not_interested': [
                r'\b(not interested|no thanks|not for me)',
                r'\b(don\'?t\s+(want|need)|no longer)',
                r'\bplease\s+(remove|stop|don\'?t\s+call)',
            ],
            'budget_constraint': [
                r'\b(can\'?t afford|no budget|too expensive)',
                r'\b(financial|money)\s+(issue|problem|constraint)',
            ],
            'chose_competitor': [
                r'\b(enrolled|joined|registered)\s+(elsewhere|other|another)',
                r'\b(going with|chose|selected)\s+(another|other)',
            ],
            'timing_issue': [
                r'\b(not the right time|maybe later)',
                r'\b(after|once)\s+.+\s+(then|will contact)',
            ],
            'unresponsive': [
                r'\b(no response|not responding|unreachable)',
                r'\b(call not picked|switched off)',
            ]
        }
        
        # SENTIMENT KEYWORDS (fast alternative to BERT)
        self.positive_keywords = [
            'great', 'excellent', 'good', 'interested', 'perfect', 'amazing',
            'wonderful', 'love', 'like', 'yes', 'definitely', 'absolutely',
            'thank', 'thanks', 'appreciate', 'helpful'
        ]
        
        self.negative_keywords = [
            'not', 'no', 'bad', 'poor', 'terrible', 'horrible', 'worst',
            'disappointed', 'unhappy', 'angry', 'frustrated', 'waste',
            'expensive', 'costly', 'can\'t', 'won\'t', 'don\'t'
        ]
    
    def analyze_text_fast(self, text):
        """
        Fast NLP analysis using regex + keyword matching
        ~2000x faster than BERT-based analysis
        """
        if pd.isna(text) or not str(text).strip():
            return self._get_empty_analysis()
        
        text = str(text).lower().strip()
        result = {}
        
        # 1. BUYING SIGNALS
        result.update(self._detect_buying_signals_fast(text))
        
        # 2. OBJECTIONS
        result.update(self._detect_objections_fast(text))
        
        # 3. URGENCY
        result.update(self._detect_urgency_fast(text))
        
        # 4. DROP REASONS
        result.update(self._detect_drop_reasons_fast(text))
        
        # 5. SENTIMENT (keyword-based)
        result.update(self._analyze_sentiment_fast(text))
        
        # 6. LINGUISTIC FEATURES
        result.update(self._extract_linguistic_features_fast(text))
        
        return result
    
    def _detect_buying_signals_fast(self, text):
        """Fast buying signal detection"""
        signals_found = 0
        
        # Regex patterns
        for pattern in self.buying_signal_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                signals_found += 1
        
        # Keyword matching
        for keyword in self.buying_signal_keywords:
            if keyword in text:
                signals_found += 1
        
        signal_confidence = min(signals_found * 15, 100)
        
        return {
            'buying_signals_count': signals_found,
            'buying_signal_confidence': signal_confidence,
            'has_buying_signal': signals_found > 0
        }
    
    def _detect_objections_fast(self, text):
        """Fast objection detection"""
        objections = {}
        total_objections = 0
        
        for objection_type, patterns in self.objection_patterns.items():
            count = sum(1 for pattern in patterns if re.search(pattern, text, re.IGNORECASE))
            
            objections[f'objection_{objection_type}'] = count > 0
            objections[f'objection_{objection_type}_count'] = count
            total_objections += count
        
        objections['total_objections'] = total_objections
        objections['has_objection'] = total_objections > 0
        
        # Primary objection
        if total_objections > 0:
            primary = max(
                [(k, v) for k, v in objections.items() if k.endswith('_count')],
                key=lambda x: x[1]
            )
            objections['primary_objection'] = primary[0].replace('objection_', '').replace('_count', '')
        else:
            objections['primary_objection'] = 'none'
        
        return objections
    
    def _detect_urgency_fast(self, text):
        """Fast urgency detection"""
        urgency_count = sum(1 for pattern in self.urgency_patterns 
                           if re.search(pattern, text, re.IGNORECASE))
        
        urgency_level = 'high' if urgency_count >= 3 else 'medium' if urgency_count >= 1 else 'none'
        
        return {
            'urgency_count': urgency_count,
            'urgency_level': urgency_level,
            'is_urgent': urgency_count > 0
        }
    
    def _detect_drop_reasons_fast(self, text):
        """Fast drop reason detection"""
        drop_reasons = {}
        total_drop_signals = 0
        
        for reason_type, patterns in self.drop_reason_patterns.items():
            count = sum(1 for pattern in patterns if re.search(pattern, text, re.IGNORECASE))
            drop_reasons[f'drop_reason_{reason_type}'] = count > 0
            total_drop_signals += count
        
        drop_reasons['total_drop_signals'] = total_drop_signals
        drop_reasons['likely_to_drop'] = total_drop_signals >= 2
        
        return drop_reasons
    
    def _analyze_sentiment_fast(self, text):
        """Fast sentiment analysis using keyword matching"""
        words = text.split()
        
        positive_count = sum(1 for word in words if any(pos in word for pos in self.positive_keywords))
        negative_count = sum(1 for word in words if any(neg in word for neg in self.negative_keywords))
        
        # Calculate sentiment score (0-100)
        if positive_count + negative_count == 0:
            sentiment_score = 50.0
            sentiment_label = 'neutral'
        else:
            sentiment_score = (positive_count / (positive_count + negative_count)) * 100
            if sentiment_score > 60:
                sentiment_label = 'positive'
            elif sentiment_score < 40:
                sentiment_label = 'negative'
            else:
                sentiment_label = 'neutral'
        
        return {
            'sentiment_fast': sentiment_label,
            'sentiment_score': sentiment_score,
            'positive_word_count': positive_count,
            'negative_word_count': negative_count
        }
    
    def _extract_linguistic_features_fast(self, text):
        """Fast linguistic feature extraction"""
        question_count = text.count('?')
        exclamation_count = text.count('!')
        
        words = text.split()
        sentences = text.split('.')
        
        return {
            'question_count': question_count,
            'exclamation_count': exclamation_count,
            'word_count': len(words),
            'sentence_count': len(sentences),
            'avg_word_length': np.mean([len(w) for w in words]) if words else 0,
            'char_count': len(text)
        }
    
    def _get_empty_analysis(self):
        """Empty analysis for missing text"""
        return {
            'buying_signals_count': 0,
            'buying_signal_confidence': 0.0,
            'has_buying_signal': False,
            'objection_price': False,
            'objection_price_count': 0,
            'objection_time': False,
            'objection_time_count': 0,
            'objection_competitor': False,
            'objection_competitor_count': 0,
            'objection_skepticism': False,
            'objection_skepticism_count': 0,
            'objection_content_quality': False,
            'objection_content_quality_count': 0,
            'total_objections': 0,
            'has_objection': False,
            'primary_objection': 'none',
            'urgency_count': 0,
            'urgency_level': 'none',
            'is_urgent': False,
            'drop_reason_not_interested': False,
            'drop_reason_budget_constraint': False,
            'drop_reason_chose_competitor': False,
            'drop_reason_timing_issue': False,
            'drop_reason_unresponsive': False,
            'total_drop_signals': 0,
            'likely_to_drop': False,
            'sentiment_fast': 'neutral',
            'sentiment_score': 50.0,
            'positive_word_count': 0,
            'negative_word_count': 0,
            'question_count': 0,
            'exclamation_count': 0,
            'word_count': 0,
            'sentence_count': 0,
            'avg_word_length': 0.0,
            'char_count': 0
        }


def process_leads_with_fast_nlp(input_csv, output_csv, sample_size=None):
    """
    Process leads with optimized fast NLP analysis
    
    Args:
        input_csv: Path to input CSV
        output_csv: Path to output CSV
        sample_size: If set, only process first N leads (for testing)
    """
    print(f"\n📂 Loading data from: {input_csv}")
    df = pd.read_csv(input_csv)
    
    if sample_size:
        print(f"   📌 SAMPLE MODE: Processing first {sample_size} leads")
        df = df.head(sample_size)
    
    print(f"   Found {len(df)} leads to analyze")
    
    # Initialize fast NLP engine
    engine = FastNLPEngine(use_deep_learning=False)
    
    # Combine all text fields
    print("\n🔗 Combining text fields (notes, whatsapp, transcripts)...")
    
    # Check which columns exist
    text_columns = []
    if 'notes' in df.columns:
        text_columns.append('notes')
    if 'whatsapp_message' in df.columns:
        text_columns.append('whatsapp_message')
    if 'call_transcript' in df.columns:
        text_columns.append('call_transcript')
    
    if not text_columns:
        print("   ⚠️  No text columns found, creating empty combined_text")
        df['combined_text'] = ''
    else:
        print(f"   Using columns: {text_columns}")
        df['combined_text'] = df[text_columns].fillna('').astype(str).agg(' '.join, axis=1)
    
    # Analyze each lead
    print(f"\n🧠 Analyzing {len(df)} leads with FAST NLP engine...")
    start_time = pd.Timestamp.now()
    
    nlp_features = []
    for idx, row in df.iterrows():
        if idx % 1000 == 0 and idx > 0:
            elapsed = (pd.Timestamp.now() - start_time).total_seconds()
            rate = idx / elapsed
            eta = (len(df) - idx) / rate
            print(f"   Progress: {idx}/{len(df)} ({idx/len(df)*100:.1f}%) | Speed: {rate:.0f} leads/sec | ETA: {eta:.0f}s")
        
        analysis = engine.analyze_text_fast(row['combined_text'])
        nlp_features.append(analysis)
    
    elapsed = (pd.Timestamp.now() - start_time).total_seconds()
    rate = len(df) / elapsed
    print(f"   ✅ Completed: {len(df)}/{len(df)} (100.0%) | Total time: {elapsed:.1f}s | Avg speed: {rate:.0f} leads/sec")
    
    # Convert to DataFrame and merge
    nlp_df = pd.DataFrame(nlp_features)
    df_enriched = pd.concat([df, nlp_df], axis=1)
    
    # Save results
    print(f"\n💾 Saving enriched data to: {output_csv}")
    df_enriched.to_csv(output_csv, index=False)
    
    # Generate summary statistics
    print_nlp_summary(df_enriched)
    
    return df_enriched


def print_nlp_summary(df):
    """Print NLP analysis summary"""
    print("\n" + "=" * 80)
    print("📊 FAST NLP ANALYSIS SUMMARY")
    print("=" * 80)
    
    print(f"\n🎯 BUYING SIGNALS:")
    print(f"   Leads with buying signals: {df['has_buying_signal'].sum()} ({df['has_buying_signal'].sum()/len(df)*100:.1f}%)")
    if df['buying_signal_confidence'].sum() > 0:
        print(f"   Avg buying signal confidence: {df[df['has_buying_signal']]['buying_signal_confidence'].mean():.1f}")
    
    print(f"\n🚫 OBJECTIONS:")
    print(f"   Leads with objections: {df['has_objection'].sum()} ({df['has_objection'].sum()/len(df)*100:.1f}%)")
    if df['has_objection'].sum() > 0:
        print(f"   Most common objection: {df[df['primary_objection'] != 'none']['primary_objection'].mode()[0] if len(df[df['primary_objection'] != 'none']) > 0 else 'none'}")
        objection_breakdown = df['primary_objection'].value_counts().head(5)
        for objection, count in objection_breakdown.items():
            if objection != 'none':
                print(f"     - {objection}: {count} ({count/len(df)*100:.1f}%)")
    
    print(f"\n⚡ URGENCY:")
    urgency_breakdown = df['urgency_level'].value_counts()
    for level in ['high', 'medium', 'none']:
        count = urgency_breakdown.get(level, 0)
        print(f"   {level.upper()}: {count} ({count/len(df)*100:.1f}%)")
    
    print(f"\n📉 DROP RISK:")
    print(f"   Likely to drop: {df['likely_to_drop'].sum()} ({df['likely_to_drop'].sum()/len(df)*100:.1f}%)")
    
    print(f"\n😊 SENTIMENT (Fast Keyword-Based):")
    sentiment_breakdown = df['sentiment_fast'].value_counts()
    for sentiment in ['positive', 'neutral', 'negative']:
        count = sentiment_breakdown.get(sentiment, 0)
        print(f"   {sentiment.upper()}: {count} ({count/len(df)*100:.1f}%)")
    print(f"   Avg sentiment score: {df['sentiment_score'].mean():.1f}/100")
    
    print("\n" + "=" * 80)
    print("✅ FAST NLP ANALYSIS COMPLETE!")
    print("=" * 80)


if __name__ == "__main__":
    # File paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    input_file = project_root / 'data' / 'processed' / 'leads_features_v2.csv'
    output_file = project_root / 'outputs' / 'leads_nlp_enriched.csv'
    
    # Ensure output directory exists
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Process leads - use sample_size=1000 for testing, None for full dataset
    import sys
    sample_size = int(sys.argv[1]) if len(sys.argv) > 1 else None
    
    df_enriched = process_leads_with_fast_nlp(input_file, output_file, sample_size=sample_size)
    
    print(f"\n✨ Output saved to: {output_file}")
    print(f"   Total columns: {len(df_enriched.columns)}")
    print(f"   New NLP features: ~30 features added")
    print(f"\n📌 To process full dataset: python {Path(__file__).name}")
    print(f"📌 To test on sample: python {Path(__file__).name} 1000")
