"""
Users Router — /api/users/*, /api/counselors/*
===============================================
Handles user CRUD, password management, counselor lists,
performance metrics, workload stats, and per-user stats.

Routes:
  GET    /api/users                          — list all users
  POST   /api/users                          — create user
  GET    /api/users/{user_id}                — get user by ID
  PUT    /api/users/{user_id}                — update user
  DELETE /api/users/{user_id}                — delete user
  PUT    /api/users/{user_id}/password       — change own password
  PUT    /api/users/{user_id}/admin-reset-password — admin password reset
  GET    /api/users/{user_id}/stats          — counselor KPI snapshot
  GET    /api/users/{user_id}/performance    — daily sparkline data

  GET    /api/counselors                     — counselors + stats
  GET    /api/counselors/performance         — live performance table
  GET    /api/counselors/workload            — workload distribution
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException

from auth import get_password_hash, verify_password
from token_blocklist import blocklist
from cache import cache_async_result
from logger_config import logger
from supabase_data_layer import supabase_data

router = APIRouter(tags=["Users"])


# ── USERS CRUD ────────────────────────────────────────────────────────────────

@router.get("/api/users")
async def get_users():
    """List all users — strips password field before returning."""
    try:
        users = supabase_data.get_all_users()
        return [
            {k: v for k, v in u.items() if k != "password"} if isinstance(u, dict) else u
            for u in (users or [])
        ]
    except Exception as exc:
        logger.error(f"Error fetching users: {exc}")
        return []


@router.get("/api/users/{user_id}")
async def get_user(user_id: int):
    """Get a specific user by ID — Supabase only."""
    user = supabase_data.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {k: v for k, v in user.items() if k != "password"}


@router.post("/api/users", status_code=201)
async def create_user(body: dict):
    """Create a new user — hashes password before storing."""
    existing = supabase_data.get_user_by_email(body.get("email", ""))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    payload = {
        "full_name":  body.get("full_name"),
        "email":      body.get("email"),
        "phone":      body.get("phone"),
        "password":   get_password_hash(body.get("password", "")),
        "role":       body.get("role", "Counselor"),
        "reports_to": body.get("reports_to"),
        "is_active":  body.get("is_active", True),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    try:
        db_user = supabase_data.create_user(payload)
        if not db_user:
            raise HTTPException(status_code=500, detail="Failed to create user")
        return {k: v for k, v in db_user.items() if k != "password"}
    except Exception as exc:
        logger.error(f"Error creating user: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create user")


@router.put("/api/users/{user_id}")
async def update_user(user_id: int, body: dict):
    """Update user information — Supabase only."""
    db_user = supabase_data.get_user_by_id(user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Never allow password to be set via this endpoint
    body.pop("password", None)
    body["updated_at"] = datetime.utcnow().isoformat()

    updated = supabase_data.update_user(user_id, body)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update user")
    return {k: v for k, v in updated.items() if k != "password"}


@router.delete("/api/users/{user_id}")
async def delete_user(user_id: int):
    """Delete a user — Supabase only."""
    db_user = supabase_data.get_user_by_id(user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not supabase_data.delete_user(user_id):
        raise HTTPException(status_code=500, detail="Failed to delete user")
    return {"message": "User deleted successfully"}


# ── PASSWORD MANAGEMENT ───────────────────────────────────────────────────────

@router.put("/api/users/{user_id}/password")
async def change_password(user_id: int, body: dict):
    """
    Let a user change their own password.
    Requires: { current_password, new_password }
    """
    user = supabase_data.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_password = body.get("current_password", "")
    new_password     = body.get("new_password", "")

    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="current_password and new_password are required")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    # Verify current password
    stored_hash = user.get("password", "")
    try:
        import bcrypt as _bcrypt
        ok = _bcrypt.checkpw(current_password.encode(), stored_hash.encode())
    except Exception:
        ok = verify_password(current_password, stored_hash)

    if not ok:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    hashed = get_password_hash(new_password)
    supabase_data.update_user(user_id, {"password": hashed, "updated_at": datetime.utcnow().isoformat()})

    # Invalidate ALL existing tokens for this user — forces re-login on other devices
    import time as _time
    blocklist.revoke_all_for_user(
        user.get("email", ""),
        current_exp=_time.time() + 86400,  # cover max 24h token lifetime
    )
    logger.info(f"Password changed and all tokens revoked for user {user_id}")
    return {"success": True, "message": "Password changed successfully — please log in again on other devices"}


@router.put("/api/users/{user_id}/admin-reset-password")
async def admin_reset_password(user_id: int, body: dict):
    """
    Admin-level password reset — no current password required.
    Requires: { new_password }  or  { temp_password }
    """
    user = supabase_data.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_password = body.get("new_password") or body.get("temp_password", "")
    if not new_password:
        raise HTTPException(status_code=400, detail="new_password is required")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    hashed = get_password_hash(new_password)
    supabase_data.update_user(user_id, {
        "password":   hashed,
        "updated_at": datetime.utcnow().isoformat(),
    })
    # Invalidate all tokens for this user — admin reset means all sessions expire
    import time as _time
    blocklist.revoke_all_for_user(
        user.get("email", ""),
        current_exp=_time.time() + 86400,
    )
    logger.info(f"Admin reset password for user {user_id}, all tokens revoked")
    return {"success": True, "message": f"Password reset for {user.get('full_name', 'user')} — all sessions invalidated"}


# ── USER STATS & PERFORMANCE ──────────────────────────────────────────────────

@router.get("/api/users/{user_id}/stats")
async def get_user_stats(user_id: int):
    """Per-user KPI snapshot for counselor dashboard — Supabase only."""
    try:
        user = supabase_data.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        response = supabase_data.client.table("leads").select(
            "status,ai_segment,expected_revenue,created_at,follow_up_date"
        ).eq("assigned_to", user["full_name"]).execute()
        assigned = response.data or []

        total    = len(assigned)
        enrolled = sum(1 for l in assigned if l.get("status") == "Enrolled")
        hot      = sum(1 for l in assigned if l.get("ai_segment") == "Hot")
        warm     = sum(1 for l in assigned if l.get("ai_segment") == "Warm")
        revenue  = sum(l.get("expected_revenue", 0) or 0 for l in assigned if l.get("status") == "Enrolled")

        today = datetime.utcnow().date()
        today_leads = sum(
            1 for l in assigned
            if l.get("created_at") and datetime.fromisoformat(l["created_at"].replace("Z", "+00:00")).date() == today
        )
        followups_today = sum(
            1 for l in assigned
            if l.get("follow_up_date") and l["follow_up_date"][:10] == today.isoformat()
        )

        return {
            "user_id":         user_id,
            "name":            user["full_name"],
            "total_leads":     total,
            "enrolled":        enrolled,
            "hot_leads":       hot,
            "warm_leads":      warm,
            "today_leads":     today_leads,
            "followups_today": followups_today,
            "revenue":         round(revenue, 2),
            "conversion_rate": round((enrolled / max(total, 1)) * 100, 2),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"User stats error: {exc}")
        return {"total_leads": 0, "enrolled": 0, "hot_leads": 0, "warm_leads": 0,
                "today_leads": 0, "followups_today": 0, "revenue": 0, "conversion_rate": 0}


@router.get("/api/users/{user_id}/performance")
async def get_user_performance(user_id: int, days: int = 7):
    """Daily performance sparkline for a counselor — Supabase only."""
    try:
        user = supabase_data.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        cutoff = datetime.utcnow() - timedelta(days=days)
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("status,created_at").eq("assigned_to", user["full_name"]).range(0, 99999).execute()
        leads = [l for l in (response.data or []) if l.get("created_at") and datetime.fromisoformat(l["created_at"].replace("Z", "+00:00")) >= cutoff]

        daily: dict = defaultdict(lambda: {"leads": 0, "enrolled": 0})
        for lead in leads:
            try:
                dt = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00"))
                day_key = dt.strftime("%a")
                daily[day_key]["leads"] += 1
                if lead.get("status") == "Enrolled":
                    daily[day_key]["enrolled"] += 1
            except Exception:
                pass

        return [{"day": k, **v} for k, v in daily.items()]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"User performance error: {exc}")
        return []


# ── COUNSELORS ────────────────────────────────────────────────────────────────

@router.get("/api/counselors")
async def get_counselors():
    """List counselors with lead counts and conversion stats."""
    try:
        all_users = supabase_data.get_all_users()
        users = [u for u in all_users if u.get("role") in ["Counselor", "Team Leader", "Manager"] and u.get("is_active")]

        # Use .range() to bypass 1000 row limit
        all_leads_resp = supabase_data.client.table("leads").select("assigned_to,status").range(0, 99999).execute()
        all_leads = all_leads_resp.data or []

        counselors = []
        for user in users:
            name   = user.get("full_name")
            uLeads = [l for l in all_leads if l.get("assigned_to") == name]
            total  = len(uLeads)
            converted = sum(1 for l in uLeads if l.get("status") == "Enrolled")
            counselors.append({
                "id":               user.get("id"),
                "name":             name,
                "email":            user.get("email"),
                "phone":            user.get("phone") or "",
                "is_active":        user.get("is_active"),
                "specialization":   user.get("role"),
                "total_leads":      total,
                "total_conversions": converted,
                "conversion_rate":  round((converted / total * 100) if total > 0 else 0, 1),
                "created_at":       user.get("created_at"),
            })
        return counselors
    except Exception as exc:
        logger.error(f"Error fetching counselors: {exc}")
        return []


@router.get("/api/counselors/performance")
async def get_counselor_performance():
    """Live counselor performance computed from leads table."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("assigned_to,status,ai_segment").range(0, 99999).execute()
        leads = response.data or []

        counselor_stats: dict = {}
        for lead in leads:
            name = lead.get("assigned_to") or "Unassigned"
            if name not in counselor_stats:
                counselor_stats[name] = {"total": 0, "enrolled": 0, "hot": 0, "warm": 0, "cold": 0}
            counselor_stats[name]["total"] += 1
            if lead.get("status") == "Enrolled":
                counselor_stats[name]["enrolled"] += 1
            seg = (lead.get("ai_segment") or "").lower()
            if seg == "hot":
                counselor_stats[name]["hot"] += 1
            elif seg == "warm":
                counselor_stats[name]["warm"] += 1
            else:
                counselor_stats[name]["cold"] += 1

        return [
            {
                "counselor":       name,
                "total_leads":     stats["total"],
                "enrolled":        stats["enrolled"],
                "hot_leads":       stats["hot"],
                "warm_leads":      stats["warm"],
                "cold_leads":      stats["cold"],
                "conversion_rate": round((stats["enrolled"] / max(stats["total"], 1)) * 100, 2),
            }
            for name, stats in counselor_stats.items()
        ]
    except Exception as exc:
        logger.error(f"Counselor performance error: {exc}")
        return []


