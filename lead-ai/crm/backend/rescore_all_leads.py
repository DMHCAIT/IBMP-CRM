#!/usr/bin/env python3
"""
Rescore all leads with ML-powered AI scoring
"""

from main import DBLead, get_db, ai_scorer
from sqlalchemy.orm import Session
import json

def rescore_all_leads():
    print("=" * 80)
    print("🤖 RESCORING ALL LEADS WITH ML MODEL")
    print("=" * 80)
    
    # Get database session
    db = next(get_db())
    
    # Load course prices
    ai_scorer.load_course_prices(db)
    
    # Get all leads
    leads = db.query(DBLead).all()
    total_leads = len(leads)
    
    print(f"\n📊 Found {total_leads} leads to rescore\n")
    
    updated_count = 0
    ml_count = 0
    rule_count = 0
    
    for idx, lead in enumerate(leads, 1):
        try:
            # Score the lead
            score_result = ai_scorer.score_lead(lead, lead.notes)
            
            # Update with AI insights
            for key, value in score_result.items():
                if key == 'feature_importance' and value:
                    # Serialize feature importance dict to JSON
                    setattr(lead, key, json.dumps(value))
                else:
                    setattr(lead, key, value)
            
            # Track scoring method
            if score_result.get('scoring_method') == 'hybrid_ml':
                ml_count += 1
            else:
                rule_count += 1
            
            updated_count += 1
            
            if idx % 10 == 0:
                print(f"  ✅ Processed {idx}/{total_leads} leads...")
                
        except Exception as e:
            print(f"  ❌ Error scoring lead {lead.id}: {e}")
    
    # Commit all changes
    db.commit()
    
    print(f"\n" + "=" * 80)
    print(f"✅ RESCORING COMPLETE!")
    print(f"=" * 80)
    print(f"  Total Leads: {total_leads}")
    print(f"  Updated: {updated_count}")
    print(f"  ML-Powered: {ml_count}")
    print(f"  Rule-Based: {rule_count}")
    print(f"=" * 80)

if __name__ == "__main__":
    rescore_all_leads()
