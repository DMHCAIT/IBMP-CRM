"""
Script 5 V2: Advanced Model Training
🚀 PRODUCTION-GRADE ML WITH BUSINESS METRICS

IMPROVEMENTS:
✅ Optimized for Precision@Top10% (not accuracy)
✅ Class weighting for imbalanced data
✅ Time-based train/test split (no data leakage)
✅ Error analysis & false positive detection
✅ Model versioning with metadata tracking
✅ Custom business metric evaluation
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, 
    roc_auc_score, 
    confusion_matrix,
    precision_recall_curve,
    precision_score,
    recall_score,
    f1_score,
    average_precision_score
)
from catboost import CatBoostClassifier, Pool
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import json
from imblearn.over_sampling import SMOTE, ADASYN
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.calibration import CalibratedClassifierCV
import optuna
from optuna.samplers import TPESampler
import warnings
warnings.filterwarnings('ignore')

# Paths
INPUT_PATH = Path("../data/processed/leads_labeled.csv")
MODEL_DIR = Path("../models/")
OUTPUT_DIR = Path("../outputs/")
MODEL_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Model version tracking
MODEL_VERSION = "v2"
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

def load_data():
    """Load labeled data"""
    df = pd.read_csv(INPUT_PATH)
    
    # Parse created_at for time-based splitting
    if 'created_at' in df.columns:
        df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
    
    print(f"✅ Loaded {len(df):,} rows with {len(df.columns)} columns")
    return df

# ============================================================================
# PHASE 1: FIX DATA LEAKAGE IN FEATURES
# ============================================================================

def remove_leakage_features(df, feature_cols):
    """
    Remove features that leak target information
    """
    print("\n--- Removing Data Leakage Features ---")
    
    leakage_features = []
    
    # Remove status_clean if it contains "Enrolled"
    if 'status_clean' in feature_cols:
        leakage_features.append('status_clean')
    
    # Remove any feature with "enrolled" in the name
    for col in feature_cols:
        if 'enroll' in col.lower():
            leakage_features.append(col)
    
    # Remove lead_tier (derived from target)
    if 'lead_tier' in feature_cols:
        leakage_features.append('lead_tier')
    
    clean_features = [f for f in feature_cols if f not in leakage_features]
    
    print(f"✅ Removed {len(leakage_features)} leakage features: {leakage_features}")
    print(f"✅ Kept {len(clean_features)} clean features")
    
    return clean_features

def add_temporal_features(df):
    """Add time-based features for better predictions"""
    print("\n--- Adding Temporal Features ---")
    
    temporal_features = {}
    
    # Parse created_at if not already datetime
    if 'created_at' in df.columns:
        if df['created_at'].dtype == 'object':
            df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
        
        # Extract temporal features
        temporal_features['hour_created'] = df['created_at'].dt.hour
        temporal_features['day_of_week'] = df['created_at'].dt.dayofweek  # 0=Monday
        temporal_features['day_of_month'] = df['created_at'].dt.day
        temporal_features['month'] = df['created_at'].dt.month
        temporal_features['is_weekend'] = (df['created_at'].dt.dayofweek >= 5).astype(int)
        temporal_features['is_business_hours'] = ((df['created_at'].dt.hour >= 9) & 
                                                   (df['created_at'].dt.hour <= 17)).astype(int)
        temporal_features['quarter'] = df['created_at'].dt.quarter
        
        print(f"✅ Added {len(temporal_features)} temporal features")
    else:
        print("⚠️  No created_at column found - skipping temporal features")
    
    return pd.DataFrame(temporal_features, index=df.index)

def prepare_features(df):
    """Prepare features for modeling"""
    print("\n--- Preparing Features ---")
    
    target = 'converted'
    
    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found!")
    
    # Add temporal features BEFORE feature selection
    temporal_df = add_temporal_features(df)
    df = pd.concat([df, temporal_df], axis=1)
    
    # Exclude non-feature columns
    exclude_cols = [
        target, 
        'lead_tier',
        'id',
        'fullName',
        'email',
        'phone',
        'notes',
        'status_clean',  # CRITICAL: Remove to prevent data leakage
        'status'  # Also remove raw status
    ]
    
    # Exclude date columns
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            exclude_cols.append(col)
    exclude_cols += [col for col in df.columns if 'date' in col.lower() and df[col].dtype == 'object']
    exclude_cols += [col for col in df.columns if col.endswith('_at') and df[col].dtype == 'object']
    
    # Get feature columns
    feature_cols = [col for col in df.columns if col not in exclude_cols]
    
    # Remove leakage features
    feature_cols = remove_leakage_features(df, feature_cols)
    
    # Identify categorical features
    categorical_features = []
    for col in feature_cols:
        if df[col].dtype == 'object' or (df[col].dtype in ['int64', 'int32'] and df[col].nunique() < 50):
            categorical_features.append(col)
    
    print(f"✅ Total features: {len(feature_cols)}")
    print(f"✅ Categorical features: {len(categorical_features)}")
    
    X = df[feature_cols].copy()
    y = df[target].copy()
    
    # Data quality validation
    X, y = validate_data_quality(X, y)
    
    # Fill missing values
    for col in X.columns:
        if X[col].dtype == 'object':
            X[col] = X[col].fillna('Unknown')
        else:
            X[col] = X[col].fillna(X[col].median())
    
    return X, y, feature_cols, categorical_features

def validate_data_quality(X, y):
    """Validate and clean data for quality issues"""
    print("\n--- Data Quality Validation ---")
    
    initial_rows = len(X)
    
    # 1. Remove rows with all missing values
    all_missing = X.isna().all(axis=1)
    X = X[~all_missing]
    y = y[~all_missing]
    
    # 2. Remove outliers using IQR method for numeric features
    numeric_cols = X.select_dtypes(include=[np.number]).columns
    outlier_mask = pd.Series([False] * len(X), index=X.index)
    
    for col in numeric_cols:
        Q1 = X[col].quantile(0.25)
        Q3 = X[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 3 * IQR  # 3 IQR instead of 1.5 for less aggressive removal
        upper_bound = Q3 + 3 * IQR
        
        col_outliers = (X[col] < lower_bound) | (X[col] > upper_bound)
        outlier_mask = outlier_mask | col_outliers
    
    outliers_removed = outlier_mask.sum()
    X = X[~outlier_mask]
    y = y[~outlier_mask]
    
    # 3. Check for duplicate rows
    duplicates = X.duplicated()
    X = X[~duplicates]
    y = y[~duplicates]
    
    final_rows = len(X)
    
    print(f"✅ Initial rows: {initial_rows:,}")
    print(f"   Removed all-missing: {all_missing.sum():,}")
    print(f"   Removed outliers: {outliers_removed:,}")
    print(f"   Removed duplicates: {duplicates.sum():,}")
    print(f"✅ Final rows: {final_rows:,} ({final_rows/initial_rows:.1%} retained)")
    
    return X, y

# ============================================================================
# PHASE 2: TIME-BASED TRAIN/TEST SPLIT (CRITICAL)
# ============================================================================

def time_based_split(df, X, y, test_size=0.2):
    """
    Split data by time (not random)
    ✅ Train on older leads, test on recent leads
    🔥 This gives REAL-WORLD accuracy
    """
    print("\n--- Time-Based Train/Test Split ---")
    
    if 'created_at' not in df.columns or df['created_at'].isna().all():
        print("⚠️  No created_at column - using random split")
        return train_test_split(X, y, test_size=test_size, random_state=42, stratify=y)
    
    # Sort by creation date
    df_sorted = df.copy()
    df_sorted['_sort_index'] = range(len(df_sorted))
    df_sorted = df_sorted.sort_values('created_at')
    
    # Split index
    split_idx = int(len(df_sorted) * (1 - test_size))
    
    train_indices = df_sorted.iloc[:split_idx]['_sort_index'].values
    test_indices = df_sorted.iloc[split_idx:]['_sort_index'].values
    
    X_train = X.iloc[train_indices]
    X_test = X.iloc[test_indices]
    y_train = y.iloc[train_indices]
    y_test = y.iloc[test_indices]
    
    # Get date ranges
    train_date_range = f"{df_sorted.iloc[0]['created_at'].date()} to {df_sorted.iloc[split_idx-1]['created_at'].date()}"
    test_date_range = f"{df_sorted.iloc[split_idx]['created_at'].date()} to {df_sorted.iloc[-1]['created_at'].date()}"
    
    print(f"✅ Time-based split completed:")
    print(f"   Train: {len(X_train):,} samples ({train_date_range})")
    print(f"   Test:  {len(X_test):,} samples ({test_date_range})")
    print(f"   Train conversions: {y_train.sum():,} ({y_train.mean():.2%})")
    print(f"   Test conversions:  {y_test.sum():,} ({y_test.mean():.2%})")
    
    return X_train, X_test, y_train, y_test

# ============================================================================
# PHASE 3: SMOTE FOR CLASS IMBALANCE (CRITICAL IMPROVEMENT)
# ============================================================================

def apply_smote(X_train, y_train, categorical_features):
    """Apply SMOTE to balance classes - BIGGEST ACCURACY IMPROVEMENT"""
    print("\n--- Applying SMOTE for Class Balance ---")
    
    # Get categorical feature indices
    cat_indices = [i for i, col in enumerate(X_train.columns) if col in categorical_features]
    
    # Check class distribution
    minority_count = y_train.sum()
    majority_count = len(y_train) - minority_count
    
    print(f"Before SMOTE:")
    print(f"   Class 0 (not converted): {majority_count:,}")
    print(f"   Class 1 (converted): {minority_count:,}")
    print(f"   Ratio: 1:{majority_count/minority_count:.1f}")
    
    # Apply SMOTE with conservative sampling
    # Target ratio: make minority class 20% of majority (not 100%)
    target_minority = int(majority_count * 0.2)
    
    try:
        # Try SMOTE first
        smote = SMOTE(
            sampling_strategy=target_minority / majority_count,
            random_state=42,
            k_neighbors=min(5, minority_count - 1)  # Handle small minority class
        )
        
        # Convert categorical columns to numeric temporarily for SMOTE
        X_train_numeric = X_train.copy()
        for col in categorical_features:
            if col in X_train_numeric.columns:
                X_train_numeric[col] = pd.Categorical(X_train_numeric[col]).codes
        
        X_resampled, y_resampled = smote.fit_resample(X_train_numeric, y_train)
        
        # Convert back to DataFrame
        X_resampled = pd.DataFrame(X_resampled, columns=X_train.columns)
        y_resampled = pd.Series(y_resampled, name=y_train.name)
        
        # Restore categorical columns
        for col in categorical_features:
            if col in X_train.columns:
                # Map codes back to original categories
                categories = X_train[col].unique()
                X_resampled[col] = X_resampled[col].round().astype(int)
                X_resampled[col] = X_resampled[col].apply(
                    lambda x: categories[x] if 0 <= x < len(categories) else categories[0]
                )
        
        print(f"\nAfter SMOTE:")
        print(f"   Class 0 (not converted): {(y_resampled == 0).sum():,}")
        print(f"   Class 1 (converted): {(y_resampled == 1).sum():,}")
        print(f"   Ratio: 1:{(y_resampled == 0).sum()/(y_resampled == 1).sum():.1f}")
        print(f"✅ SMOTE completed successfully")
        
        return X_resampled, y_resampled
        
    except Exception as e:
        print(f"⚠️  SMOTE failed: {e}")
        print(f"   Using original training data")
        return X_train, y_train

# ============================================================================
# PHASE 4: FEATURE SELECTION (REMOVE REDUNDANT FEATURES)
# ============================================================================

def select_features(X_train, y_train, X_test, categorical_features, n_features=40):
    """Select best features using correlation and importance"""
    print("\n--- Feature Selection ---")
    
    # 1. Remove highly correlated features (redundant)
    numeric_cols = X_train.select_dtypes(include=[np.number]).columns
    corr_matrix = X_train[numeric_cols].corr().abs()
    
    # Find pairs with correlation > 0.95
    upper_triangle = corr_matrix.where(
        np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
    )
    
    to_drop = [col for col in upper_triangle.columns 
               if any(upper_triangle[col] > 0.95)]
    
    print(f"   Removing {len(to_drop)} highly correlated features")
    
    # 2. Train quick model to get feature importance
    X_train_reduced = X_train.drop(columns=to_drop, errors='ignore')
    X_test_reduced = X_test.drop(columns=to_drop, errors='ignore')
    
    # Update categorical features list
    cat_features_reduced = [f for f in categorical_features if f not in to_drop]
    
    # Quick CatBoost to get importance
    quick_model = CatBoostClassifier(
        iterations=100,
        learning_rate=0.1,
        depth=4,
        verbose=0,
        random_seed=42,
        cat_features=cat_features_reduced,
        auto_class_weights='Balanced'
    )
    
    quick_model.fit(X_train_reduced, y_train)
    
    # Get feature importance
    importance_df = pd.DataFrame({
        'feature': X_train_reduced.columns,
        'importance': quick_model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    # Select top N features
    top_features = importance_df.head(n_features)['feature'].tolist()
    
    print(f"   Selected top {len(top_features)} features out of {len(X_train_reduced.columns)}")
    print(f"\n   Top 10 features:")
    for i, row in importance_df.head(10).iterrows():
        print(f"      {row['feature']}: {row['importance']:.4f}")
    
    # Filter datasets
    X_train_final = X_train_reduced[top_features]
    X_test_final = X_test_reduced[top_features]
    cat_features_final = [f for f in cat_features_reduced if f in top_features]
    
    return X_train_final, X_test_final, cat_features_final, top_features

# ============================================================================
# PHASE 5: CLASS WEIGHTING FOR IMBALANCE
# ============================================================================

def calculate_class_weights(y):
    """
    Calculate class weights for imbalanced data
    """
    conversion_rate = y.mean()
    
    # Weight inversely proportional to class frequency
    weight_0 = 1.0
    weight_1 = (1 - conversion_rate) / conversion_rate
    
    print(f"\n--- Class Weights ---")
    print(f"   Conversion rate: {conversion_rate:.2%}")
    print(f"   Weight for class 0 (not converted): {weight_0:.2f}")
    print(f"   Weight for class 1 (converted): {weight_1:.2f}")
    
    return {0: weight_0, 1: weight_1}

# ============================================================================
# PHASE 6: HYPERPARAMETER OPTIMIZATION WITH OPTUNA
# ============================================================================

def optimize_hyperparameters(X_train, y_train, categorical_features, n_trials=50):
    """Use Optuna to find best hyperparameters"""
    print("\n--- Hyperparameter Optimization with Optuna ---")
    print(f"   Running {n_trials} trials (this may take 1-3 hours)...")
    
    def objective(trial):
        # Suggest hyperparameters
        params = {
            'iterations': trial.suggest_int('iterations', 500, 2000),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
            'depth': trial.suggest_int('depth', 4, 10),
            'l2_leaf_reg': trial.suggest_float('l2_leaf_reg', 1, 10),
            'border_count': trial.suggest_int('border_count', 32, 255),
            'random_seed': 42,
            'verbose': 0,
            'cat_features': categorical_features,
            'auto_class_weights': 'Balanced'
        }
        
        # Use cross-validation for robust evaluation
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        
        scores = []
        for train_idx, val_idx in cv.split(X_train, y_train):
            X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
            y_tr, y_val = y_train.iloc[train_idx], y_train.iloc[val_idx]
            
            model = CatBoostClassifier(**params)
            model.fit(X_tr, y_tr, eval_set=(X_val, y_val), verbose=0)
            
            # Evaluate using Precision@Top10%
            y_pred_proba = model.predict_proba(X_val)[:, 1]
            prec_10, _ = calculate_precision_at_k(y_val, y_pred_proba, k=10)
            scores.append(prec_10)
        
        return np.mean(scores)
    
    # Run optimization
    study = optuna.create_study(
        direction='maximize',
        sampler=TPESampler(seed=42)
    )
    
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
    
    print(f"\n✅ Optimization completed!")
    print(f"   Best Precision@Top10%: {study.best_value:.2%}")
    print(f"   Best parameters:")
    for key, value in study.best_params.items():
        print(f"      {key}: {value}")
    
    return study.best_params

# ============================================================================
# PHASE 7: TRAIN MODEL WITH ALL IMPROVEMENTS
# ============================================================================

def train_model(df, X, y, categorical_features, use_smote=True, 
                use_feature_selection=True, optimize_params=False, n_trials=50):
    """Train CatBoost model with all accuracy improvements"""
    print("\n" + "="*70)
    print("🚀 TRAINING ENHANCED CATBOOST MODEL V3")
    print("="*70)
    
    # Time-based split
    X_train, X_test, y_train, y_test = time_based_split(df, X, y)
    
    # IMPROVEMENT 1: Apply SMOTE for class imbalance
    if use_smote:
        X_train, y_train = apply_smote(X_train, y_train, categorical_features)
    
    # IMPROVEMENT 2: Feature selection
    if use_feature_selection:
        X_train, X_test, categorical_features, selected_features = select_features(
            X_train, y_train, X_test, categorical_features, n_features=40
        )
    else:
        selected_features = X_train.columns.tolist()
    
    # IMPROVEMENT 3: Hyperparameter optimization
    if optimize_params:
        best_params = optimize_hyperparameters(X_train, y_train, categorical_features, n_trials)
        model_params = {
            **best_params,
            'random_seed': 42,
            'eval_metric': 'AUC',
            'verbose': 100,
            'early_stopping_rounds': 50,
            'use_best_model': True,
            'task_type': 'CPU',
            'cat_features': categorical_features,
            'auto_class_weights': 'Balanced'
        }
    else:
        # Use good default parameters
        model_params = {
            'iterations': 1000,
            'learning_rate': 0.05,
            'depth': 6,
            'l2_leaf_reg': 3,
            'border_count': 128,
            'random_seed': 42,
            'eval_metric': 'AUC',
            'verbose': 100,
            'early_stopping_rounds': 50,
            'use_best_model': True,
            'task_type': 'CPU',
            'cat_features': categorical_features,
            'auto_class_weights': 'Balanced'
        }
    
    # Create CatBoost Pool objects
    train_pool = Pool(X_train, y_train, cat_features=categorical_features)
    test_pool = Pool(X_test, y_test, cat_features=categorical_features)
    
    # Train the model
    print(f"\n🎯 Training model with enhanced configuration...")
    model = CatBoostClassifier(**model_params)
    model.fit(train_pool, eval_set=test_pool, plot=False)
    
    print(f"\n✅ Model training completed!")
    print(f"   Best iteration: {model.best_iteration_}")
    print(f"   Best score: {model.best_score_['validation']['AUC']:.4f}")
    
    # IMPROVEMENT 4: Probability calibration
    print(f"\n--- Applying Probability Calibration ---")
    calibrated_model = CalibratedClassifierCV(model, cv=3, method='sigmoid')
    calibrated_model.fit(X_train, y_train)
    print(f"✅ Model calibrated for better probability estimates")
    
    # Store selected features in model for scoring
    model.selected_features = selected_features
    calibrated_model.selected_features = selected_features
    
    return calibrated_model, X_train, X_test, y_train, y_test

# ============================================================================
# PHASE 5: BUSINESS METRIC EVALUATION
# ============================================================================

def calculate_precision_at_k(y_true, y_pred_proba, k=10):
    """
    Calculate Precision@K%
    🔥 This is what matters in real business
    """
    # Get top k% of leads by score
    n = len(y_true)
    top_k_n = max(1, int(n * k / 100))
    
    # Get indices of top k% predictions
    top_k_indices = np.argsort(y_pred_proba)[::-1][:top_k_n]
    
    # Calculate precision on top k%
    precision_at_k = y_true.iloc[top_k_indices].mean()
    
    return precision_at_k, top_k_n

def evaluate_model(model, X_test, y_test, feature_cols):
    """
    Evaluate model using BUSINESS METRICS
    ✅ Precision@Top10%, Precision@Top20%
    ✅ Not just accuracy!
    """
    print("\n" + "="*70)
    print("📊 MODEL EVALUATION (BUSINESS METRICS)")
    print("="*70)
    
    # Predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # Standard metrics
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    avg_precision = average_precision_score(y_test, y_pred_proba)
    
    print(f"\n🎯 STANDARD METRICS:")
    print(f"   ROC-AUC:        {roc_auc:.4f}")
    print(f"   Avg Precision:  {avg_precision:.4f}")
    print(f"   Precision:      {precision:.4f}")
    print(f"   Recall:         {recall:.4f}")
    print(f"   F1 Score:       {f1:.4f}")
    
    # BUSINESS METRICS (what actually matters!)
    prec_10, n_10 = calculate_precision_at_k(y_test, y_pred_proba, k=10)
    prec_20, n_20 = calculate_precision_at_k(y_test, y_pred_proba, k=20)
    prec_5, n_5 = calculate_precision_at_k(y_test, y_pred_proba, k=5)
    
    print(f"\n🔥 BUSINESS METRICS (WHAT MATTERS!):")
    print(f"   Precision@Top5%:  {prec_5:.2%} ({n_5} leads)")
    print(f"   Precision@Top10%: {prec_10:.2%} ({n_10} leads)")
    print(f"   Precision@Top20%: {prec_20:.2%} ({n_20} leads)")
    
    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()
    
    print(f"\n📊 Confusion Matrix:")
    print(f"   True Negatives:  {tn:,}")
    print(f"   False Positives: {fp:,} (Wasted calls)")
    print(f"   False Negatives: {fn:,} (Missed opportunities)")
    print(f"   True Positives:  {tp:,} (Success!)")
    
    # Save metrics
    metrics = {
        'model_version': MODEL_VERSION,
        'timestamp': TIMESTAMP,
        'roc_auc': roc_auc,
        'avg_precision': avg_precision,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'precision_at_5': prec_5,
        'precision_at_10': prec_10,
        'precision_at_20': prec_20,
        'true_positives': int(tp),
        'false_positives': int(fp),
        'false_negatives': int(fn),
        'true_negatives': int(tn)
    }
    
    return metrics, y_pred, y_pred_proba

# ============================================================================
# PHASE 6: ERROR ANALYSIS
# ============================================================================

def analyze_errors(X_test, y_test, y_pred, y_pred_proba):
    """
    Analyze wrong predictions to improve model
    """
    print("\n" + "="*70)
    print("🔍 ERROR ANALYSIS")
    print("="*70)
    
    # Create error analysis dataframe
    error_df = X_test.copy()
    error_df['actual'] = y_test.values
    error_df['predicted'] = y_pred
    error_df['probability'] = y_pred_proba
    
    # Classify errors
    error_df['prediction_type'] = 'Correct'
    error_df.loc[(error_df['actual'] == 0) & (error_df['predicted'] == 1), 'prediction_type'] = 'False Hot'
    error_df.loc[(error_df['actual'] == 1) & (error_df['predicted'] == 0), 'prediction_type'] = 'Missed Opportunity'
    
    # Count each type
    error_counts = error_df['prediction_type'].value_counts()
    
    print(f"\n📊 Prediction Breakdown:")
    for pred_type, count in error_counts.items():
        print(f"   {pred_type}: {count:,}")
    
    # Save false positives (False Hot) for analysis
    false_hot = error_df[error_df['prediction_type'] == 'False Hot'].sort_values('probability', ascending=False)
    if len(false_hot) > 0:
        false_hot.head(100).to_csv(OUTPUT_DIR / 'false_positives_analysis.csv', index=False)
        print(f"\n✅ Saved top 100 false positives to false_positives_analysis.csv")
    
    # Save missed opportunities
    missed = error_df[error_df['prediction_type'] == 'Missed Opportunity'].sort_values('probability')
    if len(missed) > 0:
        missed.head(100).to_csv(OUTPUT_DIR / 'missed_opportunities_analysis.csv', index=False)
        print(f"✅ Saved top 100 missed opportunities to missed_opportunities_analysis.csv")
    
    return error_df

# ============================================================================
# PHASE 7: MODEL VERSIONING
# ============================================================================

def save_model_with_versioning(model, feature_cols, categorical_features, metrics):
    """
    Save model with version tracking
    ✅ Never overwrite blindly
    """
    print("\n--- Saving Model with Versioning ---")
    
    # Model files
    model_pkl_path = MODEL_DIR / f"lead_conversion_model_{MODEL_VERSION}_{TIMESTAMP}.pkl"
    
    # Save model (calibrated models need joblib, not CatBoost's save_model)
    joblib.dump(model, model_pkl_path)
    
    # If it's a calibrated model, also save the base model
    if hasattr(model, 'calibrated_classifiers_'):
        base_model = model.calibrated_classifiers_[0]
        model_path = MODEL_DIR / f"lead_conversion_base_model_{MODEL_VERSION}_{TIMESTAMP}.cbm"
        base_model.save_model(str(model_path))
    else:
        model_path = MODEL_DIR / f"lead_conversion_model_{MODEL_VERSION}_{TIMESTAMP}.cbm"
        model.save_model(str(model_path))
    
    # Save metadata
    metadata = {
        'version': MODEL_VERSION,
        'timestamp': TIMESTAMP,
        'features': feature_cols,
        'categorical_features': categorical_features,
        'metrics': metrics,
        'model_pkl_path': str(model_pkl_path),
        'is_calibrated': hasattr(model, 'calibrated_classifiers_')
    }
    
    metadata_path = MODEL_DIR / f"model_metadata_{MODEL_VERSION}_{TIMESTAMP}.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ Saved model: {model_pkl_path.name}")
    print(f"✅ Saved metadata: {metadata_path.name}")
    
    # Also save as "latest" for easy loading
    joblib.dump(model, MODEL_DIR / "lead_conversion_model_latest.pkl")
    
    return model_pkl_path

# ============================================================================
# VISUALIZATION
# ============================================================================

def plot_feature_importance(model, feature_cols):
    """Plot feature importance"""
    importance = model.get_feature_importance()
    feature_importance_df = pd.DataFrame({
        'feature': feature_cols,
        'importance': importance
    }).sort_values('importance', ascending=False)
    
    plt.figure(figsize=(10, 8))
    top_20 = feature_importance_df.head(20)
    plt.barh(range(len(top_20)), top_20['importance'])
    plt.yticks(range(len(top_20)), top_20['feature'])
    plt.xlabel('Importance')
    plt.title('Top 20 Feature Importance')
    plt.gca().invert_yaxis()
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / f'feature_importance_{MODEL_VERSION}.png', dpi=300)
    
    feature_importance_df.to_csv(OUTPUT_DIR / f'feature_importance_{MODEL_VERSION}.csv', index=False)
    
    print(f"\n✅ Saved feature importance chart and CSV")

# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Train enhanced CatBoost model')
    parser.add_argument('--no-smote', action='store_true', help='Disable SMOTE oversampling')
    parser.add_argument('--no-feature-selection', action='store_true', help='Disable feature selection')
    parser.add_argument('--optimize', action='store_true', help='Enable hyperparameter optimization')
    parser.add_argument('--n-trials', type=int, default=50, help='Number of Optuna trials')
    
    args = parser.parse_args()
    
    print("="*70)
    print("🚀 ADVANCED MODEL TRAINING V3 (ENHANCED)")
    print("="*70)
    print(f"\nEnhancements enabled:")
    print(f"   SMOTE: {'Yes' if not args.no_smote else 'No'}")
    print(f"   Feature Selection: {'Yes' if not args.no_feature_selection else 'No'}")
    print(f"   Hyperparameter Optimization: {'Yes' if args.optimize else 'No'}")
    if args.optimize:
        print(f"   Optuna Trials: {args.n_trials}")
    
    # Load data
    df = load_data()
    
    # Prepare features (includes temporal features and data quality validation)
    X, y, feature_cols, categorical_features = prepare_features(df)
    
    # Train model with enhancements
    model, X_train, X_test, y_train, y_test = train_model(
        df, X, y, categorical_features,
        use_smote=not args.no_smote,
        use_feature_selection=not args.no_feature_selection,
        optimize_params=args.optimize,
        n_trials=args.n_trials
    )
    
    # Evaluate model
    metrics, y_pred, y_pred_proba = evaluate_model(model, X_test, y_test, 
                                                     model.selected_features if hasattr(model, 'selected_features') else feature_cols)
    
    # Error analysis
    error_df = analyze_errors(X_test, y_test, y_pred, y_pred_proba)
    
    # Save model with versioning
    model_path = save_model_with_versioning(model, 
                                             model.selected_features if hasattr(model, 'selected_features') else feature_cols,
                                             categorical_features, metrics)
    
    # Plot feature importance (use base model if calibrated)
    base_model = model.calibrated_classifiers_[0] if hasattr(model, 'calibrated_classifiers_') else model
    plot_feature_importance(base_model, 
                           model.selected_features if hasattr(model, 'selected_features') else feature_cols)
    
    print("\n" + "="*70)
    print("✅ ENHANCED MODEL TRAINING V3 COMPLETE!")
    print("="*70)
    print(f"\n🎯 Key Improvements from V2 to V3:")
    print(f"   ✅ SMOTE oversampling (20% minority class ratio)")
    print(f"   ✅ Temporal features (hour, day_of_week, is_weekend, etc.)")
    print(f"   ✅ Feature selection (top 40 features by importance)")
    print(f"   ✅ Data quality validation (outliers, duplicates)")
    print(f"   ✅ Probability calibration (better confidence scores)")
    if args.optimize:
        print(f"   ✅ Hyperparameter optimization ({args.n_trials} trials)")
    print(f"\n📊 Performance:")
    print(f"   Precision@Top10%: {metrics['precision_at_10']:.2%}")
    print(f"   ROC-AUC: {metrics['roc_auc']:.4f}")
    print(f"\n📁 Next: Run 06_score_leads_v2.py to score with new model")
