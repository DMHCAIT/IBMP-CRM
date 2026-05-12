"""
Seed database with sample data for testing
"""

from main import *
from datetime import datetime, timedelta
import random
from courses_data import FELLOWSHIP_COURSES, ALL_COUNTRIES

def seed_database():
    db = SessionLocal()
    
    print("🌱 Seeding database...")
    
    # 1. Create Courses - All 55 Fellowship Programs
    print("Creating 55 fellowship courses...")
    for course_data in FELLOWSHIP_COURSES:
        course = DBCourse(**course_data)
        db.add(course)
    db.commit()
    print(f"✅ Created {len(FELLOWSHIP_COURSES)} fellowship courses across 14 specializations")
    
    # 2. Create Hospitals
    hospitals_data = [
        {
            "name": "Apollo Hospitals",
            "country": "India",
            "city": "Chennai",
            "contact_person": "Dr. Rajesh Kumar",
            "contact_email": "rajesh@apollo.com",
            "contact_phone": "+91-9876543210",
            "collaboration_status": "Active",
            "courses_offered": [1, 2, 3]
        },
        {
            "name": "Max Healthcare",
            "country": "India",
            "city": "Delhi",
            "contact_person": "Dr. Priya Sharma",
            "contact_email": "priya@maxhealthcare.com",
            "contact_phone": "+91-9876543211",
            "collaboration_status": "Active",
            "courses_offered": [1, 4, 5]
        },
        {
            "name": "Fortis Hospital",
            "country": "India",
            "city": "Mumbai",
            "contact_person": "Dr. Amit Patel",
            "contact_email": "amit@fortis.com",
            "contact_phone": "+91-9876543212",
            "collaboration_status": "Active",
            "courses_offered": [2, 3, 4]
        },
        {
            "name": "Dubai Hospital",
            "country": "UAE",
            "city": "Dubai",
            "contact_person": "Dr. Ahmed Hassan",
            "contact_email": "ahmed@dubaihospital.ae",
            "contact_phone": "+971-501234567",
            "collaboration_status": "Active",
            "courses_offered": [1, 2]
        },
        {
            "name": "King Faisal Hospital",
            "country": "Saudi Arabia",
            "city": "Riyadh",
            "contact_person": "Dr. Khalid Al-Rashid",
            "contact_email": "khalid@kfh.sa",
            "contact_phone": "+966-501234567",
            "collaboration_status": "Active",
            "courses_offered": [1, 3, 5]
        }
    ]
    
    print("Creating hospitals...")
    for hospital_data in hospitals_data:
        hospital = DBHospital(**hospital_data)
        db.add(hospital)
    db.commit()
    print(f"✅ Created {len(hospitals_data)} hospitals")
    
    # 3. Create Counselors
    counselors_data = [
        {"name": "Priya Singh", "email": "priya@crm.com", "phone": "+91-9999999001", "specialization": "Closer"},
        {"name": "Rahul Verma", "email": "rahul@crm.com", "phone": "+91-9999999002", "specialization": "Price Objection Handler"},
        {"name": "Anita Desai", "email": "anita@crm.com", "phone": "+91-9999999003", "specialization": "General"},
        {"name": "Vijay Kumar", "email": "vijay@crm.com", "phone": "+91-9999999004", "specialization": "Closer"},
    ]
    
    print("Creating counselors...")
    for counselor_data in counselors_data:
        counselor = DBCounselor(**counselor_data)
        db.add(counselor)
    db.commit()
    print(f"✅ Created {len(counselors_data)} counselors")
    
    # 4. Create Sample Leads
    sources = ["Facebook", "Instagram", "Google Ads", "Website", "Referral", "WhatsApp"]
    statuses = [LeadStatus.FRESH, LeadStatus.FOLLOW_UP, LeadStatus.WARM, LeadStatus.HOT, LeadStatus.NOT_INTERESTED, LeadStatus.ENROLLED]
    
    courses = db.query(DBCourse).all()
    counselors = db.query(DBCounselor).all()
    
    sample_notes_templates = [
        ("Interested in course. Asked about fees and duration.", "call"),
        ("Sent course details via WhatsApp. Waiting for response.", "whatsapp"),
        ("Had detailed discussion about course curriculum.", "call"),
        ("Price is too high. Looking for discount options.", "call"),
        ("Very excited! Wants to join immediately.", "call"),
        ("Will get back after discussing with family.", "call"),
        ("Already enrolled in competitor course.", "call"),
        ("Not answering calls. Sent WhatsApp message.", "whatsapp"),
        ("Requested payment details. Ready to pay.", "whatsapp"),
        ("Comparing with other institutes. Following up tomorrow.", "call"),
    ]
    
    first_names = ["Rahul", "Priya", "Ahmed", "Fatima", "Sanjay", "Deepika", "Mohammed", "Ayesha", "Raj", "Kavita",
                   "Arjun", "Sneha", "Vikram", "Pooja", "Amit", "Divya", "Rohan", "Anjali", "Karan", "Nisha"]
    last_names = ["Sharma", "Khan", "Patel", "Kumar", "Singh", "Ali", "Hassan", "Verma", "Reddy", "Gupta"]
    
    print("Creating 50 sample leads...")
    for i in range(50):
        full_name = f"Dr. {random.choice(first_names)} {random.choice(last_names)}"
        country = random.choice(ALL_COUNTRIES)
        course = random.choice(courses)
        counselor = random.choice(counselors)
        status = random.choice(statuses)
        
        # Generate realistic phone number based on country
        if country == "India":
            phone = f"+91-{random.randint(9000000000, 9999999999)}"
        elif country in ["UAE", "Saudi Arabia", "Kuwait", "Oman", "Qatar", "Bahrain"]:
            phone = f"+971-{random.randint(500000000, 599999999)}"
        elif country in ["United States", "USA", "Canada"]:
            phone = f"+1-{random.randint(2000000000, 9999999999)}"
        elif country in ["United Kingdom", "UK"]:
            phone = f"+44-{random.randint(7000000000, 7999999999)}"
        else:
            phone = f"+{random.randint(1, 999)}-{random.randint(1000000000, 9999999999)}"
        
        lead_count = db.query(DBLead).count()
        lead = DBLead(
            lead_id=f"LEAD{lead_count + 1:05d}",
            full_name=full_name,
            email=f"{full_name.lower().replace(' ', '.').replace('dr.', '')}@email.com",
            phone=phone,
            whatsapp=phone,
            country=country,
            source=random.choice(sources),
            course_interested=course.course_name,
            status=status,
            assigned_to=counselor.name,
            created_at=datetime.utcnow() - timedelta(days=random.randint(0, 30))
        )
        
        db.add(lead)
        db.commit()
        db.refresh(lead)
        
        # Add 1-5 notes
        num_notes = random.randint(1, 5)
        for j in range(num_notes):
            note_content, channel = random.choice(sample_notes_templates)
            note = DBNote(
                lead_id=lead.id,
                content=note_content,
                channel=channel,
                created_by=counselor.name,
                created_at=lead.created_at + timedelta(days=j, hours=random.randint(1, 23))
            )
            db.add(note)
        
        # Update last contact
        lead.last_contact_date = lead.created_at + timedelta(days=num_notes-1)
        
        db.commit()
        
        # AI scoring
        ai_scorer.load_course_prices(db)
        score_result = ai_scorer.score_lead(lead, lead.notes)
        for key, value in score_result.items():
            setattr(lead, key, value)
        
        # If enrolled, set actual revenue
        if status == LeadStatus.ENROLLED:
            lead.actual_revenue = course.price
        
        db.commit()
        
        if (i + 1) % 10 == 0:
            print(f"  Created {i + 1}/50 leads...")
    
    print(f"✅ Created 50 sample leads")
    
    # Update counselor stats
    print("Updating counselor statistics...")
    for counselor in counselors:
        counselor.total_leads = db.query(DBLead).filter(DBLead.assigned_to == counselor.name).count()
        counselor.total_conversions = db.query(DBLead).filter(
            DBLead.assigned_to == counselor.name,
            DBLead.status == LeadStatus.ENROLLED
        ).count()
        counselor.conversion_rate = (counselor.total_conversions / counselor.total_leads * 100) if counselor.total_leads > 0 else 0
    
    db.commit()
    print("✅ Updated counselor statistics")
    
    db.close()
    print("\n✨ Database seeded successfully!")
    print("\n📊 Summary:")
    print(f"  - {len(FELLOWSHIP_COURSES)} fellowship courses across 14 specializations")
    print(f"  - {len(hospitals_data)} hospitals")
    print(f"  - {len(counselors_data)} counselors")
    print(f"  - 50 leads with notes")
    print("\n🚀 Start the API server with: python main.py")
    print("📱 API Docs: http://localhost:8000/docs")

if __name__ == "__main__":
    seed_database()
