"""
Courses Router — /api/courses/*
=================================
Full CRUD for course catalogue.

Routes:
  POST   /api/courses              — create course
  GET    /api/courses              — list courses (with filters)
  PUT    /api/courses/{course_id}  — update course
  DELETE /api/courses/{course_id}  — delete course
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException

from cache import invalidate_cache
from logger_config import logger
from supabase_data_layer import supabase_data

router = APIRouter(prefix="/api/courses", tags=["Courses"])


def _course_cache():
    from main import COURSE_CACHE
    return COURSE_CACHE


@router.post("", status_code=201)
async def create_course(body: dict):
    """Create a course — Supabase only."""
    try:
        body["created_at"] = datetime.utcnow().isoformat()
        created = supabase_data.create_course(body)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create course")
        invalidate_cache(_course_cache())
        return created
    except HTTPException:
        raise
    except Exception as exc:
        err = str(exc)
        if "duplicate key" in err.lower() or "unique" in err.lower():
            raise HTTPException(status_code=409, detail="A course with this name already exists.")
        logger.error(f"create_course error: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create course.")


@router.get("")
async def get_courses(
    skip:     int = 0,
    limit:    int = 100,
    category: Optional[str] = None,
    active:   Optional[bool] = None,
):
    """List courses with optional filters — Supabase only."""
    try:
        COURSE_CACHE = _course_cache()
        _ck = f"courses:{skip}:{limit}:{category}:{active}"
        if _ck in COURSE_CACHE:
            return COURSE_CACHE[_ck]

        query = supabase_data.client.table("courses").select("*")
        if category:
            query = query.eq("category", category)
        if active is not None:
            query = query.eq("is_active", active)
        response = query.range(skip, skip + limit - 1).execute()
        result = response.data or []
        COURSE_CACHE[_ck] = result
        return result
    except Exception as exc:
        logger.error(f"Error getting courses: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch courses")


@router.put("/{course_id}")
async def update_course(course_id: int, body: dict):
    """Update a course — Supabase only."""
    try:
        existing = supabase_data.client.table("courses").select("id").eq("id", course_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Course not found")
        updated = supabase_data.update_course(course_id, body)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update course")
        invalidate_cache(_course_cache())
        return updated
    except HTTPException:
        raise
    except Exception as exc:
        err = str(exc)
        if "duplicate key" in err.lower() or "unique" in err.lower():
            raise HTTPException(status_code=409, detail="A course with this name already exists.")
        logger.error(f"update_course error: {exc}")
        raise HTTPException(status_code=500, detail="Failed to update course.")


@router.delete("/{course_id}")
async def delete_course(course_id: int):
    """Delete a course — Supabase only."""
    try:
        existing = supabase_data.client.table("courses").select("id").eq("id", course_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Course not found")
        if not supabase_data.delete_course(course_id):
            raise HTTPException(status_code=500, detail="Failed to delete course")
        invalidate_cache(_course_cache())
        return {"message": "Course deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"delete_course error: {exc}")
        raise HTTPException(status_code=409, detail="Cannot delete course — it may be referenced by existing leads.")
