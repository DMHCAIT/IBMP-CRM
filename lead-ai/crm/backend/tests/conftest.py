"""
IBMP CRM — pytest configuration and shared fixtures
=====================================================
Provides:
  - in-memory SQLite DB + SQLAlchemy session
  - FastAPI TestClient with all routers mounted
  - Mock Supabase data layer (no live network calls)
  - Mock AI assistant / ai_scorer
  - Helper factories for creating test users and leads
"""

import os
import sys
import types
import pytest

# ── Ensure the backend package is importable ───────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# ── Patch environment BEFORE any app module is imported ────────────────────
_TEST_SECRET = "ci-test-secret-key-not-for-production-must-be-32-chars-long!!"
os.environ["DATABASE_URL"]        = "sqlite:///./test_conftest.db"
os.environ["SECRET_KEY"]          = _TEST_SECRET
# auth.py reads JWT_SECRET_KEY specifically
os.environ["JWT_SECRET_KEY"]      = _TEST_SECRET
os.environ["ALGORITHM"]           = "HS256"
os.environ["ENVIRONMENT"]         = "test"
os.environ["LOG_LEVEL"]           = "WARNING"
os.environ["OPENAI_API_KEY"]      = ""
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_KEY", "test-supabase-anon-key")

# ── Build a minimal fake `supabase_data_layer` so imports succeed ──────────
class _FakeQueryBuilder:
    """Chainable query builder that returns empty results by default."""

    def __init__(self, data=None):
        self._data = data if data is not None else []

    # chaining methods
    def select(self, *a, **kw):   return self
    def insert(self, *a, **kw):   return self
    def update(self, *a, **kw):   return self
    def upsert(self, *a, **kw):   return self
    def delete(self):             return self
    def eq(self, *a, **kw):       return self
    def neq(self, *a, **kw):      return self
    def in_(self, *a, **kw):      return self
    def lt(self, *a, **kw):       return self
    def gte(self, *a, **kw):      return self
    def lte(self, *a, **kw):      return self
    def order(self, *a, **kw):    return self
    def limit(self, *a, **kw):    return self
    def offset(self, *a, **kw):   return self
    def ilike(self, *a, **kw):    return self
    def or_(self, *a, **kw):      return self
    def on_conflict(self, *a, **kw): return self
    def single(self):             return self
    def maybe_single(self):       return self

    def execute(self):
        class _Resp:
            data  = []
            count = 0
            error = None
        return _Resp()


class _FakeStorageFileMethods:
    def upload(self, *a, **kw):
        class _R:
            error = None
            data  = {"Key": "chat-media/test.jpg"}
        return _R()

    def get_public_url(self, path):
        return f"https://fake-storage.example.com/{path}"


class _FakeStorage:
    def from_(self, bucket):
        return _FakeStorageFileMethods()


class _FakeSupabaseClient:
    storage = _FakeStorage()

    def table(self, name):
        return _FakeQueryBuilder()

    def rpc(self, *a, **kw):
        return _FakeQueryBuilder()


class _FakeSupabaseDataLayer:
    client = _FakeSupabaseClient()

    def get_leads(self, *a, **kw):         return []
    def get_lead(self, lead_id):            return None
    def create_lead(self, data):            return {"lead_id": "LEAD_TEST_001", **data}
    def update_lead(self, lead_id, data):   return {"lead_id": lead_id, **data}
    def delete_lead(self, lead_id):         return True
    def get_users(self, *a, **kw):          return []
    def get_user_by_email(self, email):     return None
    def get_hospitals(self, *a, **kw):      return []
    def get_courses(self, *a, **kw):        return []


# Inject before any app module loads
_sdl_mod = types.ModuleType("supabase_data_layer")
_sdl_mod.supabase_data = _FakeSupabaseDataLayer()
sys.modules["supabase_data_layer"] = _sdl_mod

# ── Fake cache module ─────────────────────────────────────────────────────
def _noop_cache_async_result(cache, ttl=60):
    """No-op decorator — passes through the wrapped function unchanged."""
    import functools
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            return await fn(*args, **kwargs)
        return wrapper
    return decorator

