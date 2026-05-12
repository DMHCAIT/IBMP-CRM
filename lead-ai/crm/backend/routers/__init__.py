"""
IBMP CRM — FastAPI Routers Package
====================================
Each module owns one domain.  All are registered in main.py via:

    from routers import auth_router, leads_router, ...
    app.include_router(auth_router.router)

Domain map:
  system_router.py          — /, /ping, /health, /ready, /metrics, /api/sync/*
  auth_router.py            — /api/auth/*
  leads_router.py           — /api/leads/*
  users_router.py           — /api/users/*, /api/counselors/*
  hospitals_router.py       — /api/hospitals/*
  courses_router.py         — /api/courses/*
  analytics_router.py       — /api/analytics/*, /api/admin/*, /api/dashboard/*
  ai_router.py              — /api/ai/*, /api/ml/*
  communications_router.py  — /api/wa-templates/*, /api/interakt/*, /api/upload,
                               /api/notifications/*, /api/audit-logs
  settings_router.py        — /api/admin/sla-config, /api/admin/decay-*,
                               /api/cache/*, /api/workflows/*
"""
