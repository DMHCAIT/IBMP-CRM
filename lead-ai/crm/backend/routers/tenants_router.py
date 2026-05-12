"""
IBMP CRM — Tenants Router
===========================
REST API for tenant management (SaaS multi-tenancy).

Routes:
  POST   /api/tenants                        — Create tenant (onboarding)
  GET    /api/tenants/current                — Get own tenant details
  PATCH  /api/tenants/current                — Update own tenant settings
  GET    /api/tenants/current/usage          — Seat & lead usage stats
  GET    /api/tenants/current/plan           — Plan limits / feature flags
  GET    /api/tenants                        — List all tenants (super-admin)
  GET    /api/tenants/{id}                   — Get tenant by ID (super-admin)
  PATCH  /api/tenants/{id}                   — Update any tenant (super-admin)
  DELETE /api/tenants/{id}                   — Deactivate tenant (super-admin)
  POST   /api/tenants/lookup-subdomain       — Check subdomain availability

Auth:
  - Public: POST /api/tenants (signup), POST /api/tenants/lookup-subdomain
  - Authenticated tenant user: /current/* endpoints
  - Super Admin only: list, get/{id}, patch/{id}, delete/{id}
"""

import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, validator

from auth import get_current_user, get_current_admin
from tenant_service import tenant_service, PLAN_LIMITS
from logger_config import logger

router = APIRouter(prefix="/api/tenants", tags=["Tenants"])


# ─── Request / Response models ────────────────────────────────────────────────

class CreateTenantRequest(BaseModel):
    name:           str   = Field(..., min_length=2, max_length=120)
    plan:           str   = Field(default="starter")
    billing_email:  Optional[str] = None
    subdomain:      Optional[str] = Field(default=None, min_length=2, max_length=48)

    @validator("plan")
    def valid_plan(cls, v):
        if v not in PLAN_LIMITS:
            raise ValueError(f"plan must be one of: {list(PLAN_LIMITS)}")
        return v

    @validator("subdomain", pre=True, always=True)
    def clean_subdomain(cls, v):
        if v is None:
            return v
        import re
        slug = re.sub(r"[^a-z0-9-]+", "-", v.strip().lower()).strip("-")
        if not slug:
            raise ValueError("subdomain contains no valid characters")
        return slug


class UpdateTenantRequest(BaseModel):
    name:           Optional[str] = Field(default=None, min_length=2, max_length=120)
    billing_email:  Optional[str] = None
    plan:           Optional[str] = None
    settings:       Optional[Dict[str, Any]] = None

    @validator("plan")
    def valid_plan(cls, v):
        if v is not None and v not in PLAN_LIMITS:
            raise ValueError(f"plan must be one of: {list(PLAN_LIMITS)}")
        return v


class SubdomainCheckRequest(BaseModel):
    subdomain: str = Field(..., min_length=2, max_length=48)


# ─── Public endpoints ─────────────────────────────────────────────────────────

@router.post("")
async def create_tenant(body: CreateTenantRequest):
    """
    Create a new tenant. Called by the onboarding wizard on signup.
    No authentication required (creates the first user's org).
    """
    tenant = tenant_service.create_tenant(
        name          = body.name,
        plan          = body.plan,
        billing_email = body.billing_email,
        subdomain     = body.subdomain,
    )
    if not tenant:
        raise HTTPException(status_code=500, detail="Failed to create tenant. Please try again.")
    return {"success": True, "tenant": tenant}


@router.post("/lookup-subdomain")
async def check_subdomain(body: SubdomainCheckRequest):
    """
    Check whether a subdomain is available.
    Returns {available: bool, suggestion: str}.
    """
    import re
    slug = re.sub(r"[^a-z0-9-]+", "-", body.subdomain.strip().lower()).strip("-")
    if not slug:
        return {"available": False, "suggestion": None}

    existing = tenant_service.get_tenant_by_subdomain(slug)
    if not existing:
        return {"available": True, "subdomain": slug}

    # Generate suggestion with suffix
    for i in range(1, 20):
        candidate = f"{slug}-{i}"
        if not tenant_service.get_tenant_by_subdomain(candidate):
            return {"available": False, "subdomain": slug, "suggestion": candidate}
    return {"available": False, "subdomain": slug, "suggestion": None}


# ─── Tenant-scoped (own tenant) ───────────────────────────────────────────────

@router.get("/current")
async def get_current_tenant(current_user=Depends(get_current_user)):
    """Return the authenticated user's tenant details."""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated with this account")

    tenant = tenant_service.get_tenant_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/current")
async def update_current_tenant(
    body: UpdateTenantRequest,
    current_user=Depends(get_current_user),
):
    """
    Update the authenticated user's tenant.
    Only Super Admin may change plan.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated with this account")

    role = current_user.get("role", "")
    if body.plan and role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only Super Admins can change the plan")

    updates = body.dict(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    tenant = tenant_service.update_tenant(tenant_id, updates)
    if not tenant:
        raise HTTPException(status_code=500, detail="Failed to update tenant")
    return {"success": True, "tenant": tenant}


@router.get("/current/usage")
async def get_tenant_usage(current_user=Depends(get_current_user)):
    """Return seat count and lead count for the current tenant."""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated with this account")
    return tenant_service.get_usage_stats(tenant_id)


@router.get("/current/plan")
async def get_tenant_plan(current_user=Depends(get_current_user)):
    """Return feature flags and limits for the current tenant's plan."""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        return PLAN_LIMITS["starter"]
    return tenant_service.get_plan_limits(tenant_id)


# ─── Super-admin endpoints ────────────────────────────────────────────────────

def _require_super_admin(current_user=Depends(get_current_user)):
    if current_user.get("role") != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin required")
    return current_user


@router.get("")
async def list_tenants(
    is_active: Optional[bool] = None,
    plan: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    _: dict = Depends(_require_super_admin),
):
    """List all tenants. Super Admin only."""
    tenants = tenant_service.list_tenants(
        is_active=is_active,
        plan=plan,
        limit=limit,
        offset=offset,
    )
    return {"total": len(tenants), "tenants": tenants}


@router.get("/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    _: dict = Depends(_require_super_admin),
):
    """Get any tenant by ID. Super Admin only."""
    tenant = tenant_service.get_tenant_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    body: UpdateTenantRequest,
    _: dict = Depends(_require_super_admin),
):
    """Update any tenant. Super Admin only."""
    updates = body.dict(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    tenant = tenant_service.update_tenant(tenant_id, updates)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found or update failed")
    return {"success": True, "tenant": tenant}


@router.delete("/{tenant_id}")
async def deactivate_tenant(
    tenant_id: str,
    hard: bool = False,
    _: dict = Depends(_require_super_admin),
):
    """
    Deactivate a tenant (soft delete by default).
    Pass ?hard=true to permanently delete all tenant data (DANGEROUS).
    """
    from tenant_service import DEFAULT_TENANT_ID
    if tenant_id == DEFAULT_TENANT_ID:
        raise HTTPException(status_code=400, detail="Cannot delete the default tenant")

    if hard:
        ok = tenant_service.delete_tenant(tenant_id)
    else:
        ok = tenant_service.deactivate_tenant(tenant_id)

    if not ok:
        raise HTTPException(status_code=404, detail="Tenant not found")

    action = "deleted" if hard else "deactivated"
    logger.warning("Tenant %s: %s by super-admin", tenant_id, action)
    return {"success": True, "action": action, "tenant_id": tenant_id}
