"""
Hospitals Router — /api/hospitals/*
=====================================
Full CRUD for hospital records.

Routes:
  POST   /api/hospitals              — create hospital
  GET    /api/hospitals              — list hospitals (with filters)
  PUT    /api/hospitals/{hospital_id} — update hospital
  DELETE /api/hospitals/{hospital_id} — delete hospital
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException

from logger_config import logger
from supabase_data_layer import supabase_data

router = APIRouter(prefix="/api/hospitals", tags=["Hospitals"])


@router.post("", status_code=201)
async def create_hospital(body: dict):
    """Create a hospital record — Supabase only."""
    try:
        body["created_at"] = datetime.utcnow().isoformat()
        created = supabase_data.create_hospital(body)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create hospital")
        return created
    except HTTPException:
        raise
    except Exception as exc:
        err = str(exc)
        if "duplicate key" in err.lower() or "unique" in err.lower():
            raise HTTPException(status_code=409, detail="A hospital with this name already exists.")
        logger.error(f"create_hospital error: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create hospital.")


@router.get("")
async def get_hospitals(
    skip:    int = 0,
    limit:   int = 100,
    country: Optional[str] = None,
    status:  Optional[str] = None,
):
    """List hospitals with optional filters — Supabase only."""
    try:
        query = supabase_data.client.table("hospitals").select("*")
        if country:
            query = query.eq("country", country)
        if status:
            query = query.eq("collaboration_status", status)
        response = query.range(skip, skip + limit - 1).execute()
        return response.data or []
    except Exception as exc:
        logger.error(f"Error getting hospitals: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch hospitals")


@router.put("/{hospital_id}")
async def update_hospital(hospital_id: int, body: dict):
    """Update a hospital record — Supabase only."""
    try:
        existing = supabase_data.client.table("hospitals").select("id").eq("id", hospital_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Hospital not found")
        updated = supabase_data.update_hospital(hospital_id, body)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update hospital")
        return updated
    except HTTPException:
        raise
    except Exception as exc:
        err = str(exc)
        if "duplicate key" in err.lower() or "unique" in err.lower():
            raise HTTPException(status_code=409, detail="A hospital with this name already exists.")
        logger.error(f"update_hospital error: {exc}")
        raise HTTPException(status_code=500, detail="Failed to update hospital.")


@router.delete("/{hospital_id}")
async def delete_hospital(hospital_id: int):
    """Delete a hospital record — Supabase only."""
    try:
        existing = supabase_data.client.table("hospitals").select("id").eq("id", hospital_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Hospital not found")
        if not supabase_data.delete_hospital(hospital_id):
            raise HTTPException(status_code=500, detail="Failed to delete hospital")
        return {"message": "Hospital deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"delete_hospital error: {exc}")
        raise HTTPException(status_code=409, detail="Cannot delete hospital — it may be referenced by existing leads.")
