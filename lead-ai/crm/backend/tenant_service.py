"""
IBMP CRM — Tenant Service
==========================
All tenant-level CRUD operations and plan enforcement.

Tenant lifecycle:
  create_tenant()         → called during SaaS signup wizard
  get_tenant_by_id()      → used in every authenticated request
  get_tenant_by_subdomain() → used in subdomain-based routing
  update_tenant()         → admin settings
  deactivate_tenant()     → churn / payment failure

Plan enforcement:
  check_seat_limit()      → called before creating a new user
  get_plan_limits()       → returns feature flags per plan
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase_data_layer import supabase_data
from logger_config import logger

# ---------------------------------------------------------------------------
# Plan definitions
# ---------------------------------------------------------------------------
PLAN_LIMITS: Dict[str, Dict[str, Any]] = {
    "starter": {
        "max_seats":        5,
        "max_leads":        1_000,
        "ai_scoring":       False,
        "whatsapp":         False,
        "google_sheets":    False,
        "api_access":       False,
        "custom_workflows": False,
        "sso":              False,
        "priority_support": False,
    },
    "growth": {
        "max_seats":        25,
        "max_leads":        20_000,
        "ai_scoring":       True,
        "whatsapp":         True,
        "google_sheets":    True,
        "api_access":       True,
        "custom_workflows": True,
        "sso":              False,
        "priority_support": False,
    },
    "enterprise": {
        "max_seats":        9_999,  # effectively unlimited
        "max_leads":        999_999,
        "ai_scoring":       True,
        "whatsapp":         True,
        "google_sheets":    True,
        "api_access":       True,
        "custom_workflows": True,
        "sso":              True,
        "priority_support": True,
    },
}

# Default tenant ID used to seed existing installations
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slugify(name: str) -> str:
    """Convert an org name to a URL-safe subdomain slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower())
    slug = slug.strip("-")
    return slug[:48] if slug else "org"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# TenantService
# ---------------------------------------------------------------------------

