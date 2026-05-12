"""
Hash all existing passwords in the database
Run this once to secure existing user passwords
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import bcrypt
from main import DBUser
import os

# Database connection
DATABASE_URL = "sqlite:///./crm_database.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt - truncate if needed"""
    # Bcrypt has a 72 byte limit
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

def hash_existing_passwords():
    """Hash all plain text passwords in the database"""
    db = SessionLocal()
    
    try:
        users = db.query(DBUser).all()
        
        print(f"📊 Found {len(users)} users")
        
        hashed_count = 0
        skipped_count = 0
        
        for user in users:
            # Check if password is already hashed (bcrypt hashes start with $2b$)
            if user.password and not user.password.startswith('$2b$') and not user.password.startswith('$2a$'):
                original_password = user.password
                user.password = get_password_hash(original_password)
                hashed_count += 1
                print(f"✅ Hashed password for: {user.email} (was: {original_password[:3]}...)")
            else:
                skipped_count += 1
                print(f"⏭️  Skipped (already hashed): {user.email}")
        
        db.commit()
        
        print(f"\n✅ Password hashing complete!")
        print(f"   - Hashed: {hashed_count} users")
        print(f"   - Skipped: {skipped_count} users (already hashed)")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("🔒 Starting password hashing process...")
    hash_existing_passwords()