_cache_mod = types.ModuleType("cache")
_cache_mod.get_cache_stats      = lambda: {}
_cache_mod.invalidate_cache     = lambda c: None
_cache_mod.set_cached           = lambda c, k, v: None
_cache_mod.get_cached           = lambda c, k: None
_cache_mod.cache_async_result   = _noop_cache_async_result
sys.modules["cache"] = _cache_mod

# ── Fake logger ───────────────────────────────────────────────────────────
import logging
_logger_mod = types.ModuleType("logger_config")
_logger_mod.logger = logging.getLogger("test")
sys.modules["logger_config"] = _logger_mod

# ── Fake ai_assistant ─────────────────────────────────────────────────────
class _FakeAIAssistant:
    def is_available(self): return False
    async def generate_smart_reply(self, *a, **kw): return "Mocked reply"
    async def summarize_notes(self, *a, **kw):      return "Mocked summary"
    async def get_next_action(self, *a, **kw):      return "Mocked action"

_ai_mod = types.ModuleType("ai_assistant")
_ai_mod.AIAssistant = _FakeAIAssistant
_ai_mod.ai_assistant = _FakeAIAssistant()
sys.modules["ai_assistant"] = _ai_mod

# ── Fake ai_scorer ────────────────────────────────────────────────────────
class _FakeAIScorer:
    def score_lead(self, lead): return 72.5
    def batch_score(self, leads): return [72.5] * len(leads)

_scorer_mod = types.ModuleType("ai_scorer")
_scorer_mod.AIScorer   = _FakeAIScorer
_scorer_mod.ai_scorer  = _FakeAIScorer()
sys.modules["ai_scorer"] = _scorer_mod

# ── Fake auth module (avoids JWT_SECRET_KEY runtime check at import time) ──
#    Real auth.py refuses to load unless JWT_SECRET_KEY is set to a non-default
#    value.  We've set it above, but in case the module was already cached or
#    the env var check changes, we provide a complete stub.
import jwt as _pyjwt
from datetime import datetime as _dt, timedelta as _td

class _FakeTokenData:
    def __init__(self, email="", role="Admin", sub=""):
        self.email = email or sub
        self.role  = role
        self.sub   = sub or email

def _fake_create_token(data: dict, expires_delta=None):
    payload = {**data, "exp": _dt.utcnow() + (_td(hours=8) if expires_delta is None else expires_delta)}
    return _pyjwt.encode(payload, _TEST_SECRET, algorithm="HS256")

def _fake_decode_token(token: str):
    try:
        payload = _pyjwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        return _FakeTokenData(email=payload.get("sub", ""), role=payload.get("role", "Admin"))
    except Exception:
        return None

def _fake_get_current_user(token: str = None):
    return _FakeTokenData(email="admin@test.com", role="Admin")

_auth_mod = types.ModuleType("auth")
_auth_mod.SECRET_KEY          = _TEST_SECRET
_auth_mod.ALGORITHM           = "HS256"
_auth_mod.TokenData           = _FakeTokenData
_auth_mod.create_access_token = _fake_create_token
_auth_mod.decode_access_token = _fake_decode_token
_auth_mod.get_current_user    = _fake_get_current_user
_auth_mod.verify_password     = lambda plain, hashed: True
_auth_mod.get_password_hash   = lambda pw: "fakehash"
sys.modules["auth"] = _auth_mod

# ── Fake token_blocklist module ───────────────────────────────────────────
class _FakeBlocklist:
    def revoke(self, jti, exp): pass
    def is_revoked(self, jti): return False
    def revoke_all_for_user(self, email, current_exp): pass
    def is_revoked_for_user(self, email, iat): return False
    @property
    def backend(self): return "memory"
    def stats(self): return {"backend": "memory", "memory_entries": 0}

