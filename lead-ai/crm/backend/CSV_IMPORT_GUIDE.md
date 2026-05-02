# 📥 CSV Data Import Guide

## Overview
Import your raw CSV data from `/lead-ai/data/raw/leads.csv` into the CRM database.

---

## 📋 Column Mapping

### Your CSV → Database Mapping

| CSV Column | Database Column | Description |
|-----------|----------------|-------------|
| `id` | `lead_id` | UUID identifier |
| `fullName` | `full_name` | Lead's full name |
| `email` | `email` | Email address |
| `phone` | `phone` & `whatsapp` | Contact numbers |
| `country` | `country` | Country code |
| `source` | `source` | Lead source |
| `course` | `course_interested` | Interested course |
| `status` | `status` | Lead status |
| `assignedTo` / `assignedcounselor` | `assigned_to` | Assigned counselor |
| `priority` | `priority_level` | Priority (high/medium/low) |
| `followUp` / `nextfollowup` | `follow_up_date` | Next follow-up date |
| `createdAt` / `created_at` | `created_at` | Creation timestamp |
| `updatedAt` / `updated_at` | `updated_at` | Last update timestamp |
| `score` / `lead_score` | `ai_score` | AI lead score (0-100) |
| `churn_risk` | `churn_risk` | Churn risk probability |
| `estimatedvalue` / `estimated_value` | `expected_revenue` | Expected revenue |
| `sale_price` / `fees` | `actual_revenue` | Actual revenue |
| `next_action` | `next_action` | Recommended next action |
| `notes` | `primary_objection` | Extracted from notes JSON |

---

## 🔄 Auto-Calculated Fields

The import script automatically calculates:

1. **`ai_segment`** - Based on ai_score:
   - **Hot**: score >= 70
   - **Warm**: score >= 40
   - **Cold**: score < 40

2. **`conversion_probability`** - ai_score / 100

3. **`buying_signal_strength`** - Normalized score (0-1)

4. **`primary_objection`** - Extracted from latest note in notes JSON

---

## 🚀 How to Import

### Step 1: Navigate to backend folder
```bash
cd "/Users/rubeenakhan/Desktop/ADVANCED AI LEAD SYSTEM/lead-ai/crm/backend"
```

### Step 2: Run the import script
```bash
python import_csv_data.py
```

### Expected Output:
```
🚀 Starting CSV Import Process...
📁 Reading CSV from: /Users/.../leads.csv
✅ Loaded 19494 rows from CSV
📊 Columns found: 40
✅ Connected to database
📊 Found 0 existing leads in database

🔄 Processing rows...
  Processed: 100 rows (Imported: 98, Skipped: 2)
  Processed: 200 rows (Imported: 195, Skipped: 5)
  ...

============================================================
📊 IMPORT SUMMARY
============================================================
✅ Successfully imported: 19,450 leads
⏭️  Skipped (duplicates):  40 leads
❌ Errors:                4 leads
📈 Total processed:       19,494 rows
============================================================

🎉 Import completed successfully!
💾 Database updated: crm_database.db
```

---

## 🛡️ Data Validation

The script handles:

✅ **Duplicate Prevention** - Skips leads with existing `lead_id`  
✅ **Phone Cleaning** - Removes +, -, spaces from phone numbers  
✅ **Status Normalization** - Converts variations to standard format  
✅ **Date Parsing** - Handles multiple date formats  
✅ **NULL Handling** - Replaces empty values with defaults  
✅ **Score Validation** - Ensures scores are 0-100  
✅ **Notes Extraction** - Parses JSON notes array

---

## 📊 Status Normalization

Variations are mapped to standard statuses:

- `Follow Up`, `follow up`, `FOLLOW UP` → **Follow Up**
- `Not Interested`, `not interested` → **Not Interested**
- `Interested`, `interested` → **Interested**
- `Converted`, `converted` → **Converted**
- `New`, `new` → **New**
- `Lost`, `lost` → **Lost**

---

## 🔍 Verify Import

After import, check data in database:

```bash
# Count total leads
sqlite3 crm_database.db "SELECT COUNT(*) FROM leads;"

# Check latest imports
sqlite3 crm_database.db "SELECT lead_id, full_name, status, ai_score, ai_segment FROM leads LIMIT 5;"

# Count by status
sqlite3 crm_database.db "SELECT status, COUNT(*) FROM leads GROUP BY status;"

# Count by segment
sqlite3 crm_database.db "SELECT ai_segment, COUNT(*) FROM leads GROUP BY ai_segment;"
```

---

## 🔧 Troubleshooting

### Issue: "Database locked"
**Solution:** Stop the backend server first:
```bash
# Find and kill the process
ps aux | grep main.py
kill <process_id>
```

### Issue: "Duplicate key error"
**Solution:** Script automatically skips duplicates. Check output for skipped count.

### Issue: "Date parsing errors"
**Solution:** Script handles multiple formats. Check error messages for specific rows.

### Issue: "Column not found"
**Solution:** Your CSV might have different column names. Edit `COLUMN_MAPPING` in script.

---

## 📝 Notes

- **Backup first:** Script doesn't delete data, but backup database before import
- **Large files:** Import happens in batches of 100 rows with auto-commit
- **Re-running:** Safe to re-run - duplicates are skipped
- **Customization:** Edit `import_csv_data.py` to adjust mappings

---

## 🎯 Next Steps After Import

1. **Start backend server:**
   ```bash
   python main.py
   ```

2. **Verify in CRM:**
   - Go to http://localhost:3000/leads
   - Check if leads appear with correct data
   - Verify AI scores and segments
   - Check assignments

3. **Re-score leads (optional):**
   ```bash
   python rescore_all_leads.py
   ```

---

## 📚 Related Files

- **Import Script:** `import_csv_data.py`
- **Raw Data:** `/lead-ai/data/raw/leads.csv`
- **Database:** `crm_database.db`
- **Database Schema:** Check with `sqlite3 crm_database.db ".schema leads"`

---

**🎉 Ready to import! Run `python import_csv_data.py` to begin.**
