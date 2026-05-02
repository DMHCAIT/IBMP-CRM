"""
Fix NULL created_at and updated_at values in users table
"""
import os
from datetime import datetime
from dotenv import load_dotenv
from database import SessionLocal
from main import DBUser

load_dotenv()

def fix_user_timestamps():
    db = SessionLocal()
    try:
        # Find users with NULL timestamps
        users_to_fix = db.query(DBUser).filter(
            (DBUser.created_at == None) | (DBUser.updated_at == None)
        ).all()

        print(f"Found {len(users_to_fix)} users with NULL timestamps")

        now = datetime.utcnow()
        for user in users_to_fix:
            if user.created_at is None:
                user.created_at = now
                print(f"  Fixed created_at for user {user.id}: {user.full_name}")
            if user.updated_at is None:
                user.updated_at = now
                print(f"  Fixed updated_at for user {user.id}: {user.full_name}")

        db.commit()
        print(f"✅ Successfully fixed timestamps for {len(users_to_fix)} users")

        # Verify
        remaining = db.query(DBUser).filter(
            (DBUser.created_at == None) | (DBUser.updated_at == None)
        ).count()
        print(f"Remaining users with NULL timestamps: {remaining}")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_user_timestamps()
