"""
Canonical seed script for the Medical Education CRM (Local SQLite).

Usage:
    python seed_all.py                  # seeds courses + users (safe — skips existing)
    python seed_all.py --courses-only   # seeds only courses
    python seed_all.py --users-only     # seeds only users
    python seed_all.py --leads          # also seeds 50 sample leads (dev only)

This script uses local SQLite database.
It is idempotent — it checks for existing data before inserting.
"""

import os
import sys
import argparse
from datetime import datetime, timedelta
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import SQLAlchemy database models
from main import SessionLocal, DBCourse, DBUser, DBLead
from auth import get_password_hash
from logger_config import logger


# ---------------------------------------------------------------------------
# COURSES  (Demo medical education courses)
# ---------------------------------------------------------------------------

COURSES = [
    ("Advanced Clinical Medicine",                  "General Medicine",     "1 Year",   400000),
    ("Emergency Medicine Certificate",              "Emergency Care",       "6 Months", 250000),
    ("Critical Care Fundamentals",                  "Critical Care",        "6 Months", 300000),
    ("Pediatric Care Specialist",                   "Pediatrics",          "1 Year",   350000),
    ("Surgical Techniques Course",                  "Surgery",             "1 Year",   450000),
    ("Diagnostic Imaging Basics",                   "Radiology",           "3 Months", 150000),
    ("Primary Healthcare Management",               "Family Medicine",      "6 Months", 200000),
    ("Women's Health Specialist",                   "Gynecology",          "1 Year",   400000),
    ("Mental Health Professional Certificate",      "Psychiatry",          "6 Months", 250000),
    ("Anesthesia Fundamentals",                     "Anesthesiology",      "6 Months", 300000),
]


# ---------------------------------------------------------------------------
# USERS  (Demo users with organizational hierarchy)
# ---------------------------------------------------------------------------

USERS = [
    {
        "full_name": "Sarah Johnson",
        "email": "admin@demo-crm.com",
        "phone": "+1-555-0001",
        "role": "Super Admin",
        "reports_to": None,
        "password": "Admin@123",
    },
    {
        "full_name": "Michael Chen",
        "email": "manager@demo-crm.com",
        "phone": "+1-555-0002",
        "role": "Manager",
        "reports_to_email": "admin@demo-crm.com",
        "password": "Manager@123",
    },
    {
        "full_name": "David Martinez",
        "email": "teamlead@demo-crm.com",
        "phone": "+1-555-0003",
        "role": "Team Leader",
        "reports_to_email": "manager@demo-crm.com",
        "password": "Lead@123",
    },
    {
        "full_name": "Emily Wong",
        "email": "counselor.a@demo-crm.com",
        "phone": "+1-555-0004",
        "role": "Counselor",
        "reports_to_email": "teamlead@demo-crm.com",
        "password": "Counselor@123",
    },
    {
        "full_name": "James Wilson",
        "email": "counselor.b@demo-crm.com",
        "phone": "+1-555-0005",
        "role": "Counselor",
        "reports_to_email": "teamlead@demo-crm.com",
        "password": "Counselor@123",
    },
]


# ---------------------------------------------------------------------------
# SAMPLE LEADS  (50 realistic entries for development / testing)
# ---------------------------------------------------------------------------

_LEAD_COUNTRIES = ["India", "Nigeria", "UAE", "Nepal", "Bangladesh", "Kenya", "Sri Lanka"]
_LEAD_SOURCES = ["Website", "WhatsApp", "Referral", "Instagram", "Facebook", "LinkedIn"]
_LEAD_STATUSES = ["Fresh", "Follow Up", "Warm", "Hot", "Not Interested", "Enrolled"]
_LEAD_COURSES = [c[0] for c in COURSES]

_FIRST_NAMES = ["Priya", "Arun", "Fatima", "Chioma", "Ahmed", "Meera", "Raj", "Ngozi",
                "Suresh", "Amara", "Deepak", "Zara", "Kavya", "Emeka", "Sunita"]
_LAST_NAMES = ["Sharma", "Patel", "Ali", "Okonkwo", "Kumar", "Singh", "Gupta", "Adeyemi",
               "Nair", "Chukwu", "Mehta", "Khan", "Reddy", "Ibrahim", "Pandey"]


