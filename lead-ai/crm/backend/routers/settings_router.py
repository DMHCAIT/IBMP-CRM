"""
Settings Router — SLA, Decay, Cache, Workflow
===============================================
Administrative configuration and operations endpoints.

Routes:
  GET  /api/admin/sla-config      — read SLA config
  PUT  /api/admin/sla-config      — update SLA config
  GET  /api/admin/sla-compliance  — SLA compliance report
  GET  /api/admin/decay-config    — read lead decay config
  PUT  /api/admin/decay-config    — update lead decay config
  POST /api/admin/run-decay       — manually run decay logic
  GET  /api/admin/decay-log       — decay execution history
  GET  /api/admin/decay-preview   — preview leads that would decay

  GET  /api/cache/stats           — cache hit/miss stats
  POST /api/cache/clear           — clear one or all caches

  POST /api/workflows/trigger     — manually trigger workflow engine
"""

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException

from cache import get_cache_stats, invalidate_cache
from logger_config import logger
from supabase_data_layer import supabase_data

router = APIRouter(tags=["Settings"])


# ── SLA Configuration ─────────────────────────────────────────────────────────

_DEFAULT_SLA = {
    "fresh_response_hours":    24,
    "followup_interval_hours": 48,
    "max_idle_days":           7,
    "escalation_threshold":    3,
    "enabled":                 True,
}

# In-memory store (replace with DB-backed config when needed)
_sla_config: dict = dict(_DEFAULT_SLA)


@router.get("/api/admin/sla-config")
async def get_sla_config():
    """Read current SLA configuration."""
    try:
        response = supabase_data.client.table("system_config").select("*").eq("key", "sla_config").limit(1).execute()
        if response.data:
            import json
            return json.loads(response.data[0].get("value", "{}")) or _sla_config
    except Exception:
        pass
    return _sla_config


@router.put("/api/admin/sla-config")
async def update_sla_config(body: dict):
    """Update SLA configuration."""
    global _sla_config
    _sla_config.update(body)
    try:
        import json
        payload = {"key": "sla_config", "value": json.dumps(_sla_config), "updated_at": datetime.utcnow().isoformat()}
        supabase_data.client.table("system_config").upsert(payload, on_conflict="key").execute()
    except Exception as exc:
        logger.warning(f"Could not persist SLA config: {exc}")
    return {"success": True, "config": _sla_config}


