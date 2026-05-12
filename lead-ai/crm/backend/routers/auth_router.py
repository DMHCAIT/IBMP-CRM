"""
Auth Router — /api/auth/*
==========================
Handles login and logout.  Extracted from main.py.

Routes:
  POST /api/auth/login   — issue JWT (with jti claim for revocation)
  POST /api/auth/logout  — immediately revoke token via blocklist
  GET  /api/auth/me      — return current user info
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from pathlib import Path
import os

from slowapi import Limiter
from slowapi.util import get_remote_address
from jose import jwt as _jose_jwt, JWTError

from auth import create_access_token, verify_password, SECRET_KEY, ALGORITHM
from supabase_data_layer import supabase_data
from logger_config import logger
from token_blocklist import blocklist

# Re-use the app-level limiter — injected at registration time via state
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Role → Department mapping (mirrors rbac.js getDepartment)
_DEPT_MAP: dict = {
    "Super Admin":          "Admin",
    "CEO":                  "CEO",
    "Marketing Manager":    "Marketing",
    "Marketing Executive":  "Marketing",
    "Sales Manager":        "Sales",
    "Counselor":            "Sales",
    "Team Leader":          "Sales",
    "Academic Admin":       "Academic",
    "Academic Executive":   "Academic",
    "Accounts Manager":     "Accounts",
    "Finance Executive":    "Accounts",
    "HR Manager":           "HR",
    "HR Executive":         "HR",
    # Legacy roles
    "Manager":              "Sales",
    "finance":              "Accounts",
}


class LoginRequest(BaseModel):
    username: str   # email used as username
    password: str


@router.post("/login")
@limiter.limit("10/minute")   # Per-IP: max 10 attempts / minute
@limiter.limit("50/hour")     # Per-IP: hard ceiling of 50 attempts / hour
async def login(request: Request, body: LoginRequest):
    """
    Login with email + password.
    Validates against Supabase users table with SQLite fallback for local dev.
    Returns a signed JWT on success.
    """
    logger.info(f"🔐 Login attempt: {body.username}")
    user = supabase_data.get_user_by_email(body.username)
    if user:
        logger.info(f"✅ User found in Supabase: {body.username} (role={user.get('role')}, active={user.get('is_active')})")
    else:
        logger.warning(f"❌ User NOT found in Supabase: {body.username}")

    # ── Local SQLite fallback (dev / test only) ───────────────────────────
    if not user:
        try:
            db_url = os.getenv("DATABASE_URL", "")
            if db_url:
                from sqlalchemy import create_engine
                from sqlalchemy.orm import sessionmaker

                if db_url.startswith("sqlite:///./"):
                    db_file = db_url.replace("sqlite:///./", "", 1)
                    db_abs = Path(__file__).resolve().parent.parent / db_file
                    db_url = f"sqlite:///{db_abs}"

                engine   = create_engine(db_url, connect_args={"check_same_thread": False}
                                         if db_url.startswith("sqlite") else {})
                Session  = sessionmaker(bind=engine, autoflush=False, autocommit=False)
                db       = Session()
                try:
                    # Import DBUser here to avoid circular import at module level
                    from main import DBUser
                    local = db.query(DBUser).filter(DBUser.email == body.username).first()
                    if local:
                        user = {
                            "id": local.id, "full_name": local.full_name,
                            "email": local.email, "phone": local.phone,
                            "password": local.password, "role": local.role,
                            "is_active": bool(local.is_active),
                        }
                finally:
                    db.close()
        except Exception as exc:
            logger.warning(f"Local DB fallback failed: {exc}")
            user = None

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is inactive. Contact your administrator.")

    # ── Password verification ─────────────────────────────────────────────
    raw_hash = user.get("password", "")
    if raw_hash.startswith("$2b$") or raw_hash.startswith("$2a$"):
        try:
            import bcrypt as _bcrypt
            ok = _bcrypt.checkpw(body.password.encode("utf-8"), raw_hash.encode("utf-8"))
        except Exception:
            ok = verify_password(body.password, raw_hash)
    else:
        # Legacy plain-text (migrate ASAP!)
        ok = (raw_hash == body.password)

    if not ok:
        logger.warning(f"❌ Password mismatch for: {body.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    _role       = user.get("role", "")
    _department = _DEPT_MAP.get(_role, "Sales")
    _company    = user.get("company")

    token = create_access_token({
        "sub":        user["email"],
        "role":       _role,
        "department": _department,
        "company":    _company,
        "tenant_id":  user.get("tenant_id"),   # injected for RLS passthrough
    })

    logger.info(
        f"✅ Login success: {user['email']} ({_role}/{_department}) "
        f"company={_company} tenant={user.get('tenant_id')}"
    )
    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id":         user.get("id"),
            "full_name":  user.get("full_name"),
            "email":      user.get("email"),
            "role":       _role,
            "department": _department,
            "company":    _company,
            "phone":      user.get("phone"),
            "is_active":  user.get("is_active", True),
            "tenant_id":  user.get("tenant_id"),
        },
    }


@router.post("/logout")
async def logout(request: Request):
    """
    Logout — immediately revokes the token via the blocklist.
    The token cannot be used again even if it hasn't expired yet.
    Works whether the blocklist backend is Redis or in-memory.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ", 1)[1]
        try:
            payload = _jose_jwt.decode(
                raw_token, SECRET_KEY, algorithms=[ALGORITHM],
                options={"verify_exp": False},  # revoke even if already expired
            )
            jti = payload.get("jti", "")
            exp = float(payload.get("exp", 0))
            email = payload.get("sub", "")

            if jti:
                blocklist.revoke(jti, exp)
                logger.info(f"🔒 Token revoked for {email} (jti={jti[:8]}…, backend={blocklist.backend})")
        except JWTError as exc:
            logger.warning(f"Logout: could not decode token — {exc}")

    return {"success": True, "message": "Logged out successfully — token revoked"}


