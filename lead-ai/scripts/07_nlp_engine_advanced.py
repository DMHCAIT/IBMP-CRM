#!/usr/bin/env python3
"""
Advanced NLP Engine for Lead Intelligence
Uses BERT/RoBERTa and spaCy for deep text analysis

Analyzes:
- Notes
- WhatsApp messages
- Call transcripts

Detects:
- Buying signals (ready to purchase, asking about pricing, timeline)
- Objections (price, time, competitor, skepticism)
- Urgency (immediate need, deadline-driven)
- Drop reasons (not interested, budget issues, competitor chosen)
"""

import pandas as pd
import numpy as np
import re
from datetime import datetime
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# NLP Libraries
import spacy
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import torch

print("=" * 80)
print("🧠 ADVANCED NLP ENGINE - BERT/RoBERTa + spaCy")
print("=" * 80)


class AdvancedNLPEngine:
    """
    State-of-the-art NLP engine for lead intelligence extraction
    """
    
    def __init__(self):
        print("\n🔧 Initializing NLP models...")
        
        # Load spaCy for linguistic features
        print("  📚 Loading spaCy (en_core_web_sm)...")
        self.nlp = spacy.load('en_core_web_sm')
        
        # Load BERT-based sentiment analyzer
        print("  🤖 Loading BERT sentiment analyzer...")
        self.sentiment_analyzer = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            device=-1  # CPU
        )
        
        # Load zero-shot classifier for custom categories
        print("  🎯 Loading zero-shot classifier (RoBERTa)...")
        self.zero_shot_classifier = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli",
            device=-1
        )
        
        print("✅ All NLP models loaded successfully!\n")
        
        # Define detection patterns
        self._initialize_patterns()
    
    def _initialize_patterns(self):
        """Initialize regex patterns and classification labels"""
        
        # BUYING SIGNALS - Strong intent to purchase
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
            ],
            'time': [
                r'\b(no time|busy|occupied|not available)',
                r'\b(later|next month|next year|after)',
                r'\b(tight schedule|hectic)',
                r'\bwill\s+(get back|contact|call)\s+later',
            ],
            'competitor': [
                r'\b(already|other|another)\s+(enrolled|joined|registered)',
                r'\b(comparing|checking|looking at)\s+other',
                r'\b(coursera|udemy|upgrad|simplilearn|edureka)',
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
    
    def analyze_text(self, text):
        """
        Comprehensive NLP analysis of a single text
        
        Returns dict with all signals and features
        """
        if pd.isna(text) or not str(text).strip():
            return self._get_empty_analysis()
        
        text = str(text).lower().strip()
        
        # Initialize result
        result = {}
        
        # 1. BUYING SIGNALS
        result.update(self._detect_buying_signals(text))
        
        # 2. OBJECTIONS
        result.update(self._detect_objections(text))
        
        # 3. URGENCY
        result.update(self._detect_urgency(text))
        
        # 4. DROP REASONS
        result.update(self._detect_drop_reasons(text))
        
        # 5. SENTIMENT ANALYSIS (BERT)
        result.update(self._analyze_sentiment_bert(text))
        
        # 6. ENTITY EXTRACTION (spaCy)
        result.update(self._extract_entities(text))
        
        # 7. LINGUISTIC FEATURES (spaCy)
        result.update(self._extract_linguistic_features(text))
        
        # 8. ZERO-SHOT CLASSIFICATION
        result.update(self._classify_intent(text))
        
        return result
    
    def _detect_buying_signals(self, text):
        """Detect buying signals using regex + ML"""
        signals_found = 0
        signal_confidence = 0.0
        
        # Regex-based detection
        for pattern in self.buying_signal_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                signals_found += 1
        
        # Calculate confidence
        if signals_found > 0:
            signal_confidence = min(signals_found * 20, 100)  # Each signal = 20 points
        
        return {
            'buying_signals_count': signals_found,
            'buying_signal_confidence': signal_confidence,
            'has_buying_signal': signals_found > 0
        }
    
    def _detect_objections(self, text):
        """Detect and classify objections"""
        objections = {}
        total_objections = 0
        
        for objection_type, patterns in self.objection_patterns.items():
            count = 0
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    count += 1
            
            objections[f'objection_{objection_type}'] = count > 0
            objections[f'objection_{objection_type}_count'] = count
            total_objections += count
        
        objections['total_objections'] = total_objections
        objections['has_objection'] = total_objections > 0
        
        # Identify primary objection
        if total_objections > 0:
            primary = max(
                [(k, v) for k, v in objections.items() if k.endswith('_count')],
                key=lambda x: x[1]
            )
            objections['primary_objection'] = primary[0].replace('objection_', '').replace('_count', '')
        else:
            objections['primary_objection'] = 'none'
        
        return objections
    
    def _detect_urgency(self, text):
        """Detect urgency signals"""
        urgency_count = 0
        
        for pattern in self.urgency_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                urgency_count += 1
        
        urgency_level = 'none'
        if urgency_count >= 3:
            urgency_level = 'high'
        elif urgency_count >= 1:
            urgency_level = 'medium'
        
        return {
            'urgency_count': urgency_count,
            'urgency_level': urgency_level,
            'is_urgent': urgency_count > 0
        }
    
    def _detect_drop_reasons(self, text):
        """Detect reasons for lead drop"""
        drop_reasons = {}
        total_drop_signals = 0
        
        for reason_type, patterns in self.drop_reason_patterns.items():
            count = 0
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    count += 1
            
            drop_reasons[f'drop_reason_{reason_type}'] = count > 0
            total_drop_signals += count
        
        drop_reasons['total_drop_signals'] = total_drop_signals
        drop_reasons['likely_to_drop'] = total_drop_signals >= 2
        
        return drop_reasons
    
    def _analyze_sentiment_bert(self, text):
        """Analyze sentiment using BERT"""
        try:
            # Truncate to 512 tokens (BERT limit)
            if len(text) > 500:
                text = text[:500]
            
            result = self.sentiment_analyzer(text)[0]
            
            # Map to score: POSITIVE = high score, NEGATIVE = low score
            if result['label'] == 'POSITIVE':
                sentiment_score = result['score'] * 100
            else:
                sentiment_score = (1 - result['score']) * 100
            
            return {
                'sentiment_bert': result['label'].lower(),
                'sentiment_confidence': result['score'] * 100,
                'sentiment_score': sentiment_score
            }
        except Exception as e:
            return {
                'sentiment_bert': 'neutral',
                'sentiment_confidence': 0.0,
                'sentiment_score': 50.0
            }
    
    def _extract_entities(self, text):
        """Extract named entities using spaCy"""
        doc = self.nlp(text[:1000])  # Limit length
        
        entities = {
            'person_count': 0,
            'org_count': 0,
            'money_count': 0,
            'date_count': 0,
            'time_count': 0
        }
        
        for ent in doc.ents:
            if ent.label_ == 'PERSON':
                entities['person_count'] += 1
            elif ent.label_ == 'ORG':
                entities['org_count'] += 1
            elif ent.label_ == 'MONEY':
                entities['money_count'] += 1
            elif ent.label_ == 'DATE':
                entities['date_count'] += 1
            elif ent.label_ == 'TIME':
                entities['time_count'] += 1
        
        entities['has_money_mention'] = entities['money_count'] > 0
        entities['has_date_mention'] = entities['date_count'] > 0
        
        return entities
    
    def _extract_linguistic_features(self, text):
        """Extract linguistic features using spaCy"""
        doc = self.nlp(text[:1000])
        
        # Count question marks
        question_count = text.count('?')
        exclamation_count = text.count('!')
        
        # Count tokens, sentences
        token_count = len(doc)
        sentence_count = len(list(doc.sents))
        
        # Count verbs, nouns, adjectives
        verb_count = sum(1 for token in doc if token.pos_ == 'VERB')
        noun_count = sum(1 for token in doc if token.pos_ == 'NOUN')
        adj_count = sum(1 for token in doc if token.pos_ == 'ADJ')
        
        return {
            'question_count': question_count,
            'exclamation_count': exclamation_count,
            'token_count': token_count,
            'sentence_count': sentence_count,
            'verb_count': verb_count,
            'noun_count': noun_count,
            'adj_count': adj_count,
            'avg_sentence_length': token_count / max(sentence_count, 1)
        }
    
    def _classify_intent(self, text):
        """Zero-shot classification of lead intent"""
        try:
            if len(text) > 500:
                text = text[:500]
            
            candidate_labels = [
                "ready to buy",
                "just exploring",
                "has objections",
                "needs more information",
                "not interested"
            ]
            
            result = self.zero_shot_classifier(
                text,
                candidate_labels,
                multi_label=False
            )
            
            # Get top intent
            top_intent = result['labels'][0]
            top_score = result['scores'][0] * 100
            
            return {
                'intent_category': top_intent,
                'intent_confidence_zeroshot': top_score
            }
        except Exception as e:
            return {
                'intent_category': 'unknown',
                'intent_confidence_zeroshot': 0.0
            }
    
    def _get_empty_analysis(self):
        """Return empty analysis for missing text"""
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
            'sentiment_bert': 'neutral',
            'sentiment_confidence': 0.0,
            'sentiment_score': 50.0,
            'person_count': 0,
            'org_count': 0,
            'money_count': 0,
            'date_count': 0,
            'time_count': 0,
            'has_money_mention': False,
            'has_date_mention': False,
            'question_count': 0,
            'exclamation_count': 0,
            'token_count': 0,
            'sentence_count': 0,
            'verb_count': 0,
            'noun_count': 0,
            'adj_count': 0,
            'avg_sentence_length': 0.0,
            'intent_category': 'unknown',
            'intent_confidence_zeroshot': 0.0
        }


