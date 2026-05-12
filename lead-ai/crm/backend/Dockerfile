# =============================================================================
# IBMP CRM Backend — Multi-stage Dockerfile
# =============================================================================
# Stages:
#   base        — Python deps only (shared by both stages)
#   development — includes test deps + uvicorn --reload
#   production  — minimal, no test deps, runs as non-root user
#
# Usage:
#   docker build --target development -t ibmp-backend:dev .
#   docker build --target production  -t ibmp-backend:prod .
# =============================================================================

# ── Base stage ───────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

WORKDIR /app

# System deps needed for some Python packages (catboost, bcrypt, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        libssl-dev \
        libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Explicitly install redis-py for the token blocklist
RUN pip install --no-cache-dir "redis>=5.0.0"


# ── Development stage ─────────────────────────────────────────────────────────
FROM base AS development

# Install test / dev tools
RUN pip install --no-cache-dir \
        pytest \
        pytest-asyncio \
        pytest-cov \
        httpx \
        ruff \
        slowapi

# Copy source (will be bind-mounted in docker-compose for hot-reload)
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


# ── Production stage ──────────────────────────────────────────────────────────
FROM base AS production

# Create a non-root user for security
RUN groupadd --gid 1001 appgroup && \
    useradd  --uid 1001 --gid appgroup --no-create-home appuser

# Copy only application source (no test files)
COPY --chown=appuser:appgroup . .

# Remove test/dev files from the production image
RUN rm -rf tests/ .pytest_cache/ __pycache__/ \
           *.pyc *.pyo .coverage coverage.xml

USER appuser

EXPOSE 8000

# Gunicorn with uvicorn workers for production
CMD ["gunicorn", "main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keepalive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
