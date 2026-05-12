# Advanced AI Lead System

An ML-powered lead scoring and analysis system.

## Project Structure

```
lead-ai/
│
├── data/
│   ├── raw/          # Original data (DO NOT EDIT)
│   └── processed/    # Cleaned and processed data
│
├── scripts/          # ML pipeline scripts
│   ├── 01_clean_data.py
│   ├── 02_parse_notes.py
│   ├── 03_feature_engineering.py
│   ├── 04_label_creation.py
│   ├── 05_train_model.py
│   └── 06_score_leads.py
│
├── models/           # Trained model files
├── outputs/          # Results and visualizations
└── requirements.txt  # Python dependencies
```

## Setup

1. Create and activate virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Mac/Linux
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Place your data in `data/raw/` directory

## Usage

Run scripts in order:
```bash
python scripts/01_clean_data.py
python scripts/02_parse_notes.py
python scripts/03_feature_engineering.py
python scripts/04_label_creation.py
python scripts/05_train_model.py
python scripts/06_score_leads.py
```

## Created: December 2025
