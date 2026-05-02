"""
V1 vs V2 Comparison Analysis
Compare baseline model with production-grade improvements
"""

import pandas as pd
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns

# Load both versions
v1_scored = pd.read_csv("../outputs/leads_scored.csv")
v2_scored = pd.read_csv("../outputs/leads_scored_v2.csv")

print("="*70)
print("🔬 V1 vs V2 COMPARISON ANALYSIS")
print("="*70)

# ============================================================================
# SCORING DISTRIBUTION COMPARISON
# ============================================================================

print("\n📊 SCORE DISTRIBUTION:")
print(f"\n{'Metric':<30} {'V1 (Baseline)':<20} {'V2 (Production)':<20}")
print("-" * 70)

print(f"{'Avg Score':<30} {v1_scored['ai_score'].mean():<20.1f} {v2_scored['ai_score'].mean():<20.1f}")
print(f"{'Min Score':<30} {v1_scored['ai_score'].min():<20.1f} {v2_scored['ai_score'].min():<20.1f}")
print(f"{'Max Score':<30} {v1_scored['ai_score'].max():<20.1f} {v2_scored['ai_score'].max():<20.1f}")
print(f"{'Std Dev':<30} {v1_scored['ai_score'].std():<20.1f} {v2_scored['ai_score'].std():<20.1f}")

# ============================================================================
# SEGMENT DISTRIBUTION COMPARISON
# ============================================================================

print("\n📊 SEGMENT DISTRIBUTION:")
print(f"\n{'Segment':<15} {'V1 Count':<15} {'V1 %':<10} {'V2 Count':<15} {'V2 %':<10}")
print("-" * 70)

v1_segments = v1_scored['ai_segment'].value_counts()
v2_segments = v2_scored['ai_segment'].value_counts()

for segment in ['Hot', 'Warm', 'Cold', 'Junk']:
    v1_count = v1_segments.get(segment, 0)
    v2_count = v2_segments.get(segment, 0)
    v1_pct = (v1_count / len(v1_scored)) * 100
    v2_pct = (v2_count / len(v2_scored)) * 100
    print(f"{segment:<15} {v1_count:<15,} {v1_pct:<10.1f}% {v2_count:<15,} {v2_pct:<10.1f}%")

# ============================================================================
# KEY IMPROVEMENTS
# ============================================================================

hot_v1 = v1_segments.get('Hot', 0)
hot_v2 = v2_segments.get('Hot', 0)
warm_v1 = v1_segments.get('Warm', 0)
warm_v2 = v2_segments.get('Warm', 0)

high_value_v1 = hot_v1 + warm_v1
high_value_v2 = hot_v2 + warm_v2

print(f"\n🎯 HIGH-VALUE LEADS COMPARISON:")
print(f"   V1: {high_value_v1:,} high-value leads ({(high_value_v1/len(v1_scored)*100):.1f}%)")
print(f"   V2: {high_value_v2:,} high-value leads ({(high_value_v2/len(v2_scored)*100):.1f}%)")
print(f"   Improvement: {high_value_v2 - high_value_v1:+,} leads")

# ============================================================================
# ACTIONABILITY ANALYSIS
# ============================================================================

print(f"\n📞 ACTIONABILITY:")
print(f"   V1 Hot Leads (immediate calls): {hot_v1:,}")
print(f"   V2 Hot Leads (immediate calls): {hot_v2:,}")
print(f"   Improvement: {hot_v2 - hot_v1:+,} hot leads identified")

# ============================================================================
# SCORE SPREAD ANALYSIS
# ============================================================================

print(f"\n📈 SCORE DISCRIMINATION (better models have wider spread):")
v1_range = v1_scored['ai_score'].max() - v1_scored['ai_score'].min()
v2_range = v2_scored['ai_score'].max() - v2_scored['ai_score'].min()

print(f"   V1 Score Range: {v1_range:.1f} points")
print(f"   V2 Score Range: {v2_range:.1f} points")
print(f"   Improvement: {v2_range - v1_range:+.1f} points (better discrimination)")

# ============================================================================
# VISUALIZATION
# ============================================================================

fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# Plot 1: Score Distribution
axes[0, 0].hist([v1_scored['ai_score'], v2_scored['ai_score']], 
                bins=30, label=['V1', 'V2'], alpha=0.7)
axes[0, 0].set_xlabel('AI Score')
axes[0, 0].set_ylabel('Count')
axes[0, 0].set_title('Score Distribution Comparison')
axes[0, 0].legend()
axes[0, 0].grid(True, alpha=0.3)

# Plot 2: Segment Distribution
segments = ['Hot', 'Warm', 'Cold', 'Junk']
v1_counts = [v1_segments.get(s, 0) for s in segments]
v2_counts = [v2_segments.get(s, 0) for s in segments]

x = np.arange(len(segments))
width = 0.35

axes[0, 1].bar(x - width/2, v1_counts, width, label='V1', alpha=0.8)
axes[0, 1].bar(x + width/2, v2_counts, width, label='V2', alpha=0.8)
axes[0, 1].set_xlabel('Segment')
axes[0, 1].set_ylabel('Lead Count')
axes[0, 1].set_title('Segment Distribution Comparison')
axes[0, 1].set_xticks(x)
axes[0, 1].set_xticklabels(segments)
axes[0, 1].legend()
axes[0, 1].grid(True, alpha=0.3, axis='y')

# Plot 3: Cumulative Distribution
axes[1, 0].hist([v1_scored['ai_score'], v2_scored['ai_score']], 
                bins=50, cumulative=True, histtype='step', 
                label=['V1', 'V2'], linewidth=2)
axes[1, 0].set_xlabel('AI Score')
axes[1, 0].set_ylabel('Cumulative Count')
axes[1, 0].set_title('Cumulative Score Distribution')
axes[1, 0].legend()
axes[1, 0].grid(True, alpha=0.3)

# Plot 4: Box Plot
axes[1, 1].boxplot([v1_scored['ai_score'], v2_scored['ai_score']], 
                    labels=['V1', 'V2'])
axes[1, 1].set_ylabel('AI Score')
axes[1, 1].set_title('Score Distribution (Box Plot)')
axes[1, 1].grid(True, alpha=0.3, axis='y')

plt.tight_layout()
plt.savefig('../outputs/v1_vs_v2_comparison.png', dpi=300, bbox_inches='tight')
print(f"\n✅ Saved comparison visualization: v1_vs_v2_comparison.png")

# ============================================================================
# KEY METRICS SUMMARY
# ============================================================================

print("\n" + "="*70)
print("🎯 KEY IMPROVEMENTS IN V2:")
print("="*70)

print("\n✅ Data Quality:")
print(f"   - Fixed data leakage (removed 'Enrolled' status)")
print(f"   - Time-based train/test split (real-world accuracy)")
print(f"   - Score discrimination: {v2_range:.1f} vs {v1_range:.1f} points")

print("\n✅ Feature Engineering:")
print(f"   - Timeline features (first_response_hours, response_decay)")
print(f"   - NLP objection classification (price, time, intent)")
print(f"   - Source+Course cross features")
print(f"   - Intent confidence scoring")

print("\n✅ Model Quality:")
print(f"   - Class weighting (handles 0.71% conversion rate)")
print(f"   - Business metrics (Precision@Top10%)")
print(f"   - Error analysis (saved false positives)")
print(f"   - Model versioning")

print("\n✅ Scoring System:")
print(f"   - Hybrid ML+Rules (70% ML + 30% Business Logic)")
print(f"   - Drift detection monitoring")
print(f"   - Enhanced engagement scoring")

print("\n✅ Business Impact:")
print(f"   - Hot leads: {hot_v1} → {hot_v2} ({hot_v2-hot_v1:+})")
print(f"   - Total high-value: {high_value_v1:,} → {high_value_v2:,} ({high_value_v2-high_value_v1:+,})")
print(f"   - Better lead prioritization with wider score range")

print("\n" + "="*70)
print("✅ ANALYSIS COMPLETE")
print("="*70)
print("\n📁 Files generated:")
print("   - v1_vs_v2_comparison.png")
print("   - This terminal output")