_bl_mod = types.ModuleType("token_blocklist")
_bl_mod.blocklist = _FakeBlocklist()
_bl_mod.new_jti   = lambda: "test-jti-00000000"
sys.modules["token_blocklist"] = _bl_mod

# ── Fake interakt / twilio stubs ──────────────────────────────────────────
for _stub in ("interakt_client", "twilio_client", "email_client"):
    _m = types.ModuleType(_stub)
    sys.modules[_m.name if hasattr(_m, "name") else _stub] = _m

# ── Now import the FastAPI app ────────────────────────────────────────────
from fastapi.testclient import TestClient   # noqa: E402
from sqlalchemy import create_engine        # noqa: E402
from sqlalchemy.orm import sessionmaker     # noqa: E402

# Import Base from main (triggers model definitions)
import importlib.util as _ilu

def _try_import(module_name: str):
    """Import a module, return None on failure."""
    try:
        return __import__(module_name)
    except Exception:
        return None

# ── SQLAlchemy in-memory test DB ──────────────────────────────────────────
TEST_DB_URL = "sqlite:///./test_conftest.db"

@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    yield eng
    eng.dispose()
    # cleanup
    if os.path.exists("./test_conftest.db"):
        os.remove("./test_conftest.db")


@pytest.fixture(scope="session")
def db_session(engine):
    """Session-scoped database session for tests."""
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


# ── FastAPI TestClient ────────────────────────────────────────────────────
def _build_test_app():
    """
    Build a clean FastAPI app with all routers mounted directly.
    This avoids importing main.py (which has heavy startup logic) and
    guarantees every domain's routes are available in tests.
    """
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse

    test_app = FastAPI(title="IBMP CRM — Test App")

    # Generic 500 handler so tests get JSON instead of raw exceptions
    @test_app.exception_handler(Exception)
    async def _generic_handler(request: Request, exc: Exception):
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    # Mount all domain routers
    _router_names = [
        "routers.system_router",
        "routers.auth_router",
        "routers.leads_router",
        "routers.users_router",
        "routers.hospitals_router",
        "routers.courses_router",
        "routers.analytics_router",
        "routers.ai_router",
        "routers.communications_router",
        "routers.settings_router",
    ]
    import importlib
    for _rname in _router_names:
        try:
            _rmod = importlib.import_module(_rname)
            test_app.include_router(_rmod.router)
        except Exception as _e:
            # Log but don't crash — router may depend on optional package
            import logging
            logging.getLogger("test").warning(f"Could not mount {_rname}: {_e}")

    return test_app


@pytest.fixture(scope="session")
def client():
    """
    TestClient backed by a purpose-built test app with all routers mounted.
    Does NOT import main.py — avoids heavy startup dependencies in CI.
    """
    app = _build_test_app()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ── JWT helper ────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def auth_headers():
    """
    Return Authorization headers for a mock admin user.
    Creates a real JWT signed with the test SECRET_KEY.
    """
    import jwt as _jwt
    from datetime import datetime, timedelta

    secret = os.environ["SECRET_KEY"]
    algorithm = os.environ.get("ALGORITHM", "HS256")
    payload = {
        "sub":   "admin@test.com",
        "role":  "Admin",
        "exp":   datetime.utcnow() + timedelta(hours=8),
        "iat":   datetime.utcnow(),
    }
    token = _jwt.encode(payload, secret, algorithm=algorithm)
    return {"Authorization": f"Bearer {token}"}


# ── Data factories ────────────────────────────────────────────────────────
@pytest.fixture
def sample_lead_payload():
    return {
        "full_name":    "Test Lead",
        "phone":        "9876543210",
        "email":        "testlead@example.com",
        "source":       "Website",
        "status":       "Fresh",
        "hospital_name":"Test Hospital",
        "course":       "MBBS",
        "country":      "India",
        "city":         "Bangalore",
    }


@pytest.fixture
def sample_user_payload():
    return {
        "name":     "Test Counselor",
        "email":    "counselor@test.com",
        "password": "SecurePass@123",
        "role":     "Counselor",
    }
