"""
Database Setup Script
Creates all tables in PostgreSQL (Supabase) and seeds initial users.
Run once: python setup_database.py
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not set in .env")
    sys.exit(1)

print(f"🔗 Connecting to: {DATABASE_URL.split('@')[1]}")  # hide credentials in log

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean,
    Text, ForeignKey, JSON
)
from datetime import datetime
import bcrypt

# ── Engine ──────────────────────────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=False
)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


# ── Models (mirrors main.py) ─────────────────────────────────────────────────
class DBLead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(String, unique=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String)
    phone = Column(String)
    whatsapp = Column(String)
    country = Column(String, index=True)
    source = Column(String)
    course_interested = Column(String)
    status = Column(String, default="Fresh", index=True)
    assigned_to = Column(String, index=True)
    follow_up_date = Column(DateTime, nullable=True)
    next_action = Column(Text, nullable=True)
    priority_level = Column(String, default="normal")
    ai_score = Column(Float, default=0.0, index=True)
    ml_score = Column(Float, default=0.0)
    rule_score = Column(Float, default=0.0)
    confidence = Column(Float, default=0.0)
    scoring_method = Column(String, default="rule_based")
    ai_segment = Column(String, default="Cold")
    conversion_probability = Column(Float, default=0.0)
    expected_revenue = Column(Float, default=0.0)
    actual_revenue = Column(Float, default=0.0)
    buying_signal_strength = Column(Float, default=0.0)
    primary_objection = Column(String, nullable=True)
    churn_risk = Column(Float, default=0.0)
    recommended_script = Column(Text, nullable=True)
    feature_importance = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_contact_date = Column(DateTime, nullable=True)


class DBNote(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), index=True)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)
    channel = Column(String, default="manual")


class DBActivity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), index=True)
    activity_type = Column(String)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)


class DBHospital(Base):
    __tablename__ = "hospitals"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    country = Column(String)
    city = Column(String)
    contact_person = Column(String)
    contact_email = Column(String)
    contact_phone = Column(String)
    collaboration_status = Column(String, default="Active")
    courses_offered = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class DBCourse(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    course_name = Column(String, index=True)
    category = Column(String)
    duration = Column(String)
    eligibility = Column(String)
    price = Column(Float, default=0.0)
    currency = Column(String, default="INR")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DBCounselor(Base):
    __tablename__ = "counselors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String)
    phone = Column(String)
    is_active = Column(Boolean, default=True)
    specialization = Column(String, nullable=True)
    total_leads = Column(Integer, default=0)
    total_conversions = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)


class DBUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    password = Column(String)
    role = Column(String)
    reports_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DBCommunicationHistory(Base):
    __tablename__ = "communication_history"
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(String, index=True)
    communication_type = Column(String)
    direction = Column(String, default="outbound")
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="sent")
    communication_metadata = Column(Text, nullable=True)
    sender = Column(String, nullable=True)
    recipient = Column(String, nullable=True)
    used_for_training = Column(Boolean, default=False)
    sentiment_score = Column(Float, nullable=True)
    ai_insights = Column(Text, nullable=True)


# ── Helpers ───────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


# ── Seed Data ─────────────────────────────────────────────────────────────────
USERS = [
    {"id": 1,  "full_name": "Sarah Johnson",    "email": "sarah.johnson@crm.com",    "phone": "+1 555 0001",       "password": "admin123",     "role": "Super Admin",  "reports_to": None},
    {"id": 2,  "full_name": "Michael Chen",      "email": "michael.chen@crm.com",     "phone": "+1 555 0002",       "password": "manager123",   "role": "Manager",      "reports_to": 1},
    {"id": 3,  "full_name": "Priya Sharma",      "email": "priya.sharma@crm.com",     "phone": "+91 98765 43210",   "password": "manager123",   "role": "Manager",      "reports_to": 1},
    {"id": 4,  "full_name": "David Martinez",    "email": "david.martinez@crm.com",   "phone": "+1 555 0004",       "password": "leader123",    "role": "Team Leader",  "reports_to": 2},
    {"id": 5,  "full_name": "Emily Wong",        "email": "emily.wong@crm.com",       "phone": "+1 555 0005",       "password": "leader123",    "role": "Team Leader",  "reports_to": 2},
    {"id": 6,  "full_name": "Rajesh Kumar",      "email": "rajesh.kumar@crm.com",     "phone": "+91 98765 43211",   "password": "leader123",    "role": "Team Leader",  "reports_to": 3},
    {"id": 7,  "full_name": "Aisha Patel",       "email": "aisha.patel@crm.com",      "phone": "+91 98765 43212",   "password": "leader123",    "role": "Team Leader",  "reports_to": 3},
    {"id": 8,  "full_name": "James Wilson",      "email": "james.wilson@crm.com",     "phone": "+1 555 0008",       "password": "counselor123", "role": "Counselor",    "reports_to": 4},
    {"id": 9,  "full_name": "Lisa Anderson",     "email": "lisa.anderson@crm.com",    "phone": "+1 555 0009",       "password": "counselor123", "role": "Counselor",    "reports_to": 4},
    {"id": 10, "full_name": "Carlos Rodriguez",  "email": "carlos.rodriguez@crm.com", "phone": "+1 555 0010",       "password": "counselor123", "role": "Counselor",    "reports_to": 5},
    {"id": 11, "full_name": "Sophia Lee",        "email": "sophia.lee@crm.com",       "phone": "+1 555 0011",       "password": "counselor123", "role": "Counselor",    "reports_to": 5},
    {"id": 12, "full_name": "Amit Desai",        "email": "amit.desai@crm.com",       "phone": "+91 98765 43213",   "password": "counselor123", "role": "Counselor",    "reports_to": 6},
    {"id": 13, "full_name": "Neha Gupta",        "email": "neha.gupta@crm.com",       "phone": "+91 98765 43214",   "password": "counselor123", "role": "Counselor",    "reports_to": 6},
    {"id": 14, "full_name": "Vikram Singh",      "email": "vikram.singh@crm.com",     "phone": "+91 98765 43215",   "password": "counselor123", "role": "Counselor",    "reports_to": 7},
    {"id": 15, "full_name": "Pooja Mehta",       "email": "pooja.mehta@crm.com",      "phone": "+91 98765 43216",   "password": "counselor123", "role": "Counselor",    "reports_to": 7},
]


COURSES = [
    # --- Cardiology ---
    {"course_name": "Fellowship in Cardiology",                    "category": "Cardiology",               "duration": "1 Year",   "price": 450000},
    {"course_name": "Fellowship in Clinical Cardiology",           "category": "Cardiology",               "duration": "6 Months", "price": 350000},
    {"course_name": "Fellowship in Interventional Cardiology",     "category": "Cardiology",               "duration": "1 Year",   "price": 500000},
    {"course_name": "Fellowship in 2D Echocardiography",           "category": "Cardiology",               "duration": "3 Months", "price": 150000},
    {"course_name": "Fellowship in Pediatric Echocardiography",    "category": "Cardiology",               "duration": "3 Months", "price": 150000},
    {"course_name": "Fellowship in Cardiothoracic Surgery",        "category": "Surgery",                  "duration": "1 Year",   "price": 600000},
    # --- Emergency & Critical Care ---
    {"course_name": "Fellowship in Emergency Medicine",            "category": "Emergency Medicine",       "duration": "1 Year",   "price": 400000},
    {"course_name": "Fellowship in Critical Care Medicine",        "category": "Critical Care",            "duration": "1 Year",   "price": 450000},
    # --- Gynecology & Obstetrics ---
    {"course_name": "Fellowship in Gynecology & Obstetrics",       "category": "Gynecology & Obstetrics",  "duration": "1 Year",   "price": 400000},
    {"course_name": "Fellowship in High-Risk Pregnancy",           "category": "Gynecology & Obstetrics",  "duration": "6 Months", "price": 300000},
    {"course_name": "Fellowship in Fetal Medicine",                "category": "Gynecology & Obstetrics",  "duration": "6 Months", "price": 350000},
    {"course_name": "Fellowship in Cosmetic Gynecology",           "category": "Gynecology & Obstetrics",  "duration": "3 Months", "price": 200000},
    {"course_name": "Fellowship in Laparoscopy & Hysteroscopy",    "category": "Gynecology & Obstetrics",  "duration": "6 Months", "price": 300000},
    {"course_name": "Fellowship in Reproductive Medicine",         "category": "Gynecology & Obstetrics",  "duration": "6 Months", "price": 350000},
    # --- Dental & Oral Surgery ---
    {"course_name": "Fellowship in Maxillofacial and Oral Surgery","category": "Dental & Oral Surgery",    "duration": "1 Year",   "price": 350000},
    {"course_name": "Fellowship in Oral Implantology and Laser Dentistry", "category": "Dental & Oral Surgery", "duration": "6 Months", "price": 250000},
    # --- Endocrinology & Diabetes ---
    {"course_name": "Fellowship in Diabetes Mellitus",             "category": "Endocrinology",            "duration": "6 Months", "price": 250000},
    {"course_name": "Fellowship in Endocrinology",                 "category": "Endocrinology",            "duration": "1 Year",   "price": 400000},
    {"course_name": "Fellowship in Pediatric Endocrinology",       "category": "Pediatrics",               "duration": "6 Months", "price": 300000},
    # --- Orthopedics ---
    {"course_name": "Fellowship in Orthopedics",                   "category": "Orthopedics",              "duration": "1 Year",   "price": 400000},
    {"course_name": "Fellowship in Arthroscopy",                   "category": "Orthopedics",              "duration": "6 Months", "price": 300000},
    {"course_name": "Fellowship in Arthroscopy and Arthroplasty",  "category": "Orthopedics",              "duration": "1 Year",   "price": 450000},
    # --- Pediatrics ---
    {"course_name": "Fellowship in Pediatrics",                    "category": "Pediatrics",               "duration": "1 Year",   "price": 350000},
    {"course_name": "Fellowship in Neonatology",                   "category": "Pediatrics",               "duration": "6 Months", "price": 300000},
    {"course_name": "Fellowship in Pediatric Neurology",           "category": "Pediatrics",               "duration": "1 Year",   "price": 400000},
    # --- Surgery ---
    {"course_name": "Fellowship in General Surgery (1 Year)",      "category": "Surgery",                  "duration": "1 Year",   "price": 400000},
    {"course_name": "Fellowship in Minimal Access & Robotic Surgery","category": "Surgery",                "duration": "1 Year",   "price": 500000},
    # --- Oncology ---
    {"course_name": "Fellowship in Medical Oncology",              "category": "Oncology",                 "duration": "1 Year",   "price": 500000},
    {"course_name": "Fellowship in Head & Neck Oncology",          "category": "Oncology",                 "duration": "1 Year",   "price": 450000},
    # --- Neurology ---
    {"course_name": "Fellowship in Clinical Neurology",            "category": "Neurology",                "duration": "1 Year",   "price": 400000},
    # --- Gastroenterology ---
    {"course_name": "Fellowship in Gastroenterology",              "category": "Gastroenterology",         "duration": "1 Year",   "price": 450000},
    # --- Nephrology ---
    {"course_name": "Fellowship in Nephrology",                    "category": "Nephrology",               "duration": "1 Year",   "price": 400000},
    # --- Urology ---
    {"course_name": "Fellowship in Urology",                       "category": "Urology",                  "duration": "1 Year",   "price": 450000},
    # --- Pulmonology ---
    {"course_name": "Fellowship in Respiratory Medicine",          "category": "Pulmonology",              "duration": "1 Year",   "price": 350000},
    # --- Anesthesiology ---
    {"course_name": "Fellowship in Anesthesia",                    "category": "Anesthesiology",           "duration": "1 Year",   "price": 400000},
    {"course_name": "Fellowship in Pain Management",               "category": "Anesthesiology",           "duration": "6 Months", "price": 250000},
    # --- Radiology ---
    {"course_name": "Fellowship in Radiology",                     "category": "Radiology",                "duration": "1 Year",   "price": 400000},
    {"course_name": "Fellowship in Interventional Radiology",      "category": "Radiology",                "duration": "1 Year",   "price": 450000},
    # --- Dermatology & Aesthetics ---
    {"course_name": "Fellowship in Dermatology",                   "category": "Dermatology & Aesthetics", "duration": "6 Months", "price": 300000},
    {"course_name": "Fellowship in Cosmetic & Aesthetic Medicine", "category": "Dermatology & Aesthetics", "duration": "6 Months", "price": 300000},
    {"course_name": "Fellowship in Trichology",                    "category": "Dermatology & Aesthetics", "duration": "3 Months", "price": 150000},
    # --- Psychiatry ---
    {"course_name": "Fellowship in Psychiatric Medicine",          "category": "Psychiatry",               "duration": "1 Year",   "price": 350000},
    # --- Rheumatology ---
    {"course_name": "Fellowship in Rheumatology",                  "category": "Rheumatology",             "duration": "1 Year",   "price": 400000},
    # --- Internal & Family Medicine ---
    {"course_name": "Fellowship in Internal Medicine",             "category": "Internal Medicine",        "duration": "1 Year",   "price": 350000},
    {"course_name": "Fellowship in Family Medicine",               "category": "Family Medicine",          "duration": "1 Year",   "price": 300000},
    # --- Haematology ---
    {"course_name": "Fellowship in Clinical Haematology",          "category": "Haematology",              "duration": "1 Year",   "price": 400000},
]


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("\n📦 Creating all tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully!")
    except Exception as e:
        print(f"❌ Table creation failed: {e}")
        sys.exit(1)

    db = SessionLocal()
    try:
        # Seed users
        existing = db.query(DBUser).count()
        if existing > 0:
            print(f"\n⚠️  Users table already has {existing} records — skipping seed.")
        else:
            print("\n👥 Seeding users...")
            for u in USERS:
                hashed = hash_password(u["password"])
                db.add(DBUser(
                    id=u["id"],
                    full_name=u["full_name"],
                    email=u["email"],
                    phone=u["phone"],
                    password=hashed,
                    role=u["role"],
                    reports_to=u["reports_to"],
                    is_active=True,
                ))
            db.commit()
            print(f"✅ {len(USERS)} users created with hashed passwords!")

        print("\n🔑 Login credentials:")
        print("  Super Admin : sarah.johnson@crm.com  / admin123")
        print("  Manager     : michael.chen@crm.com   / manager123")
        print("  Team Leader : david.martinez@crm.com / leader123")
        print("  Counselor   : james.wilson@crm.com   / counselor123")

        # Seed courses
        existing_courses = db.query(DBCourse).count()
        if existing_courses > 0:
            print(f"\n⚠️  Courses table already has {existing_courses} records — skipping seed.")
        else:
            print("\n📚 Seeding courses...")
            for c in COURSES:
                db.add(DBCourse(
                    course_name=c["course_name"],
                    category=c["category"],
                    duration=c["duration"],
                    price=c["price"],
                    currency="INR",
                    is_active=True,
                ))
            db.commit()
            print(f"✅ {len(COURSES)} courses seeded!")

    except Exception as e:
        db.rollback()
        print(f"❌ Seeding failed: {e}")
        raise
    finally:
        db.close()

    print("\n🎉 Database setup complete! You can now start the backend.\n")


if __name__ == "__main__":
    main()
