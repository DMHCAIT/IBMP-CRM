"""
Seed Supabase database with demo data

Usage:
    python seed_supabase_demo.py
"""

import os
import sys
from datetime import datetime, timedelta
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supabase_client import supabase_manager
from auth import get_password_hash
from logger_config import logger


# Demo courses
COURSES = [
    ("Advanced Clinical Medicine", "General Medicine", "1 Year", 400000),
    ("Emergency Medicine Certificate", "Emergency Care", "6 Months", 250000),
    ("Critical Care Fundamentals", "Critical Care", "6 Months", 300000),
    ("Pediatric Care Specialist", "Pediatrics", "1 Year", 350000),
    ("Surgical Techniques Course", "Surgery", "1 Year", 450000),
    ("Diagnostic Imaging Basics", "Radiology", "3 Months", 150000),
    ("Primary Healthcare Management", "Family Medicine", "6 Months", 200000),
    ("Women's Health Specialist", "Gynecology", "1 Year", 400000),
    ("Mental Health Professional Certificate", "Psychiatry", "6 Months", 250000),
    ("Anesthesia Fundamentals", "Anesthesiology", "6 Months", 300000),
]

# Demo users
USERS = [
    {"full_name": "Sarah Johnson", "email": "admin@demo-crm.com", "phone": "+1-555-0001", "role": "Super Admin", "password": "Admin@123"},
    {"full_name": "Michael Chen", "email": "manager@demo-crm.com", "phone": "+1-555-0002", "role": "Manager", "password": "Manager@123"},
    {"full_name": "David Martinez", "email": "teamlead@demo-crm.com", "phone": "+1-555-0003", "role": "Team Leader", "password": "Lead@123"},
    {"full_name": "Emily Wong", "email": "counselor.a@demo-crm.com", "phone": "+1-555-0004", "role": "Counselor", "password": "Counselor@123"},
    {"full_name": "James Wilson", "email": "counselor.b@demo-crm.com", "phone": "+1-555-0005", "role": "Counselor", "password": "Counselor@123"},
]

# Demo lead data
_LEAD_COUNTRIES = ["India", "Nigeria", "UAE", "Nepal", "Bangladesh", "Kenya", "Sri Lanka"]
_LEAD_SOURCES = ["Website", "WhatsApp", "Referral", "Instagram", "Facebook"]
_LEAD_STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won"]  # Try title case
_LEAD_COURSES = [c[0] for c in COURSES]
_FIRST_NAMES = ["Priya", "Arun", "Fatima", "Chioma", "Ahmed", "Meera", "Raj", "Ngozi", "Suresh", "Amara", "Deepak", "Zara", "Kavya", "Emeka", "Sunita"]
_LAST_NAMES = ["Sharma", "Patel", "Ali", "Okonkwo", "Kumar", "Singh", "Gupta", "Adeyemi", "Nair", "Chukwu", "Mehta", "Khan", "Reddy", "Ibrahim", "Pandey"]


def make_leads(n: int = 50) -> list[dict]:
    """Generate demo leads"""
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
            # Skip status and ai_segment - let database use defaults or accept any value
            # "status": status,
            "ai_score": score,
            # "ai_segment": ("Hot" if score >= 75 else ("Warm" if score >= 50 else "Cold")).upper(),
            "conversion_probability": round(score / 100, 3),
            "expected_revenue": round(random.choice([150000, 250000, 300000, 400000, 450000]) * (score / 100), 2),
            "actual_revenue": 0,  # Always 0 for now
            "assigned_to": random.choice(["Emily Wong", "James Wilson"]),
            "buying_signal_strength": round(random.uniform(0, 80), 1),
            "churn_risk": round(random.uniform(0, 0.5), 3),
            "created_at": created.isoformat() + 'Z',
            "updated_at": (created + timedelta(days=random.randint(0, 30))).isoformat() + 'Z',
        })
    
    return leads


def seed_supabase():
    """Seed Supabase database with demo data"""
    client = supabase_manager.get_client()
    
    if not client:
        logger.error("❌ Supabase client not available")
        return False
    
    try:
        logger.info("🌱 Starting Supabase seed...")
        
        # Check if already seeded
        check = client.table('leads').select('count', count='exact').limit(0).execute()
        if check.count and check.count > 0:
            logger.info(f"✅ Database already has {check.count} leads - skipping seed")
            return True
        
        # Seed courses
        logger.info("📚 Seeding courses...")
        existing_courses = client.table('courses').select('id').execute()
        if not existing_courses.data or len(existing_courses.data) == 0:
            course_data = []
            now = datetime.utcnow().isoformat() + 'Z'
            for name, category, duration, price in COURSES:
                course_data.append({
                    "course_name": name,
                    "category": category,
                    "duration": duration,
                    "price": float(price),
                    "currency": "INR",
                    "is_active": True,
                    "created_at": now
                })
            client.table('courses').insert(course_data).execute()
            logger.info(f"  ✅ Inserted {len(COURSES)} courses")
        else:
            logger.info(f"  ℹ️  Courses already exist ({len(existing_courses.data)})")
        
        # Seed users
        logger.info("👥 Seeding users...")
        existing_users = client.table('users').select('id').execute()
        if not existing_users.data or len(existing_users.data) == 0:
            user_data = []
            now = datetime.utcnow().isoformat() + 'Z'
            for user in USERS:
                user_data.append({
                    "full_name": user["full_name"],
                    "email": user["email"],
                    "phone": user["phone"],
                    "role": user["role"],
                    "password": get_password_hash(user["password"]),
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                })
            client.table('users').insert(user_data).execute()
            logger.info(f"  ✅ Inserted {len(USERS)} users")
        else:
            logger.info(f"  ℹ️  Users already exist ({len(existing_users.data)})")
        
        # Seed leads
        logger.info("📋 Seeding 50 demo leads...")
        leads = make_leads(50)
        
        # Insert in batches of 10 to avoid timeout
        batch_size = 10
        for i in range(0, len(leads), batch_size):
            batch = leads[i:i+batch_size]
            client.table('leads').insert(batch).execute()
            logger.info(f"  ✅ Inserted leads {i+1}-{min(i+batch_size, len(leads))}")
        
        logger.info(f"  ✅ Inserted {len(leads)} leads total")
        
        logger.info("✅ Supabase seed completed successfully!")
        return True
        
    except Exception as e:
        logger.error("Error seeding Supabase: " + str(e))
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = seed_supabase()
    sys.exit(0 if success else 1)
