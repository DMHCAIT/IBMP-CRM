"""
IBMP CRM — Startup Configuration Validator
============================================
Call `validate_config()` at the top of main.py BEFORE anything else.
It inspects every required / recommended environment variable and
fails fast with a human-readable error list rather than crashing
on the first DB query.

Usage:
    from config_validator import validate_config
    validate_config()   # raises SystemExit on CRITICAL failures

Exit codes:
    0  — all required vars present (warnings may still be printed)
    1  — one or more CRITICAL required vars missing
"""

from __future__ import annotations

import os
import sys
import re
from dataclasses import dataclass, field
from typing import Callable, Optional


# ── Severity levels ───────────────────────────────────────────────────────────

CRITICAL = "CRITICAL"   # Missing → app cannot start
WARNING  = "WARNING"    # Missing → degraded feature, app still starts
INFO     = "INFO"       # Not required, just informational


# ── Validator rule definition ─────────────────────────────────────────────────

@dataclass
class EnvRule:
    name:        str
    severity:    str                   = CRITICAL
    description: str                   = ""
    default:     Optional[str]         = None      # None means no default
    validator:   Optional[Callable]    = None      # Custom check fn(value) -> str | None
    # list of environment names that are acceptable alternatives (any one present = OK)
    aliases:     list[str]             = field(default_factory=list)


# ── Built-in validator helpers ────────────────────────────────────────────────

def _min_length(n: int) -> Callable[[str], Optional[str]]:
    def _check(v: str) -> Optional[str]:
        if len(v) < n:
            return f"must be at least {n} characters (got {len(v)})"
        return None
    return _check


def _is_url(v: str) -> Optional[str]:
    if not re.match(r"^https?://", v):
        return "must start with http:// or https://"
    return None


def _not_default(bad_values: list[str]) -> Callable[[str], Optional[str]]:
    def _check(v: str) -> Optional[str]:
        if v in bad_values:
            return f"still set to insecure default value '{v}' — generate a new one"
        return None
    return _check


def _jwt_secret_check(v: str) -> Optional[str]:
    if len(v) < 32:
        return "must be at least 32 characters"
    if v in ("your-secret-key", "your-secret-key-change-in-production", "changeme"):
        return "insecure default — generate with: openssl rand -hex 32"
    return None


# ── Rule registry ─────────────────────────────────────────────────────────────

RULES: list[EnvRule] = [
    # ── Authentication ─────────────────────────────────────────────────────
    EnvRule(
        name="JWT_SECRET_KEY",
        severity=CRITICAL,
        description="JWT signing secret — must be at least 32 chars and not a default value",
        validator=_jwt_secret_check,
        aliases=["SECRET_KEY"],
    ),
    EnvRule(
        name="ALGORITHM",
        severity=WARNING,
        description="JWT algorithm (default: HS256)",
        default="HS256",
    ),
    EnvRule(
        name="ACCESS_TOKEN_EXPIRE_MINUTES",
        severity=WARNING,
        description="JWT expiry in minutes (default: 1440 = 24 h)",
        default="1440",
    ),

    # ── Supabase ───────────────────────────────────────────────────────────
    EnvRule(
        name="SUPABASE_URL",
        severity=CRITICAL,
        description="Supabase project URL, e.g. https://xyz.supabase.co",
        validator=_is_url,
    ),
    EnvRule(
        name="SUPABASE_KEY",
        severity=CRITICAL,
        description="Supabase anon or service-role key",
        validator=_min_length(20),
        aliases=["SUPABASE_ANON_KEY"],
    ),
    EnvRule(
        name="SUPABASE_SERVICE_KEY",
        severity=WARNING,
        description="Supabase service-role key (needed for admin ops and storage)",
    ),

    # ── Database ───────────────────────────────────────────────────────────
    EnvRule(
        name="DATABASE_URL",
        severity=WARNING,
        description="SQLAlchemy connection string (SQLite fallback if omitted)",
        default="sqlite:///./ibmp_crm.db",
    ),

    # ── AI / OpenAI ────────────────────────────────────────────────────────
    EnvRule(
        name="OPENAI_API_KEY",
        severity=WARNING,
        description="OpenAI API key — AI features disabled if absent",
        validator=lambda v: "should start with 'sk-'" if v and not v.startswith("sk-") else None,
    ),

    # ── Frontend origin (CORS) ─────────────────────────────────────────────
    EnvRule(
        name="FRONTEND_URL",
        severity=WARNING,
        description="React app origin for CORS, e.g. https://ibmp-crm.vercel.app",
        validator=_is_url,
    ),

    # ── Google Sheets (optional) ───────────────────────────────────────────
    EnvRule(
        name="GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON",
        severity=INFO,
        description="Google service-account JSON for Sheets sync (optional)",
    ),

    # ── Interakt WhatsApp (optional) ───────────────────────────────────────
    EnvRule(
        name="INTERAKT_API_KEY",
        severity=INFO,
        description="Interakt WhatsApp API key (optional)",
    ),

    # ── Runtime ────────────────────────────────────────────────────────────
    EnvRule(
        name="ENVIRONMENT",
        severity=WARNING,
        description="Runtime environment: development | test | production",
        default="development",
        validator=lambda v: (
            f"expected one of: development, test, production — got '{v}'"
            if v not in ("development", "test", "production") else None
        ),
    ),
    EnvRule(
        name="LOG_LEVEL",
        severity=WARNING,
        description="Log level: DEBUG | INFO | WARNING | ERROR",
        default="INFO",
        validator=lambda v: (
            f"expected DEBUG/INFO/WARNING/ERROR — got '{v}'"
            if v.upper() not in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL") else None
        ),
    ),
    EnvRule(
        name="PORT",
        severity=INFO,
        description="Port the server listens on (Render sets this automatically)",
        default="8000",
    ),
]