@router.get("/api/admin/sla-compliance")
async def get_sla_compliance():
    """SLA compliance report — how many leads were contacted within the SLA window."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("created_at,last_contact_date,status,assigned_to").range(0, 99999).execute()
        leads = response.data or []

        sla_hours  = _sla_config.get("fresh_response_hours", 24)
        compliant  = 0
        breached   = 0
        pending    = 0

        for lead in leads:
            if lead.get("status") in ["Enrolled", "Not Interested", "Junk"]:
                continue
            if not lead.get("created_at"):
                pending += 1
                continue
            try:
                created = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00"))
                if lead.get("last_contact_date"):
                    contacted = datetime.fromisoformat(lead["last_contact_date"].replace("Z", "+00:00"))
                    hours_to_contact = (contacted - created).total_seconds() / 3600
                    if hours_to_contact <= sla_hours:
                        compliant += 1
                    else:
                        breached += 1
                else:
                    hours_since_create = (datetime.utcnow() - created.replace(tzinfo=None)).total_seconds() / 3600
                    if hours_since_create > sla_hours:
                        breached += 1
                    else:
                        pending += 1
            except Exception:
                pending += 1

        total = compliant + breached + pending
        return {
            "compliant":  compliant,
            "breached":   breached,
            "pending":    pending,
            "total":      total,
            "compliance_rate": round((compliant / max(total, 1)) * 100, 2),
            "sla_hours":  sla_hours,
        }
    except Exception as exc:
        logger.error(f"SLA compliance error: {exc}")
        return {}


# ── Decay Configuration ───────────────────────────────────────────────────────

_DEFAULT_DECAY = {
    "enabled":               True,
    "idle_days_threshold":   14,
    "score_decay_per_day":   1.0,
    "min_score":             0,
    "target_statuses":       ["Fresh", "In Progress", "Follow Up"],
}
_decay_config: dict  = dict(_DEFAULT_DECAY)
_decay_log: list     = []


@router.get("/api/admin/decay-config")
async def get_decay_config():
    """Read current lead-score decay configuration."""
    return _decay_config


@router.put("/api/admin/decay-config")
async def update_decay_config(body: dict):
    """Update lead-score decay configuration."""
    global _decay_config
    _decay_config.update(body)
    return {"success": True, "config": _decay_config}


@router.post("/api/admin/run-decay")
async def run_decay():
    """Manually run lead-score decay logic."""
    from datetime import datetime, timedelta
    global _decay_log

    if not _decay_config.get("enabled"):
        return {"success": False, "message": "Decay is disabled"}

    try:
        threshold  = _decay_config.get("idle_days_threshold", 14)
        decay_rate = _decay_config.get("score_decay_per_day", 1.0)
        min_score  = _decay_config.get("min_score", 0)
        targets    = _decay_config.get("target_statuses", ["Fresh", "In Progress", "Follow Up"])
        cutoff     = (datetime.utcnow() - timedelta(days=threshold)).isoformat()

        response = supabase_data.client.table("leads").select(
            "lead_id,ai_score,last_contact_date,status"
        ).in_("status", targets).execute()
        leads = response.data or []

        decayed_count = 0
        for lead in leads:
            lc = lead.get("last_contact_date") or ""
            if lc and lc < cutoff:
                try:
                    lc_dt    = datetime.fromisoformat(lc.replace("Z", "+00:00"))
                    idle_days = (datetime.utcnow() - lc_dt.replace(tzinfo=None)).days
                    decay     = decay_rate * max(0, idle_days - threshold)
                    new_score = max(min_score, (lead.get("ai_score") or 50) - decay)
                    supabase_data.update_lead(lead["lead_id"], {"ai_score": round(new_score, 2)})
                    decayed_count += 1
                except Exception as e:
                    logger.warning(f"Decay failed for lead {lead.get('lead_id')}: {e}")

        entry = {"timestamp": datetime.utcnow().isoformat(), "leads_processed": len(leads), "decayed": decayed_count}
        _decay_log.append(entry)
        return {"success": True, **entry}
    except Exception as exc:
        logger.error(f"Decay run error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/admin/decay-log")
async def get_decay_log():
    """Decay execution history (in-memory, last 100 runs)."""
    return _decay_log[-100:]


@router.get("/api/admin/decay-preview")
async def preview_decay():
    """Preview leads that would be affected by the next decay run."""
    try:
        from datetime import timedelta
        threshold = _decay_config.get("idle_days_threshold", 14)
        cutoff    = (datetime.utcnow() - timedelta(days=threshold)).isoformat()
        targets   = _decay_config.get("target_statuses", ["Fresh", "In Progress", "Follow Up"])

        response = supabase_data.client.table("leads").select(
            "lead_id,full_name,ai_score,last_contact_date,assigned_to,status"
        ).in_("status", targets).lt("last_contact_date", cutoff).limit(100).execute()

        candidates = response.data or []
        return {
            "preview_count": len(candidates),
            "threshold_days": threshold,
            "candidates": candidates[:20],
        }
    except Exception as exc:
        logger.error(f"Decay preview error: {exc}")
        return {"preview_count": 0, "candidates": []}


# ── Cache Management ──────────────────────────────────────────────────────────

@router.get("/api/cache/stats")
async def get_cache_statistics():
    """Cache statistics for monitoring."""
    return {"caches": get_cache_stats(), "timestamp": datetime.utcnow().isoformat()}


@router.post("/api/cache/clear")
async def clear_cache(cache_name: Optional[str] = None):
    """Clear one named cache or all caches."""
    from main import LEAD_CACHE, COURSE_CACHE, USER_CACHE, STATS_CACHE, ML_SCORE_CACHE
    cache_map = {
        "leads": LEAD_CACHE, "courses": COURSE_CACHE,
        "users": USER_CACHE, "stats": STATS_CACHE, "ml_scores": ML_SCORE_CACHE,
    }
    if cache_name:
        if cache_name not in cache_map:
            raise HTTPException(status_code=400, detail=f"Unknown cache: {cache_name}")
        invalidate_cache(cache_map[cache_name])
        logger.info(f"🗑️  Cleared {cache_name} cache")
        return {"status": "success", "cleared": cache_name, "timestamp": datetime.utcnow().isoformat()}
    else:
        for c in cache_map.values():
            invalidate_cache(c)
        logger.info("🗑️  Cleared all caches")
        return {"status": "success", "cleared": "all", "timestamp": datetime.utcnow().isoformat()}


# ── Workflow Trigger ──────────────────────────────────────────────────────────

@router.post("/api/workflows/trigger")
async def trigger_workflows():
    """Manually trigger the workflow engine — marks overdue fresh leads as Follow Up."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("lead_id,status,follow_up_date").range(0, 99999).execute()
        all_leads = response.data or []

        triggered_count = 0
        now = datetime.utcnow()
        for lead in all_leads:
            if lead.get("status") in ["Fresh", "In Progress", "Follow Up"]:
                fud = lead.get("follow_up_date")
                if fud:
                    try:
                        fud_dt = datetime.fromisoformat(fud.replace("Z", "+00:00"))
                        if fud_dt.replace(tzinfo=None) < now:
                            supabase_data.update_lead(lead["lead_id"], {"status": "Follow Up"})
                            triggered_count += 1
                    except Exception:
                        pass

        return {
            "success":   True,
            "message":   f"Processed {len(all_leads)} leads, triggered {triggered_count} workflow actions",
            "processed": len(all_leads),
            "triggered": triggered_count,
        }
    except Exception as exc:
        logger.error(f"Workflow trigger failed: {exc}")
        raise HTTPException(status_code=500, detail="Workflow trigger failed")