@router.get("/api/counselors/workload")
async def get_counselor_workloads():
    """Workload distribution across all active counselors (cached)."""
    try:
        users = supabase_data.get_all_users()
        counselors = [u for u in users if u.get("role") in ["Counselor", "Manager", "Team Leader"] and u.get("is_active")]

        # Use .range() to bypass 1000 row limit
        all_leads_resp = supabase_data.client.table("leads").select("assigned_to,status,ai_score").range(0, 99999).execute()
        leads_data = all_leads_resp.data or []

        workloads = []
        for c in counselors:
            name = c["full_name"]
            active = [l for l in leads_data if l.get("assigned_to") == name and l.get("status") not in ["Junk", "Lost"]]
            n = len(active)
            avg_score = sum(l.get("ai_score", 0) or 0 for l in active) / n if n else 0
            workloads.append({
                "full_name":        name,
                "email":            c.get("email"),
                "role":             c.get("role"),
                "active_leads":     n,
                "performance_score": round(avg_score, 1),
                "status":           "overloaded" if n > 30 else "busy" if n > 20 else "available",
            })

        return {
            "counselors":        workloads,
            "total_counselors":  len(workloads),
            "total_active_leads": sum(c["active_leads"] for c in workloads),
            "average_workload":  round(sum(c["active_leads"] for c in workloads) / len(workloads), 1) if workloads else 0,
        }
    except Exception as exc:
        logger.error(f"Counselor workload error: {exc}")
        return {"counselors": [], "total_counselors": 0, "total_active_leads": 0, "average_workload": 0}
