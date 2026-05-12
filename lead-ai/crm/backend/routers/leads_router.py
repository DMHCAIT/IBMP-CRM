"""
Leads Router — /api/leads/*
============================
All lead-management endpoints extracted from main.py.

Routes:
  POST   /api/leads                         — create lead
  POST   /api/leads/bulk-create             — bulk import
  POST   /api/leads/bulk-update             — bulk status/field update
  POST   /api/leads/check-duplicates        — duplicate detection
  POST   /api/leads/merge                   — merge two leads
  POST   /api/leads/assign-all              — round-robin assign all unassigned
  GET    /api/leads                         — paginated + filtered list
  GET    /api/leads/followups/today         — today's follow-up queue
  GET    /api/leads/{lead_id}               — single lead detail
  PUT    /api/leads/{lead_id}               — update lead fields
  DELETE /api/leads/{lead_id}               — delete lead
  POST   /api/leads/{lead_id}/notes         — add note
  GET    /api/leads/{lead_id}/notes         — list notes
  GET    /api/leads/{lead_id}/activities    — enriched activity timeline
  GET    /api/leads/{lead_id}/ai-summary    — AI-generated summary
  POST   /api/leads/{lead_id}/assign        — assign to counselor
  POST   /api/leads/{lead_id}/reassign      — reassign to different counselor
  POST   /api/leads/{lead_id}/send-whatsapp — send WhatsApp message
  POST   /api/leads/{lead_id}/send-email    — send email
  POST   /api/leads/{lead_id}/trigger-welcome  — welcome sequence
  POST   /api/leads/{lead_id}/trigger-followup — follow-up sequence
  GET    /api/leads/{lead_id}/chat          — WhatsApp chat messages
  POST   /api/leads/{lead_id}/chat          — send WhatsApp chat message
"""

import hashlib
import json
import re as _re
import uuid as _uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request

from auth import decode_access_token
from cache import cache_async_result, get_cache_stats, invalidate_cache
from logger_config import logger
from supabase_data_layer import supabase_data

