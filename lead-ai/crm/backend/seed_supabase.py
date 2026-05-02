"""
DEPRECATED: This script is no longer used.
Use seed_all.py instead with local SQLite database.
Supabase integration has been removed from the system.
"""

import sys
print("❌ This script is deprecated. Use 'python seed_all.py' instead.")
sys.exit(1)
COURSES = [
    ("Fellowship in Cardiology",                        "Cardiology",               "1 Year",   450000),
    ("Fellowship in Clinical Cardiology",                "Cardiology",               "6 Months", 350000),
    ("Fellowship in Interventional Cardiology",          "Cardiology",               "1 Year",   500000),
    ("Fellowship in 2D Echocardiography",                "Cardiology",               "3 Months", 150000),
    ("Fellowship in Pediatric Echocardiography",         "Cardiology",               "3 Months", 150000),
    ("Fellowship in Cardiothoracic Surgery",             "Surgery",                  "1 Year",   600000),
    ("Fellowship in Emergency Medicine",                 "Emergency Medicine",        "1 Year",   400000),
    ("Fellowship in Critical Care Medicine",             "Critical Care",             "1 Year",   450000),
    ("Fellowship in Gynecology & Obstetrics",            "Gynecology & Obstetrics",  "1 Year",   400000),
    ("Fellowship in High-Risk Pregnancy",                "Gynecology & Obstetrics",  "6 Months", 300000),
    ("Fellowship in Fetal Medicine",                     "Gynecology & Obstetrics",  "6 Months", 350000),
    ("Fellowship in Cosmetic Gynecology",                "Gynecology & Obstetrics",  "3 Months", 200000),
    ("Fellowship in Laparoscopy & Hysteroscopy",         "Gynecology & Obstetrics",  "6 Months", 300000),
    ("Fellowship in Reproductive Medicine",              "Gynecology & Obstetrics",  "6 Months", 350000),
    ("Fellowship in Maxillofacial and Oral Surgery",     "Dental & Oral Surgery",    "1 Year",   350000),
    ("Fellowship in Oral Implantology and Laser Dentistry","Dental & Oral Surgery",  "6 Months", 250000),
    ("Fellowship in Diabetes Mellitus",                  "Endocrinology",            "6 Months", 250000),
    ("Fellowship in Endocrinology",                      "Endocrinology",            "1 Year",   400000),
    ("Fellowship in Pediatric Endocrinology",            "Pediatrics",               "6 Months", 300000),
    ("Fellowship in Orthopedics",                        "Orthopedics",              "1 Year",   400000),
    ("Fellowship in Arthroscopy",                        "Orthopedics",              "6 Months", 300000),
    ("Fellowship in Arthroscopy and Arthroplasty",       "Orthopedics",              "1 Year",   450000),
    ("Fellowship in Pediatrics",                         "Pediatrics",               "1 Year",   350000),
    ("Fellowship in Neonatology",                        "Pediatrics",               "6 Months", 300000),
    ("Fellowship in Pediatric Neurology",                "Pediatrics",               "1 Year",   400000),
    ("Fellowship in General Surgery (1 Year)",           "Surgery",                  "1 Year",   400000),
    ("Fellowship in Minimal Access & Robotic Surgery",   "Surgery",                  "1 Year",   500000),
    ("Fellowship in Medical Oncology",                   "Oncology",                 "1 Year",   500000),
    ("Fellowship in Head & Neck Oncology",               "Oncology",                 "1 Year",   450000),
    ("Fellowship in Clinical Neurology",                 "Neurology",                "1 Year",   400000),
    ("Fellowship in Gastroenterology",                   "Gastroenterology",         "1 Year",   450000),
    ("Fellowship in Nephrology",                         "Nephrology",               "1 Year",   400000),
    ("Fellowship in Urology",                            "Urology",                  "1 Year",   450000),
    ("Fellowship in Respiratory Medicine",               "Pulmonology",              "1 Year",   350000),
    ("Fellowship in Anesthesia",                         "Anesthesiology",           "1 Year",   400000),
    ("Fellowship in Pain Management",                    "Anesthesiology",           "6 Months", 250000),
    ("Fellowship in Radiology",                          "Radiology",                "1 Year",   400000),
    ("Fellowship in Interventional Radiology",           "Radiology",                "1 Year",   450000),
    ("Fellowship in Dermatology",                        "Dermatology & Aesthetics", "6 Months", 300000),
    ("Fellowship in Cosmetic & Aesthetic Medicine",      "Dermatology & Aesthetics", "6 Months", 300000),
    ("Fellowship in Trichology",                         "Dermatology & Aesthetics", "3 Months", 150000),
    ("Fellowship in Psychiatric Medicine",               "Psychiatry",               "1 Year",   350000),
    ("Fellowship in Rheumatology",                       "Rheumatology",             "1 Year",   400000),
    ("Fellowship in Internal Medicine",                  "Internal Medicine",        "1 Year",   350000),
    ("Fellowship in Family Medicine",                    "Family Medicine",          "1 Year",   300000),
    ("Fellowship in Clinical Haematology",               "Haematology",              "1 Year",   400000),
]


def seed_supabase_data():
    """Seed courses only — never overwrites users or leads."""
    client = supabase_manager.get_client()
    if not client:
        logger.error("❌ Supabase client not available")
        return False

    logger.info("🌱 Checking if courses need seeding…")

    try:
        # Only seed if courses table is empty
        courses_count = client.table('courses').select('count', count='exact').limit(0).execute()
        if courses_count.count > 0:
            logger.info(f"✅ Courses already seeded ({courses_count.count} rows) — skipping")
            return True

        logger.info("📚 Seeding 46 courses…")
        now_str = datetime.utcnow().isoformat()
        rows = [
            {
                "course_name": name,
                "category":    category,
                "duration":    duration,
                "price":       float(price),
                "currency":    "INR",
                "is_active":   True,
                "created_at":  now_str,
            }
            for name, category, duration, price in COURSES
        ]
        client.table('courses').insert(rows).execute()
        logger.info(f"✅ {len(rows)} courses seeded")
        return True

    except Exception as e:
        logger.error(f"❌ Seeding failed: {e}")
        import traceback; traceback.print_exc()
        return False


if __name__ == "__main__":
    sys.exit(0 if seed_supabase_data() else 1)
