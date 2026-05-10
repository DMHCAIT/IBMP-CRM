"""
Authentication and Authorization Module - SUPABASE ONLY
Provides JWT token generation, password hashing, and user verification
"""

from datetime import datetime, timedelta
from typing import Optional
import os
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

# Import Supabase data layer
from supabase_data_layer import supabase_data

# Security configuration — fail fast if the secret is missing or left as the default.
_raw_secret = os.getenv("JWT_SECRET_KEY", "")
_default_insecure = "your-secret-key-change-in-production"
if not _raw_secret or _raw_secret.startswith(_default_insecure):
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is not set or is still the insecure default. "
        "Generate one with: openssl rand -hex 32"
    )
SECRET_KEY: str = _raw_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours

# OAuth2 scheme (authentication disabled - auto_error=False)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password"""
    try:
        password_bytes = plain_password.encode('utf-8')[:72]
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    password_bytes = password.encode('utf-8')[:72]  # Bcrypt 72 byte limit
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt


def decode_access_token(token: str) -> TokenData:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return TokenData(email=email, role=role)
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def authenticate_user(email: str, password: str):
    """Authenticate a user by email and password - SUPABASE VERSION"""
    if not supabase_data.client:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    user = supabase_data.get_user_by_email(email)
    
    if not user:
        return False
    
    if not verify_password(password, user.get('password', '')):
        return False
    
    return user


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    """Validate JWT token and return the authenticated user from Supabase."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    if not supabase_data.client:
        raise HTTPException(status_code=500, detail="Database not configured")

    user = supabase_data.get_user_by_email(email)
    if not user:
        raise credentials_exception

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact your administrator.",
        )

    return user


def require_role(allowed_roles: list):
    """Decorator to require specific roles for endpoint access"""
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user.get('role') not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    
    return role_checker


# ── All valid roles across all departments ────────────────────────────────
ALL_ROLES = [
    "Super Admin",
    # CEO
    "CEO",
    # Marketing
    "Marketing Manager", "Marketing Executive",
    # Sales
    "Sales Manager", "Counselor", "Team Leader",
    # Academic / Admin
    "Academic Admin", "Academic Executive",
    # Accounts
    "Accounts Manager", "Finance Executive",
    # HR
    "HR Manager", "HR Executive",
    # Legacy (kept for backwards compat)
    "Manager", "finance",
]

SENIOR_ROLES = ["Super Admin", "CEO", "Sales Manager", "Marketing Manager",
                 "Academic Admin", "Accounts Manager", "HR Manager", "Manager"]


async def get_current_counselor(current_user=Depends(get_current_user)):
    """Require Sales department role or higher."""
    sales_roles = ["Counselor", "Team Leader", "Sales Manager", "Manager",
                   "Super Admin", "CEO"]
    if current_user.get('role') not in sales_roles:
        raise HTTPException(status_code=403, detail="Sales access required")
    return current_user


async def get_current_team_leader(current_user=Depends(get_current_user)):
    """Require Team Leader level or higher."""
    tl_roles = ["Team Leader", "Sales Manager", "Manager", "Super Admin", "CEO"]
    if current_user.get('role') not in tl_roles:
        raise HTTPException(status_code=403, detail="Team Leader access required")
    return current_user


async def get_current_manager(current_user=Depends(get_current_user)):
    """Require Manager level or higher."""
    if current_user.get('role') not in SENIOR_ROLES:
        raise HTTPException(status_code=403, detail="Manager access required")
    return current_user


async def get_current_admin(current_user=Depends(get_current_user)):
    """Require Super Admin or CEO."""
    if current_user.get('role') not in ["Super Admin", "CEO"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
