"""
Analytics Router — /api/analytics/*, /api/admin/*, /api/dashboard/*
=====================================================================
All analytics, admin reporting, and dashboard stats endpoints.

Routes:
  GET  /api/dashboard/stats                  — overall KPI snapshot (cached)
  GET  /api/analytics/revenue-by-country     — revenue breakdown by country
  GET  /api/analytics/conversion-funnel      — funnel stage counts
  GET  /api/analytics/campaigns/overview     — campaign performance overview
  GET  /api/analytics/campaigns/list         — per-campaign list
  GET  /api/analytics/campaigns/{name}       — single campaign detail
  GET  /api/analytics/campaigns/compare      — campaign comparison
  GET  /api/analytics/call-timing            — call timing analysis
  GET  /api/admin/stats                      — admin KPI totals
  GET  /api/admin/team-performance           — counselor league table
  GET  /api/admin/funnel-analysis            — status-based funnel
  GET  /api/admin/revenue-trend              — daily revenue trend
  GET  /api/admin/lead-update-activity       — lead update audit
  GET  /api/admin/sla-config                 — SLA configuration
  PUT  /api/admin/sla-config                 — update SLA config
  GET  /api/admin/sla-compliance             — SLA compliance report
  GET  /api/admin/cohort-analysis            — cohort conversion analysis
  GET  /api/admin/conversion-time            — time-to-conversion metrics
  GET  /api/admin/source-analytics           — source performance
  GET  /api/admin/decay-config               — decay config
  PUT  /api/admin/decay-config               — update decay config
  POST /api/admin/run-decay                  — manual decay run
  GET  /api/admin/decay-log                  — decay execution log
  GET  /api/admin/decay-preview              — preview decay candidates
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from auth import decode_access_token
from cache import cache_async_result
from logger_config import logger
from supabase_data_layer import supabase_data

router = APIRouter(tags=["Analytics"])


# ── Dashboard Stats ───────────────────────────────────────────────────────────

@router.get("/api/dashboard/stats")
async def get_dashboard_stats(request: Request):
    """Overall KPI snapshot (cached per user role). Dept-scoped for Counselors/Academic/Accounts."""
    from main import DashboardStats, STATS_CACHE, _get_counselor_name
    _counselor_name = _get_counselor_name(request)
    _dept_status    = None   # status filter for Academic / Accounts depts

    # Resolve department from JWT
    try:
        ah = request.headers.get("Authorization", "")
        if ah.startswith("Bearer "):
            td = decode_access_token(ah.split(" ", 1)[1])
            if td:
                dept = td.department or ""
                if dept in ("Academic", "Accounts"):
                    _dept_status = "ENROLLED"
                elif dept == "HR":
                    # HR sees no lead stats
                    from main import DashboardStats
                    return DashboardStats(
                        total_leads=0, hot_leads=0, warm_leads=0, cold_leads=0, junk_leads=0,
                        total_conversions=0, conversion_rate=0, total_revenue=0, expected_revenue=0,
                        leads_today=0, leads_this_week=0, leads_this_month=0, avg_ai_score=0,
                    )
    except Exception:
        pass

    try:
        basic_stats = supabase_data.get_dashboard_stats(assigned_to=_counselor_name)
        now         = datetime.utcnow()
        today_start = f"{now.date().isoformat()}T00:00:00"
        week_start  = (now - timedelta(days=7)).isoformat()
        month_start = (now - timedelta(days=30)).isoformat()

        def _count(gte_val: str) -> int:
            q = supabase_data.client.table("leads").select("id", count="exact").gte("created_at", gte_val)
            if _counselor_name:
                q = q.ilike("assigned_to", _counselor_name)
            if _dept_status:
                q = q.eq("status", _dept_status)
            return getattr(q.execute(), "count", 0) or 0

        today_count = _count(today_start)
        week_count  = _count(week_start)
        month_count = _count(month_start)

        rev_q = supabase_data.client.table("leads").select("expected_revenue")
        if _counselor_name:
            rev_q = rev_q.ilike("assigned_to", _counselor_name)
        if _dept_status:
            rev_q = rev_q.eq("status", _dept_status)
        # Use .range() to bypass 1000 row limit
        rev_q = rev_q.range(0, 99999)
        expected_revenue = sum(l.get("expected_revenue", 0) or 0 for l in (rev_q.execute().data or []))

        score_q = supabase_data.client.table("leads").select("ai_score").not_.is_("ai_score", "null")
        if _counselor_name:
            score_q = score_q.ilike("assigned_to", _counselor_name)
        if _dept_status:
            score_q = score_q.eq("status", _dept_status)
        # Use .range() to bypass 1000 row limit
        score_q = score_q.range(0, 99999)
        scores   = [l.get("ai_score", 0) for l in (score_q.execute().data or []) if l.get("ai_score")]
        avg_score = sum(scores) / len(scores) if scores else 0

        return DashboardStats(
            total_leads=basic_stats["total"],
            hot_leads=basic_stats["hot"],
            warm_leads=basic_stats["warm"],
            cold_leads=basic_stats["cold"],
            junk_leads=basic_stats["junk"],
            total_conversions=basic_stats["conversions"],
            conversion_rate=basic_stats["conversion_rate"],
            total_revenue=basic_stats["revenue"],
            expected_revenue=round(expected_revenue, 2),
            leads_today=today_count,
            leads_this_week=week_count,
            leads_this_month=month_count,
            avg_ai_score=avg_score,
        )
    except Exception as exc:
        logger.error(f"Dashboard stats error: {exc}")
        from main import DashboardStats
        return DashboardStats(
            total_leads=0, hot_leads=0, warm_leads=0, cold_leads=0, junk_leads=0,
            total_conversions=0, conversion_rate=0, total_revenue=0, expected_revenue=0,
            leads_today=0, leads_this_week=0, leads_this_month=0, avg_ai_score=0,
        )


# ── Revenue / Funnel ──────────────────────────────────────────────────────────

@router.get("/api/analytics/revenue-by-country")
async def revenue_by_country():
    """Revenue breakdown by country."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("country,actual_revenue,expected_revenue").range(0, 99999).execute()
        country_stats: dict = {}
        for lead in (response.data or []):
            c = lead.get("country") or "Unknown"
            if c not in country_stats:
                country_stats[c] = {"total_leads": 0, "total_revenue": 0, "expected_revenue": 0}
            country_stats[c]["total_leads"] += 1
            country_stats[c]["total_revenue"]    += lead.get("actual_revenue", 0) or 0
            country_stats[c]["expected_revenue"] += lead.get("expected_revenue", 0) or 0
        return [{"country": c, "total_leads": s["total_leads"],
                 "total_revenue": round(s["total_revenue"], 2),
                 "expected_revenue": round(s["expected_revenue"], 2)}
                for c, s in country_stats.items()]
    except Exception as exc:
        logger.error(f"Revenue by country error: {exc}")
        return []