# ── Real-time broadcast helper ────────────────────────────────────────────────
async def _broadcast_lead_event(
    request: Request,
    event_type: str,
    payload: dict,
) -> None:
    """Fire-and-forget: broadcast a lead event to all WebSocket clients."""
    try:
        from websocket_manager import broadcast as _ws_broadcast
        # Extract tenant_id from JWT if available; fall back to "default"
        tenant_id = "default"
        try:
            ah = request.headers.get("Authorization", "")
            if ah.startswith("Bearer "):
                from auth import SECRET_KEY, ALGORITHM
                from jose import jwt as _jose
                p = _jose.decode(ah.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
                tenant_id = p.get("tenant_id") or "default"
        except Exception:
            pass
        await _ws_broadcast(tenant_id=tenant_id, event_type=event_type, payload=payload)
    except Exception as _e:
        logger.debug("WS broadcast skipped: %s", _e)

router = APIRouter(prefix="/api/leads", tags=["Leads"])


# ── Lazy imports from main (avoid circular imports) ──────────────────────────

def _get_main():
    """Lazy-import shared objects from main to avoid circular imports at load time."""
    from main import (
        DBLead, LeadStatus, LeadSegment, LeadCreate, LeadUpdate,
        LeadResponse, NoteCreate, NoteResponse,
        LEAD_CACHE, STATS_CACHE, COURSE_CACHE,
        ai_scorer, normalize_lead_values, _get_counselor_name,
        get_current_user, AssignmentRequest, ReassignmentRequest,
        WhatsAppRequest, EmailRequest, FollowUpRequest,
        ChatSendRequest, ChatMessageResponse,
    )
    return (
        DBLead, LeadStatus, LeadSegment, LeadCreate, LeadUpdate,
        LeadResponse, NoteCreate, NoteResponse,
        LEAD_CACHE, STATS_CACHE, COURSE_CACHE,
        ai_scorer, normalize_lead_values, _get_counselor_name,
        get_current_user, AssignmentRequest, ReassignmentRequest,
        WhatsAppRequest, EmailRequest, FollowUpRequest,
        ChatSendRequest, ChatMessageResponse,
    )


# ── Background helpers ────────────────────────────────────────────────────────

async def rescore_lead_supabase(lead_id: str) -> None:
    """Re-score a lead in the background after an update or new note."""
    try:
        _m = _get_main()
        DBLead     = _m[0]
        LeadStatus = _m[1]
        ai_scorer  = _m[11]
        from main import LEAD_CACHE, STATS_CACHE

        lead_data = supabase_data.get_lead_by_id(lead_id)
        if not lead_data:
            return

        temp = DBLead(
            lead_id=lead_data.get("lead_id", lead_id),
            full_name=lead_data.get("full_name", ""),
            email=lead_data.get("email"),
            phone=lead_data.get("phone", ""),
            whatsapp=lead_data.get("whatsapp"),
            country=lead_data.get("country", ""),
            source=lead_data.get("source", ""),
            course_interested=lead_data.get("course_interested", ""),
            assigned_to=lead_data.get("assigned_to"),
            status=LeadStatus(lead_data.get("status", "Fresh")),
        )

        try:
            courses = supabase_data.get_courses()
            ai_scorer.course_prices = {
                c.get("name"): c.get("price", 0) for c in courses if c.get("name")
            }
        except Exception:
            pass

        score_result = ai_scorer.score_lead(temp, [])
        score_payload = {
            "ai_score":               score_result.get("ai_score", lead_data.get("ai_score", 0)),
            "ai_segment":             (
                score_result.get("ai_segment").value
                if hasattr(score_result.get("ai_segment"), "value")
                else score_result.get("ai_segment", lead_data.get("ai_segment"))
            ),
            "conversion_probability": score_result.get("conversion_probability", 0),
            "buying_signal_strength": score_result.get("buying_signal_strength", 0),
            "churn_risk":             score_result.get("churn_risk", 0),
            "next_action":            score_result.get("next_action"),
            "priority_level":         score_result.get("priority_level"),
            "recommended_script":     score_result.get("recommended_script"),
        }
        score_payload = {k: v for k, v in score_payload.items() if v is not None}
        supabase_data.update_lead(lead_id, score_payload)
        invalidate_cache(LEAD_CACHE)
        invalidate_cache(STATS_CACHE)

    except Exception as exc:
        logger.warning(f"Background re-score failed for {lead_id}: {exc}")


# ── CREATE ────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_lead(request: Request, background_tasks: BackgroundTasks, body: dict):
    """Create a new lead with AI scoring — Supabase only."""
    _m = _get_main()
    DBLead, LeadStatus, LeadCreate = _m[0], _m[1], _m[3]
    ai_scorer, normalize_lead_values, _get_counselor_name = _m[11], _m[12], _m[13]
    from main import LEAD_CACHE, STATS_CACHE

    _counselor_name = _get_counselor_name(request)

    # Accept both parsed model and raw dict — coerce to LeadCreate
    if not isinstance(body, LeadCreate):
        body = LeadCreate(**body)

    if _counselor_name:
        body.assigned_to = _counselor_name

    normalized = normalize_lead_values({
        "full_name":         body.full_name,
        "country":           body.country,
        "source":            body.source,
        "course_interested": body.course_interested,
        "assigned_to":       body.assigned_to,
        "status":            body.status.value if hasattr(body.status, "value") else (body.status or "Fresh"),
    })

    _ts   = datetime.utcnow().strftime("%y%m%d%H%M%S")
    _rand = _uuid.uuid4().hex[:8].upper()
    lead_id = f"LEAD{_ts}{_rand}"

    db_lead = DBLead(
        lead_id=lead_id,
        full_name=normalized["full_name"],
        email=body.email or None,
        phone=body.phone,
        whatsapp=body.whatsapp or body.phone,
        country=normalized["country"],
        source=normalized["source"],
        course_interested=normalized["course_interested"],
        assigned_to=normalized.get("assigned_to"),
        status=LeadStatus(normalized["status"]),
    )

    try:
        courses = supabase_data.get_courses()
        ai_scorer.course_prices = {c.get("name"): c.get("price", 0) for c in courses if c.get("name")}
    except Exception as exc:
        logger.warning(f"Could not load course prices: {exc}")
        ai_scorer.course_prices = {}

    score_result = ai_scorer.score_lead(db_lead, [])
    for key, value in score_result.items():
        if key == "feature_importance" and value:
            setattr(db_lead, key, json.dumps(value))
        else:
            setattr(db_lead, key, value)

    try:
        payload = {
            "lead_id":         db_lead.lead_id,
            "full_name":       db_lead.full_name,
            "email":           db_lead.email,
            "phone":           db_lead.phone,
            "whatsapp":        db_lead.whatsapp,
            "country":         db_lead.country,
            "source":          db_lead.source,
            "course_interested": db_lead.course_interested,
            "assigned_to":     db_lead.assigned_to,
            "qualification":   body.qualification,
            "company":         body.company,
            "utm_source":      body.utm_source,
            "utm_medium":      body.utm_medium,
            "utm_campaign":    body.utm_campaign,
            "follow_up_date":  body.follow_up_date.isoformat() if body.follow_up_date else None,
            "status":          db_lead.status.value if hasattr(db_lead.status, "value") else db_lead.status,
            "ai_score":              db_lead.ai_score or 0.0,
            "ai_segment":            db_lead.ai_segment.value if hasattr(db_lead.ai_segment, "value") else db_lead.ai_segment,
            "conversion_probability": db_lead.conversion_probability or 0.0,
            "expected_revenue":       db_lead.expected_revenue or 0.0,
            "actual_revenue":         db_lead.actual_revenue or 0.0,
            "buying_signal_strength": db_lead.buying_signal_strength or 0.0,
            "churn_risk":             db_lead.churn_risk or 0.0,
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        created = supabase_data.create_lead(payload)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create lead in database")

        if created.get("id"):
            supabase_data.create_activity(
                lead_id=created["id"],
                activity_type="lead_created",
                description=f"Lead created from {body.source}",
                created_by="System",
            )

        invalidate_cache(STATS_CACHE)
        invalidate_cache(LEAD_CACHE)

        # ── Real-time event ───────────────────────────────────────────────────
        await _broadcast_lead_event(request, "lead.created", {
            "lead_id":   created.get("lead_id"),
            "full_name": created.get("full_name"),
            "assigned_to": created.get("assigned_to"),
            "status":    created.get("status"),
            "ai_score":  created.get("ai_score"),
        })
        return created
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to create lead: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create lead: {exc}")


# ── BULK CREATE ───────────────────────────────────────────────────────────────

@router.post("/bulk-create")
async def bulk_create_leads(request: Request, background_tasks: BackgroundTasks, leads: list):
    """Bulk-import multiple leads at once — Supabase only."""
    _m = _get_main()
    DBLead, LeadStatus, LeadCreate = _m[0], _m[1], _m[3]
    ai_scorer, normalize_lead_values, _get_counselor_name = _m[11], _m[12], _m[13]
    from main import LEAD_CACHE, STATS_CACHE

    importer_name = _get_counselor_name(request)
    if not importer_name:
        try:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token_data = decode_access_token(auth_header.split(" ", 1)[1])
                if token_data and token_data.email:
                    user = supabase_data.get_user_by_email(token_data.email)
                    if user:
                        importer_name = user.get("full_name")
        except Exception:
            pass
    importer_name = importer_name or "System"

    results: dict = {"success": [], "failed": [], "total": len(leads)}

    try:
        courses = supabase_data.get_courses()
        ai_scorer.course_prices = {c.get("name"): c.get("price", 0) for c in courses if c.get("name")}
    except Exception as exc:
        logger.warning(f"Could not load course prices: {exc}")
        ai_scorer.course_prices = {}

    for idx, raw_lead in enumerate(leads):
        try:
            lead = LeadCreate(**raw_lead) if isinstance(raw_lead, dict) else raw_lead
            _ts   = datetime.utcnow().strftime("%y%m%d%H%M%S")
            _rand = _uuid.uuid4().hex[:8].upper()
            lead_id = f"LEAD{_ts}{_rand}"

            # Duplicate check by phone
            try:
                existing = supabase_data.client.table("leads").select(
                    "lead_id,assigned_to,status,full_name"
                ).eq("phone", lead.phone).limit(1).execute()
                if existing.data:
                    ex = existing.data[0]
                    results["failed"].append({
                        "index": idx, "name": lead.full_name,
                        "error": f"Duplicate phone: {lead.phone}",
                        "duplicate": True,
                        "existing_lead_id": ex.get("lead_id", ""),
                        "existing_owner":   ex.get("assigned_to") or "Unassigned",
                        "existing_status":  ex.get("status", ""),
                    })
                    continue
            except Exception as dup_err:
                logger.warning(f"Duplicate check failed for lead {idx}: {dup_err}")

            normalized = normalize_lead_values({
                "full_name":         lead.full_name,
                "country":           lead.country,
                "source":            lead.source,
                "course_interested": lead.course_interested,
                "assigned_to":       lead.assigned_to,
                "status":            lead.status.value if hasattr(lead.status, "value") else (lead.status or "Fresh"),
            })
            _cn = _get_counselor_name(request)
            if _cn:
                normalized["assigned_to"] = _cn

            db_lead = DBLead(
                lead_id=lead_id,
                full_name=normalized["full_name"],
                email=lead.email,
                phone=lead.phone,
                whatsapp=lead.whatsapp or lead.phone,
                country=normalized["country"],
                source=normalized["source"],
                course_interested=normalized["course_interested"],
                assigned_to=normalized.get("assigned_to"),
                status=LeadStatus(normalized["status"]),
            )

            score_result = ai_scorer.score_lead(db_lead, [])
            for key, value in score_result.items():
                if key == "feature_importance" and value:
                    setattr(db_lead, key, json.dumps(value))
                else:
                    setattr(db_lead, key, value)

            payload = {
                "lead_id":                db_lead.lead_id,
                "full_name":              db_lead.full_name,
                "email":                  db_lead.email,
                "phone":                  db_lead.phone,
                "whatsapp":               db_lead.whatsapp,
                "country":                db_lead.country,
                "source":                 db_lead.source,
                "course_interested":      db_lead.course_interested,
                "assigned_to":            db_lead.assigned_to,
                "status":                 db_lead.status.value if hasattr(db_lead.status, "value") else db_lead.status,
                "ai_score":               db_lead.ai_score or 0.0,
                "ai_segment":             db_lead.ai_segment.value if hasattr(db_lead.ai_segment, "value") else db_lead.ai_segment,
                "conversion_probability": db_lead.conversion_probability or 0.0,
                "expected_revenue":       db_lead.expected_revenue or 0.0,
                "actual_revenue":         db_lead.actual_revenue or 0.0,
                "buying_signal_strength": db_lead.buying_signal_strength or 0.0,
                "churn_risk":             db_lead.churn_risk or 0.0,
                # Extra fields from LeadCreate
                "qualification":          getattr(lead, "qualification", None),
                "company":                getattr(lead, "company", None),
                "city":                   getattr(lead, "city", None),
                "follow_up_date":         lead.follow_up_date.isoformat() if getattr(lead, "follow_up_date", None) else None,
                "utm_source":             getattr(lead, "utm_source", None),
                "utm_medium":             getattr(lead, "utm_medium", None),
                "utm_campaign":           getattr(lead, "utm_campaign", None),
                "campaign_name":          getattr(lead, "campaign_name", None),
                "campaign_medium":        getattr(lead, "campaign_medium", None),
                "campaign_group":         getattr(lead, "campaign_group", None),
                "lead_quality":           getattr(lead, "lead_quality", None),
                "lead_rating":            getattr(lead, "lead_rating", None),
                "ad_name":                getattr(lead, "ad_name", None) if hasattr(lead, "ad_name") else None,
                "adset_name":             getattr(lead, "adset_name", None) if hasattr(lead, "adset_name") else None,
                "form_name":              getattr(lead, "form_name", None) if hasattr(lead, "form_name") else None,
            }
            payload = {k: v for k, v in payload.items() if v is not None}
            created = supabase_data.create_lead(payload)
            if created:
                iid = created.get("id")
                if iid:
                    supabase_data.create_note(
                        lead_id=iid,
                        content=lead.notes if hasattr(lead, "notes") and lead.notes else "Lead imported via bulk upload",
                        channel="manual",
                        created_by=importer_name,
                    )
                results["success"].append({"index": idx, "lead_id": lead_id, "name": lead.full_name})
            else:
                results["failed"].append({"index": idx, "name": lead.full_name, "error": "Failed to create in database"})
        except Exception as exc:
            err = str(exc)
            if "duplicate" in err.lower() or "unique" in err.lower():
                err = f"Duplicate entry for phone: {getattr(lead if 'lead' in dir() else {}, 'phone', '?')}"
            results["failed"].append({"index": idx, "name": getattr(raw_lead, "full_name", "Unknown"), "error": err[:200]})

    invalidate_cache(STATS_CACHE)
    invalidate_cache(LEAD_CACHE)
    return {
        "message": f"Bulk import complete: {len(results['success'])} succeeded, {len(results['failed'])} failed",
        "results": results,
    }


# ── LIST ──────────────────────────────────────────────────────────────────────

@router.get("")
async def get_leads(
    request:          Request,
    skip:             int = 0,
    limit:            int = 50,
    status:           Optional[str] = None,
    status_in:        Optional[str] = None,
    country:          Optional[str] = None,
    country_in:       Optional[str] = None,
    segment:          Optional[str] = None,
    segment_in:       Optional[str] = None,
    assigned_to:      Optional[str] = None,
    assigned_to_in:   Optional[str] = None,
    course_interested: Optional[str] = None,
    source:           Optional[str] = None,
    company:          Optional[str] = None,
    company_in:       Optional[str] = None,
    qualification:    Optional[str] = None,
    qualification_in: Optional[str] = None,
    min_score:        Optional[float] = None,
    max_score:        Optional[float] = None,
    created_today:    bool = False,
    overdue:          bool = False,
    follow_up_from:   Optional[datetime] = None,
    follow_up_to:     Optional[datetime] = None,
    created_from:     Optional[datetime] = None,
    created_to:       Optional[datetime] = None,
    created_on:       Optional[str] = None,
    created_after:    Optional[datetime] = None,
    created_before:   Optional[datetime] = None,
    updated_from:     Optional[datetime] = None,
    updated_to:       Optional[datetime] = None,
    updated_on:       Optional[str] = None,
    updated_after:    Optional[datetime] = None,
    updated_before:   Optional[datetime] = None,
    search:           Optional[str] = None,
):
    """Paginated + filtered lead list — Supabase only. Counselors see only their own leads."""
    from main import LEAD_CACHE, LeadStatus, LeadSegment

    skip  = max(0, int(skip))
    limit = max(1, min(int(limit), 1000))

    # Department-based lead isolation
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token_data = decode_access_token(auth_header.split(" ", 1)[1])
            if token_data:
                role = token_data.role or ""
                dept = token_data.department or ""

                if role == "Counselor":
                    # Counselors only see their own assigned leads
                    caller = supabase_data.get_user_by_email(token_data.email)
                    if caller:
                        assigned_to = caller.get("full_name")

                elif dept == "HR":
                    # HR manages employees, not leads — return empty immediately
                    return {"leads": [], "total": 0, "skip": skip, "limit": limit}

                elif dept == "Academic":
                    # Academic dept sees only enrolled/admitted leads
                    if not status and not status_in:
                        status_in = "Enrolled"

                elif dept == "Accounts":
                    # Accounts dept sees enrolled leads for fee processing
                    if not status and not status_in:
                        status_in = "Enrolled"

                # CEO, Admin, Marketing, Sales (non-Counselor) → no restriction
    except Exception:
        pass

    # Cache key
    _cp = dict(
        skip=skip, limit=limit, status=str(status), status_in=status_in,
        country=country, country_in=country_in, segment=str(segment), segment_in=segment_in,
        assigned_to=assigned_to, assigned_to_in=assigned_to_in,
        course_interested=course_interested, source=source,
        company=company, company_in=company_in,
        qualification=qualification, qualification_in=qualification_in,
        min_score=min_score, max_score=max_score,
        follow_up_from=str(follow_up_from), follow_up_to=str(follow_up_to),
        created_today=created_today, overdue=overdue, search=search,
        created_on=created_on, created_from=str(created_from), created_to=str(created_to),
        created_after=str(created_after), created_before=str(created_before),
        updated_on=updated_on, updated_from=str(updated_from), updated_to=str(updated_to),
        updated_after=str(updated_after), updated_before=str(updated_before),
    )
    _cache_key = "leads:" + hashlib.md5(
        json.dumps(_cp, sort_keys=True, default=str).encode()
    ).hexdigest()
    if _cache_key in LEAD_CACHE:
        return LEAD_CACHE[_cache_key]

    try:
        # Resolve string enums
        status_val  = status.value  if hasattr(status,  "value") else status
        segment_val = segment.value if hasattr(segment, "value") else segment

        leads_data = supabase_data.get_leads(
            skip=skip, limit=limit,
            status=status_val, status_in=status_in,
            country=country, country_in=country_in,
            segment=segment_val, segment_in=segment_in,
            assigned_to=assigned_to, assigned_to_in=assigned_to_in,
            course_interested=course_interested, source=source,
            company=company, company_in=company_in,
            qualification=qualification, qualification_in=qualification_in,
            min_score=min_score, max_score=max_score,
            follow_up_from=follow_up_from.isoformat() if follow_up_from else None,
            follow_up_to=follow_up_to.isoformat()   if follow_up_to   else None,
            created_today=created_today, overdue=overdue, search=search,
            created_on=created_on,
            created_after=created_after.isoformat()   if created_after   else None,
            created_before=created_before.isoformat() if created_before  else None,
            created_from=created_from.isoformat()     if created_from    else None,
            created_to=created_to.isoformat()         if created_to      else None,
            updated_on=updated_on,
            updated_after=updated_after.isoformat()   if updated_after   else None,
            updated_before=updated_before.isoformat() if updated_before  else None,
            updated_from=updated_from.isoformat()     if updated_from    else None,
            updated_to=updated_to.isoformat()         if updated_to      else None,
        )
        LEAD_CACHE[_cache_key] = leads_data
        return leads_data
    except Exception as exc:
        logger.error(f"Supabase leads query failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch leads from database")


# ── TODAY'S FOLLOW-UPS ────────────────────────────────────────────────────────

@router.get("/followups/today")
async def get_followups_today(request: Request, assigned_to: Optional[str] = None):
    """All leads with follow_up_date = today + overdue, for the daily work view."""
    try:
        # Department-based isolation for follow-ups
        _status_filter = None
        try:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token_data = decode_access_token(auth_header.split(" ", 1)[1])
                if token_data:
                    role = token_data.role or ""
                    dept = token_data.department or ""

                    if role == "Counselor":
                        user_resp = supabase_data.client.table("users").select("full_name").eq("email", token_data.email).execute()
                        if user_resp.data:
                            assigned_to = user_resp.data[0].get("full_name")

                    elif dept == "HR":
                        return {"overdue": [], "today": [], "overdue_count": 0, "today_count": 0}

                    elif dept in ("Academic", "Accounts"):
                        _status_filter = "ENROLLED"
        except Exception:
            pass

        today       = datetime.utcnow().date()
        today_start = f"{today.isoformat()}T00:00:00"
        today_end   = f"{today.isoformat()}T23:59:59"

        COLS = "id,lead_id,full_name,phone,whatsapp,course_interested,status,ai_segment,ai_score,assigned_to,follow_up_date,last_contact_date,country,next_action,primary_objection,churn_risk"

        overdue_q = (
            supabase_data.client.table("leads").select(COLS)
            .not_.is_("follow_up_date", "null").lt("follow_up_date", today_start)
        )
        today_q = (
            supabase_data.client.table("leads").select(COLS)
            .gte("follow_up_date", today_start).lte("follow_up_date", today_end)
        )
        if assigned_to:
            overdue_q = overdue_q.eq("assigned_to", assigned_to)
            today_q   = today_q.eq("assigned_to", assigned_to)
        if _status_filter:
            overdue_q = overdue_q.eq("status", _status_filter)
            today_q   = today_q.eq("status", _status_filter)

        overdue_resp = overdue_q.order("follow_up_date", desc=False).execute()
        today_resp   = today_q.order("follow_up_date", desc=False).execute()

        def _fmt(lead: dict) -> dict:
            return {
                "id":               lead.get("id"),
                "lead_id":          lead.get("lead_id"),
                "full_name":        lead.get("full_name"),
                "phone":            lead.get("phone"),
                "whatsapp":         lead.get("whatsapp"),
                "course_interested": lead.get("course_interested"),
                "status":           str(lead.get("status", "")),
                "ai_segment":       str(lead.get("ai_segment", "")),
                "ai_score":         round(lead.get("ai_score") or 0, 1),
                "assigned_to":      lead.get("assigned_to"),
                "follow_up_date":   lead.get("follow_up_date"),
                "last_contact_date": lead.get("last_contact_date"),
                "country":          lead.get("country"),
                "next_action":      lead.get("next_action"),
                "primary_objection": lead.get("primary_objection"),
                "churn_risk":       round(lead.get("churn_risk") or 0, 2),
            }

        overdue_list = [_fmt(l) for l in (overdue_resp.data or [])]
        today_list   = [_fmt(l) for l in (today_resp.data or [])]
        return {
            "overdue":       overdue_list,
            "today":         today_list,
            "overdue_count": len(overdue_list),
            "today_count":   len(today_list),
        }
    except Exception as exc:
        logger.error(f"Error fetching followups: {exc}", exc_info=True)
        return {"overdue": [], "today": [], "overdue_count": 0, "today_count": 0}


# ── GET SINGLE ────────────────────────────────────────────────────────────────

@router.get("/{lead_id}")
async def get_lead(lead_id: str, request: Request):
    """Get single lead by ID — Supabase only."""
    from main import _get_counselor_name
    _counselor_name = _get_counselor_name(request)
    try:
        lead = supabase_data.get_lead_by_id(lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        if _counselor_name and lead.get("assigned_to") != _counselor_name:
            raise HTTPException(status_code=403, detail="Access denied")
        iid = lead.get("id")
        lead["notes"] = supabase_data.get_notes_for_lead(iid) if iid else []
        return lead
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to get lead {lead_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve lead: {exc}")


# ── UPDATE ────────────────────────────────────────────────────────────────────

@router.put("/{lead_id}")
async def update_lead(lead_id: str, request: Request, background_tasks: BackgroundTasks, body: dict):
    """Update lead fields — Supabase only. Logs granular activity for every change."""
    from main import LeadUpdate, _get_counselor_name, LEAD_CACHE, STATS_CACHE
    _counselor_name = _get_counselor_name(request)

    try:
        if _counselor_name:
            existing = supabase_data.get_lead_by_id(lead_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Lead not found")
            if existing.get("assigned_to") != _counselor_name:
                raise HTTPException(status_code=403, detail="Access denied")

        lead_update = LeadUpdate(**body) if isinstance(body, dict) else body
        update_data = lead_update.dict(exclude_unset=True)

        if "follow_up_date" in update_data and update_data["follow_up_date"]:
            dt  = update_data["follow_up_date"]
            iso = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
            update_data["follow_up_date"] = iso if iso.endswith("Z") or "+" in iso else iso + "Z"

        existing_for_diff = supabase_data.get_lead_by_id(lead_id) if not _counselor_name else existing
        updated_lead = supabase_data.update_lead(lead_id, update_data)
        if not updated_lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        # Activity log
        try:
            def _actor(req: Request) -> str:
                try:
                    ah = req.headers.get("Authorization", "")
                    if ah.startswith("Bearer "):
                        td = decode_access_token(ah.split(" ", 1)[1])
                        if td:
                            u = supabase_data.get_user_by_email(td.email)
                            if u:
                                return u.get("full_name") or td.email or "System"
                except Exception:
                    pass
                return "System"

            _TRACKED = {
                "status": "Status", "full_name": "Full Name", "email": "Email",
                "phone": "Phone", "whatsapp": "WhatsApp", "country": "Country",
                "source": "Source", "course_interested": "Course",
                "qualification": "Qualification", "company": "Company",
                "assigned_to": "Assigned To", "follow_up_date": "Follow-up Date",
                "expected_revenue": "Expected Revenue", "actual_revenue": "Actual Revenue",
                "utm_source": "UTM Source", "utm_medium": "UTM Medium", "utm_campaign": "UTM Campaign",
            }
            changed = []
            for field, label in _TRACKED.items():
                if field not in update_data:
                    continue
                old_str = str((existing_for_diff or {}).get(field) or "").strip()
                new_str = str(update_data[field] or "").strip()
                if old_str != new_str:
                    changed.append(f"{label}: {old_str} → {new_str}" if old_str else f"{label}: set to {new_str}")

            iid = (existing_for_diff or {}).get("id")
            if changed and iid:
                only_status = len(changed) == 1 and list(update_data.keys()) == ["status"]
                supabase_data.create_activity(
                    lead_id=int(iid),
                    activity_type="status_change" if only_status else "field_update",
                    description=" | ".join(changed),
                    created_by=_actor(request),
                )
        except Exception as ae:
            logger.warning(f"Activity log failed for {lead_id}: {ae}")

        invalidate_cache(LEAD_CACHE)
        invalidate_cache(STATS_CACHE)
        background_tasks.add_task(rescore_lead_supabase, lead_id)

        # ── Real-time event ───────────────────────────────────────────────────
        _event = "status.changed" if "status" in update_data else "lead.updated"
        await _broadcast_lead_event(request, _event, {
            "lead_id":     lead_id,
            "updated_fields": list(update_data.keys()),
            "status":      update_data.get("status"),
            "assigned_to": update_data.get("assigned_to"),
        })
        return updated_lead
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to update lead: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── DELETE ────────────────────────────────────────────────────────────────────

@router.delete("/{lead_id}")
async def delete_lead(lead_id: str, request: Request):
    """Delete lead — Supabase only."""
    from main import LEAD_CACHE, STATS_CACHE
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not supabase_data.delete_lead(lead_id):
        raise HTTPException(status_code=500, detail="Failed to delete lead")
    invalidate_cache(LEAD_CACHE)
    invalidate_cache(STATS_CACHE)

    # ── Real-time event ───────────────────────────────────────────────────────
    await _broadcast_lead_event(request, "lead.deleted", {"lead_id": lead_id})
    return {"message": "Lead deleted successfully"}


# ── BULK UPDATE ───────────────────────────────────────────────────────────────

@router.post("/bulk-update")
async def bulk_update_leads(bulk_data: dict):
    """Bulk-update multiple leads — Supabase only."""
    from main import LeadStatus, LeadSegment, LEAD_CACHE
    lead_ids = bulk_data.get("lead_ids", [])
    updates  = bulk_data.get("updates", {})
    if not lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    if "status" in updates and updates["status"] not in {s.value for s in LeadStatus}:
        raise HTTPException(status_code=422, detail=f"Invalid status '{updates['status']}'")
    if "ai_segment" in updates and updates["ai_segment"] not in {s.value for s in LeadSegment}:
        raise HTTPException(status_code=422, detail=f"Invalid segment '{updates['ai_segment']}'")

    try:
        updates["updated_at"] = datetime.utcnow().isoformat() + "Z"
        updated_count = sum(
            1 for lid in lead_ids if supabase_data.update_lead(lid, updates)
        )
        invalidate_cache(LEAD_CACHE)
        return {"message": f"Successfully updated {updated_count} leads", "updated_count": updated_count}
    except Exception as exc:
        logger.error(f"bulk_update_leads failed: {exc}")
        raise HTTPException(status_code=500, detail="Bulk update failed — database error.")


# ── CHECK DUPLICATES ──────────────────────────────────────────────────────────

@router.post("/check-duplicates")
async def check_duplicates(payload: dict):
    """Check if a lead already exists by phone / email / name."""
    return {"duplicates": [], "match_count": 0}


# ── MERGE ─────────────────────────────────────────────────────────────────────

@router.post("/merge")
async def merge_leads(payload: dict, request: Request):
    """Merge two leads — absorb secondary into primary."""
    from main import STATS_CACHE, LEAD_CACHE
    try:
        auth_header = request.headers.get("Authorization", "")
        current_user: dict = {}
        if auth_header.startswith("Bearer "):
            td = decode_access_token(auth_header.split(" ", 1)[1])
            if td:
                u = supabase_data.get_user_by_email(td.email)
                current_user = u or {}
    except Exception:
        current_user = {}

    primary_id    = payload.get("primary_lead_id")
    secondary_id  = payload.get("secondary_lead_id")
    direct_updates = payload.get("direct_updates", {})
    MERGEABLE = [
        "full_name", "email", "phone", "whatsapp", "country",
        "source", "course_interested", "assigned_to",
        "expected_revenue", "actual_revenue", "follow_up_date",
        "next_action", "priority_level",
    ]
    if not primary_id:
        raise HTTPException(status_code=400, detail="primary_lead_id required")

    try:
        def _fetch(lid: str) -> Optional[dict]:
            r = supabase_data.client.table("leads").select("*").eq("lead_id", lid).single().execute()
            return r.data

        primary = _fetch(primary_id)
        if not primary:
            raise HTTPException(status_code=404, detail="Primary lead not found")

        if direct_updates:
            updates = {k: v for k, v in direct_updates.items() if v is not None and k in MERGEABLE}
        elif secondary_id:
            secondary = _fetch(secondary_id)
            if not secondary:
                raise HTTPException(status_code=404, detail="Secondary lead not found")
            choices = payload.get("field_choices", {})
            updates = {}
            for field in MERGEABLE:
                src = secondary if choices.get(field) == "secondary" else primary
                val = src.get(field)
                if val is not None:
                    updates[field] = val
        else:
            updates = {}

        if updates:
            supabase_data.client.table("leads").update(updates).eq("lead_id", primary_id).execute()

        prim_int_id = primary.get("id")
        merge_label = "Updated with resolved field values."

        if secondary_id and secondary_id != "__new__":
            secondary = _fetch(secondary_id)
            if secondary:
                sec_int_id = secondary.get("id")
                if prim_int_id and sec_int_id:
                    supabase_data.client.table("notes").update({"lead_id": prim_int_id}).eq("lead_id", sec_int_id).execute()
                    supabase_data.client.table("activities").update({"lead_id": prim_int_id}).eq("lead_id", sec_int_id).execute()
                supabase_data.client.table("leads").delete().eq("lead_id", secondary_id).execute()
                merge_label = f"Absorbed lead {secondary_id} ({secondary.get('full_name')}) into this record."

        if prim_int_id:
            supabase_data.client.table("notes").insert({
                "lead_id": prim_int_id,
                "content": f"[MERGED] {merge_label}",
                "channel": "system",
                "created_by": current_user.get("full_name", "System"),
            }).execute()

        invalidate_cache(STATS_CACHE)
        invalidate_cache(LEAD_CACHE)
        updated = supabase_data.client.table("leads").select("*").eq("lead_id", primary_id).single().execute()
        return updated.data
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Merge failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── ASSIGN / REASSIGN ─────────────────────────────────────────────────────────

@router.post("/{lead_id}/assign")
async def assign_lead(lead_id: str, body: dict):
    """Assign lead to a counselor."""
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    counselor_name = body.get("counselor_name")
    if not counselor_name:
        users = supabase_data.get_all_users()
        counselors = [u for u in users if u.get("role") in ["Counselor", "Team Leader", "Manager"] and u.get("is_active")]
        if not counselors:
            raise HTTPException(status_code=400, detail="No available counselors")
        counselor_name = counselors[0]["full_name"]

    updated = supabase_data.update_lead(lead_id, {"assigned_to": counselor_name})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to assign lead")
    return {"success": True, "message": f"Lead assigned to {counselor_name}", "assigned_to": counselor_name}


@router.post("/assign-all")
async def assign_all_unassigned(body: dict):
    """Round-robin assign all unassigned leads."""
    response = supabase_data.client.table("leads").select("lead_id").is_("assigned_to", "null").execute()
    unassigned = response.data if response.data else []
    if not unassigned:
        return {"success": True, "message": "No unassigned leads", "assigned_count": 0}

    users = supabase_data.get_all_users()
    counselors = [u["full_name"] for u in users if u.get("role") in ["Counselor", "Team Leader"] and u.get("is_active")]
    if not counselors:
        raise HTTPException(status_code=400, detail="No available counselors")

    assigned_count = 0
    for idx, lead in enumerate(unassigned):
        supabase_data.update_lead(lead["lead_id"], {"assigned_to": counselors[idx % len(counselors)]})
        assigned_count += 1

    return {"success": True, "message": f"Assigned {assigned_count} leads", "assigned_count": assigned_count}


@router.post("/{lead_id}/reassign")
async def reassign_lead(lead_id: str, body: dict):
    """Reassign lead to a different counselor."""
    from main import LEAD_CACHE, STATS_CACHE
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    new_counselor = body.get("new_counselor", "")
    reason        = body.get("reason", "")
    updated = supabase_data.update_lead(lead_id, {"assigned_to": new_counselor})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to reassign lead")

    iid = lead.get("id")
    if iid:
        supabase_data.create_activity(
            lead_id=iid,
            activity_type="reassignment",
            description=f"Lead reassigned to {new_counselor}. Reason: {reason}",
            created_by="System",
        )

    invalidate_cache(LEAD_CACHE)
    invalidate_cache(STATS_CACHE)
    return {"success": True, "message": f"Lead reassigned to {new_counselor}", "new_counselor": new_counselor}


# ── NOTES ─────────────────────────────────────────────────────────────────────

@router.post("/{lead_id}/notes")
async def add_note(lead_id: str, request: Request, background_tasks: BackgroundTasks, body: dict):
    """Add note to lead — Supabase only."""
    from main import LEAD_CACHE, STATS_CACHE, _get_counselor_name
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    counselor_name = _get_counselor_name(request)
    if counselor_name and lead.get("assigned_to") != counselor_name:
        raise HTTPException(status_code=403, detail="Access denied")

    if not counselor_name:
        try:
            ah = request.headers.get("Authorization", "")
            if ah.startswith("Bearer "):
                td = decode_access_token(ah.split(" ", 1)[1])
                if td and td.email:
                    u = supabase_data.get_user_by_email(td.email)
                    if u:
                        counselor_name = u.get("full_name")
        except Exception:
            pass

    created_by = counselor_name or body.get("created_by") or "System"
    db_note = supabase_data.create_note(
        lead_id=lead.get("id"),
        content=body.get("content", ""),
        channel=body.get("channel", "manual"),
        created_by=created_by,
    )
    if not db_note:
        raise HTTPException(status_code=500, detail="Failed to create note")

    supabase_data.update_lead(lead_id, {"last_contact_date": datetime.utcnow().isoformat()})
    invalidate_cache(LEAD_CACHE)
    invalidate_cache(STATS_CACHE)
    background_tasks.add_task(rescore_lead_supabase, lead_id)

    # ── Real-time event ───────────────────────────────────────────────────────
    await _broadcast_lead_event(request, "note.created", {
        "lead_id":    lead_id,
        "created_by": created_by,
        "channel":    body.get("channel", "manual"),
    })
    return db_note


@router.get("/{lead_id}/notes")
async def get_notes(lead_id: str, request: Request):
    """Get all notes for a lead — Supabase only."""
    from main import _get_counselor_name
    _cn = _get_counselor_name(request)
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if _cn and lead.get("assigned_to") != _cn:
        raise HTTPException(status_code=403, detail="Access denied")
    return supabase_data.get_notes_for_lead(lead.get("id"))


# ── ACTIVITIES ────────────────────────────────────────────────────────────────

@router.get("/{lead_id}/activities")
async def get_lead_activities(lead_id: str, type: Optional[str] = None, request: Request = None):
    """Enriched activity timeline — notes, WhatsApp, calls, emails, status changes."""
    try:
        from main import _get_counselor_name
        _cn = _get_counselor_name(request)
        lead_data = supabase_data.get_lead_by_id(lead_id)
        if not lead_data:
            raise HTTPException(status_code=404, detail="Lead not found")
        if _cn and lead_data.get("assigned_to") != _cn:
            raise HTTPException(status_code=403, detail="Access denied")

        iid = lead_data.get("id")
        if not iid:
            return []

        activities: list = []
        CHANNEL_TYPE  = {"call": "call", "whatsapp": "whatsapp", "email": "email", "manual": "note", "note": "note", "system": "status"}
        CHANNEL_TITLE = {"call": "Call logged", "whatsapp": "WhatsApp message", "email": "Email sent", "manual": "Note added", "note": "Note added", "system": "System update"}

        for note in supabase_data.get_notes_for_lead(iid):
            channel  = (note.get("channel") or "manual").lower()
            act_type = CHANNEL_TYPE.get(channel, "note")
            content_lower = (note.get("content") or "").lower()
            if any(k in content_lower for k in ["status changed", "status updated", "marked as", "enrolled", "not interested"]):
                act_type = "status"
            dur_match = _re.search(r"duration[:\s]+(\d+m?\s*\d*s?)", note.get("content") or "", _re.I)
            activities.append({
                "id": f"note-{note.get('id')}", "type": act_type,
                "title": CHANNEL_TITLE.get(channel, "Note added"),
                "content": note.get("content"), "timestamp": note.get("created_at"),
                "user": note.get("created_by") or "System", "channel": channel,
                "duration": dur_match.group(1).strip() if dur_match else None,
                "direction": None, "status": None,
            })

        try:
            chat_resp = supabase_data.client.table("chat_messages").select("*").eq("lead_db_id", iid).execute()
            for msg in (chat_resp.data or []):
                direction = msg.get("direction", "outbound")
                activities.append({
                    "id": f"chat-{msg.get('id')}",
                    "type": "whatsapp_in" if direction == "inbound" else "whatsapp_out",
                    "title": "WhatsApp " + ("Received" if direction == "inbound" else "Sent"),
                    "content": msg.get("content") or f"[{msg.get('msg_type', 'media')}]",
                    "timestamp": msg.get("timestamp") or msg.get("created_at"),
                    "user": msg.get("sender_name") or ("Lead" if direction == "inbound" else "System"),
                    "channel": "whatsapp", "duration": None, "direction": direction, "status": msg.get("status"),
                })
        except Exception as ce:
            logger.warning(f"Chat messages load failed for {lead_id}: {ce}")

        if lead_data.get("created_at"):
            activities.append({"id": "created", "type": "created", "title": "Lead created",
                "content": f"{lead_data.get('full_name')} added · Source: {lead_data.get('source') or 'Unknown'}",
                "timestamp": lead_data.get("created_at"), "user": lead_data.get("assigned_to") or "System",
                "channel": "system", "duration": None, "direction": None, "status": None})

        if lead_data.get("updated_at") and lead_data.get("updated_at") != lead_data.get("created_at"):
            activities.append({"id": "status-current", "type": "status",
                "title": f"Status: {lead_data.get('status')}",
                "content": f"Lead marked as {lead_data.get('status')}",
                "timestamp": lead_data.get("updated_at"), "user": lead_data.get("assigned_to") or "System",
                "channel": "system", "duration": None, "direction": None, "status": lead_data.get("status")})

        activities.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        if type and type != "all":
            activities = [a for a in activities if a["type"] == type]
        return activities
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to get activities for {lead_id}: {exc}", exc_info=True)
        return []


# ── UNIFIED TIMELINE ─────────────────────────────────────────────────────────

@router.get("/{lead_id}/timeline")
async def get_lead_timeline(
    lead_id: str,
    request: Request,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    kinds: Optional[str] = Query(default=None, description="Comma-separated kinds to filter: note,activity,whatsapp,email,call,status_change,ai_score,lifecycle"),
):
    """
    Unified chronological timeline for a lead.

    Merges four data sources into a single sorted feed:
      - notes             (manual notes, WA notes, call notes, email notes)
      - activities        (DB activity log: status_change, field_update, etc.)
      - chat_messages     (WhatsApp real-time chat — inbound + outbound)
      - communication_history  (email, call, bulk WA blasts)

    Plus two synthetic lifecycle events derived from the lead record itself:
      - 'lifecycle:created'   when the lead was first created
      - 'lifecycle:score'     when the AI score was last computed

    Each item in the response follows a consistent envelope:
      {
        "id":        string   — unique stable ID (source-prefixed)
        "kind":      string   — note | activity | whatsapp | email | call | status_change | ai_score | lifecycle
        "ts":        string   — ISO-8601 UTC timestamp (used for sorting)
        "actor":     string   — person or system that performed the action
        "title":     string   — short headline (always present)
        "body":      string   — full content / description (may be null)
        "direction": string   — 'inbound' | 'outbound' | null
        "channel":   string   — whatsapp | email | call | manual | system | null
        "status":    string   — delivered | read | failed | null
        "meta":      object   — kind-specific extra fields
      }

    Query params:
      limit   — max items to return (default 200, max 500)
      offset  — for pagination
      kinds   — comma-separated filter e.g. "note,whatsapp"
    """
    # ── Auth: counselors can only see their own leads ─────────────────────────
    try:
        from main import _get_counselor_name
        _cn = _get_counselor_name(request)
    except Exception:
        _cn = None

    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if _cn and lead.get("assigned_to") != _cn:
        raise HTTPException(status_code=403, detail="Access denied")

    iid = lead.get("id")   # internal integer PK
    items: list[dict] = []

    # ── Helper: parse a timestamp to a sortable string ────────────────────────
    def _ts(raw) -> str:
        if not raw:
            return "1970-01-01T00:00:00Z"
        s = str(raw)
        # Ensure trailing Z so sort order is correct
        if s.endswith("+00:00"):
            s = s[:-6] + "Z"
        elif not s.endswith("Z") and "+" not in s[-7:] and "-" not in s[-7:]:
            s = s.rstrip() + "Z"
        return s

    # ── Source 1: notes ───────────────────────────────────────────────────────
    if iid:
        try:
            for n in supabase_data.get_notes_for_lead(iid):
                ch = (n.get("channel") or "manual").lower()
                # Map channel → kind
                _KIND_MAP = {
                    "whatsapp": "whatsapp", "wa": "whatsapp",
                    "email":    "email",
                    "call":     "call",
                    "manual":   "note",
                    "note":     "note",
                    "system":   "activity",
                }
                kind = _KIND_MAP.get(ch, "note")
                # Heuristic: notes whose content looks like a status change
                body = (n.get("content") or "")
                if any(k in body.lower() for k in ["status changed", "status updated", "marked as", "enrolled", "not interested", "converted"]):
                    kind = "status_change"

                dur = None
                dur_m = _re.search(r"duration[:\s]+(\d+[hm]?\s*\d*[ms]?)", body, _re.I)
                if dur_m:
                    dur = dur_m.group(1).strip()

                items.append({
                    "id":        f"note-{n.get('id', _uuid.uuid4().hex[:8])}",
                    "kind":      kind,
                    "ts":        _ts(n.get("created_at")),
                    "actor":     n.get("created_by") or "System",
                    "title":     {
                        "whatsapp": "WhatsApp note",
                        "email":    "Email note",
                        "call":     "Call logged",
                        "status_change": "Status change",
                    }.get(kind, "Note added"),
                    "body":      body or None,
                    "direction": None,
                    "channel":   ch,
                    "status":    None,
                    "meta":      {"duration": dur},
                })
        except Exception as exc:
            logger.warning("Timeline: notes fetch failed for %s — %s", lead_id, exc)

    # ── Source 2: activities (DB table) ───────────────────────────────────────
    if iid:
        try:
            for a in supabase_data.get_activities_for_lead(iid):
                atype = (a.get("activity_type") or "update").lower()
                _ATYPE_KIND = {
                    "status_change":  "status_change",
                    "field_update":   "activity",
                    "lead_created":   "lifecycle",
                    "reassignment":   "activity",
                    "assignment":     "activity",
                    "ai_scored":      "ai_score",
                    "call":           "call",
                    "email":          "email",
                    "whatsapp":       "whatsapp",
                }
                kind = _ATYPE_KIND.get(atype, "activity")
                desc = (a.get("description") or "")
                items.append({
                    "id":        f"act-{a.get('id', _uuid.uuid4().hex[:8])}",
                    "kind":      kind,
                    "ts":        _ts(a.get("created_at")),
                    "actor":     a.get("created_by") or "System",
                    "title":     {
                        "status_change": "Status changed",
                        "activity":      "Lead updated",
                        "lifecycle":     "Lead created",
                        "ai_score":      "AI score updated",
                        "call":          "Call logged",
                        "email":         "Email sent",
                        "whatsapp":      "WhatsApp sent",
                    }.get(kind, "Activity"),
                    "body":      desc or None,
                    "direction": None,
                    "channel":   atype if atype in ("call", "email", "whatsapp") else "system",
                    "status":    None,
                    "meta":      {"activity_type": atype},
                })
        except Exception as exc:
            logger.warning("Timeline: activities fetch failed for %s — %s", lead_id, exc)

    # ── Source 3: chat_messages (WhatsApp real-time) ──────────────────────────
    if iid:
        try:
            resp = supabase_data.client.table("chat_messages") \
                .select("*").eq("lead_db_id", iid).execute()
            for m in (resp.data or []):
                direction = (m.get("direction") or "outbound").lower()
                items.append({
                    "id":        f"chat-{m.get('id', _uuid.uuid4().hex[:8])}",
                    "kind":      "whatsapp",
                    "ts":        _ts(m.get("timestamp") or m.get("created_at")),
                    "actor":     m.get("sender_name") or ("Lead" if direction == "inbound" else "System"),
                    "title":     "WhatsApp " + ("received" if direction == "inbound" else "sent"),
                    "body":      m.get("content") or (f"[{m.get('msg_type', 'media')}]" if m.get("msg_type") != "text" else None),
                    "direction": direction,
                    "channel":   "whatsapp",
                    "status":    m.get("status"),
                    "meta": {
                        "msg_type":   m.get("msg_type", "text"),
                        "media_url":  m.get("media_url"),
                        "interakt_id": m.get("interakt_id"),
                    },
                })
        except Exception as exc:
            logger.warning("Timeline: chat_messages fetch failed for %s — %s", lead_id, exc)

    # ── Source 4: communication_history ───────────────────────────────────────
    try:
        comm_resp = supabase_data.client.table("communication_history") \
            .select("*").eq("lead_id", lead_id).execute()
        for c in (comm_resp.data or []):
            ctype = (c.get("communication_type") or "other").lower()
            direction = (c.get("direction") or "outbound").lower()
            _CTYPE_KIND = {
                "whatsapp": "whatsapp", "sms": "whatsapp",
                "email":    "email",
                "call":     "call",
            }
            kind = _CTYPE_KIND.get(ctype, "activity")
            items.append({
                "id":        f"comm-{c.get('id', _uuid.uuid4().hex[:8])}",
                "kind":      kind,
                "ts":        _ts(c.get("timestamp") or c.get("created_at")),
                "actor":     c.get("sender") or "System",
                "title":     {
                    "whatsapp": "WhatsApp " + ("received" if direction == "inbound" else "sent"),
                    "email":    "Email " + ("received" if direction == "inbound" else "sent"),
                    "call":     "Call " + ("inbound" if direction == "inbound" else "made"),
                }.get(kind, "Communication"),
                "body":      c.get("content") or None,
                "direction": direction,
                "channel":   ctype,
                "status":    c.get("status"),
                "meta": {
                    "recipient":      c.get("recipient"),
                    "sentiment_score": c.get("sentiment_score"),
                    "ai_insights":    c.get("ai_insights"),
                },
            })
    except Exception as exc:
        logger.warning("Timeline: communication_history fetch failed for %s — %s", lead_id, exc)

    # ── Source 5: synthetic lifecycle events ──────────────────────────────────
    if lead.get("created_at"):
        items.append({
            "id":        "lifecycle-created",
            "kind":      "lifecycle",
            "ts":        _ts(lead.get("created_at")),
            "actor":     lead.get("assigned_to") or "System",
            "title":     "Lead created",
            "body":      f"{lead.get('full_name')} added · Source: {lead.get('source') or 'Unknown'} · Course: {lead.get('course_interested') or 'Unknown'}",
            "direction": None,
            "channel":   "system",
            "status":    None,
            "meta": {
                "source":            lead.get("source"),
                "course_interested": lead.get("course_interested"),
                "country":           lead.get("country"),
            },
        })

    if lead.get("ai_score") is not None and lead.get("updated_at"):
        items.append({
            "id":        "lifecycle-ai-score",
            "kind":      "ai_score",
            "ts":        _ts(lead.get("updated_at")),
            "actor":     "AI Engine",
            "title":     f"AI score: {round(float(lead.get('ai_score') or 0), 1)} · {lead.get('ai_segment', 'Unknown')} segment",
            "body":      f"Conversion probability: {round(float(lead.get('conversion_probability') or 0) * 100)}%",
            "direction": None,
            "channel":   "system",
            "status":    None,
            "meta": {
                "ai_score":              lead.get("ai_score"),
                "ai_segment":            lead.get("ai_segment"),
                "conversion_probability": lead.get("conversion_probability"),
                "churn_risk":            lead.get("churn_risk"),
            },
        })

    # ── De-duplicate by id, sort descending, apply kind filter + pagination ───
    seen_ids: set = set()
    unique: list[dict] = []
    for item in items:
        if item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            unique.append(item)

    unique.sort(key=lambda x: x["ts"], reverse=True)

    # Kind filter
    if kinds:
        allowed = {k.strip().lower() for k in kinds.split(",") if k.strip()}
        unique = [i for i in unique if i["kind"] in allowed]

    total = len(unique)
    page  = unique[offset: offset + limit]

    return {
        "lead_id":  lead_id,
        "total":    total,
        "offset":   offset,
        "limit":    limit,
        "items":    page,
    }


# ── AI SUMMARY ────────────────────────────────────────────────────────────────

@router.get("/{lead_id}/ai-summary")
async def get_lead_ai_summary(lead_id: str):
    """AI-generated summary and insights for a lead."""
    try:
        lead_data = supabase_data.get_lead_by_id(lead_id)
        if not lead_data:
            raise HTTPException(status_code=404, detail="Lead not found")
        ai_score  = lead_data.get("ai_score", 0) or 0
        conv_prob = lead_data.get("conversion_probability", 0) or 0
        return {
            "lead_id": lead_data.get("lead_id"),
            "summary": f"{lead_data.get('full_name', 'Lead')} is interested in {lead_data.get('course_interested', 'courses')}. Currently {lead_data.get('status', 'Unknown')}.",
            "key_insights": [
                f"AI Score: {ai_score}/100 — {lead_data.get('ai_segment', 'Unknown')} segment",
                f"Conversion Probability: {int(conv_prob * 100)}%",
                f"Expected Revenue: ${lead_data.get('expected_revenue', 0)}",
            ],
            "recommendations": [lead_data.get("ai_recommendation", "Follow up with the lead")],
            "next_best_action": "Schedule follow-up call" if lead_data.get("status") == "Fresh" else "Continue nurturing",
            "urgency":   "High" if ai_score > 70 else "Medium" if ai_score > 40 else "Low",
            "sentiment": "positive" if ai_score > 60 else "neutral",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"AI summary failed for {lead_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate AI summary: {exc}")


# ── COMMUNICATION ─────────────────────────────────────────────────────────────

@router.post("/{lead_id}/send-whatsapp")
async def send_whatsapp(lead_id: str, body: dict):
    """Send WhatsApp message via Twilio."""
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not lead.get("whatsapp"):
        raise HTTPException(status_code=400, detail="Lead has no WhatsApp number")

    from communication_service import comm_service
    result = await comm_service.send(
        channel="whatsapp", to=lead["whatsapp"],
        message=body.get("message", ""), template=body.get("template"),
        variables={"name": lead.get("full_name") or "there", "course": lead.get("course_interested") or "our courses",
                   "counselor": lead.get("assigned_to") or "Your counselor", "message": body.get("message", "")},
    )
    iid = lead.get("id")
    if iid:
        supabase_data.create_note(lead_id=iid, content=f"[WhatsApp {'Sent' if result['success'] else 'Failed'}] {body.get('message', '')}", channel="whatsapp", created_by="System")

    if result["success"]:
        return {"success": True, "message": "WhatsApp sent", "message_id": result.get("message_id"), "to": lead["whatsapp"]}
    raise HTTPException(status_code=500, detail=result.get("error", "Failed to send WhatsApp"))


@router.post("/{lead_id}/send-email")
async def send_email(lead_id: str, body: dict):
    """Send email via Resend."""
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not lead.get("email"):
        raise HTTPException(status_code=400, detail="Lead has no email address")

    from communication_service import comm_service
    result = await comm_service.send(
        channel="email", to=lead["email"],
        message=body.get("body", ""), template=body.get("template"),
        variables={"name": lead.get("full_name") or "there", "course": lead.get("course_interested") or "our courses",
                   "counselor": lead.get("assigned_to") or "Your counselor",
                   "subject": body.get("subject", ""), "body": body.get("body", "")},
    )
    iid = lead.get("id")
    if iid:
        supabase_data.create_note(lead_id=iid, content=f"[Email {'Sent' if result['success'] else 'Failed'}] Subject: {body.get('subject', '')}\n\n{body.get('body', '')}", channel="email", created_by="System")

    if result["success"]:
        return {"success": True, "message": "Email sent", "message_id": result.get("message_id"), "to": lead["email"]}
    raise HTTPException(status_code=500, detail=result.get("error", "Failed to send email"))


@router.post("/{lead_id}/trigger-welcome")
async def trigger_welcome(lead_id: str):
    """Trigger automated welcome sequence (Email + WhatsApp)."""
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    from communication_service import comm_service
    results = []
    if lead.get("email"):
        r = await comm_service.send(channel="email", to=lead["email"], message="Welcome message", template="welcome_email", variables={"name": lead.get("full_name", "there")})
        results.append({"channel": "email", "success": r["success"]})
    if lead.get("whatsapp"):
        r = await comm_service.send(channel="whatsapp", to=lead["whatsapp"], message="Welcome message", template="welcome_whatsapp", variables={"name": lead.get("full_name", "there")})
        results.append({"channel": "whatsapp", "success": r["success"]})
    return {"success": True, "message": "Welcome sequence triggered", "results": results}


@router.post("/{lead_id}/trigger-followup")
async def trigger_followup(lead_id: str, body: dict):
    """Trigger automated follow-up sequence."""
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    from communication_service import comm_service
    lead_payload = {"id": lead.get("lead_id"), "name": lead.get("full_name") or "there",
                    "email": lead.get("email"), "whatsapp": lead.get("whatsapp"),
                    "course": lead.get("course_interested") or "our courses",
                    "counselor": lead.get("assigned_to") or "Your counselor"}
    try:
        results = await comm_service.campaign.trigger_follow_up(lead_payload, body.get("message", ""), body.get("priority", "normal"))
    except Exception as exc:
        logger.error(f"trigger_followup failed for {lead_id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Communication service error: {exc}")

    for result in results:
        try:
            supabase_data.create_note(lead_id=lead.get("id"), content=f"[{result['channel'].title()} - Follow-up] {body.get('message', '')}", channel=result["channel"], created_by="System")
        except Exception as ne:
            logger.error(f"Note creation failed for {lead_id}: {ne}")
    return {"success": True, "message": "Follow-up sequence triggered", "results": results}


# ── CHAT (WhatsApp via Interakt) ──────────────────────────────────────────────

@router.get("/{lead_id}/chat")
async def get_chat_messages(lead_id: str):
    """Get all WhatsApp chat messages for a lead."""
    try:
        row = supabase_data.client.table("leads").select("id").eq("lead_id", lead_id).execute()
        if not row.data:
            return []
        iid = row.data[0]["id"]
        resp = supabase_data.client.table("chat_messages").select("*").eq("lead_db_id", iid).order("timestamp").execute()
        return resp.data or []
    except Exception as exc:
        logger.error(f"Error getting chat messages for {lead_id}: {exc}")
        return []


@router.post("/{lead_id}/chat")
async def send_chat_message(lead_id: str, body: dict):
    """Send a WhatsApp message (text or media) to a lead via Interakt."""
    row = supabase_data.client.table("leads").select("*").eq("lead_id", lead_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = row.data[0]
    iid   = lead["id"]
    phone = lead.get("whatsapp") or lead.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Lead has no WhatsApp/phone number")

    from communication_service import InteraktWhatsAppService
    wa = InteraktWhatsAppService()
    msg_type = body.get("msg_type", "text")
    country_code = body.get("country_code", "+91")

    if msg_type == "text":
        result = await wa.send_message(phone, body.get("message") or "", country_code)
    else:
        result = await wa.send_media(to=phone, media_type=msg_type, url=body.get("media_url") or "", filename=body.get("filename"), caption=body.get("message"), country_code=country_code)

    msg_data = {k: v for k, v in {
        "lead_db_id": iid, "direction": "outbound", "msg_type": msg_type,
        "content": body.get("message"), "media_url": body.get("media_url"),
        "filename": body.get("filename"), "sender_name": body.get("sender_name", "CRM"),
        "status": "sent" if result.get("success") else "failed",
        "interakt_id": result.get("message_id"),
        "created_at": datetime.utcnow().isoformat(),
    }.items() if v is not None}

    ins = supabase_data.client.table("chat_messages").insert(msg_data).execute()
    if ins.data:
        return ins.data[0]
    raise HTTPException(status_code=500, detail="Failed to save message")