def _make_leads(n: int = 50) -> list[dict]:
    random.seed(42)
    leads = []
    now = datetime.utcnow()
    for i in range(1, n + 1):
        first = random.choice(_FIRST_NAMES)
        last = random.choice(_LAST_NAMES)
        created = now - timedelta(days=random.randint(0, 180))
        status = random.choice(_LEAD_STATUSES)
        score = round(random.uniform(10, 95), 1)
        leads.append({
            "lead_id": f"LEAD{i:05d}",
            "full_name": f"Dr. {first} {last}",
            "email": f"{first.lower()}.{last.lower()}{i}@email.com",
            "phone": f"+91-{random.randint(7000000000, 9999999999)}",
            "country": random.choice(_LEAD_COUNTRIES),
            "source": random.choice(_LEAD_SOURCES),
            "course_interested": random.choice(_LEAD_COURSES),
            "status": status,
            "ai_score": score,
            "ai_segment": "Hot" if score >= 75 else ("Warm" if score >= 50 else "Cold"),
            "conversion_probability": round(score / 100, 3),
            "expected_revenue": round(random.choice([150000, 250000, 300000, 400000, 450000]) * (score / 100), 2),
            "actual_revenue": round(random.choice([150000, 300000, 400000]) if status == "Enrolled" else 0, 2),
            "assigned_to": random.choice(["Emily Wong", "James Wilson"]),
            "buying_signal_strength": round(random.uniform(0, 80), 1),
            "churn_risk": round(random.uniform(0, 0.5), 3),
            "created_at": created,
            "updated_at": created + timedelta(days=random.randint(0, 30)),
        })
    return leads


# ---------------------------------------------------------------------------
# SEED FUNCTIONS (Using SQLAlchemy + SQLite)
# ---------------------------------------------------------------------------

def seed_courses(db) -> int:
    existing_count = db.query(DBCourse).count()
    if existing_count > 0:
        logger.info(f"  Courses: already have {existing_count} rows — skipping.")
        return 0
    
    now = datetime.utcnow()
    for name, cat, dur, price in COURSES:
        course = DBCourse(
            course_name=name,
            category=cat,
            duration=dur,
            price=float(price),
            currency="INR",
            is_active=True,
            created_at=now
        )
        db.add(course)
    
    db.commit()
    logger.info(f"  Courses: inserted {len(COURSES)} rows.")
    return len(COURSES)


def seed_users(db) -> int:
    inserted = 0
    email_to_user = {}

    # First pass: create all users
    for u in USERS:
        existing = db.query(DBUser).filter_by(email=u['email']).first()
        if existing:
            email_to_user[u['email']] = existing
            continue

        now = datetime.utcnow()
        user = DBUser(
            full_name=u["full_name"],
            email=u["email"],
            phone=u["phone"],
            role=u["role"],
            password=get_password_hash(u["password"]),
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()  # Get the ID
        email_to_user[u['email']] = user
        inserted += 1

    db.commit()

    # Second pass: resolve reports_to relationships
    for u in USERS:
        mgr_email = u.get("reports_to_email")
        if mgr_email and mgr_email in email_to_user and u["email"] in email_to_user:
            user = email_to_user[u["email"]]
            manager = email_to_user[mgr_email]
            user.reports_to = manager.id
            db.add(user)

    db.commit()
    logger.info(f"  Users: inserted {inserted} new rows (skipped {len(USERS) - inserted} existing).")
    return inserted


def seed_leads(db, n: int = 50) -> int:
    existing_count = db.query(DBLead).count()
    if existing_count >= n:
        logger.info(f"  Leads: already have {existing_count} rows — skipping.")
        return 0
    
    leads_data = _make_leads(n)
    for lead_data in leads_data:
        lead = DBLead(**lead_data)
        db.add(lead)
    
    db.commit()
    logger.info(f"  Leads: inserted {n} sample rows.")
    return n


# ---------------------------------------------------------------------------
# ENTRYPOINT
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Seed the CRM database (Local SQLite).")
    parser.add_argument("--courses-only", action="store_true")
    parser.add_argument("--users-only", action="store_true")
    parser.add_argument("--leads", action="store_true", help="Also seed 50 sample leads (dev only)")
    args = parser.parse_args()

    logger.info("🌱 Starting seed (Local SQLite)...")
    
    db = SessionLocal()
    try:
        if args.courses_only:
            seed_courses(db)
        elif args.users_only:
            seed_users(db)
        else:
            seed_courses(db)
            seed_users(db)
            if args.leads:
                seed_leads(db)
        
        logger.info("✅ Seed complete.")
    except Exception as e:
        logger.error(f"❌ Seed failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
