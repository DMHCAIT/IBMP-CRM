"""
System Router — /, /ping, /health, /ready, /metrics, /api/sync/*
=================================================================
Handles infrastructure endpoints: root info, keep-alive ping,
health checks, readiness probes, Prometheus metrics, and
Google Sheets sync management.

Routes:
  GET  /                                    — API info
  GET  /ping                                — keep-alive (< 1 ms, no DB)
  GET  /health                              — full health check
  GET  /ready                               — Kubernetes readiness probe
  GET  /metrics                             — Prometheus metrics
  GET  /api/sync/google-sheets/status       — sync status
  POST /api/sync/google-sheets/trigger      — async trigger
  POST /api/sync/google-sheets/sync-now     — synchronous trigger
  GET  /api/sync/google-sheets/test-connection — connectivity test
"""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException

from logger_config import logger

router = APIRouter(tags=["System"])


# ── Root ─────────────────────────────────────────────────────────────────────

@router.get("/")
async def root():
    """Root endpoint — API information."""
    return {
        "name": "Medical Education CRM API",
        "version": "2.1.0",
        "status": "running",
        "docs":   "/docs",
        "health": "/health",
    }


# ── Keep-alive ────────────────────────────────────────────────────────────────

@router.get("/ping")
async def ping():
    """
    Ultra-lightweight keep-alive endpoint — NO database, NO ML calls.
    Used by external schedulers (cron-job.org, UptimeRobot) to keep the
    Render free-tier container warm.  Returns in < 1 ms.
    """
    return {"pong": True, "ts": datetime.utcnow().isoformat()}


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/health")
async def health_check():
    """Full health check — tests DB, AI assistant, ML model, and cache."""
    health_status: dict = {
        "status":          "healthy",
        "version":         "2.1.0",
        "timestamp":       datetime.utcnow().isoformat(),
        "database":        "unknown",
        "database_status": "unknown",
        "components":      {},
    }

    # ── Dynamic imports — each isolated so one failure doesn't break others ──
    try:
        from supabase_client import supabase_manager as _sm
        health_status["database"] = "supabase" if _sm.client else "sqlite"
    except Exception:
        health_status["database"] = "unavailable"

    # ── Database ping ─────────────────────────────────────────────────────────
    try:
        from supabase_data_layer import supabase_data as _sd
        from supabase_client import supabase_manager as _sm2
        if _sm2.client:
            _sd.client.table("leads").select("count", count="exact").limit(0).execute()
            health_status["database_status"] = "connected"
        else:
            from main import SessionLocal, DBLead
            db = SessionLocal()
            try:
                health_status["lead_count"] = db.query(DBLead).count()
                health_status["database_status"] = "connected"
            finally:
                db.close()
    except Exception as exc:
        health_status["database_status"] = "degraded"
        health_status["status"] = "degraded"
        logger.warning(f"Database health check failed: {exc}")

    # ── AI assistant ──────────────────────────────────────────────────────────
    try:
        from ai_assistant import ai_assistant as _ai
        health_status["ai_assistant"] = (
            "available" if _ai.is_available() else "not_configured"
        )
    except Exception:
        health_status["ai_assistant"] = "unavailable"

    # ── ML model ──────────────────────────────────────────────────────────────
    try:
        from main import get_cached_model as _gcm
        health_status["components"]["ml_model"] = {
            "status": "loaded" if _gcm() else "not_loaded"
        }
    except Exception:
        health_status["components"]["ml_model"] = {"status": "unavailable"}

    # ── Cache ─────────────────────────────────────────────────────────────────
    try:
        from cache import get_cache_stats as _gcs
        health_status["components"]["cache"] = {
            "status": "healthy",
            "stats":  _gcs(),
        }
    except Exception:
        health_status["components"]["cache"] = {"status": "unavailable"}

    status_code = 503 if health_status["status"] != "healthy" else 200
    from fastapi.responses import JSONResponse
    return JSONResponse(content=health_status, status_code=status_code)


# ── Readiness ─────────────────────────────────────────────────────────────────

