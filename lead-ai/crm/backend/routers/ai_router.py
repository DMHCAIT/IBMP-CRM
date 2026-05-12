"""
AI Router — /api/ai/*, /api/ml/*
==================================
AI-powered smart features and ML model info.

Routes:
  GET  /api/ai/status                        — AI assistant availability
  POST /api/ai/search                        — natural-language lead search
  POST /api/ai/smart-reply/{lead_id}         — personalised message generation
  GET  /api/ai/summarize-notes/{lead_id}     — note summarisation
  GET  /api/ai/next-action/{lead_id}         — next-best-action prediction
  GET  /api/ai/conversion-barriers/{lead_id} — barrier analysis
  POST /api/ai/recommend-course/{lead_id}    — course recommendation
  GET  /api/ml/model-info                    — CatBoost model metadata
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ai_assistant import ai_assistant
from logger_config import logger
from supabase_data_layer import supabase_data

router = APIRouter(tags=["AI / ML"])


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/api/ai/status")
async def ai_status():
    """Check AI assistant availability and configuration."""
    return {
        "available": ai_assistant.is_available(),
        "model":     ai_assistant.model if ai_assistant.is_available() else None,
        "features":  [
            "Natural Language Search",
            "Smart Reply Generation",
            "Note Summarization",
            "Next Action Prediction",
            "Conversion Barrier Analysis",
            "Course Recommendations",
        ] if ai_assistant.is_available() else [],
        "status": "ready" if ai_assistant.is_available() else "not_configured",
    }


# ── Natural-language search ───────────────────────────────────────────────────

@router.post("/api/ai/search")
async def ai_natural_language_search(
    query: str = Query(..., description="Natural language search, e.g. 'hot leads from India interested in MBBS'")
):
    """Search leads using natural language — Supabase only."""
    if not ai_assistant.is_available():
        raise HTTPException(status_code=503, detail="AI features unavailable — configure OPENAI_API_KEY")

    try:
        response = supabase_data.client.table("leads").select(
            "id,full_name,country,course_interested,status,ai_segment,ai_score,conversion_probability,updated_at"
        ).limit(500).execute()
        lead_dicts = response.data or []

        results = await ai_assistant.natural_language_search(query, lead_dicts)
        logger.info(f"🔍 AI Search: '{query}' → {len(results)} results")
        return {"query": query, "results_count": len(results), "leads": results}
    except Exception as exc:
        logger.error(f"AI search failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Smart reply ───────────────────────────────────────────────────────────────

@router.post("/api/ai/smart-reply/{lead_id}")
async def generate_smart_reply(
    lead_id: str,
    context: str = Query("follow-up", description="follow-up | welcome | reminder | thank-you"),
):
    """Generate an AI-powered personalised message for a lead."""
    if not ai_assistant.is_available():
        raise HTTPException(status_code=503, detail="AI features unavailable — configure OPENAI_API_KEY")

    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    try:
        lead_data = {
            "full_name":    lead.get("full_name"),
            "country":      lead.get("country"),
            "course_interested": lead.get("course_interested"),
            "status":       lead.get("status"),
            "ai_score":     lead.get("ai_score"),
        }
        message = await ai_assistant.generate_smart_reply(lead_data, context)
        logger.info(f"✉️ Generated smart reply for lead {lead_id} ({context})")
        return {
            "lead_id":      lead_id,
            "lead_name":    lead.get("full_name"),
            "context":      context,
            "message":      message,
            "generated_at": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        logger.error(f"Smart reply failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Summarise notes ───────────────────────────────────────────────────────────

@router.get("/api/ai/summarize-notes/{lead_id}")
async def summarize_lead_notes(lead_id: str):
    """Summarise all notes for a lead using AI."""
    if not ai_assistant.is_available():
        raise HTTPException(status_code=503, detail="AI features unavailable — configure OPENAI_API_KEY")

    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    iid   = lead.get("id")
    notes = supabase_data.get_notes_for_lead(iid) if iid else []
    if not notes:
        return {"lead_id": lead_id, "summary": "No notes available for this lead.", "notes_count": 0}

    try:
        notes_data = [{"content": n.get("content"), "created_at": n.get("created_at")} for n in notes]
        summary = await ai_assistant.summarize_notes(notes_data)
        logger.info(f"📝 Summarised {len(notes)} notes for lead {lead_id}")
        return {
            "lead_id":      lead_id,
            "lead_name":    lead.get("full_name"),
            "notes_count":  len(notes),
            "summary":      summary,
            "generated_at": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        logger.error(f"Note summarisation failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Next action ───────────────────────────────────────────────────────────────

@router.get("/api/ai/next-action/{lead_id}")
async def predict_next_action(lead_id: str):
    """AI-powered prediction of best next action for a lead."""
    if not ai_assistant.is_available():
        raise HTTPException(status_code=503, detail="AI features unavailable — configure OPENAI_API_KEY")

    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    iid = lead.get("id")
    activities: list = []
    if iid:
        try:
            act_resp = supabase_data.client.table("activities").select("activity_type,created_at").eq("lead_id", iid).order("created_at", desc=True).limit(5).execute()
            activities = [{"activity_type": a.get("activity_type"), "created_at": a.get("created_at")} for a in (act_resp.data or [])]
        except Exception:
            pass

    try:
        lead_data = {
            "full_name":    lead.get("full_name"),
            "status":       lead.get("status"),
            "ai_score":     lead.get("ai_score"),
            "ai_segment":   lead.get("ai_segment"),
            "conversion_probability": lead.get("conversion_probability"),
            "course_interested": lead.get("course_interested"),
            "country":      lead.get("country"),
        }
        prediction = await ai_assistant.predict_best_action(lead_data, activities)
        logger.info(f"🎯 Predicted next action for lead {lead_id}: {prediction.get('action')}")
        return {
            "lead_id":      lead_id,
            "lead_name":    lead.get("full_name"),
            "prediction":   prediction,
            "generated_at": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        logger.error(f"Action prediction failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Conversion barriers ───────────────────────────────────────────────────────

@router.get("/api/ai/conversion-barriers/{lead_id}")
async def analyze_conversion_barriers(lead_id: str):
    """Identify potential barriers preventing lead conversion."""
    if not ai_assistant.is_available():
        raise HTTPException(status_code=503, detail="AI features unavailable — configure OPENAI_API_KEY")

    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    iid   = lead.get("id")
    notes = supabase_data.get_notes_for_lead(iid)[:10] if iid else []

    try:
        lead_data  = {"status": lead.get("status"), "ai_score": lead.get("ai_score"),
                      "conversion_probability": lead.get("conversion_probability"),
                      "expected_revenue": lead.get("expected_revenue")}
        notes_data = [{"content": n.get("content")} for n in notes]
        barriers   = await ai_assistant.analyze_conversion_barriers(lead_data, notes_data)
        logger.info(f"🚧 Identified {len(barriers)} barriers for lead {lead_id}")
        return {
            "lead_id":        lead_id,
            "lead_name":      lead.get("full_name"),
            "barriers":       barriers,
            "barriers_count": len(barriers),
            "generated_at":   datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        logger.error(f"Barrier analysis failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Course recommendation ─────────────────────────────────────────────────────

@router.post("/api/ai/recommend-course/{lead_id}")
async def recommend_course(lead_id: str):
    """AI-powered course recommendation based on lead profile."""
    if not ai_assistant.is_available():
        raise HTTPException(status_code=503, detail="AI features unavailable — configure OPENAI_API_KEY")

    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    try:
        courses_resp = supabase_data.client.table("courses").select("*").eq("is_active", True).execute()
        courses_data = [
            {"course_name": c.get("course_name") or c.get("name"), "category": c.get("category"),
             "duration": c.get("duration"), "price": float(c.get("price") or 0)}
            for c in (courses_resp.data or [])
        ]
        if not courses_data:
            raise HTTPException(status_code=404, detail="No active courses available")

        lead_data = {"country": lead.get("country"), "course_interested": lead.get("course_interested"), "ai_score": lead.get("ai_score")}
        recommendation = await ai_assistant.generate_course_recommendation(lead_data, courses_data)
        logger.info(f"🎓 Recommended course for lead {lead_id}: {recommendation.get('course_name')}")
        return {
            "lead_id":          lead_id,
            "lead_name":        lead.get("full_name"),
            "current_interest": lead.get("course_interested"),
            "recommendation":   recommendation,
            "generated_at":     datetime.utcnow().isoformat(),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Course recommendation failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── ML model info ─────────────────────────────────────────────────────────────

@router.get("/api/ml/model-info")
async def get_model_info():
    """CatBoost model version, metadata, and performance metrics."""
    from main import get_cached_model
    model = get_cached_model()

    models_dir     = Path(__file__).resolve().parent.parent.parent.parent / "models"
    metadata_files = sorted(models_dir.glob("model_metadata_v2_*.json"), reverse=True)

    metadata = None
    if metadata_files:
        try:
            with open(metadata_files[0]) as f:
                metadata = json.load(f)
        except Exception as exc:
            logger.warning(f"Failed to load model metadata: {exc}")

    return {
        "model_loaded":      model is not None,
        "model_type":        "CatBoostClassifier" if model else None,
        "metadata":          metadata,
        "available_versions": [f.stem for f in metadata_files],
        "timestamp":         datetime.utcnow().isoformat(),
    }