# ── Validation engine ─────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    name:     str
    severity: str
    message:  str
    value:    Optional[str] = None   # redacted for secrets


def validate_config(
    *,
    exit_on_critical: bool = True,
    silent_info:      bool = True,
) -> list[ValidationResult]:
    """
    Check all registered EnvRules.

    Args:
        exit_on_critical:  Call sys.exit(1) if any CRITICAL rule fails.
        silent_info:       Suppress INFO-level messages (not printed by default).

    Returns:
        List of ValidationResult objects (all severities, including passing ones).
    """
    results:  list[ValidationResult] = []
    problems: list[ValidationResult] = []

    for rule in RULES:
        # Resolve value — check primary name and aliases
        names_to_check = [rule.name] + rule.aliases
        value = None
        found_name = None
        for n in names_to_check:
            v = os.getenv(n)
            if v:
                value = v
                found_name = n
                break

        # Apply default if available
        if value is None and rule.default is not None:
            value = rule.default
            os.environ.setdefault(rule.name, rule.default)

        if value is None:
            if rule.severity in (CRITICAL, WARNING):
                result = ValidationResult(
                    name=rule.name,
                    severity=rule.severity,
                    message=f"not set — {rule.description}",
                )
                results.append(result)
                problems.append(result)
            continue

        # Run custom validator
        if rule.validator:
            error = rule.validator(value)
            if error:
                # Redact value for security-sensitive keys
                _safe = (
                    f"{value[:4]}…{value[-4:]}"
                    if len(value) > 10 and rule.severity == CRITICAL
                    else value
                )
                result = ValidationResult(
                    name=found_name or rule.name,
                    severity=rule.severity,
                    message=f"invalid value — {error}",
                    value=_safe,
                )
                results.append(result)
                if rule.severity in (CRITICAL, WARNING):
                    problems.append(result)
                continue

        # Passed
        results.append(
            ValidationResult(
                name=found_name or rule.name,
                severity="OK",
                message="ok",
            )
        )

    # ── Print report ──────────────────────────────────────────────────────
    _print_report(results, silent_info=silent_info)

    # ── Fail fast on CRITICAL problems ────────────────────────────────────
    critical_failures = [r for r in problems if r.severity == CRITICAL]
    if critical_failures and exit_on_critical:
        print(
            "\n❌  Startup aborted — fix the CRITICAL config issues above.\n",
            file=sys.stderr,
        )
        sys.exit(1)

    return results


def _print_report(results: list[ValidationResult], *, silent_info: bool = True) -> None:
    """Pretty-print the validation report to stderr."""
    icons = {
        "OK":       "✅",
        CRITICAL:   "🔴",
        WARNING:    "🟡",
        INFO:       "🔵",
    }

    warnings  = [r for r in results if r.severity == WARNING]
    criticals = [r for r in results if r.severity == CRITICAL]
    infos     = [r for r in results if r.severity == INFO and not silent_info]

    # Always print critical failures
    if criticals:
        print("\n" + "═" * 60, file=sys.stderr)
        print("  IBMP CRM — Configuration Errors (CRITICAL)", file=sys.stderr)
        print("═" * 60, file=sys.stderr)
        for r in criticals:
            print(f"  {icons[r.severity]} [{r.severity}] {r.name}: {r.message}", file=sys.stderr)
        print("═" * 60, file=sys.stderr)

    # Print warnings
    if warnings:
        print("\n⚠️  Config warnings (app will start but features may be degraded):", file=sys.stderr)
        for r in warnings:
            print(f"   {icons[r.severity]} {r.name}: {r.message}", file=sys.stderr)

    if infos:
        for r in infos:
            print(f"   {icons[r.severity]} {r.name}: {r.message}", file=sys.stderr)

    # Summary
    ok_count = sum(1 for r in results if r.severity == "OK")
    print(
        f"\n  Config check: {ok_count} ok, "
        f"{len(warnings)} warning(s), "
        f"{len(criticals)} critical error(s)\n",
        file=sys.stderr,
    )