@router.get("/ready")
async def readiness_check():
    """Kubernetes / deployment readiness probe — Supabase only."""
    model_status = "not_loaded"
    db_ready     = False
    reason       = ""

    try:
        from supabase_client import supabase_manager as _sm
        if _sm.client:
            _sm.client.table("leads").select("count", count="exact").limit(0).execute()
            db_ready = True
        else:
            reason = "Database not configured"
    except Exception as exc:
        reason = str(exc)
        logger.warning(f"Readiness DB check failed: {exc}")

    try:
        from main import get_cached_model as _gcm
        model_status = "loaded" if _gcm() else "not_loaded"
    except Exception:
        model_status = "unavailable"

    if not db_ready:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"ready": False, "status": "not_ready", "reason": reason, "model": model_status},
        )

    return {"ready": True, "status": "ready", "model": model_status}


# ── Prometheus metrics ────────────────────────────────────────────────────────

@router.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint (only available when prometheus_client is installed)."""
    from starlette.responses import Response

    try:
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    except ImportError:
        raise HTTPException(status_code=501, detail="Prometheus client not installed")

    # Honour the PROMETHEUS_ENABLED flag if set in main
    try:
        from main import PROMETHEUS_ENABLED
        if not PROMETHEUS_ENABLED:
            raise HTTPException(status_code=501, detail="Prometheus metrics not enabled")
    except ImportError:
        pass

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ── Google Sheets Sync ────────────────────────────────────────────────────────

@router.get("/api/sync/google-sheets/status")
async def google_sheets_sync_status():
    """Get Google Sheets sync status and configuration."""
    import os
    try:
        from google_sheets_service import google_sheets_service
        from lead_sync_service import lead_sync_service

        return {
            "google_sheets": google_sheets_service.test_connection(),
            "sync":          lead_sync_service.get_sync_stats(),
            "configuration": {
                "sheet_id":             os.getenv("GOOGLE_SHEET_ID", ""),
                "sheet_name":           os.getenv("GOOGLE_SHEET_NAME", "Sheet1"),
                "sync_interval":        "5 minutes",
                "credentials_configured": os.path.exists("google-credentials.json"),
            },
        }
    except Exception as exc:
        logger.error(f"Error getting sync status: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/sync/google-sheets/trigger")
async def trigger_google_sheets_sync(background_tasks: BackgroundTasks):
    """Manually trigger Google Sheets sync (runs in background)."""
    try:
        from lead_sync_service import lead_sync_service
        logger.info("🔄 Manual sync triggered from API")
        background_tasks.add_task(lead_sync_service.sync_all_unsynced_leads)
        return {
            "status":    "started",
            "message":   "Sync process started in background",
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        logger.error(f"Error triggering sync: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/sync/google-sheets/sync-now")
async def sync_google_sheets_now():
    """Synchronous Google Sheets sync — waits for completion (use for testing)."""
    try:
        from lead_sync_service import lead_sync_service
        logger.info("🔄 Synchronous sync triggered from API")
        return lead_sync_service.sync_all_unsynced_leads()
    except Exception as exc:
        logger.error(f"Error during sync: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/sync/google-sheets/sync-all")
async def sync_all_google_sheets_leads():
    """Sync ALL leads from Google Sheet as Fresh Leads (ignores Sync_Status)."""
    try:
        from lead_sync_service import lead_sync_service
        logger.info("Full sheet sync triggered from API")
        return lead_sync_service.sync_all_leads()
    except Exception as exc:
        logger.error(f"Error during full sync: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/sync/google-sheets/test-connection")
async def test_google_sheets_connection():
    """Test Google Sheets connection and show sheet preview."""
    try:
        from google_sheets_service import google_sheets_service

        status = google_sheets_service.test_connection()
        if status.get("status") == "success":
            all_leads     = google_sheets_service.get_all_leads()
            unsynced      = google_sheets_service.get_unsynced_leads()
            status["preview"] = {
                "total_leads":   len(all_leads),
                "unsynced_leads": len(unsynced),
                "sample_leads":  unsynced[:3] if unsynced else [],
            }
        return status
    except Exception as exc:
        logger.error(f"Error testing connection: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
