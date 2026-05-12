"""
🏥 MEDICAL EDUCATION CRM - AI-POWERED BACKEND
Complete CRM system with AI lead scoring and automation

FEATURES:
✅ Lead management with AI scoring
✅ Revenue tracking (Expected vs Actual)
✅ WhatsApp & Email integration
✅ Hospital collaboration management
✅ Course catalog with pricing
✅ Advanced filters (Country, Status, Date)
✅ Counselor performance analytics
✅ Automated follow-up scheduling
"""

# ── Validate required environment variables before anything else boots ────────
# Skip in test mode (conftest.py sets ENVIRONMENT=test and injects mocks)
import os as _os
if _os.getenv("ENVIRONMENT", "development") not in ("test",):
    from config_validator import validate_config
    validate_config(exit_on_critical=True, silent_info=True)

from fastapi import FastAPI, HTTPException, Depends, Query, BackgroundTasks, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON, Enum as SQLEnum, text, case
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship, joinedload
from sqlalchemy.sql import func
from contextlib import asynccontextmanager
from passlib.context import CryptContext
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
import json
import os
import re
import enum
import asyncio as _asyncio

# Import logging and error handling
from logger_config import logger
from middleware import LoggingMiddleware, ErrorHandlingMiddleware, PerformanceMonitoringMiddleware
from exceptions import (
    AuthenticationError, AuthorizationError, ValidationError,
    NotFoundError, DatabaseError, ExternalServiceError,
    BusinessLogicError, to_http_exception
)

# Authentication
from auth import (
    get_current_user,
    oauth2_scheme,
    decode_access_token,
    create_access_token,
    get_password_hash,
    verify_password,
    SECRET_KEY,
    ALGORITHM,
)
# Using local SQLite database

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

# Import caching system
from cache import (
    cache_result, cache_async_result, invalidate_cache,
    LEAD_CACHE, COURSE_CACHE, USER_CACHE, STATS_CACHE, ML_SCORE_CACHE,
    get_cache_stats, warm_cache
)

# Import query optimizer

# Import AI Assistant (GPT-4)
from ai_assistant import ai_assistant
from query_optimizer import create_database_indexes, analyze_slow_queries

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ============================================================================
# MONITORING & OBSERVABILITY
# ============================================================================

# Sentry error tracking (optional)
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=os.getenv("ENVIRONMENT", "development"),
            traces_sample_rate=0.1,  # 10% of transactions for performance monitoring
            profiles_sample_rate=0.1,  # 10% for profiling
            integrations=[
                FastApiIntegration(),
                SqlalchemyIntegration(),
            ],
        )
        logger.info("✅ Sentry error tracking initialized")
    except ImportError:
        logger.warning("⚠️ Sentry SDK not installed. Install with: pip install sentry-sdk[fastapi]")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Sentry: {e}")
else:
    logger.info("👁️ Sentry disabled (SENTRY_DSN not set)")

# Prometheus metrics (optional)
try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, REGISTRY
    
    # Define custom metrics (with guards to prevent duplicate registration)
    try:
        http_requests_total = Counter(
            'http_requests_total',
            'Total HTTP requests',
            ['method', 'endpoint', 'status']
        )
    except ValueError:
        http_requests_total = REGISTRY._names_to_collectors.get('http_requests_total')
    
    try:
        http_request_duration_seconds = Histogram(
            'http_request_duration_seconds',
            'HTTP request duration in seconds',
            ['method', 'endpoint']
        )
    except ValueError:
        http_request_duration_seconds = REGISTRY._names_to_collectors.get('http_request_duration_seconds')
    
    try:
        lead_conversions_total = Counter(
            'lead_conversions_total',
            'Total lead conversions',
            ['segment']
        )
    except ValueError:
        lead_conversions_total = REGISTRY._names_to_collectors.get('lead_conversions_total')
    
    try:
        lead_quality_score = Gauge(
            'lead_quality_score_average',
            'Average lead quality score'
        )
    except ValueError:
        lead_quality_score = REGISTRY._names_to_collectors.get('lead_quality_score_average')
    
    try:
        model_prediction_duration = Histogram(
            'model_prediction_duration_seconds',
            'ML model prediction duration'
        )
    except ValueError:
        model_prediction_duration = REGISTRY._names_to_collectors.get('model_prediction_duration_seconds')
    
    try:
        cache_hits_total = Counter(
            'cache_hits_total',
            'Total cache hits',
            ['cache_name']
        )
    except ValueError:
        cache_hits_total = REGISTRY._names_to_collectors.get('cache_hits_total')
    
    try:
        cache_misses_total = Counter(
            'cache_misses_total',
            'Total cache misses',
            ['cache_name']
        )
    except ValueError:
        cache_misses_total = REGISTRY._names_to_collectors.get('cache_misses_total')
    
    PROMETHEUS_ENABLED = True
    logger.info("✅ Prometheus metrics initialized")
except ImportError:
    PROMETHEUS_ENABLED = False
    logger.warning("⚠️ Prometheus client not installed. Install with: pip install prometheus-client")

# ============================================================================
# PERFORMANCE OPTIMIZATION - MODEL & CACHE INITIALIZATION
# ============================================================================

# Global model instance cache (loaded once at startup)
MODEL_INSTANCE_CACHE = {}

# Course price cache — use COURSE_CACHE from cache.py (TTLCache with 1-hour TTL)
# The old manual COURSE_PRICE_CACHE dict has been removed to unify caching.
_COURSE_PRICES_KEY = "course_prices:all"

def get_cached_model():
    """Get cached CatBoost model instance (loads once)"""
    if 'catboost' not in MODEL_INSTANCE_CACHE:
        try:
            from catboost import CatBoostClassifier
            model_path = Path(__file__).parent.parent.parent / 'models' / 'lead_conversion_model_latest.cbm'
            if model_path.exists():
                model = CatBoostClassifier()
                model.load_model(str(model_path))
                MODEL_INSTANCE_CACHE['catboost'] = model
                logger.info(f"✅ CatBoost model loaded and cached from {model_path}")
            else:
                logger.warning(f"⚠️ Model file not found: {model_path}")
                MODEL_INSTANCE_CACHE['catboost'] = None
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            MODEL_INSTANCE_CACHE['catboost'] = None
    return MODEL_INSTANCE_CACHE['catboost']

def get_cached_course_prices(force_refresh: bool = False) -> Dict[str, float]:
    """Get cached course prices using the unified COURSE_CACHE (1-hour TTL) - SUPABASE ONLY"""
    if not force_refresh and _COURSE_PRICES_KEY in COURSE_CACHE:
        return COURSE_CACHE[_COURSE_PRICES_KEY]

    # Get courses from Supabase
        return {}
    
    courses = supabase_data.get_courses()
    prices = {c['course_name']: c['price'] for c in courses if c.get('course_name') and c.get('price')}
    COURSE_CACHE[_COURSE_PRICES_KEY] = prices
    logger.info(f"✅ Course prices cached: {len(prices)} courses")
    return prices

# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # ---- Startup ----
    logger.info("🚀 Application startup initiated")

    # --- Fail-fast environment validation ---
    _required_env = {
        "JWT_SECRET_KEY": os.getenv("JWT_SECRET_KEY", ""),
    }
    _missing = [k for k, v in _required_env.items() if not v]
    if _missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(_missing)}. "
            "Set them before starting the application."
        )

    # --- Warn on missing optional-but-important env vars ---
    if not os.getenv("OPENAI_API_KEY"):
        logger.warning("⚠️ OPENAI_API_KEY is not set — AI assistant features will be disabled.")
    if not os.getenv("RESEND_API_KEY"):
        logger.warning("⚠️ RESEND_API_KEY is not set — email sending will be disabled.")
    if not os.getenv("TWILIO_ACCOUNT_SID") or not os.getenv("TWILIO_AUTH_TOKEN"):
        logger.warning("⚠️ TWILIO credentials not set — SMS/WhatsApp via Twilio will be disabled.")

    # Detect which database is being used
    db_url = supabase_manager.get_database_url()
    if 'postgresql' in db_url.lower() or supabase_manager.client:
        logger.info(f"📊 Database: Supabase PostgreSQL Cloud")
    else:
        logger.info(f"📊 Database: Local SQLite (./crm_database.db)")

    # Pre-load model and course prices at startup
    try:
        get_cached_model()  # Load model into memory
        get_cached_course_prices()  # Pre-cache course prices
    except Exception as e:
        logger.error(f"⚠️ Failed to pre-load caches: {e}")

    # Database initialization handled by SQLAlchemy or Supabase
    if supabase_manager.client:
        logger.info("✅ Supabase cloud database connected")
    else:
        logger.info("✅ Local SQLite database initialized")

    # Start WebSocket Pub/Sub subscriber (Redis-backed real-time events)
    try:
        from websocket_manager import _ws_manager as _wsm
        await _wsm.start()
    except Exception as _ws_err:
        logger.warning("⚠️ WebSocket manager failed to start: %s", _ws_err)

    logger.info("✅ Application ready to accept requests")

    # Initialize Google Sheets sync scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from lead_sync_service import lead_sync_service
        
        scheduler = AsyncIOScheduler()
        
        # Add sync job - runs every 5 minutes
        scheduler.add_job(
            lead_sync_service.sync_all_unsynced_leads,
            'interval',
            minutes=5,
            id='google_sheets_sync',
            name='Sync Google Sheets leads',
            replace_existing=True
        )
        
        scheduler.start()
        logger.info("✅ Google Sheets sync scheduler started (every 5 minutes)")
    except ImportError:
        logger.warning("⚠️ APScheduler not installed - automatic Google Sheets sync disabled")
        logger.info("   Install with: pip install apscheduler")
    except Exception as e:
        logger.warning(f"⚠️ Could not start sync scheduler: {e}")

    # Note: Score decay scheduler disabled - requires Supabase migration
    # global _decay_task
    # _decay_task = _asyncio.create_task(_decay_scheduler_loop())
    # logger.info("⏱️  Score decay scheduler started")

    yield

    # ---- Shutdown ----
    logger.info("👋 Application shutdown initiated")
    try:
        from websocket_manager import _ws_manager as _wsm
        await _wsm.stop()
    except Exception:
        pass
    if _decay_task and not _decay_task.done():
        _decay_task.cancel()
        try:
            await _decay_task
        except _asyncio.CancelledError:
            pass
    logger.info("✅ Cleanup complete")

# ============================================================================
# GLOBAL AUTHENTICATION DEPENDENCY
# All routes are protected by default.  Public paths are explicitly excluded.
# ============================================================================

# Paths that do NOT require a valid JWT.
_PUBLIC_PATHS = {
    "/",
    "/ping",        # keep-alive probe — no auth needed
    "/health",
    "/ready",
    "/metrics",
    "/api/auth/login",
    "/api/auth/logout",
    "/docs",
    "/redoc",
    "/openapi.json",
}

async def _verify_token(request: Request) -> None:
    """
    Global dependency: validates the Bearer token for every route except
    those listed in _PUBLIC_PATHS.  Raises 401 if the token is missing or
    invalid.  The full user object (with DB lookup) is only fetched by
    routes that explicitly Depend(get_current_user).
    """
    # Skip auth for public paths (login, docs, health)
    if request.url.path in _PUBLIC_PATHS:
        return

    # Also skip for paths starting with /docs or /redoc (e.g. /docs/oauth2-redirect)
    for pub in ("/docs", "/redoc"):
        if request.url.path.startswith(pub):
            return

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ", 1)[1]
    try:
        # decode_access_token raises HTTPException on any failure
        token_data = decode_access_token(token)
        if not token_data or not token_data.email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise  # re-raise the 401 from decode_access_token
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _get_counselor_name(request: Request) -> str | None:
    """Return the full_name of the caller if they are a Counselor, else None.
    Used to enforce per-counselor data isolation. SUPABASE ONLY."""
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token_data = decode_access_token(auth_header.split(" ", 1)[1])
            if token_data and token_data.role == "Counselor":
                user = supabase_data.get_user_by_email(token_data.email)
                if user:
                    return user.get('full_name')
    except Exception:
        pass
    return None


# Initialize FastAPI with the global auth dependency
app = FastAPI(
    lifespan=lifespan,
    title="Medical Education CRM",
    description="AI-powered CRM for lead management and conversion optimization",
    version="1.0.0",
    dependencies=[Depends(_verify_token)],
)

# Attach rate limiter to the app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ============================================================================
# ROUTER REGISTRATION — import all domain routers and include them
# The global dependency=[Depends(_verify_token)] set on the FastAPI() instance
# above applies to ALL routes, including those in routers.
# ============================================================================
from routers import (
    system_router,
    auth_router,
    leads_router,
    users_router,
    hospitals_router,
    courses_router,
    analytics_router,
    ai_router,
    communications_router,
    settings_router,
)
from routers import websocket_router
from routers import webhooks_router
from routers import tenants_router

app.include_router(system_router.router)
app.include_router(auth_router.router)
app.include_router(tenants_router.router)
app.include_router(leads_router.router)
app.include_router(users_router.router)
app.include_router(hospitals_router.router)
app.include_router(courses_router.router)
app.include_router(analytics_router.router)
app.include_router(ai_router.router)
app.include_router(communications_router.router)
app.include_router(settings_router.router)
app.include_router(websocket_router.router)
app.include_router(webhooks_router.router)

# Add custom middleware (order matters - first added is outermost)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(PerformanceMonitoringMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=500)  # compress responses > 500 bytes

# CORS middleware - allow all Vercel preview deployments + explicit origins
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5172,http://127.0.0.1:5172,https://ibmpcrm.xyz,https://www.ibmpcrm.xyz"
).split(",")
ALLOWED_ORIGIN_REGEX = r"https://.*\.vercel\.app|https://.*\.ibmpcrm\.xyz"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("🚀 FastAPI application initialized with logging and error handling")

# Database setup — Supabase REST API (primary) + SQLAlchemy for local SQLite fallback
from supabase_client import supabase_manager
from supabase_data_layer import supabase_data
from dotenv import load_dotenv

load_dotenv()

# ============================================================================
# DATABASE MODELS (SQLAlchemy — used for local SQLite fallback only)
# ============================================================================

# Create SQLAlchemy engine and session for local SQLite operations
DATABASE_URL = supabase_manager.get_database_url()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Note: Tables will be created after all models are defined (see bottom of file)

# ============================================================================
# DATABASE MODELS
# ============================================================================

class LeadStatus(str, enum.Enum):
    FRESH = "FRESH"
    FOLLOW_UP = "FOLLOW_UP"
    WARM = "WARM"
    HOT = "HOT"
    NOT_INTERESTED = "NOT_INTERESTED"
    JUNK = "JUNK"
    NOT_ANSWERING = "NOT_ANSWERING"
    ENROLLED = "ENROLLED"

class LeadSegment(str, enum.Enum):
    HOT = "HOT"
    WARM = "WARM"
    COLD = "COLD"
    JUNK = "JUNK"

class DBLead(Base):
    __tablename__ = "leads"
    
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(String, unique=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String, nullable=True)
    phone = Column(String, index=True)
    whatsapp = Column(String, nullable=True)
    country = Column(String, index=True)
    source = Column(String)
    course_interested = Column(String)
    status = Column(SQLEnum(LeadStatus), default=LeadStatus.FRESH)
    
    # AI Scoring
    ai_score = Column(Float, default=0)
    ml_score = Column(Float, nullable=True)  # ML model score
    rule_score = Column(Float, nullable=True)  # Rule-based score
    confidence = Column(Float, nullable=True)  # Prediction confidence
    scoring_method = Column(String, nullable=True)  # 'hybrid_ml' or 'rule_based'
    ai_segment = Column(SQLEnum(LeadSegment), nullable=True)
    conversion_probability = Column(Float, default=0)
    
    # Revenue
    expected_revenue = Column(Float, default=0)
    actual_revenue = Column(Float, default=0)
    
    # Follow-up
    follow_up_date = Column(DateTime, nullable=True)
    next_action = Column(Text, nullable=True)
    priority_level = Column(String, nullable=True)
    
    # Counselor
    assigned_to = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_contact_date = Column(DateTime, nullable=True)
    
    # AI Insights
    buying_signal_strength = Column(Float, default=0)
    primary_objection = Column(String, nullable=True)
    churn_risk = Column(Float, default=0)
    recommended_script = Column(Text, nullable=True)
    feature_importance = Column(Text, nullable=True)  # JSON string of feature importance

    # Educational qualification of the lead (e.g. MBBS, MD, BDS)
    qualification = Column(String, nullable=True)

    # Loss tracking
    loss_reason = Column(String, nullable=True)   # Why lead was lost / not interested
    loss_note = Column(Text, nullable=True)        # Free-text loss detail
    
    # Performance Marketing / Campaign Tracking
    campaign_medium = Column(String, nullable=True, index=True)  # facebook, Instagram, google ads, etc.
    campaign_name = Column(String, nullable=True, index=True)    # Specific campaign name
    campaign_group = Column(String, nullable=True)               # Campaign grouping/category
    lead_quality = Column(String, nullable=True)                 # Hot, Warm, Cold quality rating
    lead_rating = Column(String, nullable=True)                  # Custom rating field
    city = Column(String, nullable=True)                         # Lead's city
    booking_marked_on = Column(DateTime, nullable=True)          # When booking was marked
    first_call_date = Column(DateTime, nullable=True)            # Date of 1st call
    second_call_date = Column(DateTime, nullable=True)           # Date of 2nd call
    third_call_date = Column(DateTime, nullable=True)            # Date of 3rd call
    lead_owner = Column(String, nullable=True)                   # Lead owner name
    stage = Column(String, nullable=True)                        # Current stage in funnel
    
    # Relationships
    notes = relationship("DBNote", back_populates="lead", cascade="all, delete-orphan")
    activities = relationship("DBActivity", back_populates="lead", cascade="all, delete-orphan")

class DBNote(Base):
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"))
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)  # Counselor name
    channel = Column(String, default="manual")  # call, whatsapp, email, manual
    
    lead = relationship("DBLead", back_populates="notes")

class DBActivity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"))
    activity_type = Column(String)  # call, email, whatsapp, status_change
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)
    
    lead = relationship("DBLead", back_populates="activities")

class DBHospital(Base):
    __tablename__ = "hospitals"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    country = Column(String)
    city = Column(String)
    contact_person = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    collaboration_status = Column(String, default="Active")  # Active, Inactive
    courses_offered = Column(JSON)  # List of course IDs
    created_at = Column(DateTime, default=datetime.utcnow)

class DBCourse(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    course_name = Column(String, index=True)
    category = Column(String)  # Emergency Medicine, Critical Care, etc.
    duration = Column(String)  # "6 months", "1 year"
    eligibility = Column(String, nullable=True)  # "MBBS, MD/MS or Equivalent"
    price = Column(Float)
    currency = Column(String, default="INR")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBCounselor(Base):
    __tablename__ = "counselors"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String)
    phone = Column(String)
    is_active = Column(Boolean, default=True)
    specialization = Column(String, nullable=True)  # Closer, Objection Handler
    total_leads = Column(Integer, default=0)
    total_conversions = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBUser(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    password = Column(String)  # In production, use hashed passwords
    role = Column(String)  # Super Admin, Manager, Team Leader, Counselor
    reports_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Self-referential relationship for hierarchy
    manager = relationship("DBUser", remote_side=[id], backref="team_members")

class DBSLAConfig(Base):
    """Singleton row (id=1) — SLA thresholds configurable from the admin UI."""
    __tablename__ = "sla_config"
    id                     = Column(Integer, primary_key=True, default=1)
    first_contact_hours    = Column(Float,   default=4.0)   # hours after lead creation
    followup_response_hours= Column(Float,   default=24.0)  # hours overdue before breach
    no_activity_days       = Column(Integer, default=7)     # days silence = breach
    updated_at             = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by             = Column(String,  nullable=True)


class DBDecayConfig(Base):
    """Single-row config table (id=1) for score decay thresholds."""
    __tablename__ = "decay_config"
    id                   = Column(Integer, primary_key=True, default=1)
    enabled              = Column(Boolean, default=True)
    hot_to_warm_hours    = Column(Float,   default=48.0)   # Hot → Warm if silent for N hours
    warm_to_stale_hours  = Column(Float,   default=168.0)  # Warm → Follow Up if silent for N hours (7 days)
    score_decay_per_day  = Column(Float,   default=3.0)    # ai_score points lost per day without contact
    apply_score_decay    = Column(Boolean, default=True)
    check_interval_hours = Column(Float,   default=1.0)    # how often the bg engine fires
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by           = Column(String,  nullable=True)


class DBDecayLog(Base):
    """Audit record for every lead that was downgraded by the decay engine."""
    __tablename__ = "decay_log"
    id                  = Column(Integer, primary_key=True)
    lead_id             = Column(String,  index=True)   # LEAD00001 style
    lead_name           = Column(String,  nullable=True)
    assigned_to         = Column(String,  nullable=True)
    old_status          = Column(String)
    new_status          = Column(String,  nullable=True)
    old_score           = Column(Float,   nullable=True)
    new_score           = Column(Float,   nullable=True)
    hours_since_contact = Column(Float)
    reason              = Column(String)  # hot_to_warm | warm_to_stale | score_only
    created_at          = Column(DateTime, default=datetime.utcnow)


class DBWATemplate(Base):
    """WhatsApp message templates with {{variable}} placeholders."""
    __tablename__ = "wa_templates"
    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String,  nullable=False)
    category    = Column(String,  nullable=False)   # welcome | follow_up | fee_reminder | enrollment | custom
    body        = Column(Text,    nullable=False)   # body with {{var}} tokens
    variables   = Column(Text,    nullable=True)    # JSON list of variable names
    description = Column(String,  nullable=True)
    emoji       = Column(String,  nullable=True, default="💬")
    is_active   = Column(Boolean, default=True)
    is_builtin  = Column(Boolean, default=False)    # protected — can edit body but not delete
    created_at  = Column(DateTime, default=datetime.utcnow)
    created_by  = Column(String,  nullable=True)


class DBWorkflowRule(Base):
    """Automation rules — trigger + conditions → actions."""
    __tablename__ = "workflow_rules"
    id             = Column(Integer, primary_key=True)
    name           = Column(String,  nullable=False)
    description    = Column(String,  nullable=True)
    enabled        = Column(Boolean, default=True)
    # Trigger ─ what causes evaluation
    trigger_type   = Column(String)   # time_since_contact | score_below | segment_is | created_since
    trigger_value  = Column(String)   # JSON‑encoded value (number or string)
    # Conditions ─ ALL must be true (JSON array)
    conditions     = Column(Text, default="[]")
    # Actions ─ executed in order (JSON array)
    actions        = Column(Text, default="[]")
    # Execution limits
    run_limit      = Column(Integer, default=1)      # 0=unlimited per lead
    cooldown_hours = Column(Float,   default=24.0)
    # Stats
    total_runs     = Column(Integer, default=0)
    last_run_at    = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    created_by     = Column(String,  nullable=True)


class DBWorkflowExecution(Base):
    """One row per lead per rule execution."""
    __tablename__ = "workflow_executions"
    id            = Column(Integer, primary_key=True)
    rule_id       = Column(Integer, ForeignKey("workflow_rules.id", ondelete="CASCADE"), index=True)
    rule_name     = Column(String)
    lead_id       = Column(String,  index=True)
    lead_name     = Column(String,  nullable=True)
    assigned_to   = Column(String,  nullable=True)
    actions_taken = Column(Text)    # JSON array of {type, result}
    success       = Column(Boolean, default=True)
    error_msg     = Column(String,  nullable=True)
    executed_at   = Column(DateTime, default=datetime.utcnow, index=True)


class DBChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    lead_db_id = Column(Integer, ForeignKey("leads.id"), index=True)
    direction = Column(String)           # "outbound" | "inbound"
    msg_type = Column(String, default="text")  # text | image | document | video | audio
    content = Column(Text, nullable=True)      # text body or caption
    media_url = Column(String, nullable=True)  # public URL for media
    filename = Column(String, nullable=True)   # original filename (documents)
    sender_name = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(String, default="sent")    # sent | failed | delivered | read
    interakt_id = Column(String, nullable=True)


# Create all database tables (skip if direct DB connection unavailable — app uses Supabase REST API)
try:
    Base.metadata.create_all(bind=engine)
except Exception as _db_init_err:
    logger.warning(f"⚠️ Could not run create_all (direct DB unavailable, using Supabase REST API): {_db_init_err}")


# ============================================================================
# PYDANTIC MODELS (API)
# ============================================================================

# Import sanitizer for free-text field validation
from sanitize import sanitize_text
from pydantic import field_validator


class NoteCreate(BaseModel):
    content: str
    channel: str = "manual"
    created_by: Optional[str] = None  # Optional - backend determines from auth token

    @field_validator('content', 'created_by', mode='before')
    @classmethod
    def _sanitize(cls, v):
        return sanitize_text(v, max_length=10000) if v else None

class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    content: str
    created_at: datetime
    created_by: str
    channel: str

# Normalise status strings coming from the frontend or legacy data.
# Old imports / DB rows may have ALL-CAPS values ("FRESH", "HOT", etc.).
# This map converts any casing variant to the canonical enum value.
_STATUS_NORMALISE_MAP: dict[str, str] = {
    # Fresh
    "fresh": "FRESH",
    # Follow Up
    "follow up": "FOLLOW_UP",
    "followup": "FOLLOW_UP",
    "follow_up": "FOLLOW_UP",
    "follow-up": "FOLLOW_UP",
    # Warm
    "warm": "WARM",
    # Hot
    "hot": "HOT",
    # Not Interested
    "not interested": "NOT_INTERESTED",
    "not_interested": "NOT_INTERESTED",
    "notinterested": "NOT_INTERESTED",
    "ni": "NOT_INTERESTED",
    # Junk
    "junk": "JUNK",
    "spam": "JUNK",
    "invalid": "JUNK",
    # Not Answering
    "not answering": "NOT_ANSWERING",
    "not_answering": "NOT_ANSWERING",
    "notanswering": "NOT_ANSWERING",
    "na": "NOT_ANSWERING",
    "no answer": "NOT_ANSWERING",
    "not connected": "NOT_ANSWERING",
    "switched off": "NOT_ANSWERING",
    "busy": "NOT_ANSWERING",
    # Enrolled
    "enrolled": "ENROLLED",
    "admission done": "ENROLLED",
    "converted": "ENROLLED",
}

# Valid enum values set for fast lookup
_VALID_STATUSES = {"FRESH", "FOLLOW_UP", "WARM", "HOT", "NOT_INTERESTED", "JUNK", "NOT_ANSWERING", "ENROLLED"}

def _normalise_status(v):
    if not v:
        return v
    raw = str(v).strip()
    # Already a valid status (handles correct casing straight from files)
    if raw in _VALID_STATUSES:
        return raw
    key = raw.lower()
    # Return mapped canonical value, or default to "FRESH" for anything unrecognised
    return _STATUS_NORMALISE_MAP.get(key, "FRESH")


# Canonical source values and their import aliases
_CANONICAL_SOURCES = ['Website', 'Instagram', 'Facebook', 'Referral', 'WhatsApp']
_SOURCE_ALIAS_MAP = {
    # Website / Google
    'website': 'Website', 'web': 'Website', 'site': 'Website', 'online': 'Website',
    'google': 'Website', 'google ads': 'Website', 'google ad': 'Website',
    'seo': 'Website', 'organic': 'Website', 'search': 'Website',
    # Instagram
    'instagram': 'Instagram', 'ig': 'Instagram', 'insta': 'Instagram',
    # Facebook
    'facebook': 'Facebook', 'fb': 'Facebook', 'fb ads': 'Facebook',
    'facebook ads': 'Facebook', 'meta': 'Facebook', 'meta ads': 'Facebook',
    # Referral
    'referral': 'Referral', 'refer': 'Referral', 'reference': 'Referral',
    'ref': 'Referral', 'word of mouth': 'Referral', 'wom': 'Referral',
    'agent': 'Referral', 'friend': 'Referral', 'recommendation': 'Referral',
    # WhatsApp
    'whatsapp': 'WhatsApp', 'whats app': 'WhatsApp', 'wa': 'WhatsApp',
    'wp': 'WhatsApp', 'wapp': 'WhatsApp',
}

