# 🚀 QUICK START: V2 Lead Scoring System

## Run Complete Pipeline (One Command)

```bash
cd "/Users/rubeenakhan/Desktop/ADVANCED AI LEAD SYSTEM/lead-ai/scripts" && \
python 03_feature_engineering_v2.py && \
python -c "import pandas as pd; df = pd.read_csv('../data/processed/leads_features_v2.csv'); df['converted'] = (df['status_clean'] == 'Enrolled').astype(int); df['lead_tier'] = 'Cold'; df.to_csv('../data/processed/leads_labeled.csv', index=False); print('✅ Labels created')" && \
python 05_train_model_v2.py && \
python 06_score_leads_v2.py && \
echo "✅ PIPELINE COMPLETE! Check outputs/ folder"
```

## View Results

```bash
# Hot leads (immediate calls)
open outputs/hot_leads_v2.csv

# Top 100 leads
open outputs/top_leads_v2.csv

# Comparison charts
open outputs/v1_vs_v2_comparison.png
open outputs/feature_importance_v2.png
```

## Key Outputs

| File | Description | Count |
|------|-------------|-------|
| `hot_leads_v2.csv` | Score >80, call in 15 min | 13 leads |
| `top_leads_v2.csv` | Top 100 by priority | 100 leads |
| `leads_scored_v2.csv` | All scored leads | 19,494 leads |
| `action_plan_v2.csv` | Segment summary | 4 segments |

## Business Actions

### 🔥 Priority 1: Hot Leads (13)
- **Action**: Call within 15 minutes
- **File**: `hot_leads_v2.csv`
- **Score**: >80

### 📞 Priority 2: Warm Leads (1,502)
- **Action**: Schedule within 24 hours
- **File**: Filter `leads_scored_v2.csv` for score 50-80
- **Score**: 50-80

### 💬 Priority 3: Cold Leads (529)
- **Action**: WhatsApp campaigns
- **Score**: 20-50

### 🚫 Priority 4: Junk (17,450)
- **Action**: Stop outreach
- **Score**: <20

## V1 vs V2 Comparison

| Metric | V1 | V2 | Improvement |
|--------|----|----|-------------|
| Hot Leads | 0 | **13** | +13 |
| High-Value Leads | 29 | **1,515** | **52x** |
| Score Range | 28.9 pts | **78.7 pts** | **2.7x** |
| Precision@Top10% | N/A | **3.34%** | NEW |

## What's New in V2

✅ **Fixed data leakage** (removed "Enrolled" status)  
✅ **Timeline features** (response speed, decay)  
✅ **NLP objections** (price, time, intent)  
✅ **Hybrid scoring** (70% ML + 30% rules)  
✅ **Time-based validation** (real-world accuracy)  
✅ **Class weighting** (handles 0.71% imbalance)  
✅ **Drift detection** (monitors model health)  
✅ **Model versioning** (rollback capability)

## Troubleshooting

### Pipeline Fails
```bash
# Check environment
python --version  # Should be 3.13

# Check dependencies
pip list | grep catboost  # Should be 1.2.8

# Check data
ls -lh ../data/processed/
```

### No Hot Leads
- **Expected**: V2 is conservative (better than V1's overfitting)
- **Check**: Review `top_leads_v2.csv` instead
- **Action**: Adjust thresholds if needed (edit line 268 in `06_score_leads_v2.py`)

### Different Results
- **Normal**: Model uses random seed but results should be similar
- **Check**: Compare ROC-AUC (should be ~0.96)

## Next Steps

1. **Test**: Call the 13 hot leads and track results
2. **Monitor**: Run weekly to detect drift
3. **Improve**: Use error analysis to enhance V3

## Support

**Documentation**: `PRODUCTION_UPGRADE_SUMMARY.md`  
**Comparison**: Run `python compare_versions.py`  
**Model Info**: Check `models/model_metadata_v2_*.json`

---

**Last Updated**: December 24, 2025  
**Model Version**: V2  
**Status**: ✅ Production Ready