class TenantService:
    """
    Thin service layer over Supabase `tenants` table.
    All methods return plain dicts (same pattern as SupabaseDataLayer).
    """

    # ── Read ──────────────────────────────────────────────────────────────

    def get_tenant_by_id(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a tenant by UUID. Returns None if not found."""
        try:
            res = (
                supabase_data.client
                .table("tenants")
                .select("*")
                .eq("id", tenant_id)
                .single()
                .execute()
            )
            return res.data
        except Exception as exc:
            logger.debug("get_tenant_by_id(%s) — %s", tenant_id, exc)
            return None

    def get_tenant_by_subdomain(self, subdomain: str) -> Optional[Dict[str, Any]]:
        """Fetch a tenant by subdomain. Used in subdomain-based routing."""
        try:
            res = (
                supabase_data.client
                .table("tenants")
                .select("*")
                .eq("subdomain", subdomain.lower().strip())
                .eq("is_active", True)
                .single()
                .execute()
            )
            return res.data
        except Exception as exc:
            logger.debug("get_tenant_by_subdomain(%s) — %s", subdomain, exc)
            return None

    def list_tenants(
        self,
        is_active: Optional[bool] = None,
        plan: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List all tenants. Super-admin use only (no RLS at service layer)."""
        try:
            q = supabase_data.client.table("tenants").select("*")
            if is_active is not None:
                q = q.eq("is_active", is_active)
            if plan:
                q = q.eq("plan", plan)
            res = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
            return res.data or []
        except Exception as exc:
            logger.error("list_tenants — %s", exc)
            return []

    # ── Write ─────────────────────────────────────────────────────────────

    def create_tenant(
        self,
        name: str,
        plan: str = "starter",
        billing_email: Optional[str] = None,
        subdomain: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new tenant. Called from the onboarding signup wizard.
        Generates a unique subdomain if not provided.
        """
        if plan not in PLAN_LIMITS:
            raise ValueError(f"Invalid plan '{plan}'. Must be one of: {list(PLAN_LIMITS)}")

        slug = (subdomain or _slugify(name)).lower()
        slug = self._ensure_unique_subdomain(slug)

        limits = PLAN_LIMITS[plan]
        payload = {
            "id":            str(uuid.uuid4()),
            "name":          name.strip(),
            "subdomain":     slug,
            "plan":          plan,
            "max_seats":     limits["max_seats"],
            "billing_email": billing_email,
            "is_active":     True,
            "settings":      {},
            "created_at":    _now_iso(),
            "updated_at":    _now_iso(),
        }

        try:
            res = (
                supabase_data.client
                .table("tenants")
                .insert(payload)
                .execute()
            )
            created = (res.data or [None])[0]
            if created:
                logger.info("Tenant created: %s (%s) plan=%s", created["name"], created["id"], plan)
            return created
        except Exception as exc:
            logger.error("create_tenant failed: %s", exc)
            return None

    def update_tenant(
        self,
        tenant_id: str,
        updates: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Update mutable tenant fields.
        Immutable fields (id, created_at) are stripped automatically.
        """
        IMMUTABLE = {"id", "created_at", "subdomain"}
        safe = {k: v for k, v in updates.items() if k not in IMMUTABLE}
        if not safe:
            return self.get_tenant_by_id(tenant_id)

        # Enforce plan limits when upgrading/downgrading
        if "plan" in safe:
            new_plan = safe["plan"]
            if new_plan not in PLAN_LIMITS:
                raise ValueError(f"Invalid plan '{new_plan}'")
            safe["max_seats"] = PLAN_LIMITS[new_plan]["max_seats"]

        safe["updated_at"] = _now_iso()

        try:
            res = (
                supabase_data.client
                .table("tenants")
                .update(safe)
                .eq("id", tenant_id)
                .execute()
            )
            return (res.data or [None])[0]
        except Exception as exc:
            logger.error("update_tenant(%s) — %s", tenant_id, exc)
            return None

    def deactivate_tenant(self, tenant_id: str) -> bool:
        """Soft-delete a tenant (sets is_active=false). All RLS policies block access."""
        result = self.update_tenant(tenant_id, {"is_active": False})
        return result is not None

    def delete_tenant(self, tenant_id: str) -> bool:
        """
        Hard-delete. CASCADE FK will delete all tenant data.
        Only callable by super-admins — use with extreme caution.
        """
        if tenant_id == DEFAULT_TENANT_ID:
            raise ValueError("Cannot delete the default tenant")
        try:
            supabase_data.client.table("tenants").delete().eq("id", tenant_id).execute()
            logger.warning("Tenant hard-deleted: %s", tenant_id)
            return True
        except Exception as exc:
            logger.error("delete_tenant(%s) — %s", tenant_id, exc)
            return False

    # ── Seat & plan enforcement ────────────────────────────────────────────

    def check_seat_limit(self, tenant_id: str) -> Dict[str, Any]:
        """
        Check whether the tenant can add another user.
        Returns {"allowed": bool, "current": int, "max": int, "plan": str}
        """
        tenant = self.get_tenant_by_id(tenant_id)
        if not tenant:
            return {"allowed": False, "current": 0, "max": 0, "plan": "unknown"}

        try:
            count_res = (
                supabase_data.client
                .table("users")
                .select("id", count="exact")
                .eq("tenant_id", tenant_id)
                .eq("is_active", True)
                .execute()
            )
            current = count_res.count or 0
        except Exception:
            current = 0

        max_seats = tenant.get("max_seats", 5)
        return {
            "allowed": current < max_seats,
            "current": current,
            "max":     max_seats,
            "plan":    tenant.get("plan", "starter"),
        }

    def get_plan_limits(self, tenant_id: str) -> Dict[str, Any]:
        """Return the feature limits for a tenant's current plan."""
        tenant = self.get_tenant_by_id(tenant_id)
        if not tenant:
            return PLAN_LIMITS["starter"]
        return PLAN_LIMITS.get(tenant.get("plan", "starter"), PLAN_LIMITS["starter"])

    def get_usage_stats(self, tenant_id: str) -> Dict[str, Any]:
        """
        Return current usage numbers for the tenant dashboard.
        """
        def _count(table: str, **filters) -> int:
            try:
                q = supabase_data.client.table(table).select("id", count="exact")
                q = q.eq("tenant_id", tenant_id)
                for k, v in filters.items():
                    q = q.eq(k, v)
                return q.execute().count or 0
            except Exception:
                return 0

        seats = self.check_seat_limit(tenant_id)
        return {
            "leads":   _count("leads"),
            "users":   seats["current"],
            "max_users": seats["max"],
            "plan":    seats["plan"],
        }

    # ── Internal helpers ───────────────────────────────────────────────────

    def _ensure_unique_subdomain(self, base: str) -> str:
        """Append a numeric suffix until the subdomain is unique."""
        candidate = base
        suffix = 1
        while True:
            existing = self.get_tenant_by_subdomain(candidate)
            if not existing:
                return candidate
            candidate = f"{base}-{suffix}"
            suffix += 1


# Module-level singleton
tenant_service = TenantService()