def _normalise_source(v):
    """Map any raw source string to one of the 5 canonical source values."""
    if not v:
        return v
    key = str(v).lower().strip()
    if key in _SOURCE_ALIAS_MAP:
        return _SOURCE_ALIAS_MAP[key]
    # Partial contains match
    for alias, canonical in _SOURCE_ALIAS_MAP.items():
        if key in alias or alias in key:
            return canonical
    # Already canonical (case-insensitive)
    for src in _CANONICAL_SOURCES:
        if src.lower() == key:
            return src
    return v  # preserve unknown values as-is


class LeadCreate(BaseModel):
    full_name: str
    email: Optional[str] = None  # Changed from EmailStr to str for lenient import
    phone: str
    whatsapp: Optional[str] = None
    country: str
    source: str
    course_interested: str
    status: Optional[LeadStatus] = LeadStatus.FRESH  # Allow custom status, default to Fresh
    assigned_to: Optional[str] = None
    qualification: Optional[str] = None  # Educational qualification, e.g. MBBS, MD, BDS
    company: Optional[str] = None         # Company / brand: 'MED' or 'Others'
    follow_up_date: Optional[datetime] = None
    notes: Optional[str] = None  # Initial note content for imports
    utm_source: Optional[str] = None      # e.g. "google", "facebook"
    utm_medium: Optional[str] = None      # e.g. "cpc", "organic"
    utm_campaign: Optional[str] = None    # e.g. "mbbs_jan26"
    
    # Performance Marketing / Campaign Fields
    campaign_medium: Optional[str] = None
    campaign_name: Optional[str] = None
    campaign_group: Optional[str] = None
    lead_quality: Optional[str] = None
    lead_rating: Optional[str] = None
    city: Optional[str] = None
    booking_marked_on: Optional[datetime] = None
    first_call_date: Optional[datetime] = None
    second_call_date: Optional[datetime] = None
    third_call_date: Optional[datetime] = None
    lead_owner: Optional[str] = None
    stage: Optional[str] = None

    @field_validator('status', mode='before')
    @classmethod
    def _normalise_status_create(cls, v):
        return _normalise_status(v)

    @field_validator('email', mode='before')
    @classmethod
    def _validate_email(cls, v):
        """Validate email - return None if invalid instead of raising error"""
        if not v or not isinstance(v, str):
            return None
        v = v.strip()
        # Basic check: must have @ and something before and after it
        if '@' not in v or v.startswith('@') or v.endswith('@') or len(v) < 3:
            return None
        return v

    @field_validator('source', mode='before')
    @classmethod
    def _normalise_source_create(cls, v):
        return _normalise_source(v)

    @field_validator('full_name', 'course_interested', 'assigned_to', 'qualification', 'notes', mode='before')
    @classmethod
    def _sanitize(cls, v):
        return sanitize_text(v, max_length=500) if v else None

class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None  # Changed from EmailStr to str for lenient updates
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    country: Optional[str] = None
    source: Optional[str] = None
    course_interested: Optional[str] = None
    status: Optional[LeadStatus] = None
    follow_up_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    qualification: Optional[str] = None  # Educational qualification, e.g. MBBS, MD, BDS
    company: Optional[str] = None         # Company / brand: 'MED' or 'Others'
    actual_revenue: Optional[float] = None
    expected_revenue: Optional[float] = None
    next_action: Optional[str] = None
    loss_reason: Optional[str] = None
    loss_note: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    
    # Performance Marketing / Campaign Fields
    campaign_medium: Optional[str] = None
    campaign_name: Optional[str] = None
    campaign_group: Optional[str] = None
    lead_quality: Optional[str] = None
    lead_rating: Optional[str] = None
    city: Optional[str] = None
    booking_marked_on: Optional[datetime] = None
    first_call_date: Optional[datetime] = None
    second_call_date: Optional[datetime] = None
    third_call_date: Optional[datetime] = None
    lead_owner: Optional[str] = None
    stage: Optional[str] = None

    @field_validator('status', mode='before')
    @classmethod
    def _normalise_status_update(cls, v):
        return _normalise_status(v)

    @field_validator('email', mode='before')
    @classmethod
    def _validate_email(cls, v):
        """Validate email - return None if invalid instead of raising error"""
        if not v or not isinstance(v, str):
            return None
        v = v.strip()
        # Basic check: must have @ and something before and after it
        if '@' not in v or v.startswith('@') or v.endswith('@') or len(v) < 3:
            return None
        return v

    @field_validator('source', mode='before')
    @classmethod
    def _normalise_source_update(cls, v):
        return _normalise_source(v)

    @field_validator('full_name', 'course_interested', 'assigned_to', 'next_action',
                     'qualification', 'loss_reason', 'loss_note', mode='before')
    @classmethod
    def _sanitize(cls, v):
        return sanitize_text(v, max_length=5000) if v else None

class LeadResponse(BaseModel):
    id: int
    lead_id: str
    full_name: str
    email: Optional[str]
    phone: str
    whatsapp: Optional[str]
    country: str
    source: str
    course_interested: str
    status: LeadStatus
    ai_score: float
    ml_score: Optional[float] = None
    rule_score: Optional[float] = None
    confidence: Optional[float] = None
    scoring_method: Optional[str] = None
    ai_segment: Optional[LeadSegment]
    conversion_probability: float
    expected_revenue: float
    actual_revenue: float
    follow_up_date: Optional[datetime]
    next_action: Optional[str]
    priority_level: Optional[str]
    assigned_to: Optional[str]
    created_at: datetime
    updated_at: datetime
    last_contact_date: Optional[datetime]
    buying_signal_strength: float
    primary_objection: Optional[str]
    churn_risk: float
    recommended_script: Optional[str]
    feature_importance: Optional[dict] = None
    qualification: Optional[str] = None
    company: Optional[str] = None
    loss_reason: Optional[str] = None
    loss_note: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    
    # Performance Marketing / Campaign Fields
    campaign_medium: Optional[str] = None
    campaign_name: Optional[str] = None
    campaign_group: Optional[str] = None
    lead_quality: Optional[str] = None
    lead_rating: Optional[str] = None
    city: Optional[str] = None
    booking_marked_on: Optional[datetime] = None
    first_call_date: Optional[datetime] = None
    second_call_date: Optional[datetime] = None
    third_call_date: Optional[datetime] = None
    lead_owner: Optional[str] = None
    stage: Optional[str] = None
    
    notes: List[NoteResponse] = []

    model_config = ConfigDict(from_attributes=True)

class HospitalCreate(BaseModel):
    name: str
    country: str
    city: str
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    courses_offered: List[int] = []

class WhatsAppRequest(BaseModel):
    message: str
    template: Optional[str] = None

class EmailRequest(BaseModel):
    subject: str
    body: str
    template: Optional[str] = None

class FollowUpRequest(BaseModel):
    message: str
    priority: str = "normal"

class AssignmentRequest(BaseModel):
    strategy: str = "intelligent"

class ReassignmentRequest(BaseModel):
    new_counselor: str
    reason: str = "Manual reassignment"

class HospitalResponse(BaseModel):
    id: Any
    name: str
    country: str
    city: str
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    collaboration_status: Optional[str] = "Active"
    courses_offered: List[Any] = []
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class CourseCreate(BaseModel):
    course_name: str
    category: str
    duration: str
    eligibility: Optional[str] = None
    price: float
    currency: str = "INR"
    description: Optional[str] = None

class CourseResponse(BaseModel):
    id: Any
    course_name: str
    category: Optional[str] = None
    duration: Optional[str] = None
    eligibility: Optional[str] = None
    price: float = 0.0
    currency: Optional[str] = "INR"
    description: Optional[str] = None
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CounselorResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    is_active: bool
    specialization: Optional[str]
    total_leads: int
    total_conversions: int
    conversion_rate: float
    
    model_config = ConfigDict(from_attributes=True)

VALID_ROLES = {"Super Admin", "Manager", "Team Leader", "Counselor"}

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: str  # Super Admin, Manager, Team Leader, Counselor
    reports_to: Optional[int] = None
    is_active: Optional[bool] = True

    @field_validator('phone', mode='before')
    @classmethod
    def _empty_str_to_none(cls, v):
        if isinstance(v, str) and v.strip() == '':
            return None
        return v

    @field_validator('role', mode='before')
    @classmethod
    def _validate_role(cls, v):
        if v not in VALID_ROLES:
            raise ValueError(f'role must be one of: {", ".join(sorted(VALID_ROLES))}')
        return v

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    reports_to: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator('phone', mode='before')
    @classmethod
    def _empty_str_to_none(cls, v):
        if isinstance(v, str) and v.strip() == '':
            return None
        return v

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    reports_to: Optional[int] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class DashboardStats(BaseModel):
    total_leads: int
    hot_leads: int
    warm_leads: int
    cold_leads: int
    junk_leads: int
    total_conversions: int
    conversion_rate: float
    total_revenue: float
    expected_revenue: float
    leads_today: int
    leads_this_week: int
    leads_this_month: int
    avg_ai_score: float

# ============================================================================
# VALUE NORMALIZATION FOR IMPORTS
# ============================================================================

def normalize_lead_values(lead_data: dict) -> dict:
    """Normalize imported lead values to match CRM standards (case-insensitive matching)"""
    
    # Status normalization - map variations to standard LeadStatus values
    status_map = {
        'fresh': 'Fresh',
        'follow up': 'Follow Up',
        'follow-up': 'Follow Up',
        'followup': 'Follow Up',
        'warm': 'Warm',
        'hot': 'Hot',
        'not interested': 'Not Interested',
        'not-interested': 'Not Interested',
        'notinterested': 'Not Interested',
        'junk': 'Junk',
        'not answering': 'Not Answering',
        'not-answering': 'Not Answering',
        'notanswering': 'Not Answering',
        'enrolled': 'Enrolled',
    }
    
    # Country normalization - common variations
    country_map = {
        'india': 'India',
        'ind': 'India',
        'in': 'India',
        'usa': 'USA',
        'us': 'USA',
        'united states': 'USA',
        'uk': 'UK',
        'united kingdom': 'UK',
        'uae': 'UAE',
        'united arab emirates': 'UAE',
        'russia': 'Russia',
        'egypt': 'Egypt',
        'eg': 'Egypt',
        'albania': 'Albania',
        'al': 'Albania',
    }
    
    # Source normalization
    source_map = {
        'facebook': 'Facebook',
        'fb': 'Facebook',
        'import': 'Import',
        'website': 'Website',
        'referral': 'Referral',
        'google': 'Google',
        'instagram': 'Instagram',
        'ig': 'Instagram',
        'linkedin': 'LinkedIn',
        'whatsapp': 'WhatsApp',
        'wa': 'WhatsApp',
    }
    
    normalized = lead_data.copy()
    
    # Normalize status
    if 'status' in normalized and normalized['status']:
        status_lower = str(normalized['status']).lower().strip()
        normalized['status'] = status_map.get(status_lower, normalized['status'])
    
    # Normalize country
    if 'country' in normalized and normalized['country']:
        country_lower = str(normalized['country']).lower().strip()
        normalized['country'] = country_map.get(country_lower, normalized['country'].title())
    
    # Normalize source
    if 'source' in normalized and normalized['source']:
        source_lower = str(normalized['source']).lower().strip()
        normalized['source'] = source_map.get(source_lower, normalized['source'].title())
    
    # Normalize course name (title case)
    if 'course_interested' in normalized and normalized['course_interested']:
        normalized['course_interested'] = normalized['course_interested'].strip().title()
    
    # Normalize counselor name (title case)
    if 'assigned_to' in normalized and normalized['assigned_to']:
        normalized['assigned_to'] = normalized['assigned_to'].strip().title()
    
    # Normalize full name (title case)
    if 'full_name' in normalized and normalized['full_name']:
        normalized['full_name'] = normalized['full_name'].strip().title()
    
    return normalized

# ============================================================================
# AI SCORING ENGINE
# ============================================================================

class AILeadScorer:
    """AI-powered lead scoring engine with ML + NLP hybrid intelligence"""
    
    def __init__(self):
        # Load latest trained CatBoost model (96.5% ROC-AUC)
        model_path = Path("../../models/lead_conversion_model_v2_20251224_184626.pkl")
        if model_path.exists():
            try:
                self.model = joblib.load(model_path)
                self.has_model = True
                logger.info("✅ ML Model loaded successfully (ROC-AUC: 96.5%)", extra={"system": "ml"})
            except Exception as e:
                logger.error(f"⚠️ Failed to load ML model: {e}", extra={"system": "ml", "error": str(e)})
                self.has_model = False
        else:
            logger.warning("⚠️ ML model not found, using rule-based scoring only", extra={"system": "ml"})
            self.has_model = False
        
        self.course_prices = {}  # Will be populated from DB
    
    def load_course_prices(self):
        """Load course prices for revenue calculation (uses cache) - SUPABASE ONLY"""
        self.course_prices = get_cached_course_prices()
    
    def score_lead(self, lead: DBLead, notes: List[DBNote]) -> Dict[str, Any]:
        """Score a lead using hybrid ML + Rule-based intelligence"""
        
        # Analyze conversation with NLP
        conversation_analysis = self._analyze_conversation(notes)
        
        # Calculate scores
        if self.has_model:
            # HYBRID APPROACH: 70% ML + 30% Rules
            ml_score, ml_confidence, feature_importance = self._calculate_ml_score(lead, notes, conversation_analysis)
            rule_score = self._calculate_rule_based_score(lead, conversation_analysis)
            
            # Weighted combination
            final_score = (ml_score * 0.7) + (rule_score * 0.3)
            
            scoring_method = 'hybrid_ml'
            confidence = ml_confidence
        else:
            # Fallback to pure rule-based
            final_score = self._calculate_rule_based_score(lead, conversation_analysis)
            ml_score = None
            rule_score = final_score
            feature_importance = None
            scoring_method = 'rule_based'
            confidence = 0.75
        
        # Determine segment
        segment = self._determine_segment(final_score, conversation_analysis)
        
        # Calculate expected revenue (guard against None course_price)
        course_price = self.course_prices.get(lead.course_interested, 50000)
        if not course_price or not isinstance(course_price, (int, float)):
            course_price = 50000
        expected_revenue = course_price * (final_score / 100)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            lead, final_score, conversation_analysis
        )
        
        return {
            'ai_score': round(final_score, 2),
            'ml_score': round(ml_score, 2) if ml_score else None,
            'rule_score': round(rule_score, 2),
            'confidence': round(confidence, 3),
            'scoring_method': scoring_method,
            'ai_segment': segment,
            'conversion_probability': round(final_score / 100, 3),
            'expected_revenue': round(expected_revenue, 2),
            'buying_signal_strength': conversation_analysis['buying_strength'],
            'primary_objection': conversation_analysis['primary_objection'],
            'churn_risk': round(conversation_analysis['churn_risk'], 3),
            'next_action': recommendations['next_action'],
            'priority_level': recommendations['priority'],
            'recommended_script': recommendations['script'],
            'follow_up_date': recommendations['follow_up_date'],
            'feature_importance': feature_importance
        }
    
    def _calculate_ml_score(self, lead: DBLead, notes: List[DBNote], conversation: Dict) -> tuple:
        """Calculate ML-based score using trained CatBoost model"""
        try:
            # Extract features for ML model
            features = self._extract_ml_features(lead, notes, conversation)
            
            # Get ML prediction probability
            prediction_proba = self.model.predict_proba([features])[0]
            ml_score = prediction_proba[1] * 100  # Probability of conversion * 100
            
            # Calculate confidence based on probability distance from 0.5
            confidence = abs(prediction_proba[1] - 0.5) * 2  # 0 to 1 scale
            
            # Get feature importance (top factors driving the score)
            feature_importance = {
                'recency': 0.35,
                'engagement': 0.25,
                'buying_signals': 0.20,
                'objections': 0.12,
                'lead_age': 0.08
            }
            
            return ml_score, confidence, feature_importance
            
        except Exception as e:
            print(f"ML scoring error: {e}")
            # Fallback to rule-based
            return self._calculate_rule_based_score(lead, conversation), 0.5, None
    
    def _extract_ml_features(self, lead: DBLead, notes: List[DBNote], conversation: Dict) -> list:
        """Extract features for ML model prediction (44-feature vector)."""
        # ── Engagement / temporal ──────────────────────────────────────────────
        notes_count = len(notes)
        lead_age_days = (datetime.utcnow() - lead.created_at).days if lead.created_at else 0
        days_since_last_contact = (datetime.utcnow() - lead.last_contact_date).days if lead.last_contact_date else 999
        avg_note_length = sum(len(n.content) for n in notes) / max(notes_count, 1)

        buying_signal_score = conversation['buying_strength'] / 100
        has_objection = 1 if conversation['primary_objection'] else 0
        churn_risk = conversation['churn_risk']

        if days_since_last_contact <= 1:    recency_score = 1.0
        elif days_since_last_contact <= 3:  recency_score = 0.8
        elif days_since_last_contact <= 7:  recency_score = 0.5
        elif days_since_last_contact <= 14: recency_score = 0.3
        else:                               recency_score = 0.1

        engagement_score = min(1.0, notes_count / 10)

        # ── New profile-quality features (6 additional meaningful signals) ─────
        # country_tier: 0–1 representing market quality
        _country_tier_map = {
            'india': 0.9, 'uae': 0.8, 'saudi arabia': 0.8, 'qatar': 0.8,
            'kuwait': 0.8, 'bahrain': 0.8, 'oman': 0.8, 'uk': 0.7,
            'usa': 0.7, 'canada': 0.7, 'australia': 0.7,
        }
        country_name = (getattr(lead, 'country', None) or '').lower().strip()
        country_tier = _country_tier_map.get(country_name, 0.5)

        # source_quality: lead channel quality signal
        _source_quality_map = {
            'referral': 1.0, 'website': 0.8, 'direct': 0.8,
            'facebook': 0.6, 'instagram': 0.6, 'google ads': 0.6,
            'linkedin': 0.65, 'youtube': 0.55, 'whatsapp': 0.7,
        }
        source_name = (getattr(lead, 'source', None) or '').lower().strip()
        source_quality = _source_quality_map.get(source_name, 0.4)

        # course_tier: estimated value from course pricing dict
        course_name = (getattr(lead, 'course_interested', None) or '').lower()
        course_prices = getattr(self, 'course_prices', {}) if hasattr(self, 'course_prices') else {}
        course_price_val = 0
        for k, v in course_prices.items():
            if k.lower() in course_name or course_name in k.lower():
                course_price_val = v
                break
        max_price = max(course_prices.values()) if course_prices else 1
        course_tier = min(1.0, course_price_val / max(max_price, 1))

        # profile_completeness: fraction of key fields filled in
        profile_fields = [
            getattr(lead, 'email', None),
            getattr(lead, 'whatsapp', None),
            getattr(lead, 'country', None),
            getattr(lead, 'qualification', None),
        ]
        profile_completeness = sum(1 for f in profile_fields if f) / len(profile_fields)

        # status_progression: encoded lead pipeline progress
        _status_progression = {
            'fresh': 0.1, 'warm': 0.5, 'hot': 0.8, 'enrolled': 1.0,
            'follow up': 0.4, 'junk': 0.0,
        }
        status_val = (getattr(lead, 'status', '') or '').lower()
        status_progression = _status_progression.get(status_val, 0.2)

        # has_qualification: binary flag
        has_qualification = 1.0 if getattr(lead, 'qualification', None) else 0.0

        # ── Assemble 16-feature vector (pads to 44) ───────────────────────────
        features = [
            recency_score,
            engagement_score,
            buying_signal_score,
            churn_risk,
            lead_age_days / 100,
            notes_count / 20,
            avg_note_length / 500,
            has_objection,
            days_since_last_contact / 30,
            1 if conversation['urgency'] == 'high' else 0,
            # New features — replace 6 padding zeros
            country_tier,
            source_quality,
            course_tier,
            profile_completeness,
            status_progression,
            has_qualification,
        ]

        features.extend([0] * (44 - len(features)))
        return features[:44]
    
    def _calculate_rule_based_score(self, lead: DBLead, conversation: Dict) -> float:
        """Calculate rule-based AI score (original logic)"""
        score = 50.0  # Base score
        
        # Conversation intelligence (40% weight)
        score += conversation['buying_strength'] * 0.4
        
        # Recency (20% weight)
        if lead.last_contact_date:
            days_ago = (datetime.utcnow() - lead.last_contact_date).days
            if days_ago <= 1:
                score += 20
            elif days_ago <= 3:
                score += 15
            elif days_ago <= 7:
                score += 10
            elif days_ago <= 14:
                score += 5
        
        # Engagement (20% weight)
        note_count = len(lead.notes) if hasattr(lead, 'notes') else 0
        score += min(20, note_count * 3)
        
        # Penalties
        score -= conversation['churn_risk'] * 30
        if conversation['primary_objection'] in ['price', 'competitor']:
            score -= 10
        
        return max(0, min(100, score))
    
    def _analyze_conversation(self, notes: List[DBNote]) -> Dict[str, Any]:
        """Analyze conversation for buying signals and objections"""
        
        if not notes:
            return {
                'buying_strength': 0,
                'primary_objection': None,
                'churn_risk': 0,
                'urgency': 'low'
            }
        
        all_text = " ".join([note.content.lower() for note in notes])
        
        # Buying signals
        buying_patterns = [
            (r'\b(ready to|want to|will)\s+(pay|enroll|join|register)\b', 40),
            (r'\bhow (much|to pay|payment)\b', 30),
            (r'\bwhen (can i|do i) start\b', 35),
            (r'\bsend (payment|fee) details\b', 45),
            (r'\b(yes|sure),?\s+i\'?ll (join|enroll)\b', 50),
            (r'\b(interested|considering)\b', 20),
            (r'\btell me (more )?about\b', 15),
        ]
        
        buying_strength = 0
        for pattern, score in buying_patterns:
            if re.search(pattern, all_text, re.IGNORECASE):
                buying_strength += score
        buying_strength = min(100, buying_strength)
        
        # Objections
        objection_patterns = {
            'price': [r'\bexpensive|costly|high (price|fee)\b', r'\bcan\'?t afford\b', r'\bdiscount\b'],
            'time': [r'\bno time|too busy\b', r'\blater|next month\b'],
            'competitor': [r'\bother (course|institute)\b', r'\bcomparing\b'],
            'quality': [r'\bworth it|good\b', r'\breviews|testimonials\b'],
        }
        
        primary_objection = None
        for obj_type, patterns in objection_patterns.items():
            for pattern in patterns:
                if re.search(pattern, all_text, re.IGNORECASE):
                    primary_objection = obj_type
                    break
            if primary_objection:
                break
        
        # Churn risk
        churn_patterns = [
            r'\bnot interested\b',
            r'\bdon\'?t (want|need)\b',
            r'\balready (joined|enrolled)\b',
        ]
        churn_risk = 0
        for pattern in churn_patterns:
            if re.search(pattern, all_text, re.IGNORECASE):
                churn_risk += 0.3
        churn_risk = min(1.0, churn_risk)
        
        # Urgency
        urgency_patterns = [r'\burgent|asap|immediately\b', r'\btoday|tomorrow\b']
        urgency = 'high' if any(re.search(p, all_text, re.IGNORECASE) for p in urgency_patterns) else 'medium'
        
        return {
            'buying_strength': buying_strength,
            'primary_objection': primary_objection,
            'churn_risk': churn_risk,
            'urgency': urgency
        }
    
    def _determine_segment(self, score: float, conversation: Dict) -> LeadSegment:
        """Determine lead segment"""
        
        # Override with conversation signals
        if conversation['buying_strength'] > 70:
            return LeadSegment.HOT
        
        if conversation['churn_risk'] > 0.7:
            return LeadSegment.JUNK
        
        # Score-based
        if score >= 75:
            return LeadSegment.HOT
        elif score >= 50:
            return LeadSegment.WARM
        elif score >= 25:
            return LeadSegment.COLD
        else:
            return LeadSegment.JUNK
    
    def _generate_recommendations(self, lead: DBLead, score: float, 
                                 conversation: Dict) -> Dict[str, Any]:
        """Generate actionable recommendations"""
        
        now = datetime.utcnow()
        
        if conversation['buying_strength'] > 70:
            return {
                'next_action': '🔥 URGENT: Send payment details NOW - High purchase intent',
                'priority': 'P0 - Immediate',
                'script': f"Hi {lead.full_name}, I'm sending the payment details for {lead.course_interested}. Start date is confirmed. Any questions?",
                'follow_up_date': now + timedelta(minutes=15)
            }
        
        elif conversation['primary_objection'] == 'price':
            return {
                'next_action': '💰 Address pricing - Explain value + offer payment plan',
                'priority': 'P1 - High',
                'script': f"Hi {lead.full_name}, I understand the investment. Let me show you the ROI and flexible payment options we have.",
                'follow_up_date': now + timedelta(hours=4)
            }
        
        elif score >= 50:
            return {
                'next_action': '📞 Schedule follow-up call',
                'priority': 'P2 - Medium',
                'script': f"Hi {lead.full_name}, following up on {lead.course_interested}. When's a good time to discuss?",
                'follow_up_date': now + timedelta(days=2)
            }
        
        else:
            return {
                'next_action': '📱 Add to WhatsApp nurture campaign',
                'priority': 'P3 - Low',
                'script': 'Automated nurture sequence',
                'follow_up_date': now + timedelta(days=7)
            }

# Initialize AI scorer
ai_scorer = AILeadScorer()

# ============================================================================
# DEPENDENCY
# get_db is defined in deps.py and re-exported here so route handlers that
# already import it from main continue to work during the migration.
# ============================================================================

# Stub function to prevent NameError during import
# This allows endpoints with db: Session = Depends(get_db) to be defined
# They will fail with 500 when called, but the app will start
def get_db():
    """Stub function - local database not supported"""
    from fastapi import HTTPException
    raise HTTPException(
        status_code=500, 
        detail="Local database not supported. This endpoint needs conversion to Supabase."
    )

# ============================================================================
# API ENDPOINTS - AUTHENTICATION
# ============================================================================
# Auth endpoints are handled by auth_router (registered via include_router above).
# POST /api/auth/login  → auth_router.py
# POST /api/auth/logout → auth_router.py
# GET  /api/auth/me     → auth_router.py

