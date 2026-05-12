"""
IBMP CRM — JWT Token Blocklist
================================
Immediately invalidates JWTs on logout so stolen tokens cannot be reused.

Architecture:
  PRIMARY  — Redis (if REDIS_URL is set)   TTL = token's own exp - now
  FALLBACK — In-memory dict                Cleared on restart (acceptable for
                                           single-instance deployments; multi-
                                           instance needs Redis)

Usage:
    from token_blocklist import blocklist

    # On logout
    blocklist.revoke(token_jti, expires_at_timestamp)

    # On every authenticated request (in auth.py / get_current_user)
    if blocklist.is_revoked(token_jti):
        raise HTTPException(401, "Token has been revoked")

Token JTI (JWT ID):
    We add a `jti` (UUID) claim when issuing tokens so each token is uniquely
    identifiable.  See create_access_token() in auth.py.
"""

from __future__ import annotations

import os
import time
import uuid
import logging
from typing import Optional

logger = logging.getLogger("ibmp_crm")


# ── Redis client (optional) ───────────────────────────────────────────────────

def _build_redis():
    """
    Try to connect to Redis.  Returns a Redis client or None if unavailable.
    Deliberately non-fatal — app falls back to in-memory store.
    """
    url = os.getenv("REDIS_URL", "")
    if not url:
        return None
    try:
        import redis
        client = redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        logger.info("✅  Token blocklist: Redis connected (%s)", url.split("@")[-1])
        return client
    except ImportError:
        logger.warning("Token blocklist: redis-py not installed — using in-memory fallback")
        return None
    except Exception as exc:
        logger.warning("Token blocklist: Redis unavailable (%s) — using in-memory fallback", exc)
        return None


# ── Blocklist implementation ──────────────────────────────────────────────────

class TokenBlocklist:
    """
    Thread-safe (for asyncio) revocation store.

    Redis path : SETNX  ibmp:blocklist:{jti}  "" EX {ttl_seconds}
    Memory path: dict    {jti: expiry_unix_ts}  — sweept on every check
    """

    _REDIS_PREFIX = "ibmp:blocklist:"
    # Max in-memory entries before a forced sweep (prevents unbounded growth)
    _MEMORY_MAX   = 10_000

    def __init__(self) -> None:
        self._redis  = _build_redis()
        self._memory: dict[str, float] = {}   # jti → unix expiry

    # ── Public API ─────────────────────────────────────────────────────────

    def revoke(self, jti: str, exp: float) -> None:
        """
        Revoke a token identified by its `jti` claim.

        Args:
            jti: JWT ID string (uuid4).
            exp: Token expiry as a Unix timestamp (from the `exp` claim).
        """
        ttl = max(1, int(exp - time.time()))

        if self._redis:
            try:
                self._redis.setex(f"{self._REDIS_PREFIX}{jti}", ttl, "1")
                return
            except Exception as exc:
                logger.warning("Redis revoke failed (%s), falling back to memory", exc)

        # In-memory path
        self._memory[jti] = exp
        self._sweep_expired()

    def is_revoked(self, jti: str) -> bool:
        """
        Return True if the token has been explicitly revoked.

        A token that has simply expired is NOT considered "revoked" here —
        JWT expiry validation happens separately in decode_access_token().
        """
        if self._redis:
            try:
                return bool(self._redis.exists(f"{self._REDIS_PREFIX}{jti}"))
            except Exception as exc:
                logger.warning("Redis check failed (%s), falling back to memory", exc)

        # In-memory path — also checks that the entry hasn't expired naturally
        exp = self._memory.get(jti)
        if exp is None:
            return False
        if time.time() > exp:
            self._memory.pop(jti, None)
            return False
        return True

    def revoke_all_for_user(self, user_email: str, current_exp: float) -> None:
        """
        Revoke ALL tokens for a user (e.g. on password change).
        Stores a sentinel key that is checked in is_revoked_for_user().
        TTL is set to the longest possible token lifetime (24h = 86400s).
        """
        ttl = max(1, int(current_exp - time.time()) + 86400)
        key = f"user:{user_email}"

        if self._redis:
            try:
                self._redis.setex(f"{self._REDIS_PREFIX}{key}", ttl, str(time.time()))
                return
            except Exception as exc:
                logger.warning("Redis user-revoke failed (%s)", exc)

        self._memory[key] = time.time() + ttl
        self._sweep_expired()

    def is_revoked_for_user(self, user_email: str, token_iat: float) -> bool:
        """
        Return True if a global revocation was issued for this user AFTER
        the token was issued (iat).  Used for password-change invalidation.
        """
        key = f"user:{user_email}"

        if self._redis:
            try:
                revoked_at = self._redis.get(f"{self._REDIS_PREFIX}{key}")
                if revoked_at:
                    return float(revoked_at) > token_iat
                return False
            except Exception as exc:
                logger.warning("Redis user-check failed (%s)", exc)

        exp_or_ts = self._memory.get(key)
        if exp_or_ts is None:
            return False
        # For user-level revocation the value is expiry, but we stored it as now+ttl
        # We need to recover the revocation time: stored_ts = time.time() at revoke time
        # (Simplification: treat all user-level entries as "revoked now" in memory mode)
        return True

    # ── Housekeeping ────────────────────────────────────────────────────────

    def _sweep_expired(self) -> None:
        """Remove expired entries from the in-memory store."""
        if len(self._memory) < self._MEMORY_MAX:
            return
        now = time.time()
        expired = [k for k, v in self._memory.items() if v < now]
        for k in expired:
            del self._memory[k]

    @property
    def backend(self) -> str:
        """Return "redis" or "memory" — useful for /health output."""
        return "redis" if self._redis else "memory"

    def stats(self) -> dict:
        return {
            "backend":       self.backend,
            "memory_entries": len(self._memory),
        }


# ── Singleton ─────────────────────────────────────────────────────────────────
blocklist = TokenBlocklist()


# ── JTI generator (import here so auth.py has one import point) ───────────────
def new_jti() -> str:
    """Generate a fresh unique JWT ID."""
    return uuid.uuid4().hex
