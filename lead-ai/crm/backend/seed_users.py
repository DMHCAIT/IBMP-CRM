"""
Seed sample users with organizational hierarchy
Run this once to populate the users table
"""

from main import DBUser, SessionLocal, engine, Base
from datetime import datetime

def seed_users():
    db = SessionLocal()
    
    # Check if users already exist
    existing = db.query(DBUser).first()
    if existing:
        print("⚠️  Users already exist. Skipping seed.")
        db.close()
        return
    
    users_data = [
        # Super Admin (Level 4)
        {
            "id": 1,
            "full_name": "Sarah Johnson",
            "email": "sarah.johnson@crm.com",
            "phone": "+1 555 0001",
            "password": "admin123",
            "role": "Super Admin",
            "reports_to": None,
            "is_active": True
        },
        
        # Managers (Level 3) - Report to Super Admin
        {
            "id": 2,
            "full_name": "Michael Chen",
            "email": "michael.chen@crm.com",
            "phone": "+1 555 0002",
            "password": "manager123",
            "role": "Manager",
            "reports_to": 1,
            "is_active": True
        },
        {
            "id": 3,
            "full_name": "Priya Sharma",
            "email": "priya.sharma@crm.com",
            "phone": "+91 98765 43210",
            "password": "manager123",
            "role": "Manager",
            "reports_to": 1,
            "is_active": True
        },
        
        # Team Leaders (Level 2) - Report to Managers
        {
            "id": 4,
            "full_name": "David Martinez",
            "email": "david.martinez@crm.com",
            "phone": "+1 555 0004",
            "password": "leader123",
            "role": "Team Leader",
            "reports_to": 2,  # Reports to Michael
            "is_active": True
        },
        {
            "id": 5,
            "full_name": "Emily Wong",
            "email": "emily.wong@crm.com",
            "phone": "+1 555 0005",
            "password": "leader123",
            "role": "Team Leader",
            "reports_to": 2,  # Reports to Michael
            "is_active": True
        },
        {
            "id": 6,
            "full_name": "Rajesh Kumar",
            "email": "rajesh.kumar@crm.com",
            "phone": "+91 98765 43211",
            "password": "leader123",
            "role": "Team Leader",
            "reports_to": 3,  # Reports to Priya
            "is_active": True
        },
        {
            "id": 7,
            "full_name": "Aisha Patel",
            "email": "aisha.patel@crm.com",
            "phone": "+91 98765 43212",
            "password": "leader123",
            "role": "Team Leader",
            "reports_to": 3,  # Reports to Priya
            "is_active": True
        },
        
        # Counselors (Level 1) - Report to Team Leaders
        {
            "id": 8,
            "full_name": "James Wilson",
            "email": "james.wilson@crm.com",
            "phone": "+1 555 0008",
            "password": "counselor123",
            "role": "Counselor",
            "reports_to": 4,  # Reports to David
            "is_active": True
        },
        {
            "id": 9,
            "full_name": "Lisa Anderson",
            "email": "lisa.anderson@crm.com",
            "phone": "+1 555 0009",
            "password": "counselor123",
            "role": "Counselor",
            "reports_to": 4,  # Reports to David
            "is_active": True
        },
        {
            "id": 10,
            "full_name": "Carlos Rodriguez",
            "email": "carlos.rodriguez@crm.com",
            "phone": "+1 555 0010",
            "password": "counselor123",
            "role": "Counselor",
            "reports_to": 5,  # Reports to Emily
            "is_active": True
        },
        {
            "id": 11,
            "full_name": "Sophia Lee",
            "email": "sophia.lee@crm.com",
            "phone": "+1 555 0011",
            "password": "counselor123",
            "role": "Counselor",
            "reports_to": 5,  # Reports to Emily
            "is_active": True
        },
        {
            "id": 12,
            "full_name": "Amit Desai",
            "email": "amit.desai@crm.com",
            "phone": "+91 98765 43213",
            "password": "counselor123",
            "role": "Counselor",
            "reports_to": 6,  # Reports to Rajesh
            "is_active": True
        },
        {
            "id": 13,
            "full_name": "Neha Gupta",
            "email": "neha.gupta@crm.com",
            "phone": "+91 98765 43214",
            "password": "counselor123",
            "role": "Counselor",
            "reports_to": 6,  # Reports to Rajesh
            "is_active": True
        },
        {
            "id": 14,
            "full_name": "Vikram Singh",
            "email": "vikram.singh@crm.com",
            "phone": "+91 98765 43215",
            "password": "counselor123",
            "role": "Counselor",
            "reports_to": 7,  # Reports to Aisha
            "is_active": True
        },
        {
            "id": 15,
            "full_name": "Pooja Mehta",
            "email": "pooja.mehta@crm.com",
            "phone": "+91 98765 43216",
            "password": "counselor123",
            "role": "Counselor",
            "reports_to": 7,  # Reports to Aisha
            "is_active": True
        },
    ]
    
    # Insert users
    for user_data in users_data:
        user = DBUser(**user_data)
        db.add(user)
    
    db.commit()
    print(f"✅ Successfully created {len(users_data)} users!")
    print("\n📊 Organization Hierarchy:")
    print("  └─ Sarah Johnson (Super Admin)")
    print("      ├─ Michael Chen (Manager)")
    print("      │   ├─ David Martinez (Team Leader)")
    print("      │   │   ├─ James Wilson (Counselor)")
    print("      │   │   └─ Lisa Anderson (Counselor)")
    print("      │   └─ Emily Wong (Team Leader)")
    print("      │       ├─ Carlos Rodriguez (Counselor)")
    print("      │       └─ Sophia Lee (Counselor)")
    print("      └─ Priya Sharma (Manager)")
    print("          ├─ Rajesh Kumar (Team Leader)")
    print("          │   ├─ Amit Desai (Counselor)")
    print("          │   └─ Neha Gupta (Counselor)")
    print("          └─ Aisha Patel (Team Leader)")
    print("              ├─ Vikram Singh (Counselor)")
    print("              └─ Pooja Mehta (Counselor)")
    print("\n🔑 Login Credentials:")
    print("  Super Admin: sarah.johnson@crm.com / admin123")
    print("  Manager: michael.chen@crm.com / manager123")
    print("  Team Leader: david.martinez@crm.com / leader123")
    print("  Counselor: james.wilson@crm.com / counselor123")
    
    db.close()

if __name__ == "__main__":
    seed_users()