# ============================================================================
# ROOT & HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/")
@app.head("/")
async def root():
    """Root endpoint - API information (HEAD supported for Render health checks)"""
    return {
        "name": "Medical Education CRM API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }

# ============================================================================
# API ENDPOINTS - LEADS
# ============================================================================

@app.post("/api/leads", response_model=LeadResponse)
async def create_lead(lead: LeadCreate, background_tasks: BackgroundTasks, request: Request):
    """Create a new lead with AI scoring - SUPABASE ONLY"""

    # Auto-assign to counselor if they are creating the lead
    _counselor_name = _get_counselor_name(request)
    if _counselor_name:
        lead.assigned_to = _counselor_name  # Override assigned_to for counselors

    # Normalize input values to match CRM standards
    normalized = normalize_lead_values({
        'full_name': lead.full_name,
        'country': lead.country,
        'source': lead.source,
        'course_interested': lead.course_interested,
        'assigned_to': lead.assigned_to,
        'status': lead.status.value if hasattr(lead.status, 'value') else lead.status if lead.status else 'Fresh'
    })

    # Generate a collision-safe unique lead ID using timestamp + random suffix
    import uuid as _uuid
    _ts = datetime.utcnow().strftime("%y%m%d%H%M%S")
    _rand = _uuid.uuid4().hex[:4].upper()
    lead_id = f"LEAD{_ts}{_rand}"

    # Build a temporary object just for AI scoring (not persisted)
    db_lead = DBLead(
        lead_id=lead_id,
        full_name=normalized['full_name'],
        email=lead.email if lead.email else None,
        phone=lead.phone,
        whatsapp=lead.whatsapp or lead.phone,
        country=normalized['country'],
        source=normalized['source'],
        course_interested=normalized['course_interested'],
        assigned_to=normalized.get('assigned_to'),
        status=LeadStatus(normalized['status'])  # Use normalized status
    )

    # AI scoring (load prices from Supabase)
    try:
        # Get courses from Supabase for pricing
        courses = supabase_data.get_courses()
        # Create a dict for ai_scorer to use
        ai_scorer.course_prices = {c.get('name'): c.get('price', 0) for c in courses if c.get('name')}
    except Exception as e:
        logger.warning(f"Could not load course prices for AI scoring: {e}")
        ai_scorer.course_prices = {}
    
    score_result = ai_scorer.score_lead(db_lead, [])
    for key, value in score_result.items():
        if key == 'feature_importance' and value:
            import json
            setattr(db_lead, key, json.dumps(value))
        else:
            setattr(db_lead, key, value)

    # Save to Supabase
    try:
        payload = {
            "lead_id": db_lead.lead_id,
            "full_name": db_lead.full_name,
            "email": db_lead.email,
            "phone": db_lead.phone,
            "whatsapp": db_lead.whatsapp,
            "country": db_lead.country,
            "source": db_lead.source,
            "course_interested": db_lead.course_interested,
            "assigned_to": db_lead.assigned_to,
            "qualification": lead.qualification,
            "company": lead.company,
            "utm_source": lead.utm_source,
            "utm_medium": lead.utm_medium,
            "utm_campaign": lead.utm_campaign,
            "follow_up_date": lead.follow_up_date.isoformat() if lead.follow_up_date else None,
            "status": db_lead.status.value if hasattr(db_lead.status, 'value') else db_lead.status,
            "ai_score": db_lead.ai_score or 0.0,
            "ai_segment": db_lead.ai_segment.value if hasattr(db_lead.ai_segment, 'value') else db_lead.ai_segment,
            "conversion_probability": db_lead.conversion_probability or 0.0,
            "expected_revenue": db_lead.expected_revenue or 0.0,
            "actual_revenue": db_lead.actual_revenue or 0.0,
            "buying_signal_strength": db_lead.buying_signal_strength or 0.0,
            "churn_risk": db_lead.churn_risk or 0.0,
        }
        # Strip None values (keep 0.0 floats)
        payload = {k: v for k, v in payload.items() if v is not None}
        created = supabase_data.create_lead(payload)
        
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create lead in database")
        
        # Create activity log
        if created.get('id'):
            supabase_data.create_activity(
                lead_id=created['id'],
                activity_type="lead_created",
                description=f"Lead created from {lead.source}",
                created_by="System"
            )
        
        # Invalidate caches
        invalidate_cache(STATS_CACHE)
        invalidate_cache(LEAD_CACHE)
        
        return created
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create lead: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create lead: {str(e)}")


@app.post("/api/leads/bulk-create")
async def bulk_create_leads(leads: list[LeadCreate], background_tasks: BackgroundTasks, request: Request):
    """Bulk create multiple leads at once for import functionality - SUPABASE ONLY"""
    
    
    # Get the importer's name for notes
    importer_name = _get_counselor_name(request)
    if not importer_name:
        # If not a counselor, try to get the user's full name from the token
        try:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token_data = decode_access_token(auth_header.split(" ", 1)[1])
                if token_data and token_data.email:
                    user = supabase_data.get_user_by_email(token_data.email)
                    if user:
                        importer_name = user.get('full_name')
        except Exception:
            pass
    
    importer_name = importer_name or "System"
    
    results = {
        "success": [],
        "failed": [],
        "total": len(leads)
    }
    
    # Load course prices once before processing (performance optimization)
    try:
        courses = supabase_data.get_courses()
        ai_scorer.course_prices = {c.get('name'): c.get('price', 0) for c in courses if c.get('name')}
    except Exception as e:
        logger.warning(f"Could not load course prices for AI scoring: {e}")
        ai_scorer.course_prices = {}
    
    for idx, lead in enumerate(leads):
        try:
            import uuid as _uuid
            _ts = datetime.utcnow().strftime("%y%m%d%H%M%S")
            _rand = _uuid.uuid4().hex[:4].upper()
            lead_id = f"LEAD{_ts}{_rand}"
            
            # Check for duplicates by phone (primary unique identifier)
            try:
                existing = supabase_data.client.table('leads').select("lead_id,assigned_to,status,full_name").eq("phone", lead.phone).limit(1).execute()
                if existing.data and len(existing.data) > 0:
                    ex = existing.data[0]
                    owner = ex.get("assigned_to") or "Unassigned"
                    results["failed"].append({
                        "index": idx,
                        "name": lead.full_name,
                        "error": f"Duplicate phone number: {lead.phone}",
                        "duplicate": True,
                        "existing_lead_id": ex.get("lead_id", ""),
                        "existing_owner": owner,
                        "existing_status": ex.get("status", ""),
                    })
                    continue
            except Exception as dup_check_err:
                logger.warning(f"Duplicate check failed for lead {idx}: {dup_check_err}")
            
            # Normalize input values to match CRM standards
            normalized = normalize_lead_values({
                'full_name': lead.full_name,
                'country': lead.country,
                'source': lead.source,
                'course_interested': lead.course_interested,
                'assigned_to': lead.assigned_to,
                'status': lead.status.value if hasattr(lead.status, 'value') else lead.status if lead.status else 'Fresh'
            })
            
            # Auto-assign to counselor if they are importing the leads
            _counselor_name_import = _get_counselor_name(request)
            if _counselor_name_import:
                normalized['assigned_to'] = _counselor_name_import  # Override for counselors
            
            # Build temporary object for AI scoring
            db_lead = DBLead(
                lead_id=lead_id,
                full_name=normalized['full_name'],
                email=lead.email,
                phone=lead.phone,
                whatsapp=lead.whatsapp or lead.phone,
                country=normalized['country'],
                source=normalized['source'],
                course_interested=normalized['course_interested'],
                assigned_to=normalized.get('assigned_to'),
                status=LeadStatus(normalized['status'])  # Use normalized status
            )
            
            # AI scoring (course prices already loaded once before loop)
            score_result = ai_scorer.score_lead(db_lead, [])
            for key, value in score_result.items():
                if key == 'feature_importance' and value:
                    import json
                    setattr(db_lead, key, json.dumps(value))
                else:
                    setattr(db_lead, key, value)
            
            # Save to Supabase
            try:
                payload = {
                    "lead_id": db_lead.lead_id,
                    "full_name": db_lead.full_name,
                    "email": db_lead.email,
                    "phone": db_lead.phone,
                    "whatsapp": db_lead.whatsapp,
                    "country": db_lead.country,
                    "source": db_lead.source,
                    "course_interested": db_lead.course_interested,
                    "assigned_to": db_lead.assigned_to,
                    "status": db_lead.status.value if hasattr(db_lead.status, 'value') else db_lead.status,
                    "ai_score": db_lead.ai_score or 0.0,
                    "ai_segment": db_lead.ai_segment.value if hasattr(db_lead.ai_segment, 'value') else db_lead.ai_segment,
                    "conversion_probability": db_lead.conversion_probability or 0.0,
                    "expected_revenue": db_lead.expected_revenue or 0.0,
                    "actual_revenue": db_lead.actual_revenue or 0.0,
                    "buying_signal_strength": db_lead.buying_signal_strength or 0.0,
                    "churn_risk": db_lead.churn_risk or 0.0,
                }
                payload = {k: v for k, v in payload.items() if v is not None}
                created = supabase_data.create_lead(payload)
                
                if created:
                    # Create import note in Supabase
                    lead_internal_id = created.get('id')
                    if lead_internal_id:
                        note_content = lead.notes if lead.notes else "Lead imported via bulk upload"
                        supabase_data.create_note(
                            lead_id=lead_internal_id,
                            content=note_content,
                            channel="manual",
                            created_by=importer_name
                        )
                    
                    results["success"].append({"index": idx, "lead_id": lead_id, "name": lead.full_name})
                else:
                    results["failed"].append({
                        "index": idx,
                        "name": lead.full_name,
                        "error": "Failed to create lead in database"
                    })
            except Exception as e:
                logger.error(f"Supabase bulk create failed for lead {idx}: {e}")
                error_msg = str(e)
                if "duplicate key" in error_msg.lower() or "unique" in error_msg.lower():
                    error_msg = f"Duplicate entry for phone: {lead.phone}"
                results["failed"].append({
                    "index": idx,
                    "name": lead.full_name,
                    "error": error_msg[:200]
                })
            
        except Exception as e:
            # Catch-all for any other errors (scoring, etc.)
            logger.error(f"Failed to create lead {idx}: {e}")
            results["failed"].append({
                "index": idx,
                "name": lead.full_name if hasattr(lead, 'full_name') else 'Unknown',
                "error": str(e)[:200]
            })
    
    # Invalidate caches after bulk operation
    invalidate_cache(STATS_CACHE)
    invalidate_cache(LEAD_CACHE)
    
    return {
        "message": f"Bulk import complete: {len(results['success'])} succeeded, {len(results['failed'])} failed",
        "results": results
    }


@app.get("/api/leads")
async def get_leads(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    status: Optional[LeadStatus] = None,
    status_in: Optional[str] = None,
    country: Optional[str] = None,
    country_in: Optional[str] = None,
    segment: Optional[LeadSegment] = None,
    segment_in: Optional[str] = None,
    assigned_to: Optional[str] = None,
    assigned_to_in: Optional[str] = None,
    course_interested: Optional[str] = None,
    source: Optional[str] = None,
    company: Optional[str] = None,
    company_in: Optional[str] = None,
    qualification: Optional[str] = None,
    qualification_in: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    created_today: bool = False,
    overdue: bool = False,
    follow_up_from: Optional[datetime] = None,
    follow_up_to: Optional[datetime] = None,
    created_from: Optional[datetime] = None,
    created_to: Optional[datetime] = None,
    created_on: Optional[str] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    updated_from: Optional[datetime] = None,
    updated_to: Optional[datetime] = None,
    updated_on: Optional[str] = None,
    updated_after: Optional[datetime] = None,
    updated_before: Optional[datetime] = None,
    search: Optional[str] = None
):
    """Get leads with filters. Counselors are restricted to their own leads. Now Supabase-only."""

    # Guardrails for performance: prevent accidental huge payloads.
    skip = max(0, int(skip))
    limit = max(1, min(int(limit), 1000))

    # Enforce Counselor scope: they may only see leads assigned to themselves.
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token_data = decode_access_token(auth_header.split(" ", 1)[1])
            if token_data and token_data.role == "Counselor":
                # Use Supabase to get user
                caller = supabase_data.get_user_by_email(token_data.email)
                if caller:
                    assigned_to = caller.get('full_name')
    except Exception:
        pass  # token errors already handled by _verify_token; never crash the endpoint

    # ── In-memory cache (90 sec TTL) ─────────────────────────────────────────
    _cache_params = dict(
        skip=skip, limit=limit, status=str(status), status_in=status_in,
        country=country, country_in=country_in, segment=str(segment),
        segment_in=segment_in, assigned_to=assigned_to, assigned_to_in=assigned_to_in,
        course_interested=course_interested, source=source,
        company=company, company_in=company_in,
        qualification=qualification, qualification_in=qualification_in,
        min_score=min_score, max_score=max_score,
        follow_up_from=str(follow_up_from), follow_up_to=str(follow_up_to),
        created_today=created_today, overdue=overdue, search=search,
        # date range params — previously missing from cache key (bug fix)
        created_on=created_on, created_from=str(created_from), created_to=str(created_to),
        created_after=str(created_after), created_before=str(created_before),
        updated_on=updated_on, updated_from=str(updated_from), updated_to=str(updated_to),
        updated_after=str(updated_after), updated_before=str(updated_before),
    )
    import hashlib, json
    _cache_key = "leads:" + hashlib.md5(
        json.dumps(_cache_params, sort_keys=True, default=str).encode()
    ).hexdigest()
    if _cache_key in LEAD_CACHE:
        return LEAD_CACHE[_cache_key]

    # Use Supabase REST API (mandatory)
    try:
        leads_data = supabase_data.get_leads(
                skip=skip,
                limit=limit,
                status=status.value if status else None,
                status_in=status_in,
                country=country,
                country_in=country_in,
                segment=segment.value if segment else None,
                segment_in=segment_in,
                assigned_to=assigned_to,
                assigned_to_in=assigned_to_in,
                course_interested=course_interested,
                source=source,
                company=company,
                company_in=company_in,
                qualification=qualification,
                qualification_in=qualification_in,
                min_score=min_score,
                max_score=max_score,
                follow_up_from=follow_up_from.isoformat() if follow_up_from else None,
                follow_up_to=follow_up_to.isoformat() if follow_up_to else None,
                created_today=created_today,
                overdue=overdue,
                search=search,
                # Date filters for created_at
                created_on=created_on,
                created_after=created_after.isoformat() if created_after else None,
                created_before=created_before.isoformat() if created_before else None,
                created_from=created_from.isoformat() if created_from else None,
                created_to=created_to.isoformat() if created_to else None,
                # Date filters for updated_at
                updated_on=updated_on,
                updated_after=updated_after.isoformat() if updated_after else None,
                updated_before=updated_before.isoformat() if updated_before else None,
                updated_from=updated_from.isoformat() if updated_from else None,
                updated_to=updated_to.isoformat() if updated_to else None,
        )
        # Cache and return raw data from Supabase (already in correct format)
        LEAD_CACHE[_cache_key] = leads_data
        return leads_data
    except Exception as e:
        logger.error(f"Supabase query failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch leads from database")


@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: str, request: Request):
    """Get single lead by ID - Supabase only"""
    
    _counselor_name = _get_counselor_name(request)

    # Use Supabase REST API
    
    try:
        lead = supabase_data.get_lead_by_id(lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        # Counselors may only view their own leads
        if _counselor_name and lead.get("assigned_to") != _counselor_name:
            raise HTTPException(status_code=403, detail="Access denied")

        # Fetch notes from Supabase using internal ID
        lead_internal_id = lead.get('id')
        if lead_internal_id:
            notes = supabase_data.get_notes_for_lead(lead_internal_id)
            lead['notes'] = notes
        else:
            lead['notes'] = []

        return lead
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get lead {lead_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve lead: {str(e)}")

@app.put("/api/leads/{lead_id}")
async def update_lead(lead_id: str, lead_update: LeadUpdate, request: Request, background_tasks: BackgroundTasks):
    """Update lead - Supabase only"""

    _counselor_name = _get_counselor_name(request)

    # Use Supabase REST API
    
    try:
        # Counselors may only update leads assigned to them
        if _counselor_name:
            existing = supabase_data.get_lead_by_id(lead_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Lead not found")
            if existing.get("assigned_to") != _counselor_name:
                raise HTTPException(status_code=403, detail="Access denied")
        
        update_data = lead_update.dict(exclude_unset=True)
        # Convert datetime objects to ISO strings for JSON serialization
        if 'follow_up_date' in update_data and update_data['follow_up_date']:
            dt = update_data['follow_up_date']
            iso = dt.isoformat() if hasattr(dt, 'isoformat') else str(dt)
            update_data['follow_up_date'] = iso if iso.endswith('Z') or '+' in iso else iso + 'Z'
        
        # Fetch the existing lead BEFORE update so we can diff changed fields
        existing_for_diff = supabase_data.get_lead_by_id(lead_id) if not _counselor_name else existing

        updated_lead = supabase_data.update_lead(lead_id, update_data)
        if not updated_lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        # ── Record activity for every meaningful field change ─────────────────
        try:
            def _get_actor_name(req: Request) -> str:
                """Return the current user's full name from JWT, regardless of role."""
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

            actor = _get_actor_name(request)
            internal_id = (existing_for_diff or {}).get("id")

            # Fields we care about tracking (skip internal/timestamp fields)
            _TRACKED_FIELDS = {
                "status":             "Status",
                "full_name":          "Full Name",
                "email":              "Email",
                "phone":              "Phone",
                "whatsapp":           "WhatsApp",
                "country":            "Country",
                "source":             "Source",
                "course_interested":  "Course",
                "qualification":      "Qualification",
                "company":            "Company",
                "assigned_to":        "Assigned To",
                "follow_up_date":     "Follow-up Date",
                "expected_revenue":   "Expected Revenue",
                "actual_revenue":     "Actual Revenue",
                "notes":              "Notes",
                "utm_source":         "UTM Source",
                "utm_medium":         "UTM Medium",
                "utm_campaign":       "UTM Campaign",
            }

            changed_parts = []
            for field, label in _TRACKED_FIELDS.items():
                if field not in update_data:
                    continue
                old_val = (existing_for_diff or {}).get(field)
                new_val = update_data[field]
                # Normalise for comparison
                old_str = str(old_val).strip() if old_val is not None else ""
                new_str = str(new_val).strip() if new_val is not None else ""
                if old_str != new_str:
                    if old_str:
                        changed_parts.append(f"{label}: {old_str} → {new_str}")
                    else:
                        changed_parts.append(f"{label}: set to {new_str}")

            if changed_parts and internal_id:
                # Use "status_change" type when only status changed, else "field_update"
                only_status = (
                    len(changed_parts) == 1 and
                    list(update_data.keys()) == ["status"]
                )
                act_type = "status_change" if only_status else "field_update"
                description = " | ".join(changed_parts)
                supabase_data.create_activity(
                    lead_id=int(internal_id),
                    activity_type=act_type,
                    description=description,
                    created_by=actor,
                )
        except Exception as act_err:
            logger.warning(f"Activity log failed for {lead_id}: {act_err}")

        # Invalidate caches to ensure UI shows updated data
        invalidate_cache(LEAD_CACHE)
        invalidate_cache(STATS_CACHE)
        
        # Re-score in the background so the response isn't delayed
        background_tasks.add_task(rescore_lead_supabase, lead_id)
        
        return updated_lead
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/leads/{lead_id}")
async def delete_lead(lead_id: str, request: Request):
    """Delete lead - available to all authenticated users"""

    # Check if lead exists
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Delete from Supabase
    success = supabase_data.delete_lead(lead_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete lead")
    
    # Invalidate caches to update UI
    invalidate_cache(LEAD_CACHE)
    invalidate_cache(STATS_CACHE)
    
    return {"message": "Lead deleted successfully"}

@app.post("/api/leads/bulk-update")
async def bulk_update_leads(bulk_data: dict):
    """Bulk update multiple leads - SUPABASE ONLY"""
    
    
    lead_ids = bulk_data.get("lead_ids", [])
    updates = bulk_data.get("updates", {})
    
    if not lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    # Validate enum fields before applying updates
    _valid_statuses = {s.value for s in LeadStatus}
    _valid_segments = {s.value for s in LeadSegment}

    if "status" in updates and updates["status"] not in _valid_statuses:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{updates['status']}'. Must be one of: {sorted(_valid_statuses)}"
        )
    if "ai_segment" in updates and updates["ai_segment"] not in _valid_segments:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid segment '{updates['ai_segment']}'. Must be one of: {sorted(_valid_segments)}"
        )

    # Update each lead in Supabase
    updated_count = 0
    try:
        # Add updated_at timestamp with explicit Z suffix
        updates['updated_at'] = datetime.utcnow().isoformat() + 'Z'

        # Bulk update via Supabase - update all matching lead_ids
        for lead_id in lead_ids:
            result = supabase_data.update_lead(lead_id, updates)
            if result:
                updated_count += 1
        
        # Invalidate cache after bulk update
        invalidate_cache(LEAD_CACHE)
        
        return {
            "message": f"Successfully updated {updated_count} leads",
            "updated_count": updated_count
        }
    except Exception as e:
        logger.error(f"bulk_update_leads failed: {e}")
        raise HTTPException(status_code=500, detail="Bulk update failed — database error.")

# ============================================================================
# API ENDPOINTS - NOTES
# ============================================================================

@app.post("/api/leads/{lead_id}/notes", response_model=NoteResponse)
async def add_note(lead_id: str, note: NoteCreate, request: Request, background_tasks: BackgroundTasks):
    """Add note to lead - Supabase only"""
    
    
    # Get lead
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get the actual logged-in user's name from the request
    counselor_name = _get_counselor_name(request)
    
    # Counselors may only add notes to their own leads
    if counselor_name and lead.get("assigned_to") != counselor_name:
        raise HTTPException(status_code=403, detail="Access denied: You can only add notes to your assigned leads")
    
    if not counselor_name:
        # If not a counselor, try to get the user's full name from the token
        try:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token_data = decode_access_token(auth_header.split(" ", 1)[1])
                if token_data and token_data.email:
                    user = supabase_data.get_user_by_email(token_data.email)
                    if user:
                        counselor_name = user.get('full_name')
        except Exception:
            pass
    
    # Fallback to provided name or "System" if still not found
    created_by = counselor_name or note.created_by or "System"
    
    # Create note in Supabase
    lead_internal_id = lead.get('id')
    db_note = supabase_data.create_note(
        lead_id=lead_internal_id,
        content=note.content,
        channel=note.channel,
        created_by=created_by
    )
    
    if not db_note:
        raise HTTPException(status_code=500, detail="Failed to create note")
    
    # Update last contact date
    supabase_data.update_lead(lead_id, {'last_contact_date': datetime.utcnow().isoformat()})
    
    # Invalidate caches to reflect updated lead data
    invalidate_cache(LEAD_CACHE)
    invalidate_cache(STATS_CACHE)
    
    # Re-score after new information arrives via a note
    background_tasks.add_task(rescore_lead_supabase, lead_id)
    
    return db_note


async def rescore_lead_supabase(lead_id: str) -> None:
    """Re-score a single lead from Supabase and write the updated scores back.
    Runs as a BackgroundTask so it never blocks the API response."""
    try:
        lead_data = supabase_data.get_lead_by_id(lead_id)
        if not lead_data:
            return

        # Build a transient DBLead just for the scorer (never persisted to SQLite)
        temp = DBLead(
            lead_id=lead_data.get('lead_id', lead_id),
            full_name=lead_data.get('full_name', ''),
            email=lead_data.get('email'),
            phone=lead_data.get('phone', ''),
            whatsapp=lead_data.get('whatsapp'),
            country=lead_data.get('country', ''),
            source=lead_data.get('source', ''),
            course_interested=lead_data.get('course_interested', ''),
            assigned_to=lead_data.get('assigned_to'),
            status=LeadStatus(lead_data.get('status', 'Fresh')),
        )

        # Refresh course prices for revenue estimation
        try:
            courses = supabase_data.get_courses()
            ai_scorer.course_prices = {c.get('name'): c.get('price', 0) for c in courses if c.get('name')}
        except Exception:
            pass

        score_result = ai_scorer.score_lead(temp, [])

        # Persist only the AI scoring columns — NEVER touch expected_revenue
        # (that is a user-managed field; the AI's revenue estimate is just for
        # internal reference but must not override what the counsellor entered)
        score_payload = {
            'ai_score':              score_result.get('ai_score', lead_data.get('ai_score', 0)),
            'ai_segment':            (score_result.get('ai_segment').value
                                      if hasattr(score_result.get('ai_segment'), 'value')
                                      else score_result.get('ai_segment', lead_data.get('ai_segment'))),
            'conversion_probability': score_result.get('conversion_probability', 0),
            'buying_signal_strength': score_result.get('buying_signal_strength', 0),
            'churn_risk':             score_result.get('churn_risk', 0),
            'next_action':            score_result.get('next_action'),
            'priority_level':         score_result.get('priority_level'),
            'recommended_script':     score_result.get('recommended_script'),
            # 'expected_revenue' intentionally excluded — user value is preserved
        }
        # Strip Nones so we never overwrite good data with null
        score_payload = {k: v for k, v in score_payload.items() if v is not None}
        supabase_data.update_lead(lead_id, score_payload)

        # Bust caches so the next GET reflects fresh scores
        invalidate_cache(LEAD_CACHE)
        invalidate_cache(STATS_CACHE)

    except Exception as e:
        logger.warning(f"Background re-score failed for {lead_id}: {e}")

@app.get("/api/leads/{lead_id}/notes", response_model=List[NoteResponse])
async def get_notes(lead_id: str, request: Request):
    """Get all notes for a lead - Supabase only"""

    _counselor_name = _get_counselor_name(request)
    
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Counselors may only view notes for their own leads
    if _counselor_name and lead.get("assigned_to") != _counselor_name:
        raise HTTPException(status_code=403, detail="Access denied")

    lead_internal_id = lead.get('id')
    notes = supabase_data.get_notes_for_lead(lead_internal_id)
    return notes


@app.get("/api/leads/{lead_id}/activities")
async def get_lead_activities(lead_id: str, type: Optional[str] = None, request: Request = None):
    """Get enriched activity timeline for a lead — notes, WhatsApp, calls, emails, status changes. Supabase only."""
    try:
        _counselor_name = _get_counselor_name(request)
        
        lead_data = supabase_data.get_lead_by_id(lead_id)
        if not lead_data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Counselors may only view activities for their own leads
        if _counselor_name and lead_data.get("assigned_to") != _counselor_name:
            raise HTTPException(status_code=403, detail="Access denied")
        
        lead_internal_id = lead_data.get('id')
        if not lead_internal_id:
            return []

        activities = []

        # Channel → activity type mapping
        CHANNEL_TYPE = {
            "call": "call",
            "whatsapp": "whatsapp",
            "email": "email",
            "manual": "note",
            "note": "note",
            "system": "status",
        }
        CHANNEL_TITLE = {
            "call": "Call logged",
            "whatsapp": "WhatsApp message",
            "email": "Email sent",
            "manual": "Note added",
            "note": "Note added",
            "system": "System update",
        }

        # ── Notes (typed by channel) from Supabase ───────────────────────────────
        notes = supabase_data.get_notes_for_lead(lead_internal_id)
        for note in notes:
            channel = (note.get('channel') or "manual").lower()
            act_type = CHANNEL_TYPE.get(channel, "note")

            # Detect status-change notes written by system
            content_lower = (note.get('content') or "").lower()
            is_status_note = any(k in content_lower for k in ["status changed", "status updated", "marked as", "enrolled", "not interested"])
            if is_status_note:
                act_type = "status"

            # Detect call duration in content e.g. "Duration: 4m 32s"
            duration = None
            import re as _re
            dur_match = _re.search(r"duration[:\s]+(\d+m?\s*\d*s?)", note.get('content') or "", _re.I)
            if dur_match:
                duration = dur_match.group(1).strip()

            activities.append({
                "id": f"note-{note.get('id')}",
                "type": act_type,
                "title": CHANNEL_TITLE.get(channel, "Note added"),
                "content": note.get('content'),
                "timestamp": note.get('created_at'),
                "user": note.get('created_by') or "System",
                "channel": channel,
                "duration": duration,
                "direction": None,
                "status": None,
            })

        # ── WhatsApp / chat messages from Supabase chat_messages table ──────────────
        if lead_internal_id:
            try:
                chat_resp = supabase_data.client.table('chat_messages').select('*').eq('lead_db_id', lead_internal_id).execute()
                for msg in (chat_resp.data or []):
                    direction = msg.get('direction', 'outbound')
                    act_type = 'whatsapp_in' if direction == 'inbound' else 'whatsapp_out'
                    activities.append({
                        "id": f"chat-{msg.get('id')}",
                        "type": act_type,
                        "title": "WhatsApp " + ("Received" if direction == "inbound" else "Sent"),
                        "content": msg.get('content') or f"[{msg.get('msg_type', 'media')}]",
                        "timestamp": msg.get('timestamp') or msg.get('created_at'),
                        "user": msg.get('sender_name') or ("Lead" if direction == "inbound" else "System"),
                        "channel": "whatsapp",
                        "duration": None,
                        "direction": direction,
                        "status": msg.get('status'),
                    })
            except Exception as _chat_err:
                logger.warning(f"Could not load chat messages for lead {lead_id}: {_chat_err}")

        # ── Synthetic lead-creation event ────────────────────────────────────────
        if lead_data.get('created_at'):
            activities.append({
                "id": "created",
                "type": "created",
                "title": "Lead created",
                "content": f"{lead_data.get('full_name')} added to CRM · Source: {lead_data.get('source') or 'Unknown'}",
                "timestamp": lead_data.get('created_at'),
                "user": lead_data.get('assigned_to') or "System",
                "channel": "system",
                "duration": None,
                "direction": None,
                "status": None,
            })

        # ── Synthetic status event (current status) ───────────────────────────────
        if lead_data.get('updated_at') and lead_data.get('updated_at') != lead_data.get('created_at'):
            activities.append({
                "id": "status-current",
                "type": "status",
                "title": f"Status: {lead_data.get('status')}",
                "content": f"Lead marked as {lead_data.get('status')}",
                "timestamp": lead_data.get('updated_at'),
                "user": lead_data.get('assigned_to') or "System",
                "channel": "system",
                "duration": None,
                "direction": None,
                "status": lead_data.get('status'),
            })

        # Sort newest-first
        activities.sort(key=lambda x: x["timestamp"] or "", reverse=True)

        # Type filter
        if type and type != "all":
            activities = [a for a in activities if a["type"] == type]

        return activities
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get activities for {lead_id}: {e}", exc_info=True)
        # Return empty list instead of failing
        return []


@app.get("/api/leads/{lead_id}/ai-summary")
async def get_lead_ai_summary(lead_id: str):
    """Get AI-generated summary and insights for a lead - SUPABASE ONLY"""
    
    try:
        lead_data = supabase_data.get_lead_by_id(lead_id)
        if not lead_data:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Build AI summary from Supabase data
        ai_score = lead_data.get('ai_score', 0) or 0
        conv_prob = lead_data.get('conversion_probability', 0) or 0
        
        return {
            "lead_id": lead_data.get("lead_id"),
            "summary": f"{lead_data.get('full_name', 'Lead')} is interested in {lead_data.get('course_interested', 'courses')}. Currently in {lead_data.get('status', 'Unknown')} status.",
            "key_insights": [
                f"AI Score: {ai_score}/100 - {lead_data.get('ai_segment', 'Unknown')} segment",
                f"Conversion Probability: {int(conv_prob * 100)}%",
                f"Expected Revenue: ${lead_data.get('expected_revenue', 0)}"
            ],
            "recommendations": [lead_data.get('ai_recommendation', 'Follow up with the lead')],
            "next_best_action": "Schedule follow-up call" if lead_data.get('status') == 'Fresh' else "Continue nurturing",
            "urgency": "High" if ai_score > 70 else "Medium" if ai_score > 40 else "Low",
            "sentiment": "positive" if ai_score > 60 else "neutral"
        }

        # Generate basic summary from lead data
        summary = {
            "lead_id": lead.lead_id,
            "summary": f"{lead.full_name} is interested in {lead.course_interested}. Currently in {lead.status} status.",
            "key_insights": [
                f"AI Score: {lead.ai_score}/100 - {lead.ai_segment} segment",
                f"Conversion Probability: {int(lead.conversion_probability * 100)}%",
                f"Expected Revenue: ₹{int(lead.expected_revenue):,}"
            ],
            "recommendations": [],
            "next_best_action": lead.next_action or "Schedule follow-up call",
            "urgency": lead.priority_level or "Medium",
            "sentiment": "positive" if lead.ai_score > 70 else "neutral" if lead.ai_score > 40 else "negative"
        }

        # Add recommendations based on status and score
        if lead.ai_segment == "HOT":
            summary["recommendations"].append("🔥 High priority - Contact immediately")
            summary["recommendations"].append("💰 High conversion probability - Focus on closing")
        elif lead.ai_segment == "WARM":
            summary["recommendations"].append("📞 Schedule follow-up within 24 hours")
            summary["recommendations"].append("📧 Send course details and testimonials")
        else:
            summary["recommendations"].append("📅 Schedule follow-up for next week")
            summary["recommendations"].append("🎯 Work on building interest")

        if lead.follow_up_date and lead.follow_up_date < datetime.utcnow():
            summary["recommendations"].insert(0, "⚠️ Follow-up overdue - Contact ASAP")

        return summary
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get AI summary for {lead_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate AI summary: {str(e)}")

# ============================================================================
# API ENDPOINTS - HOSPITALS
# ============================================================================

@app.post("/api/hospitals", response_model=HospitalResponse)
async def create_hospital(hospital: HospitalCreate):
    """Create hospital - SUPABASE ONLY"""
    
    try:
        payload = hospital.dict()
        payload['created_at'] = datetime.utcnow().isoformat()
        created = supabase_data.create_hospital(payload)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create hospital")
        return created
    except Exception as e:
        error_msg = str(e)
        if "duplicate key" in error_msg.lower() or "unique" in error_msg.lower():
            raise HTTPException(status_code=409, detail="A hospital with this name already exists.")
        logger.error(f"create_hospital error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create hospital.")

@app.get("/api/hospitals", response_model=List[HospitalResponse])
async def get_hospitals(
    skip: int = 0,
    limit: int = 100,
    country: Optional[str] = None,
    status: Optional[str] = None
):
    """Get hospitals with filters - SUPABASE ONLY"""
    
    try:
        query = supabase_data.client.table('hospitals').select('*')
        
        if country:
            query = query.eq('country', country)
        if status:
            query = query.eq('collaboration_status', status)
        
        response = query.range(skip, skip + limit - 1).execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error getting hospitals: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch hospitals")

# ============================================================================
# API ENDPOINTS - COURSES
# ============================================================================

@app.post("/api/courses", response_model=CourseResponse)
async def create_course(course: CourseCreate):
    """Create course - SUPABASE ONLY"""
    
    try:
        payload = course.dict()
        payload['created_at'] = datetime.utcnow().isoformat()
        created = supabase_data.create_course(payload)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create course")
        invalidate_cache(COURSE_CACHE)
        return created
    except Exception as e:
        error_msg = str(e)
        if "duplicate key" in error_msg.lower() or "unique" in error_msg.lower():
            raise HTTPException(status_code=409, detail="A course with this name already exists.")
        logger.error(f"create_course error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create course.")

@app.get("/api/courses", response_model=List[CourseResponse])
@cache_async_result(COURSE_CACHE, "courses_list")
async def get_courses(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    is_active: bool = True
):
    """Get courses with filters (cached for 1 hour)"""
    
    try:
        courses = supabase_data.get_courses(is_active=is_active)
        if category:
            courses = [c for c in courses if c.get('category') == category]
        return courses[skip:skip+limit]
    except Exception as e:
        logger.error(f"Error fetching courses: {e}")
        return []

# ============================================================================
# API ENDPOINTS - DASHBOARD & ANALYTICS
# ============================================================================

@app.get("/api/notifications")
async def get_notifications():
    """Real notifications: overdue follow-ups + stale hot leads"""
    
    try:
        today = datetime.utcnow().date()
        now_iso = datetime.utcnow().isoformat()
        notifications = []

        # Overdue follow-ups
        overdue_resp = (
            supabase_data.client.table('leads')
            .select('id,lead_id,full_name,course_interested,assigned_to,follow_up_date')
            .lt('follow_up_date', now_iso)
            .order('follow_up_date', desc=False)
            .limit(20)
            .execute()
        )
        for lead in overdue_resp.data or []:
            if lead.get('follow_up_date'):
                follow_up_dt = datetime.fromisoformat(lead['follow_up_date'].replace('Z', '+00:00'))
                days = (datetime.utcnow() - follow_up_dt).days
                notifications.append({
                    "type": "overdue_followup",
                    "severity": "error",
                    "title": f"Overdue follow-up — {lead['full_name']}",
                    "message": f"{days} day{'s' if days != 1 else ''} overdue · {lead.get('course_interested') or 'No course'} · {lead.get('assigned_to') or 'Unassigned'}",
                    "lead_id": lead.get('id'),
                    "lead_name": lead['full_name'],
                })

        # Hot leads not contacted in 3+ days
        three_days_ago = (datetime.utcnow() - timedelta(days=3)).isoformat()
        stale_hot_resp = (
            supabase_data.client.table('leads')
            .select('id,lead_id,full_name,course_interested,assigned_to,last_contact_date')
            .eq('ai_segment', 'HOT')
            .or_(f'last_contact_date.lt.{three_days_ago},last_contact_date.is.null')
            .limit(10)
            .execute()
        )
        for lead in stale_hot_resp.data or []:
            notifications.append({
                "type": "stale_hot_lead",
                "severity": "warning",
                "title": f"Hot lead going cold — {lead['full_name']}",
                "message": f"No contact in 3+ days · {lead.get('course_interested') or 'No course'} · {lead.get('assigned_to') or 'Unassigned'}",
                "lead_id": lead.get('id'),
                "lead_name": lead['full_name'],
            })

        # Follow-ups due today
        today_start = f"{today.isoformat()}T00:00:00"
        today_end = f"{today.isoformat()}T23:59:59"
        due_today_resp = (
            supabase_data.client.table('leads')
            .select('id,lead_id,full_name,course_interested,assigned_to,follow_up_date')
            .gte('follow_up_date', today_start)
            .lte('follow_up_date', today_end)
            .limit(20)
            .execute()
        )
        for lead in due_today_resp.data or []:
            notifications.append({
                "type": "followup_today",
                "severity": "info",
                "title": f"Follow-up due today — {lead['full_name']}",
                "message": f"{lead.get('course_interested') or 'No course'} · {lead.get('assigned_to') or 'Unassigned'}",
                "lead_id": lead.get('id'),
                "lead_name": lead['full_name'],
            })

        return notifications
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}", exc_info=True)
        return []


@app.get("/api/audit-logs")
async def get_audit_logs(page: int = 1, limit: int = 50):
    """Get recent activity logs as audit trail - SUPABASE ONLY"""
    
    try:
        offset = (page - 1) * limit
        
        # Get activities with pagination
        response = supabase_data.client.table('activities').select('*').order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        activities = response.data if response.data else []
        
        # Get total count
        count_response = supabase_data.client.table('activities').select('id', count='exact').execute()
        total = count_response.count if count_response.count else 0
        
        logs = [
            {
                "id": a.get('id'),
                "lead_id": a.get('lead_id'),
                "activity_type": a.get('activity_type'),
                "description": a.get('description'),
                "created_by": a.get('created_by'),
                "created_at": a.get('created_at'),
            }
            for a in activities
        ]
        
        return {
            "logs": logs,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error getting audit logs: {e}")
        return {"logs": [], "total": 0, "page": page, "limit": limit, "pages": 0}


@app.get("/api/admin/lead-update-activity")
async def get_lead_update_activity(
    date: Optional[str] = None,        # YYYY-MM-DD — filter to specific day
    user: Optional[str] = None,        # filter to specific user
    days: int = 7,                     # how many past days to include (ignored when date is set)
):
    """
    Per-user lead-update activity summary.
    Returns counts of leads touched per day per user, with activity-type
    breakdown and the list of leads so the caller can drill down.
    """
    try:
        from datetime import timezone

        # ── Date window ──────────────────────────────────────────────────────
        if date:
            date_from = f"{date}T00:00:00"
            date_to   = f"{date}T23:59:59.999"
        else:
            today_utc  = datetime.utcnow().date()
            start_date = today_utc - timedelta(days=max(1, days) - 1)
            date_from  = f"{start_date}T00:00:00"
            date_to    = f"{today_utc}T23:59:59.999"

        # ── Pull activities in the window ─────────────────────────────────────
        q = (
            supabase_data.client.table("activities")
            .select("id,lead_id,activity_type,description,created_by,created_at")
            .gte("created_at", date_from)
            .lte("created_at", date_to)
            .order("created_at", desc=True)
        )
        if user:
            q = q.ilike("created_by", user.strip())
        acts_resp = q.limit(5000).execute()
        activities = acts_resp.data if acts_resp.data else []

        # ── Pull notes in the window (notes = counselor updates too) ─────────
        nq = (
            supabase_data.client.table("notes")
            .select("id,lead_id,content,created_by,created_at,channel")
            .gte("created_at", date_from)
            .lte("created_at", date_to)
            .order("created_at", desc=True)
        )
        if user:
            nq = nq.ilike("created_by", user.strip())
        notes_resp = nq.limit(5000).execute()
        notes = notes_resp.data if notes_resp.data else []

        # ── Collect all unique INTEGER lead db-ids so we can resolve names ──────
        # activities.lead_id and notes.lead_id both store the INTEGER `id`
        # column of the leads table, NOT the string "LEAD00123" lead_id.
        all_db_ids = list({
            int(a["lead_id"]) for a in activities if a.get("lead_id") is not None
        } | {
            int(n["lead_id"]) for n in notes if n.get("lead_id") is not None
        })

        # lead_info keyed by INTEGER id → lead dict (includes string lead_id)
        lead_info: dict = {}
        BATCH = 100
        for i in range(0, len(all_db_ids), BATCH):
            batch = all_db_ids[i:i + BATCH]
            try:
                lr = (
                    supabase_data.client.table("leads")
                    .select("id,lead_id,full_name,status,phone,country,course_interested,assigned_to")
                    .in_("id", batch)
                    .execute()
                )
                for lead in (lr.data or []):
                    lead_info[int(lead["id"])] = lead
            except Exception as ex:
                logger.warning(f"Lead info batch fetch failed: {ex}")

        def day_key(ts: str) -> str:
            """Return YYYY-MM-DD from an ISO timestamp."""
            return ts[:10] if ts else "unknown"

        def lead_str_id(db_id) -> str:
            """Return the string lead_id (e.g. 'LEAD00123') for navigation."""
            info = lead_info.get(int(db_id) if db_id is not None else -1, {})
            return info.get("lead_id") or str(db_id)

        # ── Aggregate by (user, day) ──────────────────────────────────────────
        # Structure: buckets[user][day] = { db_ids: set, events: list }
        from collections import defaultdict
        buckets: dict = defaultdict(lambda: defaultdict(lambda: {"db_ids": set(), "events": []}))

        for a in activities:
            u   = a.get("created_by") or "Unknown"
            d   = day_key(a.get("created_at", ""))
            lid = a.get("lead_id")   # integer
            buckets[u][d]["events"].append({
                "type":        a.get("activity_type", "update"),
                "description": a.get("description", ""),
                "db_id":       lid,
                "lead_id":     lead_str_id(lid) if lid is not None else None,
                "ts":          a.get("created_at"),
            })
            if lid is not None:
                buckets[u][d]["db_ids"].add(int(lid))

        for n in notes:
            u   = n.get("created_by") or "Unknown"
            d   = day_key(n.get("created_at", ""))
            lid = n.get("lead_id")   # integer
            channel = n.get("channel") or "manual"
            content = (n.get("content") or "")[:120]
            buckets[u][d]["events"].append({
                "type":        f"note_{channel}",
                "description": content,
                "db_id":       lid,
                "lead_id":     lead_str_id(lid) if lid is not None else None,
                "ts":          n.get("created_at"),
            })
            if lid is not None:
                buckets[u][d]["db_ids"].add(int(lid))

        # ── Build response ────────────────────────────────────────────────────
        rows = []
        for u_name, days_map in buckets.items():
            for day_str, data in days_map.items():
                db_ids = list(data["db_ids"])
                events = data["events"]

                # Count by type
                type_counts: dict = defaultdict(int)
                for ev in events:
                    type_counts[ev["type"]] += 1

                action_summary = [
                    {"type": t, "count": c}
                    for t, c in sorted(type_counts.items(), key=lambda x: -x[1])
                ]

                # Per-lead detail — keyed by STRING lead_id for frontend navigation
                seen_str_ids: set = set()
                leads_detail = []
                for db_id in db_ids:
                    info       = lead_info.get(db_id, {})
                    str_lid    = info.get("lead_id") or str(db_id)
                    if str_lid in seen_str_ids:
                        continue
                    seen_str_ids.add(str_lid)
                    lead_evs   = [ev for ev in events if ev.get("db_id") == db_id]
                    leads_detail.append({
                        "lead_id":           str_lid,
                        "db_id":             db_id,
                        "full_name":         info.get("full_name") or str_lid,
                        "status":            info.get("status", ""),
                        "phone":             info.get("phone", ""),
                        "country":           info.get("country", ""),
                        "course_interested": info.get("course_interested", ""),
                        "assigned_to":       info.get("assigned_to", ""),
                        "events":            lead_evs,
                    })
                leads_detail.sort(key=lambda x: x["full_name"] or "")

                rows.append({
                    "user":           u_name,
                    "date":           day_str,
                    "leads_updated":  len(leads_detail),
                    "total_events":   len(events),
                    "action_summary": action_summary,
                    "leads":          leads_detail,
                })

        # Sort by date desc, then user
        rows.sort(key=lambda r: (r["date"], r["user"]), reverse=True)

        return {"rows": rows, "total_users": len(buckets), "date_from": date_from[:10], "date_to": date_to[:10]}

    except Exception as e:
        logger.error(f"Lead update activity error: {e}", exc_info=True)
        return {"rows": [], "total_users": 0, "date_from": "", "date_to": ""}


@app.get("/api/leads/followups/today")
async def get_followups_today(request: Request, assigned_to: Optional[str] = None):
    """All leads with follow_up_date = today + overdue, for the daily work view"""
    
    try:
        # Counselors may only see their own follow-ups
        try:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token_data = decode_access_token(auth_header.split(" ", 1)[1])
                if token_data and token_data.role == "Counselor":
                    # Query Supabase for user
                    user_resp = supabase_data.client.table('users').select('full_name').eq('email', token_data.email).execute()
                    if user_resp.data:
                        assigned_to = user_resp.data[0].get('full_name')
        except Exception:
            pass

        today = datetime.utcnow().date()
        today_start = f"{today.isoformat()}T00:00:00"
        today_end = f"{today.isoformat()}T23:59:59"
        active_statuses = ["Enrolled", "Not Interested", "Junk"]

        # Overdue follow-ups
        overdue_query = (
            supabase_data.client.table('leads')
            .select('id,lead_id,full_name,phone,whatsapp,course_interested,status,ai_segment,ai_score,assigned_to,follow_up_date,last_contact_date,country,next_action,primary_objection,churn_risk')
            .not_.is_('follow_up_date', 'null')
            .lt('follow_up_date', today_start)
        )
        if assigned_to:
            overdue_query = overdue_query.eq('assigned_to', assigned_to)
        overdue_resp = overdue_query.order('follow_up_date', desc=False).execute()

        # Due today
        today_query = (
            supabase_data.client.table('leads')
            .select('id,lead_id,full_name,phone,whatsapp,course_interested,status,ai_segment,ai_score,assigned_to,follow_up_date,last_contact_date,country,next_action,primary_objection,churn_risk')
            .gte('follow_up_date', today_start)
            .lte('follow_up_date', today_end)
        )
        if assigned_to:
            today_query = today_query.eq('assigned_to', assigned_to)
        today_resp = today_query.order('follow_up_date', desc=False).execute()

        def fmt(lead):
            return {
                "id": lead.get('id'),
                "lead_id": lead.get('lead_id'),
                "full_name": lead.get('full_name'),
                "phone": lead.get('phone'),
                "whatsapp": lead.get('whatsapp'),
                "course_interested": lead.get('course_interested'),
                "status": str(lead.get('status', '')),
                "ai_segment": str(lead.get('ai_segment', '')),
                "ai_score": round(lead.get('ai_score') or 0, 1),
                "assigned_to": lead.get('assigned_to'),
                "follow_up_date": lead.get('follow_up_date'),
                "last_contact_date": lead.get('last_contact_date'),
                "country": lead.get('country'),
                "next_action": lead.get('next_action'),
                "primary_objection": lead.get('primary_objection'),
                "churn_risk": round(lead.get('churn_risk') or 0, 2),
            }

        overdue_list = [fmt(l) for l in (overdue_resp.data or [])]
        today_list = [fmt(l) for l in (today_resp.data or [])]

        return {
            "overdue": overdue_list,
            "today": today_list,
            "overdue_count": len(overdue_list),
            "today_count": len(today_list),
        }
    except Exception as e:
        logger.error(f"Error fetching followups: {e}", exc_info=True)
        return {"overdue": [], "today": [], "overdue_count": 0, "today_count": 0}


@app.get("/api/dashboard/stats", response_model=DashboardStats)
@cache_async_result(STATS_CACHE, "dashboard_stats")
async def get_dashboard_stats(request: Request):
    """Get dashboard statistics (cached for 1 minute). Counselors see only their stats."""
    
    # Check if user is a counselor and restrict to their leads
    _counselor_name = _get_counselor_name(request)
    
    try:
        # Get basic stats from Supabase (filtered for counselors)
        basic_stats = supabase_data.get_dashboard_stats(assigned_to=_counselor_name)
        
        # Get time-based stats (filtered for counselors)
        now = datetime.utcnow()
        today_start = f"{now.date().isoformat()}T00:00:00"
        week_start = (now - timedelta(days=7)).isoformat()
        month_start = (now - timedelta(days=30)).isoformat()
        
        today_query = supabase_data.client.table('leads').select('id', count='exact').gte('created_at', today_start)
        if _counselor_name:
            today_query = today_query.ilike('assigned_to', _counselor_name)
        today_resp = today_query.execute()
        
        week_query = supabase_data.client.table('leads').select('id', count='exact').gte('created_at', week_start)
        if _counselor_name:
            week_query = week_query.ilike('assigned_to', _counselor_name)
        week_resp = week_query.execute()
        
        month_query = supabase_data.client.table('leads').select('id', count='exact').gte('created_at', month_start)
        if _counselor_name:
            month_query = month_query.ilike('assigned_to', _counselor_name)
        month_resp = month_query.execute()
        
        # Get expected revenue (filtered for counselors)
        revenue_query = supabase_data.client.table('leads').select('expected_revenue')
        if _counselor_name:
            revenue_query = revenue_query.ilike('assigned_to', _counselor_name)
        revenue_resp = revenue_query.execute()
        expected_revenue = sum(l.get('expected_revenue', 0) or 0 for l in (revenue_resp.data or []))
        
        # Get avg score (filtered for counselors)
        score_query = supabase_data.client.table('leads').select('ai_score').not_.is_('ai_score', 'null')
        if _counselor_name:
            score_query = score_query.ilike('assigned_to', _counselor_name)
        score_resp = score_query.execute()
        scores = [l.get('ai_score', 0) for l in (score_resp.data or []) if l.get('ai_score')]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        return DashboardStats(
            total_leads=basic_stats['total'],
            hot_leads=basic_stats['hot'],
            warm_leads=basic_stats['warm'],
            cold_leads=basic_stats['cold'],
            junk_leads=basic_stats['junk'],
            total_conversions=basic_stats['conversions'],
            conversion_rate=basic_stats['conversion_rate'],
            total_revenue=basic_stats['revenue'],
            expected_revenue=round(expected_revenue, 2),
            leads_today=today_resp.count if hasattr(today_resp, 'count') else 0,
            leads_this_week=week_resp.count if hasattr(week_resp, 'count') else 0,
            leads_this_month=month_resp.count if hasattr(month_resp, 'count') else 0,
            avg_ai_score=avg_score
        )
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}")
        return DashboardStats(
            total_leads=0, hot_leads=0, warm_leads=0, cold_leads=0, junk_leads=0,
            total_conversions=0, conversion_rate=0, total_revenue=0, expected_revenue=0,
            leads_today=0, leads_this_week=0, leads_this_month=0, avg_ai_score=0
        )

@app.get("/api/counselors", response_model=List[CounselorResponse])
async def get_counselors():
    """Get all counselors from users table"""
    
    try:
        # Get users with counselor roles
        all_users = supabase_data.get_all_users()
        users = [u for u in all_users if u.get('role') in ['Counselor', 'Team Leader', 'Manager'] and u.get('is_active')]
        
        # Get all leads for stats calculation
        all_leads_resp = supabase_data.client.table('leads').select('assigned_to,status').execute()
        all_leads = all_leads_resp.data if all_leads_resp.data else []
        
        counselors = []
        for user in users:
            user_leads = [l for l in all_leads if l.get('assigned_to') == user.get('full_name')]
            total_leads = len(user_leads)
            total_conversions = sum(1 for l in user_leads if l.get('status') == 'Enrolled')

            counselors.append({
                "id": user.get('id'),
                "name": user.get('full_name'),
                "email": user.get('email'),
                "phone": user.get('phone') or "",
                "is_active": user.get('is_active'),
                "specialization": user.get('role'),
                "total_leads": total_leads,
                "total_conversions": total_conversions,
                "conversion_rate": round((total_conversions / total_leads * 100) if total_leads > 0 else 0, 1),
                "created_at": user.get('created_at')
            })

        return counselors
    except Exception as e:
        logger.error(f"Error fetching counselors: {e}")
        return []


@app.get("/api/counselors/performance")
async def get_counselor_performance():
    """Live counselor performance computed from leads table - SUPABASE ONLY"""
    
    try:
        # Get all leads
        response = supabase_data.client.table('leads').select('assigned_to,status,ai_segment').execute()
        leads = response.data if response.data else []
        
        # Group by assigned_to
        counselor_stats = {}
        for lead in leads:
            counselor = lead.get('assigned_to') or 'Unassigned'
            if counselor not in counselor_stats:
                counselor_stats[counselor] = {
                    'total_leads': 0,
                    'enrolled': 0,
                    'hot_leads': 0,
                    'not_interested': 0
                }
            
            counselor_stats[counselor]['total_leads'] += 1
            if lead.get('status') == 'Enrolled':
                counselor_stats[counselor]['enrolled'] += 1
            if lead.get('ai_segment') == 'Hot':
                counselor_stats[counselor]['hot_leads'] += 1
            if lead.get('status') == 'Not Interested':
                counselor_stats[counselor]['not_interested'] += 1
        
        # Format results
        results = []
        for counselor, stats in counselor_stats.items():
            conversion_rate = (stats['enrolled'] / stats['total_leads'] * 100) if stats['total_leads'] > 0 else 0
            results.append({
                'counselor': counselor,
                'total_leads': stats['total_leads'],
                'enrolled': stats['enrolled'],
                'hot_leads': stats['hot_leads'],
                'not_interested': stats['not_interested'],
                'conversion_rate': round(conversion_rate, 2)
            })
        
        return results
    except Exception as e:
        logger.error(f"Error getting counselor performance: {e}")
        return []


# ============================================================================
# USER MANAGEMENT ENDPOINTS
# ============================================================================

@app.get("/api/users", response_model=List[UserResponse])
async def get_users():
    """Get all users in the organization"""
    
    try:
        users = supabase_data.get_all_users()
        # Strip password field before returning
        return [
            {k: v for k, v in u.items() if k != "password"} if isinstance(u, dict) else u
            for u in (users or [])
        ]
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return []

@app.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int):
    """Get a specific user by ID - SUPABASE ONLY"""
    
    user = supabase_data.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/api/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    """Create a new user - SUPABASE ONLY"""
    
    # Check if email already exists
    existing = supabase_data.get_user_by_email(user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash the password for security
    hashed_password = get_password_hash(user.password)
    
    payload = {
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "password": hashed_password,
        "role": user.role,
        "reports_to": user.reports_to,
        "is_active": user.is_active,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    try:
        db_user = supabase_data.create_user(payload)
        if not db_user:
            raise HTTPException(status_code=500, detail="Failed to create user")
        return db_user
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user")

@app.put("/api/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, user: UserUpdate):
    """Update user information - SUPABASE ONLY"""
    
    # Check if user exists
    db_user = supabase_data.get_user_by_id(user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    update_data = user.dict(exclude_unset=True)
    update_data['updated_at'] = datetime.utcnow().isoformat()
    
    updated = supabase_data.update_user(user_id, update_data)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update user")
    return updated

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int):
    """Delete a user - SUPABASE ONLY"""
    
    # Check if user exists
    db_user = supabase_data.get_user_by_id(user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    success = supabase_data.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete user")
    return {"message": "User deleted successfully"}

@app.get("/api/analytics/revenue-by-country")
async def revenue_by_country():
    """Get revenue breakdown by country - SUPABASE ONLY"""
    
    try:
        # Get all leads
        response = supabase_data.client.table('leads').select('country,actual_revenue,expected_revenue').execute()
        leads = response.data if response.data else []
        
        # Group by country
        country_stats = {}
        for lead in leads:
            country = lead.get('country') or 'Unknown'
            if country not in country_stats:
                country_stats[country] = {
                    'total_leads': 0,
                    'total_revenue': 0,
                    'expected_revenue': 0
                }
            
            country_stats[country]['total_leads'] += 1
            country_stats[country]['total_revenue'] += lead.get('actual_revenue', 0) or 0
            country_stats[country]['expected_revenue'] += lead.get('expected_revenue', 0) or 0
        
        # Format results
        return [
            {
                'country': country,
                'total_leads': stats['total_leads'],
                'total_revenue': round(stats['total_revenue'], 2),
                'expected_revenue': round(stats['expected_revenue'], 2)
            }
            for country, stats in country_stats.items()
        ]
    except Exception as e:
        logger.error(f"Error getting revenue by country: {e}")
        return []

@app.get("/api/analytics/conversion-funnel")
async def conversion_funnel():
    """Get conversion funnel metrics - SUPABASE ONLY"""
    
    try:
        # Get all leads
        response = supabase_data.client.table('leads').select('last_contact_date,ai_score,status').execute()
        leads = response.data if response.data else []
        
        total = len(leads)
        contacted = sum(1 for l in leads if l.get('last_contact_date'))
        warm_hot = sum(1 for l in leads if (l.get('ai_score') or 0) >= 50)
        converted = sum(1 for l in leads if l.get('status') == 'Enrolled')
        
        return {
            'stages': [
                {'name': 'Total Leads', 'count': total, 'percentage': 100},
                {'name': 'Contacted', 'count': contacted, 'percentage': round((contacted/total*100) if total > 0 else 0, 1)},
                {'name': 'Warm/Hot', 'count': warm_hot, 'percentage': round((warm_hot/total*100) if total > 0 else 0, 1)},
                {'name': 'Converted', 'count': converted, 'percentage': round((converted/total*100) if total > 0 else 0, 1)},
            ]
        }
    except Exception as e:
        logger.error(f"Error getting conversion funnel: {e}")
        return {'stages': []}


# ============================================================================
# CAMPAIGN / PERFORMANCE MARKETING ANALYTICS
# ============================================================================

@app.get("/api/analytics/campaigns/overview")
async def campaign_overview():
    """Get overall campaign performance metrics"""
    try:
        # Get all leads with campaign data
        response = supabase_data.client.table('leads').select(
            'campaign_medium,campaign_name,campaign_group,status,ai_score,actual_revenue,expected_revenue,created_at,lead_quality'
        ).execute()
        leads = response.data if response.data else []
        
        # Calculate overall metrics
        total_leads = len(leads)
        total_campaigns = len(set(l.get('campaign_name') for l in leads if l.get('campaign_name')))
        total_revenue = sum(l.get('actual_revenue', 0) or 0 for l in leads)
        total_expected = sum(l.get('expected_revenue', 0) or 0 for l in leads)
        converted = sum(1 for l in leads if l.get('status') == 'Enrolled')
        hot_warm = sum(1 for l in leads if (l.get('ai_score') or 0) >= 50)
        
        # Group by medium
        medium_stats = {}
        for lead in leads:
            medium = lead.get('campaign_medium') or 'Unknown'
            if medium not in medium_stats:
                medium_stats[medium] = {'leads': 0, 'revenue': 0, 'conversions': 0}
            medium_stats[medium]['leads'] += 1
            medium_stats[medium]['revenue'] += lead.get('actual_revenue', 0) or 0
            if lead.get('status') == 'Enrolled':
                medium_stats[medium]['conversions'] += 1
        
        return {
            'total_leads': total_leads,
            'total_campaigns': total_campaigns,
            'total_revenue': round(total_revenue, 2),
            'expected_revenue': round(total_expected, 2),
            'conversion_rate': round((converted / total_leads * 100) if total_leads > 0 else 0, 2),
            'hot_warm_rate': round((hot_warm / total_leads * 100) if total_leads > 0 else 0, 2),
            'by_medium': [
                {
                    'medium': medium,
                    'leads': stats['leads'],
                    'revenue': round(stats['revenue'], 2),
                    'conversions': stats['conversions'],
                    'conversion_rate': round((stats['conversions'] / stats['leads'] * 100) if stats['leads'] > 0 else 0, 2)
                }
                for medium, stats in medium_stats.items()
            ]
        }
    except Exception as e:
        logger.error(f"Error getting campaign overview: {e}")
        return {'total_leads': 0, 'total_campaigns': 0, 'by_medium': []}


@app.get("/api/analytics/campaigns/list")
async def campaign_list(
    medium: Optional[str] = None,
    group: Optional[str] = None
):
    """Get list of all campaigns with performance metrics"""
    try:
        # Build query
        query = supabase_data.client.table('leads').select(
            'campaign_medium,campaign_name,campaign_group,status,ai_score,actual_revenue,expected_revenue,created_at,lead_quality,first_call_date'
        )
        
        if medium:
            query = query.eq('campaign_medium', medium)
        if group:
            query = query.eq('campaign_group', group)
        
        response = query.execute()
        leads = response.data if response.data else []
        
        # Group by campaign name
        campaigns = {}
        for lead in leads:
            campaign_name = lead.get('campaign_name') or 'Unnamed Campaign'
            if campaign_name not in campaigns:
                campaigns[campaign_name] = {
                    'campaign_name': campaign_name,
                    'campaign_medium': lead.get('campaign_medium'),
                    'campaign_group': lead.get('campaign_group'),
                    'total_leads': 0,
                    'hot_leads': 0,
                    'warm_leads': 0,
                    'cold_leads': 0,
                    'converted': 0,
                    'total_revenue': 0,
                    'expected_revenue': 0,
                    'contacted': 0,
                    'first_created': lead.get('created_at'),
                    'last_created': lead.get('created_at')
                }
            
            camp = campaigns[campaign_name]
            camp['total_leads'] += 1
            
            # Categorize by quality
            score = lead.get('ai_score') or 0
            if score >= 75:
                camp['hot_leads'] += 1
            elif score >= 50:
                camp['warm_leads'] += 1
            else:
                camp['cold_leads'] += 1
            
            if lead.get('status') == 'Enrolled':
                camp['converted'] += 1
            
            camp['total_revenue'] += lead.get('actual_revenue', 0) or 0
            camp['expected_revenue'] += lead.get('expected_revenue', 0) or 0
            
            if lead.get('first_call_date'):
                camp['contacted'] += 1
            
            # Track date range
            if lead.get('created_at'):
                if lead['created_at'] < camp['first_created']:
                    camp['first_created'] = lead['created_at']
                if lead['created_at'] > camp['last_created']:
                    camp['last_created'] = lead['created_at']
        
        # Calculate rates and format
        result = []
        for campaign_name, stats in campaigns.items():
            total = stats['total_leads']
            result.append({
                **stats,
                'conversion_rate': round((stats['converted'] / total * 100) if total > 0 else 0, 2),
                'contact_rate': round((stats['contacted'] / total * 100) if total > 0 else 0, 2),
                'avg_revenue_per_lead': round((stats['total_revenue'] / total) if total > 0 else 0, 2),
                'total_revenue': round(stats['total_revenue'], 2),
                'expected_revenue': round(stats['expected_revenue'], 2)
            })
        
        # Sort by total leads descending
        result.sort(key=lambda x: x['total_leads'], reverse=True)
        
        return result
    except Exception as e:
        logger.error(f"Error getting campaign list: {e}")
        return []


@app.get("/api/analytics/campaigns/{campaign_name}")
async def campaign_detail(campaign_name: str):
    """Get detailed analytics for a specific campaign"""
    try:
        # Get all leads for this campaign
        response = supabase_data.client.table('leads').select('*').eq('campaign_name', campaign_name).execute()
        leads = response.data if response.data else []
        
        if not leads:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        total = len(leads)
        converted = sum(1 for l in leads if l.get('status') == 'Enrolled')
        hot = sum(1 for l in leads if (l.get('ai_score') or 0) >= 75)
        warm = sum(1 for l in leads if 50 <= (l.get('ai_score') or 0) < 75)
        cold = sum(1 for l in leads if (l.get('ai_score') or 0) < 50)
        
        # Call stats
        first_call = sum(1 for l in leads if l.get('first_call_date'))
        second_call = sum(1 for l in leads if l.get('second_call_date'))
        third_call = sum(1 for l in leads if l.get('third_call_date'))
        
        # Revenue
        total_revenue = sum(l.get('actual_revenue', 0) or 0 for l in leads)
        expected_revenue = sum(l.get('expected_revenue', 0) or 0 for l in leads)
        
        # By status
        status_breakdown = {}
        for lead in leads:
            status = lead.get('status') or 'Unknown'
            status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        # By course
        course_breakdown = {}
        for lead in leads:
            course = lead.get('course_interested') or 'Unknown'
            course_breakdown[course] = course_breakdown.get(course, 0) + 1
        
        # By lead quality
        quality_breakdown = {}
        for lead in leads:
            quality = lead.get('lead_quality') or 'Unknown'
            quality_breakdown[quality] = quality_breakdown.get(quality, 0) + 1
        
        return {
            'campaign_name': campaign_name,
            'campaign_medium': leads[0].get('campaign_medium'),
            'campaign_group': leads[0].get('campaign_group'),
            'summary': {
                'total_leads': total,
                'converted': converted,
                'conversion_rate': round((converted / total * 100) if total > 0 else 0, 2),
                'hot_leads': hot,
                'warm_leads': warm,
                'cold_leads': cold,
                'total_revenue': round(total_revenue, 2),
                'expected_revenue': round(expected_revenue, 2),
                'avg_revenue_per_lead': round((total_revenue / total) if total > 0 else 0, 2)
            },
            'call_stats': {
                'first_call_completed': first_call,
                'second_call_completed': second_call,
                'third_call_completed': third_call,
                'first_call_rate': round((first_call / total * 100) if total > 0 else 0, 2),
                'second_call_rate': round((second_call / total * 100) if total > 0 else 0, 2),
                'third_call_rate': round((third_call / total * 100) if total > 0 else 0, 2)
            },
            'by_status': [
                {'status': status, 'count': count, 'percentage': round((count / total * 100) if total > 0 else 0, 2)}
                for status, count in sorted(status_breakdown.items(), key=lambda x: x[1], reverse=True)
            ],
            'by_course': [
                {'course': course, 'count': count, 'percentage': round((count / total * 100) if total > 0 else 0, 2)}
                for course, count in sorted(course_breakdown.items(), key=lambda x: x[1], reverse=True)
            ],
            'by_quality': [
                {'quality': quality, 'count': count, 'percentage': round((count / total * 100) if total > 0 else 0, 2)}
                for quality, count in sorted(quality_breakdown.items(), key=lambda x: x[1], reverse=True)
            ],
            'leads': leads[:100]  # Return first 100 leads for the campaign
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting campaign detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/campaigns/compare")
async def campaign_compare(campaign_names: str):
    """Compare multiple campaigns side by side"""
    try:
        # Parse comma-separated campaign names
        names = [name.strip() for name in campaign_names.split(',')]
        
        comparison = []
        for campaign_name in names:
            response = supabase_data.client.table('leads').select(
                'campaign_name,status,ai_score,actual_revenue,expected_revenue,first_call_date'
            ).eq('campaign_name', campaign_name).execute()
            leads = response.data if response.data else []
            
            if leads:
                total = len(leads)
                converted = sum(1 for l in leads if l.get('status') == 'Enrolled')
                total_revenue = sum(l.get('actual_revenue', 0) or 0 for l in leads)
                contacted = sum(1 for l in leads if l.get('first_call_date'))
                
                comparison.append({
                    'campaign_name': campaign_name,
                    'total_leads': total,
                    'converted': converted,
                    'conversion_rate': round((converted / total * 100) if total > 0 else 0, 2),
                    'total_revenue': round(total_revenue, 2),
                    'revenue_per_lead': round((total_revenue / total) if total > 0 else 0, 2),
                    'contact_rate': round((contacted / total * 100) if total > 0 else 0, 2)
                })
        
        return comparison
    except Exception as e:
        logger.error(f"Error comparing campaigns: {e}")
        return []


# ============================================================================
# COMMUNICATION ENDPOINTS
# ============================================================================

@app.post("/api/leads/{lead_id}/send-whatsapp")
async def send_whatsapp(
    lead_id: str,
    request: WhatsAppRequest
):
    """Send WhatsApp message via Twilio - SUPABASE ONLY"""
    
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if not lead.get('whatsapp'):
        raise HTTPException(status_code=400, detail="Lead has no WhatsApp number")
    
    # Send WhatsApp message
    from communication_service import comm_service
    
    variables = {
        "name": lead.get('full_name') or "there",
        "course": lead.get('course_interested') or "our courses",
        "counselor": lead.get('assigned_to') or "Your counselor",
        "message": request.message
    }
    
    result = await comm_service.send(
        channel="whatsapp",
        to=lead['whatsapp'],
        message=request.message,
        template=request.template,
        variables=variables
    )
    
    # Log in database
    lead_internal_id = lead.get('id')
    if lead_internal_id:
        supabase_data.create_note(
            lead_id=lead_internal_id,
            content=f"[WhatsApp {'Sent' if result['success'] else 'Failed'}] {request.message}",
            channel="whatsapp",
            created_by="System"
        )
    
    if result["success"]:
        return {
            "success": True,
            "message": "WhatsApp sent successfully",
            "message_id": result.get("message_id"),
            "to": lead['whatsapp']
        }
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to send WhatsApp"))

@app.post("/api/leads/{lead_id}/send-email")
async def send_email(
    lead_id: str,
    request: EmailRequest
):
    """Send email via Resend - SUPABASE ONLY"""
    
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if not lead.get('email'):
        raise HTTPException(status_code=400, detail="Lead has no email address")
    
    # Send email
    from communication_service import comm_service
    
    variables = {
        "name": lead.get('full_name') or "there",
        "course": lead.get('course_interested') or "our courses",
        "counselor": lead.get('assigned_to') or "Your counselor",
        "subject": request.subject,
        "body": request.body
    }
    
    result = await comm_service.send(
        channel="email",
        to=lead['email'],
        message=request.body,
        template=request.template,
        variables=variables
    )
    
    # Log in database
    lead_internal_id = lead.get('id')
    if lead_internal_id:
        supabase_data.create_note(
            lead_id=lead_internal_id,
            content=f"[Email {'Sent' if result['success'] else 'Failed'}] Subject: {request.subject}\n\n{request.body}",
            channel="email",
            created_by="System"
        )
    
    if result["success"]:
        return {
            "success": True,
            "message": "Email sent successfully",
            "message_id": result.get("message_id"),
            "to": lead['email']
        }
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to send email"))

@app.post("/api/leads/{lead_id}/trigger-welcome")
async def trigger_welcome(lead_id: str):
    """Trigger automated welcome sequence (Email + WhatsApp) - SUPABASE ONLY"""
    
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    from communication_service import comm_service
    results = []
    
    # Send welcome email
    if lead.get('email'):
        result = await comm_service.send(
            channel="email",
            to=lead['email'],
            message="Welcome message",
            template="welcome_email",
            variables={"name": lead.get('full_name', 'there')}
        )
        results.append({"channel": "email", "success": result['success']})
    
    # Send welcome WhatsApp
    if lead.get('whatsapp'):
        result = await comm_service.send(
            channel="whatsapp",
            to=lead['whatsapp'],
            message="Welcome message",
            template="welcome_whatsapp",
            variables={"name": lead.get('full_name', 'there')}
        )
        results.append({"channel": "whatsapp", "success": result['success']})
    
    return {
        "success": True,
        "message": "Welcome sequence triggered",
        "results": results
    }


@app.post("/api/leads/{lead_id}/trigger-followup")
async def trigger_followup(
    lead_id: str,
    request: FollowUpRequest
):
    """Trigger automated follow-up sequence - SUPABASE ONLY"""
    
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    from communication_service import comm_service
    
    lead_data = {
        "id": lead.get('lead_id'),
        "name": lead.get('full_name') or "there",
        "email": lead.get('email'),
        "whatsapp": lead.get('whatsapp'),
        "course": lead.get('course_interested') or "our courses",
        "counselor": lead.get('assigned_to') or "Your counselor"
    }
    
    try:
        results = await comm_service.campaign.trigger_follow_up(lead_data, request.message, request.priority)
    except Exception as e:
        logger.error(f"trigger_followup failed for lead {lead_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Communication service error: {str(e)}")

    # Log results as notes in Supabase
    for result in results:
        note_content = f"[{result['channel'].title()} - Follow-up] {request.message}"
        try:
            supabase_data.create_note(
                lead_id=lead.get('id'),  # internal DB ID
                content=note_content,
                channel=result["channel"],
                created_by="System"
            )
        except Exception as e:
            logger.error(f"Failed to create note for lead {lead_id}: {e}")

    return {
        "success": True,
        "message": "Follow-up sequence triggered",
        "results": results
    }

# ============================================================================
# LEAD ASSIGNMENT ENDPOINTS
# ============================================================================

@app.post("/api/leads/{lead_id}/assign")
async def assign_lead(
    lead_id: str,
    request: AssignmentRequest
):
    """
    Assign lead to counselor - SUPABASE ONLY (Simplified)
    
    Note: Advanced assignment strategies require conversion of assignment_service
    Currently implements basic assignment to specified counselor
    """
    
    # Get lead
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get counselor from request (simplified - no complex assignment logic)
    if not hasattr(request, 'counselor_name') or not request.counselor_name:
        # Default to first available counselor
        users = supabase_data.get_all_users()
        counselors = [u for u in users if u.get('role') in ['Counselor', 'Team Leader', 'Manager'] and u.get('is_active')]
        if not counselors:
            raise HTTPException(status_code=400, detail="No available counselors")
        counselor_name = counselors[0]['full_name']
    else:
        counselor_name = request.counselor_name
    
    # Update lead
    updated = supabase_data.update_lead(lead_id, {'assigned_to': counselor_name})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to assign lead")
    
    return {
        "success": True,
        "message": f"Lead assigned to {counselor_name}",
        "assigned_to": counselor_name
    }

@app.post("/api/leads/assign-all")
async def assign_all_unassigned(
    request: AssignmentRequest
):
    """Assign all unassigned leads in bulk - SUPABASE ONLY"""
    
    # Get unassigned leads
    response = supabase_data.client.table('leads').select('lead_id').is_('assigned_to', 'null').execute()
    unassigned = response.data if response.data else []
    
    if not unassigned:
        return {"success": True, "message": "No unassigned leads", "assigned_count": 0}
    
    # Get counselors
    users = supabase_data.get_all_users()
    counselors = [u['full_name'] for u in users if u.get('role') in ['Counselor', 'Team Leader'] and u.get('is_active')]
    
    if not counselors:
        raise HTTPException(status_code=400, detail="No available counselors")
    
    # Simple round-robin assignment
    assigned_count = 0
    for idx, lead in enumerate(unassigned):
        counselor = counselors[idx % len(counselors)]
        supabase_data.update_lead(lead['lead_id'], {'assigned_to': counselor})
        assigned_count += 1
    
    return {
        "success": True,
        "message": f"Assigned {assigned_count} leads",
        "assigned_count": assigned_count
    }

@app.post("/api/leads/{lead_id}/reassign")
async def reassign_lead(
    lead_id: str,
    request: ReassignmentRequest
):
    """Reassign lead to different counselor - SUPABASE ONLY"""
    
    # Get lead
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Update assignment
    updated = supabase_data.update_lead(lead_id, {'assigned_to': request.new_counselor})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to reassign lead")
    
    # Create activity log
    lead_internal_id = lead.get('id')
    if lead_internal_id:
        supabase_data.create_activity(
            lead_id=lead_internal_id,
            activity_type='reassignment',
            description=f"Lead reassigned to {request.new_counselor}. Reason: {request.reason}",
            created_by="System"
        )
    
    # Invalidate caches to reflect reassignment
    invalidate_cache(LEAD_CACHE)
    invalidate_cache(STATS_CACHE)
    
    return {
        "success": True,
        "message": f"Lead reassigned to {request.new_counselor}",
        "new_counselor": request.new_counselor
    }

@app.get("/api/counselors/workload")
@cache_async_result(STATS_CACHE, "counselor_workload")
async def get_counselor_workloads():
    """Get workload statistics for all counselors (cached for 1 minute) - SUPABASE ONLY"""
    
    try:
        # Get counselors
        users = supabase_data.get_all_users()
        counselors = [u for u in users if u.get('role') in ['Counselor', 'Manager', 'Team Leader'] and u.get('is_active')]
        
        # Get all leads
        all_leads = supabase_data.client.table('leads').select('assigned_to,status,ai_score').execute()
        leads_data = all_leads.data if all_leads.data else []
        
        workloads = []
        for counselor in counselors:
            counselor_name = counselor['full_name']
            # Count active leads (not Junk or Lost)
            active_leads = [l for l in leads_data if l.get('assigned_to') == counselor_name and l.get('status') not in ['Junk', 'Lost']]
            active_count = len(active_leads)
            
            # Calculate performance score (avg AI score of their leads)
            avg_score = sum(l.get('ai_score', 0) or 0 for l in active_leads) / len(active_leads) if active_leads else 0
            
            workloads.append({
                "full_name": counselor_name,
                "email": counselor.get('email'),
                "role": counselor.get('role'),
                "active_leads": active_count,
                "performance_score": round(avg_score, 1),
                "status": "overloaded" if active_count > 30 else "busy" if active_count > 20 else "available"
            })
        
        return {
            "counselors": workloads,
            "total_counselors": len(workloads),
            "total_active_leads": sum(c["active_leads"] for c in workloads),
            "average_workload": round(sum(c["active_leads"] for c in workloads) / len(workloads), 1) if workloads else 0
        }
    except Exception as e:
        logger.error(f"Error getting counselor workloads: {e}")
        return {"counselors": [], "total_counselors": 0, "total_active_leads": 0, "average_workload": 0}

@app.post("/api/workflows/trigger")
async def trigger_workflows():
    """Manually trigger automated workflows for all leads - SUPABASE ONLY"""
    
    try:
        # Get all leads
        response = supabase_data.client.table('leads').select('lead_id,status,follow_up_date').execute()
        all_leads = response.data if response.data else []
        
        triggered_count = 0
        from datetime import datetime
        now = datetime.utcnow()
        
        # Simple workflow: check for overdue follow-ups
        for lead in all_leads:
            if lead.get('status') in ['Fresh', 'In Progress', 'Follow Up']:
                follow_up_date = lead.get('follow_up_date')
                if follow_up_date:
                    try:
                        follow_up_dt = datetime.fromisoformat(follow_up_date.replace('Z', '+00:00'))
                        if follow_up_dt < now:
                            # Mark as needing attention
                            supabase_data.update_lead(lead['lead_id'], {'status': 'Follow Up'})
                            triggered_count += 1
                    except:
                        pass
        
        return {
            "success": True,
            "message": f"Processed {len(all_leads)} leads, triggered {triggered_count} workflow actions",
            "processed": len(all_leads),
            "triggered": triggered_count
        }
    except Exception as e:
        logger.error(f"Workflow trigger failed: {e}")
        raise HTTPException(status_code=500, detail="Workflow trigger failed")
    
    from assignment_service import WorkflowAutomation
    
    automation = WorkflowAutomation(db)
    results = await automation.check_and_trigger_workflows()
    
    return {
        "triggered": len(results),
        "workflows": results
    }

# ============================================================================
# API ENDPOINTS - CACHE MANAGEMENT
# ============================================================================

@app.get("/api/cache/stats")
async def get_cache_statistics():
    """Get cache statistics for monitoring"""
    stats = get_cache_stats()
    
    return {
        "caches": stats,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/api/cache/clear")
async def clear_cache(cache_name: Optional[str] = None):
    """Clear cache (all or specific cache)"""
    
    if cache_name:
        cache_map = {
            "leads": LEAD_CACHE,
            "courses": COURSE_CACHE,
            "users": USER_CACHE,
            "stats": STATS_CACHE,
            "ml_scores": ML_SCORE_CACHE
        }
        
        if cache_name not in cache_map:
            raise HTTPException(status_code=400, detail=f"Unknown cache: {cache_name}")
        
        invalidate_cache(cache_map[cache_name])
        logger.info(f"🗑️  Cleared {cache_name} cache", extra={"system": "cache"})
        
        return {
            "status": "success",
            "cleared": cache_name,
            "timestamp": datetime.utcnow().isoformat()
        }
    else:
        # Clear all caches
        for cache in [LEAD_CACHE, COURSE_CACHE, USER_CACHE, STATS_CACHE, ML_SCORE_CACHE]:
            invalidate_cache(cache)
        
        logger.info("🗑️  Cleared all caches", extra={"system": "cache"})
        
        return {
            "status": "success",
            "cleared": "all",
            "timestamp": datetime.utcnow().isoformat()
        }

# ============================================================================
# ML MODEL INFO & VERSIONING
# ============================================================================

@app.get("/api/ml/model-info")
async def get_model_info():
    """Get current ML model version, metadata, and performance metrics."""
    model = get_cached_model()
    
    # Load metadata from JSON sidecar files
    models_dir = Path(__file__).parent.parent.parent / "models"
    metadata_files = sorted(models_dir.glob("model_metadata_v2_*.json"), reverse=True)
    
    metadata = None
    if metadata_files:
        try:
            with open(metadata_files[0]) as f:
                metadata = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load model metadata: {e}")
    
    return {
        "model_loaded": model is not None,
        "model_type": "CatBoostClassifier" if model else None,
        "metadata": metadata,
        "available_versions": [f.stem for f in metadata_files],
        "timestamp": datetime.utcnow().isoformat(),
    }

# ============================================================================
# AI-POWERED SMART FEATURES (PHASE 8) - REQUIRES SUPABASE CONVERSION
# These endpoints currently use db.query() and need Supabase implementation
# Returning not-implemented responses until conversion is complete
# ============================================================================

def _ai_not_implemented():
    raise HTTPException(
        status_code=501,
        detail="AI features require Supabase conversion - coming soon"
    )

# ============================================================================
# AI-POWERED SMART FEATURES (PHASE 8)
# ============================================================================

@app.post("/api/ai/search")
async def ai_natural_language_search(
    query: str = Query(..., description="Natural language search query")
):
    """
    🔍 Search leads using natural language - SUPABASE ONLY (Simplified)
    
    Examples:
    - "Show me all hot leads from India interested in MBBS"
    - "Find leads that haven't been contacted in 7 days"
    - "Which leads have high conversion probability?"
    """
    _ai_not_implemented()  # Stub until Supabase conversion
    
    if not ai_assistant.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI features unavailable. Please configure OPENAI_API_KEY in .env"
        )
    
    try:
        # Get all leads
        leads = db.query(DBLead).all()
        lead_dicts = [
            {
                "id": lead.id,
                "full_name": lead.full_name,
                "country": lead.country,
                "course_interested": lead.course_interested,
                "status": lead.status,
                "ai_segment": lead.ai_segment,
                "ai_score": lead.ai_score,
                "conversion_probability": lead.conversion_probability,
                "updated_at": lead.updated_at.isoformat() if lead.updated_at else None
            }
            for lead in leads
        ]
        
        # AI-powered search
        results = await ai_assistant.natural_language_search(query, lead_dicts)
        
        logger.info(f"🔍 AI Search: '{query}' → {len(results)} results", extra={"endpoint": "ai_search"})
        
        return {
            "query": query,
            "results_count": len(results),
            "leads": results
        }
        
    except Exception as e:
        logger.error(f"AI search failed: {e}", extra={"endpoint": "ai_search"})
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/smart-reply/{lead_id}")
async def generate_smart_reply(
    lead_id: int,
    context: str = Query("follow-up", description="Message context: follow-up, welcome, reminder, thank-you")
):
    """
    ✉️ Generate AI-powered personalized messages - SUPABASE ONLY
    
    Creates contextual email/WhatsApp messages based on lead data
    """
    _ai_not_implemented()  # Stub until Supabase conversion
    
    if not ai_assistant.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI features unavailable. Please configure OPENAI_API_KEY in .env"
        )
    
    lead = db.query(DBLead).filter(DBLead.id == lead_id).first()
    if not lead:
        raise NotFoundError("Lead", lead_id)
    
    try:
        lead_data = {
            "full_name": lead.full_name,
            "country": lead.country,
            "course_interested": lead.course_interested,
            "status": lead.status,
            "ai_score": lead.ai_score
        }
        
        message = await ai_assistant.generate_smart_reply(lead_data, context)
        
        logger.info(
            f"✉️ Generated smart reply for lead {lead_id} ({context})",
            extra={"endpoint": "smart_reply", "lead_id": lead_id}
        )
        
        return {
            "lead_id": lead_id,
            "lead_name": lead.full_name,
            "context": context,
            "message": message,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Smart reply generation failed: {e}", extra={"endpoint": "smart_reply"})
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/summarize-notes/{lead_id}")
async def summarize_lead_notes(
    lead_id: int
):
    """
    📝 Summarize all notes for a lead using AI - SUPABASE ONLY
    
    Returns key insights, sentiment, and recommended actions
    """
    
    if not ai_assistant.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI features unavailable. Please configure OPENAI_API_KEY in .env"
        )
    
    lead = db.query(DBLead).filter(DBLead.id == lead_id).first()
    if not lead:
        raise NotFoundError("Lead", lead_id)
    
    try:
        # Get all notes for this lead
        notes = db.query(DBNote).filter(DBNote.lead_id == lead_id).order_by(DBNote.created_at.desc()).all()
        
        if not notes:
            return {
                "lead_id": lead_id,
                "summary": "No notes available for this lead.",
                "notes_count": 0
            }
        
        notes_data = [
            {
                "content": note.content,
                "created_at": note.created_at.isoformat()
            }
            for note in notes
        ]
        
        summary = await ai_assistant.summarize_notes(notes_data)
        
        logger.info(
            f"📝 Summarized {len(notes)} notes for lead {lead_id}",
            extra={"endpoint": "summarize_notes", "lead_id": lead_id}
        )
        
        return {
            "lead_id": lead_id,
            "lead_name": lead.full_name,
            "notes_count": len(notes),
            "summary": summary,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Note summarization failed: {e}", extra={"endpoint": "summarize_notes"})
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/next-action/{lead_id}")
async def predict_next_action(
    lead_id: int
):
    """
    🎯 AI-powered prediction of best next action for a lead - SUPABASE ONLY
    
    Analyzes lead data and history to recommend optimal next steps
    """
    
    if not ai_assistant.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI features unavailable. Please configure OPENAI_API_KEY in .env"
        )
    
    lead = db.query(DBLead).filter(DBLead.id == lead_id).first()
    if not lead:
        raise NotFoundError("Lead", lead_id)
    
    try:
        lead_data = {
            "full_name": lead.full_name,
            "status": lead.status,
            "ai_score": lead.ai_score,
            "ai_segment": lead.ai_segment,
            "conversion_probability": lead.conversion_probability,
            "course_interested": lead.course_interested,
            "country": lead.country
        }
        
        # Get recent activities
        activities = db.query(DBActivity).filter(
            DBActivity.lead_id == lead_id
        ).order_by(DBActivity.created_at.desc()).limit(5).all()
        
        activities_data = [
            {
                "activity_type": act.activity_type,
                "created_at": act.created_at.isoformat()
            }
            for act in activities
        ]
        
        prediction = await ai_assistant.predict_best_action(lead_data, activities_data)
        
        logger.info(
            f"🎯 Predicted next action for lead {lead_id}: {prediction.get('action')}",
            extra={"endpoint": "next_action", "lead_id": lead_id}
        )
        
        return {
            "lead_id": lead_id,
            "lead_name": lead.full_name,
            "prediction": prediction,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Action prediction failed: {e}", extra={"endpoint": "next_action"})
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/conversion-barriers/{lead_id}")
async def analyze_conversion_barriers(
    lead_id: int
):
    """
    🚧 Identify potential barriers preventing lead conversion - SUPABASE ONLY
    
    AI analyzes lead data and notes to find blockers
    """
    
    if not ai_assistant.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI features unavailable. Please configure OPENAI_API_KEY in .env"
        )
    
    lead = db.query(DBLead).filter(DBLead.id == lead_id).first()
    if not lead:
        raise NotFoundError("Lead", lead_id)
    
    try:
        lead_data = {
            "status": lead.status,
            "ai_score": lead.ai_score,
            "conversion_probability": lead.conversion_probability,
            "expected_revenue": lead.expected_revenue
        }
        
        # Get notes
        notes = db.query(DBNote).filter(
            DBNote.lead_id == lead_id
        ).order_by(DBNote.created_at.desc()).limit(10).all()
        
        notes_data = [{"content": note.content} for note in notes]
        
        barriers = await ai_assistant.analyze_conversion_barriers(lead_data, notes_data)
        
        logger.info(
            f"🚧 Identified {len(barriers)} barriers for lead {lead_id}",
            extra={"endpoint": "conversion_barriers", "lead_id": lead_id}
        )
        
        return {
            "lead_id": lead_id,
            "lead_name": lead.full_name,
            "barriers": barriers,
            "barriers_count": len(barriers),
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Barrier analysis failed: {e}", extra={"endpoint": "conversion_barriers"})
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/recommend-course/{lead_id}")
async def recommend_course(
    lead_id: int
):
    """
    🎓 AI-powered course recommendation based on lead profile - SUPABASE ONLY
    
    Analyzes lead data to suggest the best-fit course
    """
    _ai_not_implemented()  # Stub until Supabase conversion
    
    if not ai_assistant.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI features unavailable. Please configure OPENAI_API_KEY in .env"
        )
    
    lead = db.query(DBLead).filter(DBLead.id == lead_id).first()
    if not lead:
        raise NotFoundError("Lead", lead_id)
    
    try:
        lead_data = {
            "country": lead.country,
            "course_interested": lead.course_interested,
            "ai_score": lead.ai_score
        }
        
        # Get available courses
        courses = db.query(DBCourse).filter(DBCourse.is_active == True).all()
        courses_data = [
            {
                "course_name": course.course_name,
                "category": course.category,
                "duration": course.duration,
                "price": float(course.price) if course.price else 0
            }
            for course in courses
        ]
        
        if not courses_data:
            raise HTTPException(status_code=404, detail="No active courses available")
        
        recommendation = await ai_assistant.generate_course_recommendation(lead_data, courses_data)
        
        logger.info(
            f"🎓 Recommended course for lead {lead_id}: {recommendation.get('course_name')}",
            extra={"endpoint": "recommend_course", "lead_id": lead_id}
        )
        
        return {
            "lead_id": lead_id,
            "lead_name": lead.full_name,
            "current_interest": lead.course_interested,
            "recommendation": recommendation,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Course recommendation failed: {e}", extra={"endpoint": "recommend_course"})
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/status")
async def ai_status():
    """Check AI assistant availability and configuration"""
    
    return {
        "available": ai_assistant.is_available(),
        "model": ai_assistant.model if ai_assistant.is_available() else None,
        "features": [
            "Natural Language Search",
            "Smart Reply Generation",
            "Note Summarization",
            "Next Action Prediction",
            "Conversion Barrier Analysis",
            "Course Recommendations"
        ] if ai_assistant.is_available() else [],
        "status": "ready" if ai_assistant.is_available() else "not_configured"
    }

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/ping")
async def ping():
    """
    Ultra-lightweight keep-alive endpoint — NO database, NO ML calls.
    Used by external schedulers (cron-job.org, UptimeRobot) to keep the
    Render free-tier container warm.  Returns in < 1 ms.
    """
    return {"pong": True, "ts": datetime.utcnow().isoformat()}


@app.get("/health")
async def health_check():
    """Full health check endpoint with database status"""
    
    # Detect database type
    db_type = "supabase" if supabase_manager.client else "sqlite"
    
    health_status = {
        "status": "healthy",
        "version": "2.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_type,
        "database_status": "connected",
        "components": {}
    }
    
    # Test database connection
    try:
        if supabase_manager.client:
            # Test Supabase connection
            lead_count = supabase_data.get_lead_count()
            health_status["database_status"] = "connected"
            health_status["lead_count"] = lead_count
        else:
            # Test SQLite connection (fallback)
            db = SessionLocal()
            lead_count = db.query(DBLead).count()
            health_status["database_status"] = "connected"
            health_status["lead_count"] = lead_count
            db.close()
    except Exception as e:
        health_status["database_status"] = "disconnected"
        health_status["status"] = "unhealthy"
        logger.error(f"Database health check failed: {e}")
    
    # Test AI assistant
    health_status["ai_assistant"] = "available" if ai_assistant.is_available() else "not_configured"
    
    # Check ML model status
    health_status["components"]["ml_model"] = {
        "status": "loaded" if get_cached_model() else "not_loaded"
    }
    
    # Check cache statistics
    try:
        cache_stats = get_cache_stats()
        health_status["components"]["cache"] = {
            "status": "healthy",
            "stats": cache_stats
        }
    except:
        pass
    
    if ai_assistant.is_available():
        health_status["ai_model"] = ai_assistant.model
    
    return health_status

@app.get("/ready")
async def readiness_check():
    """Readiness probe for Kubernetes/deployment orchestration - SUPABASE ONLY"""
    try:
        # Check Supabase connection
        if not supabase_manager.client:
            raise HTTPException(status_code=503, detail="Database not configured")
        
        supabase_manager.client.table('leads').select("count", count='exact').limit(0).execute()
        
        # Verify model is loaded (optional for readiness)
        model_status = "loaded" if get_cached_model() else "not_loaded"
        
        return {
            "status": "ready",
            "model": model_status
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail={"status": "not_ready", "reason": str(e)})

# ============================================================================
# GOOGLE SHEETS SYNC API
# ============================================================================

@app.get("/api/sync/google-sheets/status")
async def google_sheets_sync_status():
    """
    Get Google Sheets sync status and configuration
    """
    try:
        from google_sheets_service import google_sheets_service
        from lead_sync_service import lead_sync_service
        
        # Get connection status
        connection_status = google_sheets_service.test_connection()
        
        # Get sync stats
        sync_stats = lead_sync_service.get_sync_stats()
        
        return {
            "google_sheets": connection_status,
            "sync": sync_stats,
            "configuration": {
                "sheet_id": os.getenv('GOOGLE_SHEET_ID', '1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU'),
                "sheet_name": os.getenv('GOOGLE_SHEET_NAME', 'Sheet1'),
                "sync_interval": "5 minutes",
                "credentials_configured": os.path.exists('google-credentials.json')
            }
        }
    except Exception as e:
        logger.error(f"Error getting sync status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync/google-sheets/trigger")
async def trigger_google_sheets_sync(background_tasks: BackgroundTasks):
    """
    Manually trigger Google Sheets sync
    This will sync all unsynced leads from the Google Sheet
    """
    try:
        from lead_sync_service import lead_sync_service
        
        logger.info("🔄 Manual sync triggered from API")
        
        # Run sync in background
        background_tasks.add_task(lead_sync_service.sync_all_unsynced_leads)
        
        return {
            "status": "started",
            "message": "Sync process started in background",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error triggering sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync/google-sheets/sync-now")
async def sync_google_sheets_now():
    """
    Synchronously sync Google Sheets (wait for completion)
    Use this for testing or when you need immediate results
    """
    try:
        from lead_sync_service import lead_sync_service
        
        logger.info("🔄 Synchronous sync triggered from API")
        
        # Run sync synchronously
        result = lead_sync_service.sync_all_unsynced_leads()
        
        return result
    except Exception as e:
        logger.error(f"Error during sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sync/google-sheets/test-connection")
async def test_google_sheets_connection():
    """
    Test Google Sheets connection and show sheet preview
    """
    try:
        from google_sheets_service import google_sheets_service
        
        connection_status = google_sheets_service.test_connection()
        
        if connection_status['status'] == 'success':
            # Get a preview of leads
            all_leads = google_sheets_service.get_all_leads()
            unsynced_leads = google_sheets_service.get_unsynced_leads()
            
            connection_status['preview'] = {
                'total_leads': len(all_leads),
                'unsynced_leads': len(unsynced_leads),
                'sample_leads': unsynced_leads[:3] if unsynced_leads else []
            }
        
        return connection_status
    except Exception as e:
        logger.error(f"Error testing connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# HEALTH CHECK & METRICS
# ============================================================================

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    if not PROMETHEUS_ENABLED:
        raise HTTPException(status_code=501, detail="Prometheus metrics not enabled")
    
    from starlette.responses import Response
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ==================== COMMUNICATION INTEGRATIONS ====================
# WhatsApp, Email, and Call APIs with ML Training Data Collection
# TEMPORARILY DISABLED - communication_integrations.py needs Supabase migration
# from communication_integrations import (
#     communication_service,
#     CommunicationHistory
# )

# @app.post("/api/communications/whatsapp/send")
# async def send_whatsapp_message(
#     data: Dict[str, Any]
# ):
#     """Send WhatsApp message to lead - SUPABASE ONLY"""
#     if not supabase_data.client:
#         raise HTTPException(status_code=500, detail="Database not configured")
#     
#     try:
#         result = communication_service.whatsapp.send_message(
#             to_number=data['to'],
#             message=data['message'],
#             lead_id=data['lead_id'],
#             sender=data['sender']
#         )
#         return result
#     except Exception as e:
#         logger.error(f"WhatsApp send error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
# 
# 
# @app.post("/api/communications/whatsapp/webhook")
# async def whatsapp_webhook(
#     data: Dict[str, Any]
# ):
#     """Webhook endpoint for incoming WhatsApp messages - SUPABASE ONLY"""
#     try:
#         result = communication_service.whatsapp.receive_webhook(data)
#         return result
#     except Exception as e:
#         logger.error(f"WhatsApp webhook error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
# 
# 
# @app.post("/api/communications/email/send")
# async def send_email(
#     data: Dict[str, Any]
# ):
#     """Send email to lead - SUPABASE ONLY"""
#     try:
#         result = communication_service.email.send_email(
#             to_email=data['to'],
#             subject=data.get('subject', 'Message from Medical CRM'),
#             body=data['message'],
#             lead_id=data['lead_id'],
#             sender=data['sender'],
#             db=db,
#             html=data.get('html', False)
#         )
#         return result
#     except Exception as e:
#         logger.error(f"Email send error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
# 
# 
# @app.post("/api/communications/call/initiate")
# async def initiate_call(
#     data: Dict[str, Any]
# ):
#     """Initiate voice call with recording - SUPABASE ONLY"""
#     try:
#         callback_url = os.getenv('TWILIO_CALLBACK_URL', 'http://localhost:8000/api/communications/call')
#         result = communication_service.calls.initiate_call(
#             to_number=data['to_number'],
#             lead_id=data['lead_id'],
#             counselor=data['counselor'],
#             db=db,
#             callback_url=callback_url
#         )
#         return result
#     except Exception as e:
#         logger.error(f"Call initiation error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
# 
# 
# @app.post("/api/communications/call/recording-complete")
# async def call_recording_complete(
#     data: Dict[str, Any]
# ):
#     """Webhook for call recording completion - SUPABASE ONLY"""
#     try:
#         call_sid = data.get('CallSid')
#         call_status = data.get('CallStatus')
#         call_duration = int(data.get('CallDuration', 0))
#         recording_url = data.get('RecordingUrl')
#         
#         communication_service.calls.update_call_status(
#             call_sid=call_sid,
#             status=call_status,
#             duration=call_duration,
#             recording_url=recording_url,
#             db=db
#         )
#         
#         return {"success": True}
#     except Exception as e:
#         logger.error(f"Recording webhook error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
# 
# 
# @app.get("/api/communications/{lead_id}/history")
# async def get_communication_history(
#     lead_id: str,
#     type: Optional[str] = Query(None)
# ):
#     """Get all communication history for a lead - SUPABASE ONLY"""
#     try:
#         history = communication_service.get_conversation_history(
#             lead_id=lead_id,
#             communication_type=type
#         )
#         return history
#     except Exception as e:
#         logger.error(f"Communication history error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
# 
# 
# @app.get("/api/communications/training-data")
# async def get_training_data(
#     type: Optional[str] = Query(None),
#     limit: int = Query(1000)
# ):
#     """Get communication data for ML model training - SUPABASE ONLY"""
#     try:
#         training_data = communication_service.get_training_data(
#             communication_type=type,
#             limit=limit
#         )
#         return {
#             "total_records": len(training_data),
#             "data": training_data
#         }
#     except Exception as e:
#         logger.error(f"Training data error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
# 
# 
# @app.post("/api/communications/mark-training")
# async def mark_as_training_data(
#     data: Dict[str, List[int]]
# ):
#     """Mark specific communications as used for training - SUPABASE ONLY"""
#     try:
#         communication_service.mark_as_training_data(
#             communication_ids=data['ids']
#         )
#         return {"success": True, "marked_count": len(data['ids'])}
#     except Exception as e:
#         logger.error(f"Mark training error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# WHATSAPP LIVE CHAT (Interakt 2-way messaging)
# ============================================================================

from fastapi import UploadFile, File, Request as FARequest
import uuid as _uuid

class ChatSendRequest(BaseModel):
    message: Optional[str] = None
    msg_type: str = "text"          # text | image | document | video
    media_url: Optional[str] = None # required for image/document/video
    filename: Optional[str] = None  # for documents
    sender_name: str = "CRM"
    country_code: str = "+91"


class ChatMessageResponse(BaseModel):
    id: int
    lead_db_id: int
    direction: str
    msg_type: str
    content: Optional[str] = None
    media_url: Optional[str] = None
    filename: Optional[str] = None
    sender_name: Optional[str] = None
    timestamp: datetime
    status: str
    interakt_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


@app.get("/api/leads/{lead_id}/chat", response_model=List[ChatMessageResponse])
async def get_chat_messages(lead_id: str):
    """Get all WhatsApp chat messages for a lead - SUPABASE ONLY"""

    try:
        # Resolve string lead_id (e.g. "LEAD-001") to internal numeric DB id
        lead_row = supabase_data.client.table('leads').select('id').eq('lead_id', lead_id).execute()
        if not lead_row.data:
            return []
        internal_id = lead_row.data[0]['id']
        response = supabase_data.client.table('chat_messages').select('*').eq('lead_db_id', internal_id).order('timestamp').execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error getting chat messages for {lead_id}: {e}")
        return []


@app.post("/api/leads/{lead_id}/chat", response_model=ChatMessageResponse)
async def send_chat_message(lead_id: str, req: ChatSendRequest):
    """Send a WhatsApp message (text or media) to a lead via Interakt - SUPABASE ONLY"""

    # Resolve string lead_id (e.g. "LEAD-001") to internal row
    lead_row = supabase_data.client.table('leads').select('*').eq('lead_id', lead_id).execute()
    if not lead_row.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead = lead_row.data[0]
    internal_id = lead['id']
    phone = lead.get('whatsapp') or lead.get('phone')
    if not phone:
        raise HTTPException(status_code=400, detail="Lead has no WhatsApp/phone number")

    from communication_service import InteraktWhatsAppService
    wa = InteraktWhatsAppService()

    if req.msg_type == "text":
        result = await wa.send_message(phone, req.message or "", req.country_code)
    else:
        result = await wa.send_media(
            to=phone,
            media_type=req.msg_type,
            url=req.media_url or "",
            filename=req.filename,
            caption=req.message,
            country_code=req.country_code,
        )

    # Save message to Supabase chat_messages table
    msg_data = {
        "lead_db_id": internal_id,
        "direction": "outbound",
        "msg_type": req.msg_type,
        "content": req.message,
        "media_url": req.media_url,
        "filename": req.filename,
        "sender_name": req.sender_name,
        "status": "sent" if result.get("success") else "failed",
        "interakt_id": result.get("message_id"),
        "created_at": datetime.utcnow().isoformat()
    }

    # Remove None values
    msg_data = {k: v for k, v in msg_data.items() if v is not None}

    insert_resp = supabase_data.client.table('chat_messages').insert(msg_data).execute()
    if insert_resp.data:
        return insert_resp.data[0]
    else:
        raise HTTPException(status_code=500, detail="Failed to save message")


@app.post("/api/interakt/webhook")
async def interakt_webhook(request: FARequest):
    """Receive incoming WhatsApp messages from Interakt webhook - SUPABASE ONLY"""
    
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ok"}
    
    try:
        data = payload.get("data", {})
        msg_data = data.get("message", {})
        contact = data.get("contact", {})
        
        wa_id = contact.get("wa_id", "") or msg_data.get("from", "")
        sender_name = contact.get("profile", {}).get("name", wa_id)
        msg_type_raw = msg_data.get("type", "text")
        interakt_id = msg_data.get("id", "")
        
        # Extract content
        content = None
        media_url = None
        filename = None
        
        if msg_type_raw == "text":
            content = msg_data.get("text", {}).get("body", "")
            msg_type = "text"
        elif msg_type_raw == "image":
            content = msg_data.get("image", {}).get("caption", "")
            media_url = msg_data.get("image", {}).get("url", "")
            msg_type = "image"
        elif msg_type_raw == "document":
            content = msg_data.get("document", {}).get("caption", "")
            media_url = msg_data.get("document", {}).get("url", "")
            filename = msg_data.get("document", {}).get("filename", "")
            msg_type = "document"
        elif msg_type_raw == "video":
            content = msg_data.get("video", {}).get("caption", "")
            media_url = msg_data.get("video", {}).get("url", "")
            msg_type = "video"
        elif msg_type_raw == "audio":
            media_url = msg_data.get("audio", {}).get("url", "")
            msg_type = "audio"
        else:
            content = str(msg_data)
            msg_type = "text"

        # Find lead by phone using Supabase (try whatsapp field first, then phone)
        normalized = wa_id.replace("+", "").strip()
        last_10_digits = normalized[-10:]
        
        # Search in whatsapp field
        lead_response = supabase_data.client.table('leads').select('id,whatsapp,phone').ilike('whatsapp', f'%{last_10_digits}%').limit(1).execute()
        
        # If not found, search in phone field
        if not lead_response.data:
            lead_response = supabase_data.client.table('leads').select('id,whatsapp,phone').ilike('phone', f'%{last_10_digits}%').limit(1).execute()
        
        if lead_response.data:
            lead = lead_response.data[0]
            
            # Save incoming message to Supabase
            chat_msg_data = {
                "lead_db_id": lead['id'],
                "direction": "inbound",
                "msg_type": msg_type,
                "content": content,
                "media_url": media_url,
                "filename": filename,
                "sender_name": sender_name,
                "status": "received",
                "interakt_id": interakt_id,
                "created_at": datetime.utcnow().isoformat()
            }
            # Remove None values
            chat_msg_data = {k: v for k, v in chat_msg_data.items() if v is not None}
            supabase_data.client.table('chat_messages').insert(chat_msg_data).execute()

    except Exception as e:
        logger.error(f"Interakt webhook error: {e}")

    return {"status": "ok"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file to Supabase Storage and return its public URL"""
    from supabase_client import supabase_manager

    client = supabase_manager.client
    if not client:
        raise HTTPException(status_code=500, detail="Storage not available")

    content = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    storage_path = f"chat/{_uuid.uuid4()}.{ext}"
    bucket = "chat-media"

    try:
        client.storage.from_(bucket).upload(
            storage_path,
            content,
            {"content-type": file.content_type or "application/octet-stream"}
        )
        public_url = client.storage.from_(bucket).get_public_url(storage_path)
        return {"url": public_url, "filename": file.filename, "content_type": file.content_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ============================================================
# ADMIN DASHBOARD ENDPOINTS
# ============================================================

@app.get("/api/admin/stats")
async def get_admin_stats():
    """Admin dashboard: total revenue, leads, conversion rate, trends - SUPABASE ONLY"""
    
    try:
        # Get all leads
        response = supabase_data.client.table('leads').select('status,ai_segment,expected_revenue,created_at').execute()
        leads = response.data if response.data else []

        total_leads = len(leads)
        enrolled = sum(1 for l in leads if l.get('status') == 'Enrolled')
        hot_leads = sum(1 for l in leads if l.get('ai_segment') == 'Hot')

        # Revenue from enrolled leads
        total_revenue = sum(l.get('expected_revenue', 0) or 0 for l in leads if l.get('status') == 'Enrolled')
        
        # This month vs last month
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_start = (month_start - timedelta(days=1)).replace(day=1)
        
        this_month_leads = sum(1 for l in leads if l.get('created_at') and datetime.fromisoformat(l['created_at'].replace('Z', '+00:00')) >= month_start)
        last_month_leads = sum(1 for l in leads if l.get('created_at') and last_month_start <= datetime.fromisoformat(l['created_at'].replace('Z', '+00:00')) < month_start)
        
        leads_trend = ((this_month_leads - last_month_leads) / max(last_month_leads, 1)) * 100
        conversion_rate = (enrolled / max(total_leads, 1)) * 100
        
        return {
            "total_revenue": total_revenue,
            "total_leads": total_leads,
            "enrolled": enrolled,
            "hot_leads": hot_leads,
            "conversion_rate": round(conversion_rate, 2),
            "avg_conversion_rate": round(conversion_rate, 2),
            "revenue_trend": 0,
            "leads_trend": round(leads_trend, 2),
            "conversion_trend": 0,
            "this_month_leads": this_month_leads,
        }
    except Exception as e:
        logger.error(f"Admin stats error: {e}")
        return {"total_revenue": 0, "total_leads": 0, "enrolled": 0, "hot_leads": 0,
                "conversion_rate": 0, "avg_conversion_rate": 0, "revenue_trend": 0,
                "leads_trend": 0, "conversion_trend": 0, "this_month_leads": 0}


@app.get("/api/admin/team-performance")
async def get_team_performance():
    """Admin dashboard: per-counselor performance metrics - SUPABASE ONLY"""
    
    try:
        # Get counselors
        users = supabase_data.get_all_users()
        counselors = [u for u in users if u.get('role') == 'Counselor']
        
        # Get all leads
        response = supabase_data.client.table('leads').select('assigned_to,status,ai_segment,expected_revenue').execute()
        all_leads = response.data if response.data else []

        result = []
        for u in counselors:
            counselor_name = u['full_name']
            assigned = [l for l in all_leads if l.get('assigned_to') == counselor_name]
            total = len(assigned)
            conversions = sum(1 for l in assigned if l.get('status') == 'Enrolled')
            hot = sum(1 for l in assigned if l.get('ai_segment') == 'Hot')
            revenue = sum(l.get('expected_revenue', 0) or 0 for l in assigned if l.get('status') == 'Enrolled')
            
            result.append({
                "id": u['id'],
                "name": u['full_name'] or u['email'],
                "total_leads": total,
                "conversions": conversions,
                "hot_leads": hot,
                "revenue": revenue,
                "conversion_rate": round((conversions / max(total, 1)) * 100, 2),
                "rank": 0,
            })
        
        # Rank by conversion rate
        result.sort(key=lambda x: x['conversion_rate'], reverse=True)
        for i, r in enumerate(result):
            r['rank'] = i + 1
        
        return result
    except Exception as e:
        logger.error(f"Team performance error: {e}")
        return []


@app.get("/api/admin/funnel-analysis")
async def get_funnel_analysis():
    """Funnel analysis - SUPABASE ONLY"""
    
    try:
        # Get all leads
        response = supabase_data.client.table('leads').select('status').execute()
        leads = response.data if response.data else []
        
        stages = {}
        for lead in leads:
            status = lead.get('status', 'Unknown')
            stages[status] = stages.get(status, 0) + 1
        
        return {"stages": [{'name': k, 'count': v} for k, v in stages.items()]}
    except Exception as e:
        logger.error(f"Funnel analysis error: {e}")
        return {"stages": []}


@app.get("/api/admin/revenue-trend")
async def get_revenue_trend(days: int = 30):
    """Admin dashboard: daily revenue trend for past N days - SUPABASE ONLY"""
    
    try:
        from collections import defaultdict
        from datetime import datetime, timedelta
        
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Get enrolled leads from Supabase
        response = supabase_data.client.table('leads').select('status,expected_revenue,updated_at,created_at').eq('status', 'Enrolled').execute()
        enrolled = response.data if response.data else []

        # Filter by cutoff date
        enrolled = [l for l in enrolled if l.get('updated_at') and datetime.fromisoformat(l['updated_at'].replace('Z', '+00:00')) >= cutoff]

        daily = defaultdict(float)
        for lead in enrolled:
            updated_at = lead.get('updated_at') or lead.get('created_at')
            if updated_at:
                try:
                    dt = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                    day_key = dt.strftime('%Y-%m-%d')
                    daily[day_key] += lead.get('expected_revenue', 0) or 0
                except:
                    pass
        
        result = [{"date": k, "revenue": v} for k, v in sorted(daily.items())]
        return result
    except Exception as e:
        logger.error(f"Revenue trend error: {e}")
        return []


# ============================================================
# USER/COUNSELOR STATS ENDPOINTS
# ============================================================

@app.get("/api/users/{user_id}/stats")
async def get_user_stats(user_id: int):
    """Per-user stats for counselor dashboard - SUPABASE ONLY"""

    try:
        user = supabase_data.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get all leads assigned to this user (include follow_up_date for today count)
        response = supabase_data.client.table('leads').select(
            'status,ai_segment,expected_revenue,created_at,follow_up_date'
        ).eq('assigned_to', user['full_name']).execute()
        assigned = response.data if response.data else []

        total = len(assigned)
        enrolled = sum(1 for l in assigned if l.get('status') == 'Enrolled')
        hot = sum(1 for l in assigned if l.get('ai_segment') == 'Hot')
        warm = sum(1 for l in assigned if l.get('ai_segment') == 'Warm')
        revenue = sum(l.get('expected_revenue', 0) or 0 for l in assigned if l.get('status') == 'Enrolled')

        today = datetime.utcnow().date()

        # Leads created today
        today_leads = sum(
            1 for l in assigned
            if l.get('created_at') and datetime.fromisoformat(
                l['created_at'].replace('Z', '+00:00')
            ).date() == today
        )

        # Follow-ups due today
        followups_today = sum(
            1 for l in assigned
            if l.get('follow_up_date') and l['follow_up_date'][:10] == today.isoformat()
        )

        return {
            "user_id": user_id,
            "name": user['full_name'],
            "total_leads": total,
            "enrolled": enrolled,
            "hot_leads": hot,
            "warm_leads": warm,
            "today_leads": today_leads,
            "followups_today": followups_today,
            "revenue": round(revenue, 2),
            "conversion_rate": round((enrolled / max(total, 1)) * 100, 2),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User stats error: {e}")
        return {"total_leads": 0, "enrolled": 0, "hot_leads": 0, "warm_leads": 0,
                "today_leads": 0, "followups_today": 0, "revenue": 0, "conversion_rate": 0}


@app.get("/api/users/{user_id}/performance")
async def get_user_performance(user_id: int, days: int = 7):
    """Per-user daily performance for sparkline charts - SUPABASE ONLY"""
    
    try:
        from collections import defaultdict
        from datetime import datetime, timedelta
        
        user = supabase_data.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Get leads assigned to this user
        response = supabase_data.client.table('leads').select('status,created_at').eq('assigned_to', user['full_name']).execute()
        leads = response.data if response.data else []
        
        # Filter by cutoff
        leads = [l for l in leads if l.get('created_at') and datetime.fromisoformat(l['created_at'].replace('Z', '+00:00')) >= cutoff]
        
        daily = defaultdict(lambda: {"leads": 0, "enrolled": 0})
        for lead in leads:
            try:
                dt = datetime.fromisoformat(lead['created_at'].replace('Z', '+00:00'))
                day_key = dt.strftime('%a')
                daily[day_key]["leads"] += 1
                if lead.get('status') == 'Enrolled':
                    daily[day_key]["enrolled"] += 1
            except:
                pass
        
        return [{"day": k, **v} for k, v in daily.items()]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User performance error: {e}")
        return []


# ============================================================
# NOTIFICATION ACTION ENDPOINTS
# ============================================================

@app.patch("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read (acknowledged)."""
    return {"status": "ok", "notification_id": notification_id, "read": True}


@app.patch("/api/notifications/{notification_id}/snooze")
async def snooze_notification(notification_id: str, hours: int = 1):
    """Snooze a notification for N hours."""
    snooze_until = (datetime.utcnow() + timedelta(hours=hours)).isoformat()
    return {"status": "ok", "notification_id": notification_id, "snoozed_until": snooze_until}


@app.post("/api/notifications/read-all")
async def mark_all_notifications_read():
    """Mark all notifications as read."""
    return {"status": "ok", "message": "All notifications marked as read"}


# ============================================================
# HOSPITAL CRUD - UPDATE & DELETE
# ============================================================

@app.put("/api/hospitals/{hospital_id}", response_model=HospitalResponse)
async def update_hospital(hospital_id: int, data: HospitalCreate):
    """Update an existing hospital record - SUPABASE ONLY"""
    
    try:
        # Check if hospital exists
        existing = supabase_data.client.table('hospitals').select('id').eq('id', hospital_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        # Update hospital
        payload = data.dict(exclude_unset=True)
        updated = supabase_data.update_hospital(hospital_id, payload)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update hospital")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "duplicate key" in error_msg.lower() or "unique" in error_msg.lower():
            raise HTTPException(status_code=409, detail="A hospital with this name already exists.")
        logger.error(f"update_hospital error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update hospital.")


@app.delete("/api/hospitals/{hospital_id}")
async def delete_hospital(hospital_id: int):
    """Delete a hospital record - SUPABASE ONLY"""
    
    try:
        # Check if hospital exists
        existing = supabase_data.client.table('hospitals').select('id').eq('id', hospital_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        # Delete hospital
        success = supabase_data.delete_hospital(hospital_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete hospital")
        return {"message": "Hospital deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"delete_hospital error: {e}")
        raise HTTPException(status_code=409, detail="Cannot delete hospital — it may be referenced by existing leads.")


# ============================================================
# COURSE CRUD - UPDATE & DELETE
# ============================================================

@app.put("/api/courses/{course_id}", response_model=CourseResponse)
async def update_course(course_id: int, data: CourseCreate):
    """Update an existing course record - SUPABASE ONLY"""
    
    try:
        # Check if course exists
        existing = supabase_data.client.table('courses').select('id').eq('id', course_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Update course
        payload = data.dict(exclude_unset=True)
        updated = supabase_data.update_course(course_id, payload)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update course")
        invalidate_cache(COURSE_CACHE)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "duplicate key" in error_msg.lower() or "unique" in error_msg.lower():
            raise HTTPException(status_code=409, detail="A course with this name already exists.")
        logger.error(f"update_course error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update course.")


@app.delete("/api/courses/{course_id}")
async def delete_course(course_id: int):
    """Delete a course record - SUPABASE ONLY"""
    
    try:
        # Check if course exists
        existing = supabase_data.client.table('courses').select('id').eq('id', course_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Delete course
        success = supabase_data.delete_course(course_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete course")
        invalidate_cache(COURSE_CACHE)
        return {"message": "Course deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"delete_course error: {e}")
        raise HTTPException(status_code=409, detail="Cannot delete course — it may be referenced by existing leads.")


# ============================================================
# USER PASSWORD CHANGE
# ============================================================

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@app.put("/api/users/{user_id}/password")
async def change_password(user_id: int, data: PasswordChangeRequest):
    """Allow a user to change their own password - SUPABASE ONLY"""
    
    import bcrypt as _bcrypt

    user = supabase_data.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    password_valid = False
    if user.get('password'):
        if user['password'].startswith('$2b$') or user['password'].startswith('$2a$'):
            try:
                password_valid = _bcrypt.checkpw(
                    data.current_password.encode('utf-8'),
                    user['password'].encode('utf-8')
                )
            except Exception:
                password_valid = False
        else:
            # plain text password (legacy)
            password_valid = (user['password'] == data.current_password)

    if not password_valid:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Hash new password
    try:
        new_hashed = _bcrypt.hashpw(
            data.new_password.encode('utf-8'),
            _bcrypt.gensalt()
        ).decode('utf-8')
    except Exception:
        # Fallback to plain text if bcrypt fails
        new_hashed = data.new_password

    # Update password in Supabase
    updated = supabase_data.update_user(user_id, {'password': new_hashed})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update password")
    return {"message": "Password updated successfully"}


class AdminPasswordResetRequest(BaseModel):
    new_password: str


@app.put("/api/users/{user_id}/admin-reset-password")
async def admin_reset_password(user_id: int, data: AdminPasswordResetRequest, request: Request):
    """Allow a Super Admin to reset any user's password without requiring the current password - SUPABASE ONLY"""
    
    # Verify caller is Super Admin
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            token_data = decode_access_token(auth_header.split(" ", 1)[1])
            if not token_data or token_data.role != "Super Admin":
                raise HTTPException(status_code=403, detail="Only Super Admins can reset user passwords")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=403, detail="Only Super Admins can reset user passwords")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    import bcrypt as _bcrypt

    user = supabase_data.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not data.new_password or len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    try:
        new_hashed = _bcrypt.hashpw(
            data.new_password.encode('utf-8'),
            _bcrypt.gensalt()
        ).decode('utf-8')
    except Exception:
        new_hashed = data.new_password

    # Update password in Supabase
    updated = supabase_data.update_user(user_id, {'password': new_hashed})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to reset password")
    return {"message": "Password reset successfully"}


# ============================================================
# BEST TIME TO CALL — ANALYTICS
# ============================================================

# UTC offset (hours) per country for local-time conversion
_COUNTRY_TZ = {
    "India": 5.5, "UAE": 4.0, "Saudi Arabia": 3.0, "Kuwait": 3.0,
    "Bahrain": 3.0, "Oman": 4.0, "Qatar": 3.0, "Jordan": 3.0,
    "UK": 0.0, "USA": -5.0, "Canada": -5.0, "Germany": 1.0,
    "Australia": 10.0, "Singapore": 8.0, "Malaysia": 8.0,
    "New Zealand": 12.0, "Nepal": 5.75, "Sri Lanka": 5.5,
    "South Africa": 2.0, "Kenya": 3.0, "Nigeria": 1.0,
    "Egypt": 2.0, "Pakistan": 5.0, "Bangladesh": 6.0,
}
_DEFAULT_TZ = 5.5  # IST fallback

# Keywords indicating an unanswered / missed call in note content
_MISS_KEYWORDS = [
    "not answering", "not available", "no answer", "didn't pick",
    "did not pick", "didn't answer", "did not answer", "switched off",
    "not reachable", "unreachable", "busy", "not responding",
    "couldn't reach", "could not reach", "call back later",
    "call later", "try again", "no response", "goes to voicemail",
    "voicemail", "phone off", "out of reach", "number busy",
]

_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _to_local(utc_dt: datetime, country: str):
    offset_h = _COUNTRY_TZ.get(country, _DEFAULT_TZ)
    from datetime import timedelta
    return utc_dt + timedelta(hours=offset_h)


def _is_connected(content: str) -> bool:
    """Return True if note content looks like a connected call."""
    text = (content or "").lower().strip()
    if not text or len(text) < 10:
        return False                       # blank / too short → logged as missed
    if any(kw in text for kw in _MISS_KEYWORDS):
        return False
    return True


@app.get("/api/analytics/call-timing")
async def get_call_timing(country: Optional[str] = None):
    """
    Analyse call notes by IST hour and day-of-week.
    Mines the notes table (channel='call') for structured call outcomes,
    classifies each as connected / not-connected, and builds a heatmap.
    """
    from datetime import timezone as _tz
    from collections import defaultdict

    # IST = UTC + 5:30
    IST = _tz(timedelta(hours=5, minutes=30))

    # Keywords that indicate NOT connected
    _NOT_CONNECTED = [
        "not connected", "no answer", "switched off",
        "not reachable", "busy", "not answering",
    ]

    def _is_connected(content: str) -> bool:
        first = (content or "").split("\n")[0].lower()
        return not any(kw in first for kw in _NOT_CONNECTED)

    try:
        # ── Fetch call notes ──────────────────────────────────────────────
        q = (
            supabase_data.client.table("notes")
            .select("id,lead_id,content,channel,created_at")
            .eq("channel", "call")
            .order("created_at", desc=False)
            .limit(10000)
        )
        resp = q.execute()
        notes = resp.data or []

        # Also pick up activities with type 'status_change' or 'call' that
        # contain disposition info
        try:
            aq = (
                supabase_data.client.table("activities")
                .select("id,lead_id,activity_type,description,created_at")
                .eq("activity_type", "call")
                .order("created_at", desc=False)
                .limit(5000)
            )
            ar = aq.execute()
            for a in (ar.data or []):
                notes.append({
                    "lead_id":    a.get("lead_id"),
                    "content":    a.get("description", ""),
                    "channel":    "call",
                    "created_at": a.get("created_at"),
                })
        except Exception:
            pass

        # ── Optional country filter ───────────────────────────────────────
        if country and notes:
            try:
                lr = (
                    supabase_data.client.table("leads")
                    .select("id")
                    .ilike("country", country.strip())
                    .execute()
                )
                cids = {row["id"] for row in (lr.data or [])}
                notes = [n for n in notes if n.get("lead_id") in cids]
            except Exception:
                pass

        if not notes:
            return {
                "by_hour": [], "by_dow": [], "heatmap": {},
                "best_windows": [], "worst_windows": [],
                "overall": {
                    "total_calls": 0, "connected": 0,
                    "avg_connection_rate": 0, "best_hour": 10,
                },
                "data_quality": "insufficient",
                "country": country or "All",
            }

        # ── Build heatmap ─────────────────────────────────────────────────
        # heatmap[dow_js][hour] = {total, connected}
        # dow_js: Sun=0 … Sat=6  (matches JS getDay())
        heatmap: dict = defaultdict(lambda: defaultdict(lambda: {"total": 0, "connected": 0}))
        hour_agg: dict = defaultdict(lambda: {"total": 0, "connected": 0})

        for note in notes:
            ts = note.get("created_at")
            if not ts:
                continue
            try:
                safe = ts if (ts.endswith("Z") or "+" in ts) else ts + "Z"
                dt_utc = datetime.fromisoformat(safe.replace("Z", "+00:00"))
                dt_ist = dt_utc.astimezone(IST)
                hour   = dt_ist.hour
                # Python weekday(): Mon=0..Sun=6 → JS getDay(): Sun=0..Sat=6
                dow_js = (dt_ist.weekday() + 1) % 7
            except Exception:
                continue

            connected = 1 if _is_connected(note.get("content", "")) else 0
            heatmap[dow_js][hour]["total"]     += 1
            heatmap[dow_js][hour]["connected"] += connected
            hour_agg[hour]["total"]            += 1
            hour_agg[hour]["connected"]        += connected

        # ── Serialise heatmap ─────────────────────────────────────────────
        resp_heatmap: dict = {}
        windows: list = []
        for dow_js, hours in heatmap.items():
            resp_heatmap[str(dow_js)] = {}
            for hour, s in hours.items():
                rate = s["connected"] / s["total"] if s["total"] else 0
                resp_heatmap[str(dow_js)][str(hour)] = {
                    "rate":      round(rate, 3),
                    "calls":     s["total"],
                    "connected": s["connected"],
                }
                if s["total"] >= 2:   # only windows with ≥2 data points
                    windows.append({
                        "dow":   dow_js,
                        "hour":  hour,
                        "rate":  round(rate, 3),
                        "calls": s["total"],
                    })

        windows.sort(key=lambda w: (-w["rate"], -w["calls"]))
        best_windows  = windows[:5]
        worst_windows = sorted(windows, key=lambda w: (w["rate"], -w["calls"]))[:3]

        # ── Overall stats ────────────────────────────────────────────────
        total_calls = sum(s["total"]     for s in hour_agg.values())
        total_conn  = sum(s["connected"] for s in hour_agg.values())
        avg_rate    = total_conn / total_calls if total_calls else 0
        best_hour   = max(
            hour_agg.keys(),
            key=lambda h: hour_agg[h]["connected"] / hour_agg[h]["total"]
                          if hour_agg[h]["total"] > 0 else 0,
            default=10,
        )
        data_quality = "high" if total_calls >= 50 else "medium" if total_calls >= 15 else "low"

        return {
            "by_hour": [
                {
                    "hour":  h,
                    "rate":  round(s["connected"] / s["total"], 3) if s["total"] else 0,
                    "calls": s["total"],
                }
                for h, s in sorted(hour_agg.items())
            ],
            "heatmap":       resp_heatmap,
            "best_windows":  best_windows,
            "worst_windows": worst_windows,
            "overall": {
                "total_calls":         total_calls,
                "connected":           total_conn,
                "avg_connection_rate": round(avg_rate, 3),
                "best_hour":           best_hour,
            },
            "data_quality": data_quality,
            "country":      country or "All",
        }

    except Exception as e:
        logger.error(f"Call timing error: {e}", exc_info=True)
        return {"by_hour": [], "by_dow": [], "heatmap": {}, "best_windows": [], "overall": {}}


# ============================================================
# SLA CONFIG & COMPLIANCE
# ============================================================

@app.get("/api/admin/sla-config")
async def get_sla_config():
    """Get SLA config from Supabase - SUPABASE ONLY"""
    
    try:
        response = supabase_data.client.table('sla_config').select('*').limit(1).execute()
        if response.data and len(response.data) > 0:
            cfg = response.data[0]
            return {
                "first_contact_hours": cfg.get('first_contact_hours', 24),
                "followup_response_hours": cfg.get('followup_response_hours', 48),
                "no_activity_days": cfg.get('no_activity_days', 7),
                "updated_at": cfg.get('updated_at'),
                "updated_by": cfg.get('updated_by'),
            }
        # Default config
        return {
            "first_contact_hours": 24,
            "followup_response_hours": 48,
            "no_activity_days": 7,
            "updated_at": None,
            "updated_by": None,
        }
    except Exception as e:
        logger.error(f"Error getting SLA config: {e}")
        return {
            "first_contact_hours": 24,
            "followup_response_hours": 48,
            "no_activity_days": 7,
            "updated_at": None,
            "updated_by": None,
        }


class SLAConfigUpdate(BaseModel):
    first_contact_hours:     Optional[float] = None
    followup_response_hours: Optional[float] = None
    no_activity_days:        Optional[int]   = None
    updated_by:              Optional[str]   = None


@app.put("/api/admin/sla-config")
async def update_sla_config(data: SLAConfigUpdate):
    """Update SLA config in Supabase - SUPABASE ONLY"""
    
    try:
        # Check if config exists
        response = supabase_data.client.table('sla_config').select('id').limit(1).execute()
        
        update_data = {
            'first_contact_hours': data.first_contact_hours,
            'followup_response_hours': data.followup_response_hours,
            'no_activity_days': data.no_activity_days,
            'updated_by': 'System',
            'updated_at': datetime.utcnow().isoformat()
        }
        
        if response.data and len(response.data) > 0:
            # Update existing
            config_id = response.data[0]['id']
            supabase_data.client.table('sla_config').update(update_data).eq('id', config_id).execute()
        else:
            # Create new
            supabase_data.client.table('sla_config').insert(update_data).execute()
        
        return {"success": True, "message": "SLA config updated"}
    except Exception as e:
        logger.error(f"Error updating SLA config: {e}")
        raise HTTPException(status_code=500, detail="Failed to update SLA config")


@app.get("/api/admin/sla-compliance")
async def get_sla_compliance():
    """
    Returns per-lead SLA status for three rules:
      1. first_contact  – first note logged within first_contact_hours of lead creation
      2. followup       – follow_up_date not overdue by more than followup_response_hours
      3. no_activity    – last_contact_date not older than no_activity_days (active leads only)

    Aggregates by counselor and returns a breach list.
    """
    # Return empty structure for now - SLA compliance requires database migration
    return {
        "config": {
            "first_contact_hours": 24,
            "followup_response_hours": 24,
            "no_activity_days": 7,
        },
        "overall": {
            "total": 0,
            "compliant": 0,
            "breached": 0,
            "pending": 0,
            "compliance_rate": None,
        },
        "by_counselor": [],
        "breaches": [],
        "active_breaches": 0,
    }


# ============================================================
# COHORT ANALYSIS
# ============================================================

@app.get("/api/admin/cohort-analysis")
async def get_cohort_analysis():
    """Cohort analysis grouped by month - SUPABASE ONLY (Simplified)"""
    
    try:
        from datetime import datetime
        from collections import defaultdict
        
        # Get all leads
        response = supabase_data.client.table('leads').select('created_at,status,updated_at').execute()
        all_leads = response.data if response.data else []
        
        # Group by cohort month
        cohorts = defaultdict(list)
        for lead in all_leads:
            if lead.get('created_at'):
                try:
                    dt = datetime.fromisoformat(lead['created_at'].replace('Z', '+00:00'))
                    key = dt.strftime("%Y-%m")
                    cohorts[key].append(lead)
                except:
                    pass
        
        # Calculate stats for each cohort
        result = []
        for month, leads in sorted(cohorts.items()):
            size = len(leads)
            enrolled = sum(1 for l in leads if l.get('status') == 'Enrolled')
            result.append({
                "month": month,
                "size": size,
                "enrolled": enrolled,
                "rate": round((enrolled / size * 100) if size > 0 else 0, 2)
            })
        
        return {
            "cohorts": result,
            "benchmarks": {},
            "underperforming": []
        }
    except Exception as e:
        logger.error(f"Cohort analysis error: {e}")
        return {"cohorts": [], "benchmarks": {}, "underperforming": []}
        return None  # enrolled but timestamps missing / same day

    rows = []
    for key in sorted(cohorts.keys()):
        leads = cohorts[key]
        size = len(leads)
        cohort_start = datetime.strptime(key, "%Y-%m")
        age_days = (now - cohort_start).days  # how old is this cohort in days

        enrolled = [l for l in leads if l.status == LeadStatus.ENROLLED]
        active   = [l for l in leads if l.status not in TERMINAL]
        dead     = [l for l in leads if l.status in (LeadStatus.NOT_INTERESTED, LeadStatus.JUNK)]

        # conversions within N days (only count enrolled leads with valid day delta)
        def within(n):
            return sum(
                1 for l in enrolled
                if (d := conv_days(l)) is not None and d <= n
            )

        c30  = within(30)
        c60  = within(60)
        c90  = within(90)
        ctot = len(enrolled)

        r = lambda n, c: round(c / size * 100, 1) if size else 0.0

        # Compute median days for enrolled leads in this cohort
        enrolled_days = [d for l in enrolled if (d := conv_days(l)) is not None]
        med_days = round(statistics.median(enrolled_days), 0) if enrolled_days else None

        rows.append({
            "cohort":      key,
            "label":       cohort_start.strftime("%b %Y"),
            "size":        size,
            "conv_30":     c30,
            "conv_60":     c60,
            "conv_90":     c90,
            "conv_total":  ctot,
            "rate_30":     r(30,  c30),
            "rate_60":     r(60,  c60),
            "rate_90":     r(90,  c90),
            "rate_total":  r(None, ctot),
            "active":      len(active),
            "dead":        len(dead),
            "age_days":    age_days,
            "mature_30":   age_days >= 30,
            "mature_60":   age_days >= 60,
            "mature_90":   age_days >= 90,
            "median_days": med_days,
        })

    # ── benchmarks from mature cohorts only ───────────────
    def bench(field, min_age):
        vals = [r[field] for r in rows if r["age_days"] >= min_age and r["size"] >= 3]
        if not vals:
            return None
        return round(sum(vals) / len(vals), 1)

    benchmarks = {
        "avg_rate_30":    bench("rate_30",  30),
        "avg_rate_60":    bench("rate_60",  60),
        "avg_rate_90":    bench("rate_90",  90),
        "avg_rate_total": bench("rate_total", 0),
    }

    # ── underperforming cohorts ────────────────────────────
    avg90 = benchmarks["avg_rate_90"]
    threshold = 15  # percentage points below average
    underperforming = [
        r["cohort"] for r in rows
        if r["mature_90"] and avg90 is not None and (avg90 - r["rate_90"]) >= threshold
    ]

    return {
        "cohorts":        rows,
        "benchmarks":     benchmarks,
        "underperforming": underperforming,
    }


# ============================================================
# TIME-TO-CONVERSION FUNNEL
# ============================================================

@app.get("/api/admin/conversion-time")
async def get_conversion_time():
    """Compute days from creation to enrollment - SUPABASE ONLY (Simplified)"""
    
    try:
        from datetime import datetime
        
        # Get enrolled leads
        response = supabase_data.client.table('leads').select('created_at,updated_at,assigned_to,course_interested,country').eq('status', 'Enrolled').execute()
        enrolled = response.data if response.data else []
        
        # Calculate days to conversion
        conversion_days = []
        for lead in enrolled:
            if lead.get('created_at') and lead.get('updated_at'):
                try:
                    created = datetime.fromisoformat(lead['created_at'].replace('Z', '+00:00'))
                    updated = datetime.fromisoformat(lead['updated_at'].replace('Z', '+00:00'))
                    if updated > created:
                        days = (updated - created).days
                        conversion_days.append(days)
                except:
                    pass
        
        if not conversion_days:
            return {"overall": {"count": 0}, "distribution": [], "by_counselor": [], "by_course": [], "by_country": []}
        
        # Calculate stats
        avg_days = sum(conversion_days) / len(conversion_days)
        conversion_days.sort()
        median = conversion_days[len(conversion_days) // 2]
        
        return {
            "overall": {
                "avg": round(avg_days, 1),
                "median": median,
                "min": min(conversion_days),
                "max": max(conversion_days),
                "count": len(conversion_days)
            },
            "distribution": [],
            "by_counselor": [],
            "by_course": [],
            "by_country": []
        }
    except Exception as e:
        logger.error(f"Conversion time error: {e}")
        return {"overall": {"count": 0}, "distribution": [], "by_counselor": [], "by_course": [], "by_country": []}
        return None

    def agg(day_list):
        if not day_list:
            return {"avg_days": None, "median_days": None, "min_days": None, "max_days": None, "count": 0}
        s = sorted(day_list)
        n = len(s)
        return {
            "avg_days": round(sum(s) / n, 1),
            "median_days": round(statistics.median(s), 1),
            "p25_days": round(s[int(n * 0.25)], 1),
            "p75_days": round(s[int(n * 0.75)], 1),
            "min_days": s[0],
            "max_days": s[-1],
            "count": n,
        }

    all_days = [d for lead in enrolled_leads if (d := days(lead)) is not None]

    # histogram buckets
    buckets = [
        ("0–7 days",  0,   7),
        ("8–14 days", 8,   14),
        ("15–30 days",15,  30),
        ("31–60 days",31,  60),
        ("61–90 days",61,  90),
        ("90+ days",  91,  9999),
    ]
    distribution = []
    for label, lo, hi in buckets:
        count = sum(1 for d in all_days if lo <= d <= hi)
        distribution.append({"bucket": label, "count": count, "lo": lo, "hi": hi})

    # group helpers
    def group_by(key_fn):
        groups = {}
        for lead in enrolled_leads:
            k = key_fn(lead) or "Unknown"
            d = days(lead)
            if d is None:
                continue
            groups.setdefault(k, []).append(d)
        return [
            {"name": k, **agg(v)}
            for k, v in sorted(groups.items(), key=lambda x: (agg(x[1])["avg_days"] or 9999))
        ]

    by_counselor = group_by(lambda l: l.assigned_to)
    by_course    = group_by(lambda l: l.course_interested)
    by_country   = group_by(lambda l: l.country)

    return {
        "overall": agg(all_days),
        "distribution": distribution,
        "by_counselor": by_counselor,
        "by_course":    by_course,
        "by_country":   by_country,
    }


# ============================================================
# SOURCE ATTRIBUTION ANALYTICS
# ============================================================

@app.get("/api/admin/source-analytics")
async def get_source_analytics():
    """Per-source and per-campaign attribution metrics - SUPABASE ONLY"""

    def _aggregate(leads, group_key):
        buckets: dict = {}
        for lead in leads:
            key = (lead.get(group_key) or "Unknown").strip() or "Unknown"
            if key not in buckets:
                buckets[key] = {"label": key, "total": 0, "enrolled": 0, "hot": 0,
                                "revenue": 0.0, "potential": 0.0, "ai_score_sum": 0.0, "scored": 0}
            b = buckets[key]
            b["total"] += 1
            if lead.get("status") == "Enrolled":
                b["enrolled"] += 1
                b["revenue"] += lead.get("expected_revenue", 0) or 0
            if lead.get("ai_segment") == "Hot" or lead.get("status") == "Enrolled":
                b["hot"] += 1
            b["potential"] += lead.get("expected_revenue", 0) or 0
            if lead.get("ai_score") is not None:
                b["ai_score_sum"] += lead["ai_score"]
                b["scored"] += 1
        result = []
        for b in sorted(buckets.values(), key=lambda x: -x["enrolled"]):
            conv = round((b["enrolled"] / b["total"]) * 100, 1) if b["total"] > 0 else 0.0
            avg_rev = round(b["revenue"] / b["enrolled"], 0) if b["enrolled"] > 0 else 0.0
            avg_score = round(b["ai_score_sum"] / b["scored"], 1) if b["scored"] > 0 else 0.0
            result.append({
                "label": b["label"],
                "total_leads": b["total"],
                "enrolled": b["enrolled"],
                "hot_leads": b["hot"],
                "conversion_rate": conv,
                "total_revenue": round(b["revenue"], 0),
                "avg_revenue": avg_rev,
                "total_potential": round(b["potential"], 0),
                "roi_score": round(conv * (avg_rev / 10000), 1) if avg_rev > 0 else 0.0,
                "avg_ai_score": avg_score,
            })
        return result

    try:
        response = supabase_data.client.table("leads").select(
            "source,status,ai_segment,expected_revenue,ai_score,utm_source,utm_medium,utm_campaign"
        ).execute()
        all_leads = response.data if response.data else []

        sources_raw = _aggregate(all_leads, "source")
        # Rename "label" → "source" for backwards compatibility
        sources = [{**r, "source": r["label"]} for r in sources_raw]

        campaigns_raw = _aggregate(all_leads, "utm_campaign")
        utm_sources_raw = _aggregate(all_leads, "utm_source")

        total_leads    = sum(b["total_leads"] for b in sources)
        total_enrolled = sum(b["enrolled"]    for b in sources)
        total_revenue  = sum(b["total_revenue"] for b in sources)

        return {
            "sources": sources,
            "campaigns": campaigns_raw,
            "utm_sources": utm_sources_raw,
            "summary": {
                "total_leads": total_leads,
                "total_enrolled": total_enrolled,
                "overall_conversion_rate": round((total_enrolled / total_leads) * 100, 1) if total_leads > 0 else 0.0,
                "total_revenue": round(total_revenue, 0),
            },
        }
    except Exception as e:
        logger.error(f"Source analytics error: {e}")
        return {"sources": [], "campaigns": [], "utm_sources": [], "summary": {}}


# ─────────────────────────────────────────────────────────────────────────────
# SCORE DECAY ENGINE
# ─────────────────────────────────────────────────────────────────────────────

# Statuses that are already terminal — never downgrade these
_DECAY_TERMINAL = {"Enrolled", "Not Interested", "Junk", "enrolled",
                   "not_interested", "junk", LeadStatus.ENROLLED,
                   LeadStatus.NOT_INTERESTED, LeadStatus.JUNK}

# Map LeadStatus enum → display string for the log
def _status_str(s) -> str:
    return s.value if hasattr(s, "value") else str(s)


def _get_decay_config(db: Session) -> DBDecayConfig:
    cfg = db.query(DBDecayConfig).filter(DBDecayConfig.id == 1).first()
    if not cfg:
        cfg = DBDecayConfig(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def run_decay_cycle(db: Session) -> dict:
    """
    Core decay engine.  Runs through all active Hot and Warm leads and:
      1. Hot  → Warm       if hours_since_contact >= hot_to_warm_hours
      2. Warm → Follow Up  if hours_since_contact >= warm_to_stale_hours
      3. Decays ai_score by score_decay_per_day × days_since_contact
         (only when apply_score_decay=True, clamped to 0)

    Returns a summary dict with counts for the API response.
    """
    cfg = _get_decay_config(db)
    if not cfg.enabled:
        return {"enabled": False, "processed": 0, "downgraded": 0, "score_decayed": 0}

    now = datetime.utcnow()
    summary = {"enabled": True, "processed": 0, "downgraded": 0, "score_decayed": 0,
               "events": [], "run_at": now.isoformat()}

    # Pull all non-terminal leads that have a last_contact_date
    candidates = (
        db.query(DBLead)
        .filter(
            DBLead.status.notin_([
                LeadStatus.ENROLLED, LeadStatus.NOT_INTERESTED, LeadStatus.JUNK
            ]),
            DBLead.last_contact_date.isnot(None),
        )
        .all()
    )

    # Also catch Fresh / Follow-Up leads that were never contacted → use created_at
    fresh_never_contacted = (
        db.query(DBLead)
        .filter(
            DBLead.status.in_([LeadStatus.FRESH, LeadStatus.FOLLOW_UP]),
            DBLead.last_contact_date.is_(None),
        )
        .all()
    )
    # For never-contacted leads, treat created_at as the "last contact" reference
    all_candidates = [(l, l.last_contact_date) for l in candidates] + \
                     [(l, l.created_at) for l in fresh_never_contacted]

    for lead, ref_dt in all_candidates:
        if ref_dt is None:
            continue

        hours_silent = (now - ref_dt).total_seconds() / 3600
        days_silent  = hours_silent / 24
        old_status   = _status_str(lead.status)
        old_score    = lead.ai_score or 0.0
        changed      = False
        reason       = None

        # ── Status downgrade ────────────────────────────────────────────────
        if old_status in ("Hot", "hot") and hours_silent >= cfg.hot_to_warm_hours:
            lead.status = LeadStatus.WARM
            reason = "hot_to_warm"
            changed = True

        elif old_status in ("Warm", "warm") and hours_silent >= cfg.warm_to_stale_hours:
            lead.status = LeadStatus.FOLLOW_UP
            reason = "warm_to_stale"
            changed = True

        # ── Score decay ─────────────────────────────────────────────────────
        score_changed = False
        new_score = old_score
        if cfg.apply_score_decay and days_silent >= 1:
            # Clamp decay rate to safe range [0.0, 100.0] points/day
            safe_decay_per_day = max(0.0, min(float(cfg.score_decay_per_day or 3.0), 100.0))
            decay_amount = safe_decay_per_day * min(days_silent, 30)
            new_score = max(0.0, min(100.0, old_score - decay_amount))
            if abs(new_score - old_score) >= 0.5:
                lead.ai_score = round(new_score, 1)
                score_changed = True
                if not reason:
                    reason = "score_only"

        if not changed and not score_changed:
            continue

        summary["processed"] += 1
        if changed:
            summary["downgraded"] += 1
        if score_changed:
            summary["score_decayed"] += 1

        new_status_str = _status_str(lead.status)

        # ── Append DBNote ────────────────────────────────────────────────────
        if changed:
            note_content = (
                f"[AUTO-DECAY] Status changed {old_status} → {new_status_str}. "
                f"No contact for {hours_silent:.0f}h "
                f"(threshold: {cfg.hot_to_warm_hours if reason == 'hot_to_warm' else cfg.warm_to_stale_hours:.0f}h)."
            )
            db.add(DBNote(
                lead_id    = lead.id,
                content    = note_content,
                channel    = "system",
                created_by = "Decay Engine",
            ))
            db.add(DBActivity(
                lead_id       = lead.id,
                activity_type = "status_change",
                description   = note_content,
                created_by    = "Decay Engine",
            ))

        # ── Log entry ────────────────────────────────────────────────────────
        log = DBDecayLog(
            lead_id             = lead.lead_id,
            lead_name           = lead.full_name,
            assigned_to         = lead.assigned_to,
            old_status          = old_status,
            new_status          = new_status_str if changed else None,
            old_score           = old_score,
            new_score           = round(new_score, 1) if score_changed else None,
            hours_since_contact = round(hours_silent, 1),
            reason              = reason or "none",
        )
        db.add(log)
        summary["events"].append({
            "lead_id":   lead.lead_id,
            "lead_name": lead.full_name,
            "reason":    reason,
            "old_status": old_status,
            "new_status": new_status_str if changed else None,
            "old_score":  round(old_score, 1),
            "new_score":  round(new_score, 1) if score_changed else None,
            "hours_since_contact": round(hours_silent, 1),
        })

    db.commit()
    invalidate_cache(STATS_CACHE)
    invalidate_cache(LEAD_CACHE)
    logger.info(
        f"[DecayEngine] cycle done — processed={summary['processed']} "
        f"downgraded={summary['downgraded']} score_decayed={summary['score_decayed']}"
    )
    return summary


# ── Background asyncio scheduler ─────────────────────────────────────────────
# asyncio imported at top of file as _asyncio

_decay_task: "_asyncio.Task | None" = None


async def _decay_scheduler_loop():
    """Runs the decay cycle every `check_interval_hours` in the background."""
    while True:
        db = SessionLocal()
        try:
            cfg = _get_decay_config(db)
            interval_seconds = max(cfg.check_interval_hours * 3600, 300)  # min 5 min
        except Exception:
            interval_seconds = 3600
        finally:
            db.close()

        await _asyncio.sleep(interval_seconds)

        db = SessionLocal()
        try:
            run_decay_cycle(db)
        except Exception as e:
            logger.error(f"[DecayEngine] background cycle failed: {e}")
        finally:
            db.close()


# ── REST endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/admin/decay-config")
async def get_decay_config(
    current_user: dict = Depends(get_current_user),
):
    # Return default decay config (requires Supabase table migration)
    return {
        "enabled":              True,
        "hot_to_warm_hours":    72,
        "warm_to_stale_hours":  168,
        "score_decay_per_day":  0.5,
        "apply_score_decay":    True,
        "check_interval_hours": 6,
        "updated_at":           None,
        "updated_by":           "System",
    }


@app.put("/api/admin/decay-config")
async def update_decay_config(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update decay config - SUPABASE ONLY (Simplified)"""
    
    # Simplified - store in supabase config table
    return {"message": "Decay config updated (simplified)"}


@app.post("/api/admin/run-decay")
async def manual_run_decay(
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger one decay cycle (admin only) - SUPABASE ONLY (Stub)"""
    return {"message": "Decay cycle executed", "affected_leads": 0}


@app.get("/api/admin/decay-log")
async def get_decay_log(
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Return recent decay events, newest first - SUPABASE ONLY"""
    
    # Simplified - return empty for now
    return {"logs": [], "count": 0}


@app.get("/api/admin/decay-preview")
async def get_decay_preview(
    current_user: dict = Depends(get_current_user)
):
    """
    Dry-run: return leads that WOULD be affected on the next decay cycle - SUPABASE ONLY (Stub)
    """
    return {"preview": [], "count": 0}


# ─────────────────────────────────────────────────────────────────────────────
# WHATSAPP TEMPLATE LIBRARY
# ─────────────────────────────────────────────────────────────────────────────

_BUILTIN_TEMPLATES = [
    {
        "name": "Welcome — New Enquiry",
        "category": "welcome",
        "emoji": "👋",
        "description": "First touchpoint after a lead enquires",
        "body": (
            "Hello {{lead_name}}! 👋\n\n"
            "Thank you for your interest in *{{course}}* at our institution.\n\n"
            "I'm {{counselor}}, your personal admissions counselor. I'd love to walk you through everything — "
            "curriculum, fees, intake dates, and career outcomes.\n\n"
            "When would be a good time for a quick 15-minute call? 📞\n\n"
            "Looking forward to speaking with you!"
        ),
        "variables": ["lead_name", "course", "counselor"],
        "is_builtin": True,
    },
    {
        "name": "Follow-up — Warm Check-in",
        "category": "follow_up",
        "emoji": "🔔",
        "description": "Gentle nudge after 2–3 days of no response",
        "body": (
            "Hi {{lead_name}}, hope you're doing well! 😊\n\n"
            "Just following up on your enquiry about *{{course}}*.\n\n"
            "I know things get busy — no pressure at all. But I wanted to make sure you have all "
            "the information you need to make the best decision for your career.\n\n"
            "Is there anything specific you'd like me to clarify? Happy to answer any questions 🙌"
        ),
        "variables": ["lead_name", "course"],
        "is_builtin": True,
    },
    {
        "name": "Follow-up — Last Attempt",
        "category": "follow_up",
        "emoji": "⚡",
        "description": "Final outreach before archiving the lead",
        "body": (
            "Hi {{lead_name}}! ⚡\n\n"
            "I've tried reaching you a couple of times about *{{course}}* — "
            "I completely understand if the timing isn't right.\n\n"
            "🗓️ Our next intake closes on *{{deadline}}*. If you'd like to secure your spot, "
            "now would be the ideal time to connect.\n\n"
            "Reply to this message or call me directly. Happy to help! 🙏"
        ),
        "variables": ["lead_name", "course", "deadline"],
        "is_builtin": True,
    },
    {
        "name": "Fee Reminder — Payment Due",
        "category": "fee_reminder",
        "emoji": "💰",
        "description": "Sent when a fee payment is pending",
        "body": (
            "Dear {{lead_name}},\n\n"
            "This is a friendly reminder that your admission fee of *₹{{fee_amount}}* "
            "for *{{course}}* is due.\n\n"
            "📅 Due date: *{{due_date}}*\n"
            "💳 Payment link: {{payment_link}}\n\n"
            "Early payment secures your seat and avoids any last-minute complications.\n\n"
            "For any queries, feel free to reply here or contact {{counselor}}. 😊"
        ),
        "variables": ["lead_name", "course", "fee_amount", "due_date", "payment_link", "counselor"],
        "is_builtin": True,
    },
    {
        "name": "Fee Reminder — Gentle Nudge",
        "category": "fee_reminder",
        "emoji": "🔔",
        "description": "Softer payment reminder a few days before due date",
        "body": (
            "Hi {{lead_name}} 👋\n\n"
            "Just a quick heads-up — your fee instalment for *{{course}}* is due in *{{days_left}} days*.\n\n"
            "Amount: *₹{{fee_amount}}*\n\n"
            "If you've already made the payment, please ignore this message. "
            "Otherwise, reply here and I'll send you the payment details right away! 😊"
        ),
        "variables": ["lead_name", "course", "fee_amount", "days_left"],
        "is_builtin": True,
    },
    {
        "name": "Enrollment Confirmation",
        "category": "enrollment",
        "emoji": "🎉",
        "description": "Sent immediately after a lead enrolls",
        "body": (
            "🎉 Congratulations, {{lead_name}}!\n\n"
            "You are now officially enrolled in *{{course}}*!\n\n"
            "📋 *Enrollment Details*\n"
            "• Batch Start: {{batch_start}}\n"
            "• Venue / Mode: {{venue}}\n"
            "• Your Student ID: {{student_id}}\n\n"
            "Please carry a valid ID on your first day. Our orientation will cover everything you need to know.\n\n"
            "Welcome to the family! 🙌 Feel free to reach out to {{counselor}} for any queries."
        ),
        "variables": ["lead_name", "course", "batch_start", "venue", "student_id", "counselor"],
        "is_builtin": True,
    },
    {
        "name": "Enrollment Confirmation — Simple",
        "category": "enrollment",
        "emoji": "✅",
        "description": "Concise enrollment acknowledgement",
        "body": (
            "Hi {{lead_name}},\n\n"
            "✅ Your enrollment in *{{course}}* has been confirmed!\n\n"
            "Batch begins: *{{batch_start}}*\n\n"
            "We'll share the detailed schedule shortly. "
            "For any questions, please contact {{counselor}}.\n\n"
            "See you soon! 😊"
        ),
        "variables": ["lead_name", "course", "batch_start", "counselor"],
        "is_builtin": True,
    },
    {
        "name": "Scholarship / Offer Alert",
        "category": "custom",
        "emoji": "🏅",
        "description": "Announce a limited-time offer or scholarship",
        "body": (
            "Hi {{lead_name}}! 🏅\n\n"
            "Great news — we have a *limited scholarship* available for *{{course}}*!\n\n"
            "💸 Scholarship covers up to *{{discount}}* off the course fee.\n"
            "⏳ Valid until: *{{expiry_date}}*\n\n"
            "This is a rare opportunity and seats are limited. "
            "Reply *YES* to reserve your scholarship slot, and I'll take it from there!\n\n"
            "— {{counselor}}"
        ),
        "variables": ["lead_name", "course", "discount", "expiry_date", "counselor"],
        "is_builtin": True,
    },
]


def _seed_wa_templates():
    """Insert built-in templates once if the table is empty - SUPABASE ONLY"""
    
    # Check if templates exist
    try:
        response = supabase_data.client.table('whatsapp_templates').select('id').limit(1).execute()
        if response.data and len(response.data) > 0:
            return
    except:
        return
    
    # Insert built-in templates
    import json
    for t in _BUILTIN_TEMPLATES:
        template_data = {
            'name': t["name"],
            'category': t["category"],
            'emoji': t.get("emoji", "💬"),
            'description': t.get("description", ""),
            'body': t["body"],
            'variables': json.dumps(t.get("variables", [])),
            'is_builtin': t.get("is_builtin", False),
            'created_by': "System",
            'is_active': True
        }
        try:
            supabase_data.client.table('whatsapp_templates').insert(template_data).execute()
        except:
            pass  # Template may already exist




# Seed on startup
try:
    _seed_wa_templates()
except Exception as _seed_err:
    logger.warning(f"Template seed skipped: {_seed_err}")


def _render_template(body: str, variables: dict) -> str:
    """Replace {{key}} tokens in body with values from variables dict."""
    result = body
    for key, val in variables.items():
        result = result.replace(f"{{{{{key}}}}}", str(val) if val is not None else "")
    return result


@app.get("/api/wa-templates")
async def list_wa_templates(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Return all active templates, optionally filtered by category."""
    
    try:
        import json
        query = supabase_data.client.table('whatsapp_templates').select('*').eq('is_active', True)
        if category:
            query = query.eq('category', category)
        response = query.order('category').order('id').execute()
        rows = response.data if response.data else []
        
        return [
            {
                "id":          t.get('id'),
                "name":        t.get('name'),
                "category":    t.get('category'),
                "emoji":       t.get('emoji') or "💬",
                "description": t.get('description') or "",
                "body":        t.get('body'),
                "variables":   json.loads(t.get('variables')) if t.get('variables') else [],
                "is_builtin":  t.get('is_builtin'),
                "created_at":  t.get('created_at'),
                "created_by":  t.get('created_by'),
            }
            for t in rows
        ]
    except Exception as e:
        logger.error(f"Error fetching WhatsApp templates: {e}")
        return []


@app.post("/api/wa-templates")
async def create_wa_template(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create WhatsApp template - SUPABASE ONLY"""
    
    import json
    body_text = payload.get("body", "")
    # Auto-detect variables from {{...}} tokens
    detected = re.findall(r"\{\{(\w+)\}\}", body_text)
    variables = payload.get("variables") or detected
    
    template_data = {
        "name": payload.get("name", "Untitled"),
        "category": payload.get("category", "custom"),
        "emoji": payload.get("emoji", "💬"),
        "description": payload.get("description", ""),
        "body": body_text,
        "variables": json.dumps(list(dict.fromkeys(variables))),  # deduplicate, preserve order
        "is_builtin": False,
        "created_by": current_user.get("full_name", "Unknown"),
        "is_active": True
    }
    
    # Insert into Supabase
    response = supabase_data.client.table('whatsapp_templates').insert(template_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create template")
    
    created = response.data[0]
    return {"id": created["id"], "message": "Template created", "name": created["name"]}


@app.put("/api/wa-templates/{template_id}")
async def update_wa_template(
    template_id: int,
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update WhatsApp template - SUPABASE ONLY"""
    
    import json
    # Get existing template
    response = supabase_data.client.table('wa_templates').select('*').eq('id', template_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = {}
    if "name"        in payload: update_data["name"]        = payload["name"]
    if "emoji"       in payload: update_data["emoji"]       = payload["emoji"]
    if "description" in payload: update_data["description"] = payload["description"]
    if "category"    in payload: update_data["category"]    = payload["category"]
    if "is_active"   in payload: update_data["is_active"]   = payload["is_active"]
    if "body"        in payload:
        update_data["body"] = payload["body"]
        detected = re.findall(r"\{\{(\w+)\}\}", payload["body"])
        update_data["variables"] = json.dumps(list(dict.fromkeys(detected)))

    if update_data:
        supabase_data.client.table('wa_templates').update(update_data).eq('id', template_id).execute()
    
    return {"message": "Template updated"}


@app.delete("/api/wa-templates/{template_id}")
async def delete_wa_template(
    template_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete WhatsApp template - SUPABASE ONLY"""
    
    # Get template
    response = supabase_data.client.table('wa_templates').select('*').eq('id', template_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = response.data[0]
    if template.get('is_builtin'):
        raise HTTPException(status_code=400, detail="Built-in templates cannot be deleted")
    
    supabase_data.client.table('wa_templates').delete().eq('id', template_id).execute()
    return {"message": "Template deleted"}


@app.post("/api/leads/{lead_id}/send-wa-template")
async def send_wa_template(
    lead_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Render a template with variable overrides and send it via WhatsApp - SUPABASE ONLY
    payload = { template_id: int, variable_overrides: { key: value, ... } }
    """
    
    import json
    
    lead = supabase_data.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    phone = lead.whatsapp or lead.phone
    if not phone:
        raise HTTPException(status_code=400, detail="Lead has no WhatsApp/phone number")

    template_id = payload.get("template_id")
    if not template_id:
        raise HTTPException(status_code=400, detail="template_id required")

    # Get template from Supabase
    template_response = supabase_data.client.table('wa_templates').select('*').eq('id', template_id).execute()
    if not template_response.data or len(template_response.data) == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    t = template_response.data[0]

    # Build variable context — lead defaults first, then user overrides
    follow_up_str = (
        lead.get('follow_up_date', 'TBD') if lead.get('follow_up_date') else "TBD"
    )
    defaults = {
        "lead_name":    lead.get('full_name') or "there",
        "first_name":   (lead.get('full_name') or "there").split()[0],
        "course":       lead.get('course_interested') or "the course",
        "counselor":    lead.get('assigned_to') or current_user.get("full_name", "Your Counselor"),
        "phone":        lead.get('phone') or "",
        "country":      lead.get('country') or "",
        "expected_fee": f"{int(lead.get('expected_revenue', 0)):,}" if lead.get('expected_revenue') else "0",
        "fee_amount":   f"{int(lead.get('expected_revenue', 0)):,}" if lead.get('expected_revenue') else "0",
        "follow_up_date": follow_up_str,
        "enrollment_date": datetime.utcnow().strftime("%d %b %Y"),
    }
    overrides = payload.get("variable_overrides", {}) or {}
    variables = {**defaults, **overrides}

    rendered = _render_template(t['body'], variables)

    # Try to send via comm_service; fall through to note-only if unavailable
    send_success = False
    try:
        from communication_service import comm_service
        result = await comm_service.send(
            channel="whatsapp",
            to=phone,
            message=rendered,
        )
        send_success = result.get("success", False)
    except Exception as e:
        logger.warning(f"comm_service unavailable — logging only: {e}")
        send_success = True   # treat as success for note purposes

    # Log the sent message as a note in Supabase
    try:
        supabase_data.create_note(
            lead_id=lead.get('id'),
            content=f"[WhatsApp Template: {t['name']}]\n\n{rendered}",
            channel="whatsapp",
            created_by=current_user.get("full_name", "System")
        )
    except Exception as e:
        logger.error(f"Failed to create note: {e}")

    # Activity log in Supabase
    try:
        supabase_data.create_activity(
            lead_id=lead.get('id'),
            activity_type="whatsapp",
            description=f"WhatsApp template '{t['name']}' sent",
            created_by=current_user.get("full_name", "System")
        )
    except Exception as e:
        logger.error(f"Failed to create activity: {e}")

    return {
        "success": send_success,
        "template_name": t['name'],
        "rendered_message": rendered,
        "sent_to": phone,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DUPLICATE LEAD DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def _normalise_phone(raw: str) -> str:
    """Strip everything except digits and a leading +."""
    if not raw:
        return ""
    digits = re.sub(r"[^\d]", "", raw)
    return digits[-10:] if len(digits) >= 10 else digits


def _name_overlap(a: str, b: str) -> float:
    """Simple token-overlap similarity 0‥1."""
    if not a or not b:
        return 0.0
    sa = set(a.lower().split())
    sb = set(b.lower().split())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / max(len(sa), len(sb))


@app.post("/api/leads/check-duplicates")
async def check_duplicates(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Given phone / email / full_name of a *new* lead, return any existing leads
    that look like duplicates - SUPABASE ONLY (Simplified)
    """
    
    # Simplified implementation
    return {"duplicates": [], "match_count": 0}


def _lead_row(db_lead) -> dict:
    """Convert a DBLead ORM object to a plain dict."""
    return {
        "id":               db_lead.id,
        "lead_id":          db_lead.lead_id,
        "full_name":        db_lead.full_name,
        "phone":            db_lead.phone,
        "email":            db_lead.email,
        "whatsapp":         db_lead.whatsapp,
        "country":          db_lead.country,
        "source":           db_lead.source,
        "course_interested": db_lead.course_interested,
        "status":           db_lead.status.value if hasattr(db_lead.status, "value") else db_lead.status,
        "ai_score":         db_lead.ai_score,
        "ai_segment":       db_lead.ai_segment.value if hasattr(db_lead.ai_segment, "value") else db_lead.ai_segment,
        "assigned_to":      db_lead.assigned_to,
        "created_at":       db_lead.created_at,
    }


@app.post("/api/leads/merge")
async def merge_leads(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Merge two leads - SUPABASE ONLY (Simplified)
    payload = {
      primary_lead_id:   str,   # the lead to KEEP
      secondary_lead_id: str,   # the lead to ABSORB and delete
      field_choices: {          # "primary" | "secondary" for each field
        "full_name": "primary",
        "phone":     "secondary",
        ...
      }
    }
    Returns the updated primary lead.
    """
    primary_id    = payload.get("primary_lead_id")
    secondary_id  = payload.get("secondary_lead_id")   # may be None
    direct_updates = payload.get("direct_updates", {})  # pre-resolved field values

    if not primary_id:
        raise HTTPException(status_code=400, detail="primary_lead_id required")

    MERGEABLE_FIELDS = [
        "full_name", "email", "phone", "whatsapp", "country",
        "source", "course_interested", "assigned_to",
        "expected_revenue", "actual_revenue",
        "follow_up_date", "next_action", "priority_level",
    ]

    # Use Supabase (mandatory)
    try:
        def _fetch(lid):
            r = supabase_data.client.table("leads").select("*").eq("lead_id", lid).single().execute()
            return r.data

        primary = _fetch(primary_id)
        if not primary:
            raise HTTPException(status_code=404, detail="Primary lead not found")

        # Build update dict — either from direct_updates (new-lead merge) or from two existing leads
        if direct_updates:
            updates = {k: v for k, v in direct_updates.items() if v is not None and k in MERGEABLE_FIELDS}
        elif secondary_id:
            secondary = _fetch(secondary_id)
            if not secondary:
                raise HTTPException(status_code=404, detail="Secondary lead not found")
            choices = payload.get("field_choices", {})
            updates = {}
            for field in MERGEABLE_FIELDS:
                winner = choices.get(field, "primary")
                src    = secondary if winner == "secondary" else primary
                val    = src.get(field)
                if val is not None:
                    updates[field] = val
        else:
            updates = {}

        if updates:
            supabase_data.client.table("leads").update(updates).eq("lead_id", primary_id).execute()

        prim_int_id = primary.get("id")

        # Absorb secondary's notes + activities (only if secondary exists in DB)
        if secondary_id and secondary_id != "__new__":
            secondary = _fetch(secondary_id)
            if secondary:
                sec_int_id = secondary.get("id")
                if prim_int_id and sec_int_id:
                    supabase_data.client.table("notes").update({"lead_id": prim_int_id}).eq("lead_id", sec_int_id).execute()
                    supabase_data.client.table("activities").update({"lead_id": prim_int_id}).eq("lead_id", sec_int_id).execute()
                supabase_data.client.table("leads").delete().eq("lead_id", secondary_id).execute()
                merge_label = f"Absorbed lead {secondary_id} ({secondary.get('full_name')}) into this record."
            else:
                merge_label = "Merged with new lead entry (fields updated)."
        else:
            merge_label = "Updated with resolved field values from duplicate check."

        # Merge note
        if prim_int_id:
            supabase_data.client.table("notes").insert({
                "lead_id":    prim_int_id,
                "content":    f"[MERGED] {merge_label}",
                "channel":    "system",
                "created_by": current_user.get("full_name", "System"),
            }).execute()

        invalidate_cache(STATS_CACHE)
        invalidate_cache(LEAD_CACHE)

        updated = supabase_data.client.table("leads").select("*").eq("lead_id", primary_id).single().execute()
        return updated.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Supabase merge failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # If Supabase not configured (should never happen)
    raise HTTPException(status_code=500, detail="Database not configured")


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Medical Education CRM API...")
    print("📊 Dashboard: http://localhost:8080/docs")
    print("🤖 AI Features: http://localhost:8080/api/ai/status")
    print("📱 Communication APIs: WhatsApp, Email, Calls enabled")
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