def process_leads_with_nlp(input_csv, output_csv):
    """
    Process all leads with advanced NLP analysis
    """
    print(f"\n📂 Loading data from: {input_csv}")
    df = pd.read_csv(input_csv)
    print(f"   Found {len(df)} leads to analyze")
    
    # Initialize NLP engine
    engine = AdvancedNLPEngine()
    
    # Combine all text fields
    print("\n🔗 Combining text fields (notes, whatsapp, transcripts)...")
    df['combined_text'] = df.apply(
        lambda row: ' '.join([
            str(row.get('notes', '')),
            str(row.get('whatsapp_message', '')),
            str(row.get('call_transcript', ''))
        ]).strip(),
        axis=1
    )
    
    # Analyze each lead
    print(f"\n🧠 Analyzing {len(df)} leads with NLP engine...")
    nlp_features = []
    
    for idx, row in df.iterrows():
        if idx % 500 == 0:
            print(f"   Progress: {idx}/{len(df)} leads ({idx/len(df)*100:.1f}%)")
        
        analysis = engine.analyze_text(row['combined_text'])
        nlp_features.append(analysis)
    
    print(f"   ✅ Completed: {len(df)}/{len(df)} leads (100.0%)")
    
    # Convert to DataFrame and merge
    nlp_df = pd.DataFrame(nlp_features)
    df_enriched = pd.concat([df, nlp_df], axis=1)
    
    # Save results
    print(f"\n💾 Saving enriched data to: {output_csv}")
    df_enriched.to_csv(output_csv, index=False)
    
    # Generate summary statistics
    print("\n" + "=" * 80)
    print("📊 NLP ANALYSIS SUMMARY")
    print("=" * 80)
    
    print(f"\n🎯 BUYING SIGNALS:")
    print(f"   Leads with buying signals: {df_enriched['has_buying_signal'].sum()} ({df_enriched['has_buying_signal'].sum()/len(df)*100:.1f}%)")
    print(f"   Avg buying signal confidence: {df_enriched['buying_signal_confidence'].mean():.1f}")
    
    print(f"\n🚫 OBJECTIONS:")
    print(f"   Leads with objections: {df_enriched['has_objection'].sum()} ({df_enriched['has_objection'].sum()/len(df)*100:.1f}%)")
    print(f"   Most common objection: {df_enriched['primary_objection'].mode()[0]}")
    objection_breakdown = df_enriched['primary_objection'].value_counts().head(5)
    for objection, count in objection_breakdown.items():
        print(f"     - {objection}: {count} ({count/len(df)*100:.1f}%)")
    
    print(f"\n⚡ URGENCY:")
    urgency_breakdown = df_enriched['urgency_level'].value_counts()
    for level, count in urgency_breakdown.items():
        print(f"   {level.upper()}: {count} ({count/len(df)*100:.1f}%)")
    
    print(f"\n📉 DROP RISK:")
    print(f"   Likely to drop: {df_enriched['likely_to_drop'].sum()} ({df_enriched['likely_to_drop'].sum()/len(df)*100:.1f}%)")
    
    print(f"\n😊 SENTIMENT (BERT):")
    sentiment_breakdown = df_enriched['sentiment_bert'].value_counts()
    for sentiment, count in sentiment_breakdown.items():
        print(f"   {sentiment.upper()}: {count} ({count/len(df)*100:.1f}%)")
    print(f"   Avg sentiment score: {df_enriched['sentiment_score'].mean():.1f}/100")
    
    print(f"\n🎭 INTENT CATEGORIES (Zero-Shot):")
    intent_breakdown = df_enriched['intent_category'].value_counts().head(5)
    for intent, count in intent_breakdown.items():
        print(f"   {intent}: {count} ({count/len(df)*100:.1f}%)")
    
    print("\n" + "=" * 80)
    print("✅ NLP ANALYSIS COMPLETE!")
    print("=" * 80)
    
    return df_enriched


if __name__ == "__main__":
    # File paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    input_file = project_root / 'data' / 'processed' / 'leads_features_v2.csv'
    output_file = project_root / 'outputs' / 'leads_nlp_enriched.csv'
    
    # Ensure output directory exists
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Process leads
    df_enriched = process_leads_with_nlp(input_file, output_file)
    
    print(f"\n✨ Output saved to: {output_file}")
    print(f"   Total features: {len(df_enriched.columns)} columns")
    print(f"   New NLP features: ~40 features added")