@router.get("/me")
async def get_me(request: Request):
    """Return basic info about the currently authenticated user."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    raw_token = auth_header.split(" ", 1)[1]
    try:
        payload = _jose_jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
        email      = payload.get("sub", "")
        role       = payload.get("role", "")
        jti        = payload.get("jti", "")
        token_tid  = payload.get("tenant_id")
        token_dept = payload.get("department")
        token_co   = payload.get("company")

        if jti and blocklist.is_revoked(jti):
            raise HTTPException(status_code=401, detail="Token has been revoked")

        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = supabase_data.get_user_by_email(email)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        _role    = user.get("role", role)
        _dept    = user.get("department") or token_dept or _DEPT_MAP.get(_role, "Sales")
        _company = user.get("company") or token_co

        return {
            "id":         user.get("id"),
            "full_name":  user.get("full_name"),
            "email":      user.get("email"),
            "role":       _role,
            "department": _dept,
            "company":    _company,
            "is_active":  user.get("is_active", True),
            "tenant_id":  user.get("tenant_id") or token_tid,
        }
    except HTTPException:
        raise
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


# ── One-time admin setup ───────────────────────────────────────────────────────

class SetupRequest(BaseModel):
    setup_secret: str   # must match SETUP_SECRET env var
    email: str
    password: str
    full_name: str = "Super Admin"
    role: str = "Super Admin"


@router.post("/setup")
async def setup_first_admin(body: SetupRequest):
    """
    Creates the first admin user when the users table is empty.
    Protected by SETUP_SECRET env var — set it in Render dashboard.
    This endpoint becomes a no-op (403) once any user exists.
    """
    # Verify setup secret
    configured_secret = os.getenv("SETUP_SECRET", "")
    if not configured_secret:
        raise HTTPException(status_code=403, detail="SETUP_SECRET env var not configured on server")
    if body.setup_secret != configured_secret:
        raise HTTPException(status_code=403, detail="Invalid setup secret")

    # Only allow when users table is empty
    existing = supabase_data.get_all_users()
    if existing:
        raise HTTPException(
            status_code=403,
            detail=f"Setup not allowed — {len(existing)} user(s) already exist. Use the Users page to add more."
        )

    # Create the admin user with bcrypt password
    from auth import get_password_hash
    from datetime import datetime as _dt
    now = _dt.utcnow().isoformat() + "Z"
    user_data = {
        "full_name":  body.full_name,
        "email":      body.email.lower().strip(),
        "password":   get_password_hash(body.password),
        "role":       body.role,
        "is_active":  True,
        "created_at": now,
        "updated_at": now,
    }
    try:
        resp = supabase_data.client.table("users").insert(user_data).execute()
        created = resp.data[0] if resp.data else None
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create user in database")
        logger.info(f"✅ Setup: first admin user created — {body.email}")
        return {
            "success": True,
            "message": f"Admin user '{body.email}' created successfully. You can now log in.",
            "email":   body.email,
            "role":    body.role,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Setup error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
