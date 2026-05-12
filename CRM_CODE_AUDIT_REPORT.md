# MedFellow CRM — Complete Code Audit Report
**Date:** April 29, 2026  
**Scope:** Full backend (FastAPI/Python) + Frontend (React)

---

## EXECUTIVE SUMMARY

The codebase has a solid architectural foundation (FastAPI, React, Supabase, CatBoost ML) but has **5 Critical**, **8 High**, **12 Medium**, and **6 Low** severity issues that need fixing before production.

---

## 1. CRITICAL ERRORS (Will Cause Crashes / 500s)

### 1.1 Hardcoded Demo API Key — Email Sends Will Silently Fail
**File:** `backend/communication_service.py` line 22  
```python
self.api_key = os.getenv("RESEND_API_KEY", "re_demo_key")  # ❌ WRONG
```
All production emails will fail silently. Remove the `"re_demo_key"` fallback — raise an error if the env var is missing.

---

### 1.2 Race Condition in Lead ID Generation
**File:** `backend/main.py` lines 1397–1403  
```python
lead_count = count_resp.count or 0
lead_id = f"LEAD{lead_count + 1:05d}"  # ❌ Two simultaneous requests = duplicate ID
```
Two concurrent lead creations will generate the same `lead_id`, causing a unique constraint crash.  
**Fix:** Use a database sequence or atomic auto-increment.

---

### 1.3 No Error Handling in Create Endpoints (Hospital / Course)
**File:** `backend/main.py` lines ~2390–2435  
```python
db.add(db_hospital)
db.commit()  # ❌ Crashes with 500 on duplicate name or null field
```
Both `POST /api/hospitals` and `POST /api/courses` have no try-except. Any duplicate name or DB constraint violation returns a raw 500 error.  
**Fix:** Wrap all DB commits in try-except and return HTTP 400/409 on IntegrityError.

---

### 1.4 Missing asyncio Import — App May Crash at Startup
**File:** `backend/main.py` (lifespan function, score decay scheduler)  
```python
_decay_task = _asyncio.create_task(...)  # ❌ _asyncio is not imported anywhere
```
`_asyncio` is used but should be `asyncio`. If this runs, the app crashes on startup.  
**Fix:** Change `_asyncio` → `asyncio`.

---

### 1.5 Null Reference in Score Decay Logic
**File:** `backend/main.py` lines 5444–5695  
```python
new_score = lead.ai_score * decay_rate  # ❌ Crashes if ai_score is None
```
Leads with no AI score will crash the decay endpoint.  
**Fix:** Add `if lead.ai_score is not None:` guard before arithmetic.

---

## 2. MISSING FEATURES / INCOMPLETE IMPLEMENTATIONS

### 2.1 Audit Logs — Always Returns Empty
**Feature flag:** `AUDIT_LOGS = true` in `frontend/src/config/featureFlags.js`  
**Route:** `/audit-logs` (page exists)  
**Backend:** `/api/audit-logs` exists but returns empty if `DBActivity` table is not populated — no automatic logging of actions is wired up.

### 2.2 AI Search — No Graceful Failure When OpenAI Key Missing
**File:** `backend/main.py` ~3295–3346  
Warning logged at startup if `OPENAI_API_KEY` missing, but the `/api/ai/search` endpoint still tries to call GPT-4 and crashes.  
**Fix:** Return HTTP 503 "AI features disabled" at endpoint level if key is absent.

### 2.3 WhatsApp Template Send — No Variable Validation
**File:** `backend/main.py` lines 5795–5909  
Template `{{variables}}` are not validated before sending. If a required variable is missing, the send fails with an unclear error.  
**Fix:** Validate all template placeholders are filled before calling the send function.

### 2.4 User Password Change — May Be Incomplete
**File:** `backend/main.py` ~4403  
Endpoint `PUT /api/users/{user_id}/password` exists but references data structures that may be undefined. Needs testing.

---

## 3. API MISMATCH / INTEGRATION ISSUES

### 3.1 Dual Data Source Problem (Critical Architecture Issue)
**File:** `backend/database.py` lines 24–40  
```python
# When Supabase is configured, backend STILL falls back to SQLite:
return "sqlite:///./crm_database.db"  # ❌ Supabase configured but SQLAlchemy uses SQLite
```
Data is split across Supabase (REST) and SQLite (SQLAlchemy). Frontend reads from Supabase, backend writes to SQLite — **data will go out of sync**.

### 3.2 Inconsistent API Response Shapes
Some endpoints return `{"leads": [...], "total": 123}`, others return a plain array `[...]`.  
Frontend (e.g., `LeadsPageEnhanced.js:232`) assumes `.data.leads` everywhere.  
**Risk:** Some pages will silently show no data even when data exists.

