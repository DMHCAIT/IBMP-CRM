"""
Script 5: Train AI Model (CORE ML)
Train CatBoost model for lead conversion prediction
📊 Evaluated using Precision, Recall, ROC-AUC (not just accuracy)
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    classification_report, 
    roc_auc_score, 
    confusion_matrix,
    precision_recall_curve,
    precision_score,
    recall_score,
    f1_score
)
from catboost import CatBoostClassifier, Pool
import joblib
import matplotlib.pyplot as plt
import seaborn as sns

# Paths
INPUT_PATH = Path("../data/processed/leads_labeled.csv")
MODEL_PATH = Path("../models/lead_conversion_model.cbm")  # CatBoost format
MODEL_PKL_PATH = Path("../models/lead_conversion_model.pkl")  # Pickle backup
OUTPUT_PATH = Path("../outputs/")

def load_data():
    """Load labeled data"""
    df = pd.read_csv(INPUT_PATH)
    print(f"✅ Loaded {len(df):,} rows with {len(df.columns)} columns")
    return df

def prepare_features(df):
    """Prepare features for CatBoost modeling"""
    print("\n--- Preparing Features for CatBoost ---")
    
    # Define target
    target = 'converted'
    
    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found!")
    
    # Exclude non-feature columns
    exclude_cols = [
        target, 
        'lead_tier',
        'id',  # Don't use ID as feature
        'fullName',
        'email',
        'phone',
        'notes'  # Already parsed
    ]
    
    # Exclude date columns (already converted to numeric features)
    exclude_cols += [col for col in df.columns if 'date' in col.lower() and df[col].dtype == 'object']
    exclude_cols += [col for col in df.columns if col.endswith('_at') and df[col].dtype == 'object']
    
    # Get feature columns
    feature_cols = [col for col in df.columns if col not in exclude_cols]
    
    # Identify categorical features for CatBoost
    categorical_features = []
    for col in feature_cols:
        if df[col].dtype == 'object' or (df[col].dtype in ['int64', 'int32'] and df[col].nunique() < 50):
            categorical_features.append(col)
    
    print(f"✅ Total features: {len(feature_cols)}")
    print(f"✅ Categorical features: {len(categorical_features)}")
    
    X = df[feature_cols].copy()
    y = df[target].copy()
    
    # Fill missing values
    for col in X.columns:
        if X[col].dtype == 'object':
            X[col] = X[col].fillna('Unknown')
        else:
            X[col] = X[col].fillna(X[col].median())
    
    return X, y, feature_cols, categorical_features

def train_model(X, y, categorical_features):
    """
    Train CatBoost model
    Why CatBoost?
    - Handles categorical data automatically
    - Handles noisy CRM data well
    - Minimal preprocessing required
    - Built-in regularization
    """
    print("\n" + "="*60)
    print("🤖 TRAINING CATBOOST MODEL")
    print("="*60)
    
    # Split data with stratification
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\n📊 Data Split:")
    print(f"   Training set: {len(X_train):,} samples ({len(X_train)/len(X)*100:.1f}%)")
    print(f"   Test set: {len(X_test):,} samples ({len(X_test)/len(X)*100:.1f}%)")
    print(f"\n   Train conversions: {y_train.sum():,} ({y_train.mean():.2%})")
    print(f"   Test conversions: {y_test.sum():,} ({y_test.mean():.2%})")
    
    # Create CatBoost Pool objects
    train_pool = Pool(
        X_train, 
        y_train,
        cat_features=categorical_features
    )
    
    test_pool = Pool(
        X_test,
        y_test,
        cat_features=categorical_features
    )
    
    # Initialize CatBoost with optimized parameters
    print(f"\n⚙️ Model Configuration:")
    model = CatBoostClassifier(
        iterations=1000,
        learning_rate=0.05,
        depth=6,
        l2_leaf_reg=3,
        border_count=128,
        random_seed=42,
        eval_metric='AUC',
        verbose=100,
        early_stopping_rounds=50,
        use_best_model=True,
        task_type='CPU'
    )
    
    # Train the model
    print(f"\n🎯 Training model...")
    model.fit(
        train_pool,
        eval_set=test_pool,
        plot=False
    )
    
    print(f"\n✅ Model training completed!")
    print(f"   Best iteration: {model.best_iteration_}")
    print(f"   Best score: {model.best_score_['validation']['AUC']:.4f}")
    
    return model, X_train, X_test, y_train, y_test

def evaluate_model(model, X_test, y_test, feature_cols):
    """
    Evaluate model using Precision, Recall, ROC-AUC
    (Not just accuracy - as requested)
    """
    print("\n" + "="*60)
    print("📊 MODEL EVALUATION")
    print("="*60)
    
    # Predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # Calculate metrics (NOT just accuracy!)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    
    print(f"\n🎯 KEY METRICS (Production-Ready):")
    print(f"   Precision: {precision:.4f} (How many predicted conversions are correct)")
    print(f"   Recall:    {recall:.4f} (How many actual conversions we catch)")
    print(f"   F1 Score:  {f1:.4f} (Balance of precision & recall)")
    print(f"   ROC-AUC:   {roc_auc:.4f} (Overall ranking quality)")
    
    # Detailed classification report
    print(f"\n📋 Detailed Classification Report:")
    print(classification_report(y_test, y_pred, target_names=['Not Converted', 'Converted']))
    
    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()
    
    print(f"\n📊 Confusion Matrix Breakdown:")
    print(f"   True Negatives:  {tn:,} (Correctly identified non-conversions)")
    print(f"   False Positives: {fp:,} (False alarms)")
    print(f"   False Negatives: {fn:,} (Missed conversions)")
    print(f"   True Positives:  {tp:,} (Correctly identified conversions)")
    
    # Plot confusion matrix
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=['Not Converted', 'Converted'],
                yticklabels=['Not Converted', 'Converted'])
    plt.title('Confusion Matrix')
    plt.ylabel('Actual')
    plt.xlabel('Predicted')
    plt.tight_layout()
    plt.savefig(OUTPUT_PATH / 'confusion_matrix.png', dpi=300)
    plt.close()
    print(f"✅ Saved confusion matrix to {OUTPUT_PATH / 'confusion_matrix.png'}")
    
    # Precision-Recall curve
    precision_vals, recall_vals, _ = precision_recall_curve(y_test, y_pred_proba)
    plt.figure(figsize=(8, 6))
    plt.plot(recall_vals, precision_vals, marker='.', label=f'PR Curve (AUC={roc_auc:.3f})')
    plt.xlabel('Recall')
    plt.ylabel('Precision')
    plt.title('Precision-Recall Curve')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig(OUTPUT_PATH / 'precision_recall_curve.png', dpi=300)
    plt.close()
    print(f"✅ Saved PR curve to {OUTPUT_PATH / 'precision_recall_curve.png'}")
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    plt.figure(figsize=(10, 8))
    top_features = feature_importance.head(20)
    sns.barplot(data=top_features, x='importance', y='feature', palette='viridis')
    plt.title('Top 20 Feature Importance')
    plt.xlabel('Importance Score')
    plt.tight_layout()
    plt.savefig(OUTPUT_PATH / 'feature_importance.png', dpi=300)
    plt.close()
    print(f"✅ Saved feature importance to {OUTPUT_PATH / 'feature_importance.png'}")
    
    # Save feature importance data
    feature_importance.to_csv(OUTPUT_PATH / 'feature_importance.csv', index=False)
    print(f"✅ Saved feature importance data")
    
    # Save metrics summary
    metrics_summary = {
        'precision': precision,
        'recall': recall,
        'f1_score': f1,
        'roc_auc': roc_auc,
        'true_positives': int(tp),
        'true_negatives': int(tn),
        'false_positives': int(fp),
        'false_negatives': int(fn),
        'test_samples': len(y_test)
    }
    pd.DataFrame([metrics_summary]).to_csv(OUTPUT_PATH / 'model_metrics.csv', index=False)
    print(f"✅ Saved metrics summary")
    
    return roc_auc, precision, recall, feature_importance

def save_model(model):
    """Save trained model in CatBoost and pickle formats"""
    print("\n--- Saving Model ---")
    
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # Save in CatBoost native format (.cbm)
    model.save_model(MODEL_PATH)
    print(f"✅ Model saved (CatBoost format): {MODEL_PATH}")
    
    # Also save as pickle for compatibility
    joblib.dump(model, MODEL_PKL_PATH)
    print(f"✅ Model saved (Pickle format): {MODEL_PKL_PATH}")

if __name__ == "__main__":
    print("="*60)
    print("🚀 ADVANCED AI LEAD SYSTEM - MODEL TRAINING")
    print("="*60)
    
    # Create output directory
    OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
    
    # Load data
    df = load_data()
    
    # Prepare features
    X, y, feature_cols, categorical_features = prepare_features(df)
    
    # Train model
    model, X_train, X_test, y_train, y_test = train_model(X, y, categorical_features)
    
    # Evaluate (using Precision, Recall, ROC-AUC)
    roc_auc, precision, recall, feature_importance = evaluate_model(model, X_test, y_test, feature_cols)
    
    # Save model
    save_model(model)
    
    print("\n" + "="*60)
    print("✅ MODEL TRAINING COMPLETE!")
    print("="*60)
    print(f"\n📊 Final Performance:")
    print(f"   ROC-AUC:   {roc_auc:.4f}")
    print(f"   Precision: {precision:.4f}")
    print(f"   Recall:    {recall:.4f}")
    print(f"\n📁 Outputs saved to: {OUTPUT_PATH}")
    print(f"   - Model: {MODEL_PATH}")
    print(f"   - Metrics: model_metrics.csv")
    print(f"   - Feature importance: feature_importance.png")
    print(f"   - Confusion matrix: confusion_matrix.png")
    print(f"\n🎯 Next step: Score all leads with 06_score_leads.py")
    print(f"\n🔍 Top 15 Most Important Features:")
    for idx, row in feature_importance.head(15).iterrows():
        print(f"   {row['feature']:30s} {row['importance']:6.2f}")