@router.get("/api/analytics/conversion-funnel")
async def conversion_funnel():
    """Conversion funnel stage counts."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("last_contact_date,ai_score,status").range(0, 99999).execute()
        leads = response.data or []
        total     = len(leads)
        contacted = sum(1 for l in leads if l.get("last_contact_date"))
        warm_hot  = sum(1 for l in leads if (l.get("ai_score") or 0) >= 50)
        converted = sum(1 for l in leads if l.get("status") == "Enrolled")
        return {"stages": [
            {"name": "Total Leads", "count": total, "percentage": 100},
            {"name": "Contacted",   "count": contacted, "percentage": round((contacted / total * 100) if total else 0, 1)},
            {"name": "Warm/Hot",    "count": warm_hot,  "percentage": round((warm_hot / total * 100) if total else 0, 1)},
            {"name": "Converted",   "count": converted, "percentage": round((converted / total * 100) if total else 0, 1)},
        ]}
    except Exception as exc:
        logger.error(f"Conversion funnel error: {exc}")
        return {"stages": []}


# ── Campaign Analytics ────────────────────────────────────────────────────────

@router.get("/api/analytics/campaigns/overview")
async def campaign_overview():
    """Overall campaign performance metrics."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select(
            "campaign_medium,campaign_name,campaign_group,status,ai_score,actual_revenue,expected_revenue,created_at,lead_quality"
        ).range(0, 99999).execute()
        leads = response.data or []
        total      = len(leads)
        total_camp = len({l.get("campaign_name") for l in leads if l.get("campaign_name")})
        total_rev  = sum(l.get("actual_revenue", 0) or 0 for l in leads)
        total_exp  = sum(l.get("expected_revenue", 0) or 0 for l in leads)
        converted  = sum(1 for l in leads if l.get("status") == "Enrolled")
        hot_warm   = sum(1 for l in leads if (l.get("ai_score") or 0) >= 50)

        medium_stats: dict = {}
        for lead in leads:
            m = lead.get("campaign_medium") or "Unknown"
            if m not in medium_stats:
                medium_stats[m] = {"leads": 0, "revenue": 0, "conversions": 0}
            medium_stats[m]["leads"] += 1
            medium_stats[m]["revenue"] += lead.get("actual_revenue", 0) or 0
            if lead.get("status") == "Enrolled":
                medium_stats[m]["conversions"] += 1

        by_medium = []
        for m, s in medium_stats.items():
            m_total = max(s["leads"], 1)
            by_medium.append({
                "medium":          m,
                "leads":           s["leads"],
                "conversions":     s["conversions"],
                "revenue":         round(s["revenue"], 2),
                "conversion_rate": round(s["conversions"] / m_total * 100, 2),
            })

        return {
            "total_leads":       total,
            "total_campaigns":   total_camp,
            "total_revenue":     round(total_rev, 2),
            "expected_revenue":  round(total_exp, 2),
            "conversion_rate":   round((converted / total * 100) if total else 0, 2),
            "hot_warm_rate":     round((hot_warm / total * 100) if total else 0, 2),
            "by_medium":         by_medium,
        }
    except Exception as exc:
        logger.error(f"Campaign overview error: {exc}")
        return {}