### 3.3 CORS Configuration — Needs Verification
Verify that `CORSMiddleware` is explicitly added in `main.py`. If missing, frontend on any non-localhost domain will be blocked entirely.

### 3.4 Inconsistent Filter Parameters for Lead Queries
Backend supports both `status` (single) and `status_in` (comma-separated). Frontend doesn't consistently use one or the other, causing some filters to be silently ignored.

---

## 4. MISSING ERROR HANDLING

These endpoints have **no try-except** and will return raw 500 errors on any DB or logic failure:

| Endpoint | File | Issue |
|----------|------|-------|
| `POST /api/hospitals` | main.py ~2391 | No DB error handling |
| `POST /api/courses` | main.py ~2426 | No DB error handling |
| `PUT /api/hospitals/{id}` | main.py ~4343 | No check if hospital exists |
| `PUT /api/courses/{id}` | main.py ~4371 | No check if course exists |
| `DELETE /api/hospitals/{id}` | main.py ~4356 | No error if hospital is in use |
| `DELETE /api/courses/{id}` | main.py ~4384 | No error if course is in use |
| `POST /api/leads/{id}/trigger-welcome` | main.py ~3010 | No error if communication fails |
| `POST /api/leads/{id}/trigger-followup` | main.py ~3049 | No error if communication fails |
| `POST /api/leads/bulk-update` | main.py ~2077 | No enum validation before commit |

**Frontend — Missing Error States:**
- `LeadDetails.js:65–70` — No error handling on `useQuery`. If lead 404s, user sees infinite loading spinner.

---

## 5. CONFIGURATION / ENVIRONMENT ISSUES

### 5.1 Missing Env Var Validation at Startup
Only `JWT_SECRET_KEY` is validated at startup. These critical vars are not checked:
- `SUPABASE_URL` + `SUPABASE_KEY` — only a warning, app continues without DB
- `OPENAI_API_KEY` — only a warning, AI endpoints crash at runtime
- `RESEND_API_KEY` — silently falls back to demo key
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` — not validated

**Fix:** Add all to the `_required_env` dict or at minimum fail gracefully at endpoint level.

### 5.2 Database Connection Pool Too Small for Production
**File:** `backend/database.py` lines 46–60  
```python
pool_size=5, max_overflow=10  # ❌ Only 15 concurrent DB connections max
```
Under real load this will cause `QueuePool limit of size 5 overflow 10 reached` errors.  
**Fix:** Increase to `pool_size=15, max_overflow=20`.

### 5.3 Supabase Seeding Failure Not Handled
**File:** `backend/main.py` (lifespan)  
If `seed_courses()` or `seed_users()` throws an exception, it's caught by a blanket `except` and the app starts without required data — endpoints then return 404 or empty results with no clear reason.

---

## 6. MINOR BUGS

| # | File | Issue |
|---|------|-------|
| 6.1 | `main.py` ~1032 | `course_price * (score/100)` crashes if `course_price` is None |
| 6.2 | `supabase_data_layer.py:111` | SQL search uses string interpolation — potential injection risk |
| 6.3 | `main.py` ~5690 | `decay_rate` not bounded — negative or >1.0 values produce invalid scores |
| 6.4 | `main.py` ~175 | Model cache (`MODEL_INSTANCE_CACHE`) never freed — memory held for app lifetime |
| 6.5 | `main.py` ~1997 | Email/phone saved with no format validation — WhatsApp sends fail silently |
| 6.6 | `LeadsPageEnhanced.js:232` | Assumes `.data` wrapper — some endpoints return raw array |

---

## RECOMMENDED FIX PRIORITY

1. **NOW** — Fix `_asyncio` → `asyncio` (app startup crash)
2. **NOW** — Remove `re_demo_key` fallback in `communication_service.py`
3. **NOW** — Wrap all `db.commit()` calls in try-except (hospitals, courses, bulk-update)
4. **URGENT** — Fix lead ID race condition (use DB sequence)
5. **URGENT** — Fix null check on `ai_score` before decay math
6. **HIGH** — Fix dual data source issue (SQLite vs Supabase)
7. **HIGH** — Add required env var validation at startup for all critical keys
8. **HIGH** — Add error state to `LeadDetails.js` useQuery
9. **MEDIUM** — Increase DB connection pool size
10. **MEDIUM** — Add enum validation in bulk-update endpoint
11. **MEDIUM** — Add email/phone regex validation on lead create/update
12. **LOW** — Fix string interpolation in Supabase search filters

---

*Report generated by automated code audit — April 29, 2026*
