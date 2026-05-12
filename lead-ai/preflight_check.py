#!/usr/bin/env python3
"""
Pre-flight Check
Validates setup before running pipeline
"""

import sys
from pathlib import Path
import pandas as pd

def check_environment():
    """Check if virtual environment is active"""
    print("🔍 Checking Python environment...")
    
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("✅ Virtual environment is active")
        return True
    else:
        print("❌ Virtual environment is NOT active")
        print("   Run: source venv/bin/activate")
        return False

def check_dependencies():
    """Check if required packages are installed"""
    print("\n🔍 Checking dependencies...")
    
    required = ['pandas', 'numpy', 'sklearn', 'catboost', 'textblob', 'matplotlib', 'seaborn']
    missing = []
    
    for package in required:
        try:
            if package == 'sklearn':
                __import__('sklearn')
            else:
                __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - MISSING")
            missing.append(package)
    
    if missing:
        print(f"\n⚠️ Install missing packages:")
        print(f"   pip install {' '.join(missing)}")
        return False
    
    return True

def check_data_file():
    """Check if raw data file exists and is readable"""
    print("\n🔍 Checking raw data file...")
    
    data_path = Path("data/raw/leads.csv")
    
    if not data_path.exists():
        print(f"❌ Data file not found: {data_path}")
        print("   Make sure leads.csv is in data/raw/")
        return False
    
    try:
        df = pd.read_csv(data_path, nrows=5)
        print(f"✅ Data file found: {data_path}")
        print(f"   Preview columns: {', '.join(df.columns[:5].tolist())}...")
        
        # Check for key columns
        required_cols = ['id', 'status', 'notes']
        missing_cols = [col for col in required_cols if col not in df.columns]
        
        if missing_cols:
            print(f"⚠️ Missing expected columns: {missing_cols}")
            print("   Pipeline may need adjustment")
        else:
            print(f"✅ All expected columns present")
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading data file: {e}")
        return False

def check_directories():
    """Check if required directories exist"""
    print("\n🔍 Checking directory structure...")
    
    required_dirs = [
        'data/raw',
        'data/processed',
        'scripts',
        'models',
        'outputs'
    ]
    
    all_good = True
    for dir_path in required_dirs:
        path = Path(dir_path)
        if path.exists():
            print(f"✅ {dir_path}/")
        else:
            print(f"❌ {dir_path}/ - MISSING")
            all_good = False
    
    return all_good

def check_scripts():
    """Check if all pipeline scripts exist"""
    print("\n🔍 Checking pipeline scripts...")
    
    scripts = [
        'scripts/01_clean_data.py',
        'scripts/02_parse_notes.py',
        'scripts/03_feature_engineering.py',
        'scripts/04_label_creation.py',
        'scripts/05_train_model.py',
        'scripts/06_score_leads.py'
    ]
    
    all_good = True
    for script_path in scripts:
        path = Path(script_path)
        if path.exists():
            print(f"✅ {script_path}")
        else:
            print(f"❌ {script_path} - MISSING")
            all_good = False
    
    return all_good

def main():
    print("="*60)
    print("🚀 ADVANCED AI LEAD SYSTEM - PRE-FLIGHT CHECK")
    print("="*60)
    
    checks = [
        check_environment(),
        check_dependencies(),
        check_directories(),
        check_scripts(),
        check_data_file()
    ]
    
    print("\n" + "="*60)
    if all(checks):
        print("✅ ALL CHECKS PASSED - READY TO RUN!")
        print("="*60)
        print("\n🚀 Next steps:")
        print("   cd scripts")
        print("   python 01_clean_data.py")
        print("\nOr run entire pipeline:")
        print("   ./run_pipeline.sh")
        return 0
    else:
        print("❌ SOME CHECKS FAILED - FIX ISSUES ABOVE")
        print("="*60)
        return 1

if __name__ == "__main__":
    sys.exit(main())