@router.get("/api/analytics/campaigns/list")
async def campaign_list():
    """Per-campaign performance list."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select(
            "campaign_name,campaign_medium,campaign_group,status,ai_segment,ai_score,actual_revenue,expected_revenue,phone,created_at"
        ).range(0, 99999).execute()
        leads = response.data or []

        campaigns: dict = {}
        for lead in leads:
            name = lead.get("campaign_name") or "Unknown"
            if name not in campaigns:
                campaigns[name] = {
                    "campaign_name":   name,
                    "campaign_medium": lead.get("campaign_medium") or "Unknown",
                    "campaign_group":  lead.get("campaign_group") or "",
                    "total_leads":     0,
                    "hot_leads":       0,
                    "warm_leads":      0,
                    "cold_leads":      0,
                    "converted":       0,
                    "total_revenue":   0.0,
                    "contacted":       0,
                }
            c = campaigns[name]
            c["total_leads"] += 1
            c["total_revenue"] += lead.get("actual_revenue", 0) or 0

            seg = (lead.get("ai_segment") or "").lower()
            if seg == "hot":
                c["hot_leads"] += 1
            elif seg == "warm":
                c["warm_leads"] += 1
            elif seg == "cold":
                c["cold_leads"] += 1

            if lead.get("status") == "Enrolled":
                c["converted"] += 1

            # Contact rate: leads whose status is not Fresh
            if lead.get("status") and lead["status"] != "Fresh":
                c["contacted"] += 1

        result = []
        for c in campaigns.values():
            total = max(c["total_leads"], 1)
            c["conversion_rate"]    = round(c["converted"] / total * 100, 2)
            c["contact_rate"]       = round(c["contacted"] / total * 100, 2)
            c["avg_revenue_per_lead"] = round(c["total_revenue"] / total, 2)
            c["total_revenue"]      = round(c["total_revenue"], 2)
            del c["contacted"]
            result.append(c)

        result.sort(key=lambda x: x["total_leads"], reverse=True)
        return result
    except Exception as exc:
        logger.error(f"Campaign list error: {exc}")
        return []


@router.get("/api/analytics/campaigns/leads")
async def campaign_leads(campaign_name: Optional[str] = None, medium: Optional[str] = None, limit: int = 70000):
    """
    All individual leads that have campaign data (synced from Google Sheet).
    Returns full campaign detail fields per lead — powers the Sheet Leads tab.
    
    NOTE: Supabase PostgREST has default 1000 row limit.
    Must use .range() instead of .limit() to fetch more rows.
    """
    try:
        query = supabase_data.client.table("leads").select(
            "lead_id,full_name,phone,email,country,city,status,source,"
            "campaign_name,campaign_medium,campaign_group,ad_name,adset_name,"
            "form_name,lead_quality,qualification,assigned_to,created_at,ai_score,ai_segment"
        )

        if campaign_name:
            query = query.eq("campaign_name", campaign_name)
        if medium:
            query = query.eq("campaign_medium", medium)

        # Use .range() instead of .limit() to bypass Supabase's 1000 row default
        # Range is 0-indexed and inclusive: range(0, 69999) = 70,000 rows
        query = query.range(0, limit - 1).order("created_at", desc=True)

        response = query.execute()
        leads = response.data or []

        # Return all leads - no filtering
        return leads
    except Exception as exc:
        logger.error(f"Campaign leads error: {exc}")
        return []


@router.get("/api/analytics/campaigns/compare")
async def campaign_compare(a: Optional[str] = None, b: Optional[str] = None):
    """Compare two campaigns side-by-side.
    NOTE: must be registered BEFORE /{campaign_name} to avoid being swallowed by the wildcard.
    """
    if not a or not b:
        raise HTTPException(status_code=400, detail="Both 'a' and 'b' campaign names are required")
    results = []
    for name in (a, b):
        # Use .range() to bypass 1000 row limit
        resp = supabase_data.client.table("leads").select("status,actual_revenue,ai_score").eq("campaign_name", name).range(0, 99999).execute()
        ldata = resp.data or []
        total = len(ldata)
        conversions = sum(1 for l in ldata if l.get("status") == "Enrolled")
        results.append({
            "campaign": name, "total_leads": total,
            "conversions": conversions,
            "conversion_rate": round(conversions / max(total, 1) * 100, 2),
            "total_revenue": round(sum(l.get("actual_revenue", 0) or 0 for l in ldata), 2),
        })
    return {"comparison": results}


@router.get("/api/analytics/campaigns/{campaign_name}")
async def campaign_detail(campaign_name: str):
    """Single campaign detail with time-series breakdown."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select(
            "status,ai_score,actual_revenue,expected_revenue,created_at,country,source"
        ).eq("campaign_name", campaign_name).range(0, 99999).execute()
        leads = response.data or []
        if not leads:
            raise HTTPException(status_code=404, detail="Campaign not found")

        daily: dict = defaultdict(lambda: {"leads": 0, "conversions": 0})
        for lead in leads:
            if lead.get("created_at"):
                try:
                    day = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00")).strftime("%Y-%m-%d")
                    daily[day]["leads"] += 1
                    if lead.get("status") == "Enrolled":
                        daily[day]["conversions"] += 1
                except Exception:
                    pass

        return {
            "campaign_name":   campaign_name,
            "total_leads":     len(leads),
            "total_revenue":   round(sum(l.get("actual_revenue", 0) or 0 for l in leads), 2),
            "conversion_rate": round(sum(1 for l in leads if l.get("status") == "Enrolled") / max(len(leads), 1) * 100, 2),
            "daily_breakdown": [{"date": k, **v} for k, v in sorted(daily.items())],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Campaign detail error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/analytics/call-timing")
async def call_timing_analysis():
    """Call timing analysis — best hours/days to contact leads."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("notes").select("created_at,channel").eq("channel", "call").range(0, 99999).execute()
        notes = response.data or []

        hour_stats: dict  = defaultdict(int)
        day_stats: dict   = defaultdict(int)
        for note in notes:
            if note.get("created_at"):
                try:
                    dt = datetime.fromisoformat(note["created_at"].replace("Z", "+00:00"))
                    hour_stats[dt.hour] += 1
                    day_stats[dt.strftime("%A")] += 1
                except Exception:
                    pass

        return {
            "by_hour": [{"hour": h, "calls": c} for h, c in sorted(hour_stats.items())],
            "by_day":  [{"day": d, "calls": c} for d, c in day_stats.items()],
            "best_hour": max(hour_stats, key=hour_stats.get) if hour_stats else None,
            "best_day":  max(day_stats, key=day_stats.get) if day_stats else None,
        }
    except Exception as exc:
        logger.error(f"Call timing error: {exc}")
        return {"by_hour": [], "by_day": []}


# ── Admin Stats ───────────────────────────────────────────────────────────────

@router.get("/api/admin/stats")
async def get_admin_stats():
    """Admin KPI totals — revenue, leads, conversion rate, month-over-month trends."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("status,ai_segment,expected_revenue,created_at").range(0, 99999).execute()
        leads = response.data or []
        total    = len(leads)
        enrolled = sum(1 for l in leads if l.get("status") == "Enrolled")
        hot      = sum(1 for l in leads if l.get("ai_segment") == "Hot")
        revenue  = sum(l.get("expected_revenue", 0) or 0 for l in leads if l.get("status") == "Enrolled")

        now            = datetime.utcnow()
        month_start    = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_m_start   = (month_start - timedelta(days=1)).replace(day=1)

        def _parse(iso: str) -> Optional[datetime]:
            try:
                return datetime.fromisoformat(iso.replace("Z", "+00:00"))
            except Exception:
                return None

        this_m  = sum(1 for l in leads if l.get("created_at") and (_parse(l["created_at"]) or datetime.min) >= month_start)
        last_m  = sum(1 for l in leads if l.get("created_at") and last_m_start <= (_parse(l["created_at"]) or datetime.min) < month_start)
        trend   = ((this_m - last_m) / max(last_m, 1)) * 100

        return {
            "total_revenue":      revenue,
            "total_leads":        total,
            "enrolled":           enrolled,
            "hot_leads":          hot,
            "conversion_rate":    round((enrolled / max(total, 1)) * 100, 2),
            "avg_conversion_rate": round((enrolled / max(total, 1)) * 100, 2),
            "revenue_trend":      0,
            "leads_trend":        round(trend, 2),
            "conversion_trend":   0,
            "this_month_leads":   this_m,
        }
    except Exception as exc:
        logger.error(f"Admin stats error: {exc}")
        return {"total_revenue": 0, "total_leads": 0, "enrolled": 0, "hot_leads": 0,
                "conversion_rate": 0, "avg_conversion_rate": 0, "revenue_trend": 0,
                "leads_trend": 0, "conversion_trend": 0, "this_month_leads": 0}


@router.get("/api/admin/team-performance")
async def get_team_performance():
    """Per-counselor performance — lead counts, conversions, revenue, ranking."""
    try:
        users     = supabase_data.get_all_users()
        counselors = [u for u in users if u.get("role") == "Counselor"]
        # Use .range() to bypass 1000 row limit
        resp      = supabase_data.client.table("leads").select("assigned_to,status,ai_segment,expected_revenue").range(0, 99999).execute()
        all_leads = resp.data or []

        result = []
        for u in counselors:
            name    = u["full_name"]
            assigned = [l for l in all_leads if l.get("assigned_to") == name]
            total   = len(assigned)
            convs   = sum(1 for l in assigned if l.get("status") == "Enrolled")
            hot     = sum(1 for l in assigned if l.get("ai_segment") == "Hot")
            rev     = sum(l.get("expected_revenue", 0) or 0 for l in assigned if l.get("status") == "Enrolled")
            result.append({"id": u["id"], "name": name, "total_leads": total,
                           "conversions": convs, "hot_leads": hot, "revenue": rev,
                           "conversion_rate": round((convs / max(total, 1)) * 100, 2), "rank": 0})

        result.sort(key=lambda x: x["conversion_rate"], reverse=True)
        for i, r in enumerate(result):
            r["rank"] = i + 1
        return result
    except Exception as exc:
        logger.error(f"Team performance error: {exc}")
        return []


@router.get("/api/admin/funnel-analysis")
async def get_funnel_analysis():
    """Status-based funnel breakdown."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("status").range(0, 99999).execute()
        stages: dict = {}
        for lead in (response.data or []):
            s = lead.get("status", "Unknown")
            stages[s] = stages.get(s, 0) + 1
        return {"stages": [{"name": k, "count": v} for k, v in stages.items()]}
    except Exception as exc:
        logger.error(f"Funnel analysis error: {exc}")
        return {"stages": []}


@router.get("/api/admin/revenue-trend")
async def get_revenue_trend(days: int = 30):
    """Daily revenue trend for the past N days."""
    try:
        cutoff   = datetime.utcnow() - timedelta(days=days)
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select(
            "status,expected_revenue,updated_at,created_at"
        ).eq("status", "Enrolled").range(0, 99999).execute()
        enrolled = [
            l for l in (response.data or [])
            if l.get("updated_at") and datetime.fromisoformat(l["updated_at"].replace("Z", "+00:00")) >= cutoff
        ]
        daily: dict = defaultdict(float)
        for lead in enrolled:
            raw = lead.get("updated_at") or lead.get("created_at")
            if raw:
                try:
                    day = datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%Y-%m-%d")
                    daily[day] += lead.get("expected_revenue", 0) or 0
                except Exception:
                    pass
        return [{"date": k, "revenue": v} for k, v in sorted(daily.items())]
    except Exception as exc:
        logger.error(f"Revenue trend error: {exc}")
        return []


@router.get("/api/admin/lead-update-activity")
async def get_lead_update_activity(
    days: int = 7,
    date: Optional[str] = None,   # specific day YYYY-MM-DD (takes priority over days)
):
    """Lead update activity — grouped by user+date, with per-lead event details.
    Returns { rows: [{ date, user, leads_updated, total_events, action_summary, leads }] }
    """
    try:
        if date:
            q = (
                supabase_data.client.table("activities")
                .select("*")
                .gte("created_at", f"{date}T00:00:00")
                .lte("created_at", f"{date}T23:59:59")
            )
        else:
            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            q = supabase_data.client.table("activities").select("*").gte("created_at", cutoff)

        q = q.order("created_at", desc=True).range(0, 49999)
        response = q.execute()
        activities = response.data or []

        # Collect unique lead_ids to fetch lead metadata
        lead_ids = list({a["lead_id"] for a in activities if a.get("lead_id")})
        leads_meta: dict = {}
        batch_size = 500
        for i in range(0, len(lead_ids), batch_size):
            batch = lead_ids[i : i + batch_size]
            lr = (
                supabase_data.client.table("leads")
                .select("lead_id,full_name,status,course_interested")
                .in_("lead_id", batch)
                .execute()
            )
            for l in (lr.data or []):
                leads_meta[l["lead_id"]] = l

        # Group activities by date (YYYY-MM-DD) → user
        groups: dict = defaultdict(lambda: defaultdict(list))
        for act in activities:
            if not act.get("created_at") or not act.get("created_by"):
                continue
            day  = act["created_at"][:10]
            user = act["created_by"]
            groups[day][user].append(act)

        rows = []
        for day in sorted(groups.keys(), reverse=True):
            for user, events in groups[day].items():
                # Group events per lead
                lead_events: dict = defaultdict(list)
                for ev in events:
                    lid = ev.get("lead_id", "")
                    if lid:
                        lead_events[lid].append({
                            "type": ev.get("type", "update"),
                            "ts":   ev.get("created_at", ""),
                            "description": ev.get("description") or ev.get("content") or "",
                        })

                # Action summary
                action_counts: dict = defaultdict(int)
                for ev in events:
                    action_counts[ev.get("type", "update")] += 1
                action_summary = [
                    {"type": t, "count": c}
                    for t, c in sorted(action_counts.items(), key=lambda x: -x[1])
                ]

                # Leads array
                leads_list = [
                    {
                        "lead_id":          lid,
                        "full_name":        leads_meta.get(lid, {}).get("full_name", ""),
                        "status":           leads_meta.get(lid, {}).get("status", ""),
                        "course_interested": leads_meta.get(lid, {}).get("course_interested", ""),
                        "events":           evs,
                    }
                    for lid, evs in lead_events.items()
                ]

                rows.append({
                    "date":          day,
                    "user":          user,
                    "leads_updated": len(lead_events),
                    "total_events":  len(events),
                    "action_summary": action_summary,
                    "leads":         leads_list,
                })

        return {"rows": rows}
    except Exception as exc:
        logger.error(f"Lead update activity error: {exc}")
        return {"rows": []}


# ── Admin Analytics (detailed) ────────────────────────────────────────────────

@router.get("/api/admin/cohort-analysis")
async def get_cohort_analysis(cohort_by: str = "week"):
    """Cohort conversion analysis — group leads by creation week/month and track conversions."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("status,created_at,updated_at").range(0, 99999).execute()
        leads = response.data or []

        cohorts: dict = defaultdict(lambda: {"created": 0, "enrolled": 0})
        for lead in leads:
            if not lead.get("created_at"):
                continue
            try:
                dt = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00"))
                if cohort_by == "week":
                    key = dt.strftime("%Y-W%W")
                else:
                    key = dt.strftime("%Y-%m")
                cohorts[key]["created"] += 1
                if lead.get("status") == "Enrolled":
                    cohorts[key]["enrolled"] += 1
            except Exception:
                pass

        return [{"cohort": k, "created": v["created"], "enrolled": v["enrolled"],
                 "conversion_rate": round(v["enrolled"] / max(v["created"], 1) * 100, 2)}
                for k, v in sorted(cohorts.items())]
    except Exception as exc:
        logger.error(f"Cohort analysis error: {exc}")
        return []


@router.get("/api/admin/conversion-time")
async def get_conversion_time():
    """Average time from lead creation to enrollment."""
    try:
        # Use .range() to bypass 1000 row limit
        response = supabase_data.client.table("leads").select("created_at,updated_at,status").eq("status", "Enrolled").range(0, 99999).execute()
        enrolled = response.data or []
        times = []
        for lead in enrolled:
            if lead.get("created_at") and lead.get("updated_at"):
                try:
                    created = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00"))
                    updated = datetime.fromisoformat(lead["updated_at"].replace("Z", "+00:00"))
                    delta   = (updated - created).days
                    if delta >= 0:
                        times.append(delta)
                except Exception:
                    pass
        avg  = round(sum(times) / len(times), 1) if times else 0
        return {"average_days": avg, "min_days": min(times) if times else 0,
                "max_days": max(times) if times else 0, "sample_size": len(times)}
    except Exception as exc:
        logger.error(f"Conversion time error: {exc}")
        return {}


@router.get("/api/admin/source-analytics")
async def get_source_analytics():
    """Lead source performance — volume, conversion rate, revenue per source.
    Returns { sources, campaigns, summary } so the AnalyticsPage charts work correctly.
    """
    try:
        # Use .range() to bypass 1000 row limit; include ai_segment for hot_leads count
        response = supabase_data.client.table("leads").select(
            "source,status,actual_revenue,expected_revenue,ai_score,ai_segment,campaign_name"
        ).range(0, 99999).execute()
        leads = response.data or []

        sources: dict = {}
        campaigns_map: dict = {}

        for lead in leads:
            src = lead.get("source") or "Unknown"
            if src not in sources:
                sources[src] = {
                    "source": src, "leads": 0, "enrolled": 0, "hot": 0,
                    "revenue": 0, "expected_revenue": 0, "scores": [],
                }
            s = sources[src]
            s["leads"] += 1
            if (lead.get("ai_segment") or "").lower() == "hot":
                s["hot"] += 1
            if lead.get("status") == "Enrolled":
                s["enrolled"] += 1
                s["revenue"] += lead.get("actual_revenue", 0) or 0
            s["expected_revenue"] += lead.get("expected_revenue", 0) or 0
            if lead.get("ai_score"):
                s["scores"].append(lead["ai_score"])

            # Campaign aggregation
            cname = lead.get("campaign_name") or ""
            if cname:
                if cname not in campaigns_map:
                    campaigns_map[cname] = {"label": cname, "total_leads": 0, "enrolled": 0, "revenue": 0, "scores": []}
                c = campaigns_map[cname]
                c["total_leads"] += 1
                if lead.get("status") == "Enrolled":
                    c["enrolled"] += 1
                    c["revenue"] += lead.get("actual_revenue", 0) or 0
                if lead.get("ai_score"):
                    c["scores"].append(lead["ai_score"])

        result = []
        for src, s in sources.items():
            total = max(s["leads"], 1)
            avg_score = round(sum(s["scores"]) / len(s["scores"]), 1) if s["scores"] else 0
            avg_rev = round(s["revenue"] / max(s["enrolled"], 1), 2) if s["enrolled"] else 0
            # ROI score: composite of conversion rate (70%) + avg AI score normalized (30%)
            conv_pct = round(s["enrolled"] / total * 100, 2)
            roi_score = round(conv_pct * 0.7 + (avg_score / 100) * 30, 1)
            result.append({
                "source": src,
                "total_leads": s["leads"],
                "enrolled": s["enrolled"],
                "hot_leads": s["hot"],
                "conversion_rate": conv_pct,
                "total_revenue": round(s["revenue"], 2),
                "expected_revenue": round(s["expected_revenue"], 2),
                "avg_revenue": avg_rev,
                "avg_ai_score": avg_score,
                "roi_score": roi_score,
            })
        result.sort(key=lambda x: x["total_leads"], reverse=True)

        campaigns_list = []
        for c in campaigns_map.values():
            avg_score = round(sum(c["scores"]) / len(c["scores"]), 1) if c["scores"] else 0
            conv_rate = round(c["enrolled"] / max(c["total_leads"], 1) * 100, 2)
            campaigns_list.append({
                "label":           c["label"],
                "total_leads":     c["total_leads"],
                "enrolled":        c["enrolled"],
                "conversion_rate": conv_rate,
                "total_revenue":   round(c["revenue"], 2),
                "avg_ai_score":    avg_score,
            })
        campaigns_list.sort(key=lambda x: x["total_leads"], reverse=True)

        total_leads   = len(leads)
        total_enrolled = sum(s["enrolled"] for s in sources.values())
        summary = {
            "total_leads":              total_leads,
            "total_enrolled":           total_enrolled,
            "overall_conversion_rate":  round(total_enrolled / max(total_leads, 1) * 100, 2),
        }

        return {"sources": result, "campaigns": campaigns_list, "summary": summary}
    except Exception as exc:
        logger.error(f"Source analytics error: {exc}")
        return {"sources": [], "campaigns": [], "summary": {}}
