"""
IBMP CRM — Google Sheets Two-Way Sync Service
===============================================
Handles the CRM ↔ Google Sheets merge layer.

Architecture:
  CRM → Sheet  (push):  Triggered on lead create/update — writes changed
                         fields back to the sheet row identified by lead_id.
  Sheet → CRM  (pull):  Apps Script onEdit() webhook fires
                         POST /api/webhooks/google-sheets with the changed row.
                         This service merges the payload, applying
                         "latest write wins" conflict resolution.

Conflict resolution policy
--------------------------
For each editable field that changed in the sheet:
  1. Look up the CRM record's `updated_at` timestamp.
  2. Compare it to the `_edited_at` value that Apps Script sends.
  3. If the sheet edit is NEWER than the CRM record's last update →
     accept the sheet value (sheet wins).
  4. If the CRM record was updated AFTER the sheet edit →
     reject the sheet value and push the CRM value back to the sheet
     on the next outbound sync (CRM wins).
  5. If no `_edited_at` is provided (legacy Apps Script) →
     assume sheet wins (safe default for a single-admin setup).

Editable fields from sheet
--------------------------
The Apps Script sends only the columns the admin actually changed.
This service maps sheet column headers → CRM field names and validates
each value before writing to Supabase.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from supabase_data_layer import supabase_data
from logger_config import logger

# ── HMAC secret for verifying Apps Script requests ───────────────────────────
# Set SHEETS_WEBHOOK_SECRET in .env — Apps Script sends this in X-Webhook-Secret
WEBHOOK_SECRET: str = os.getenv("SHEETS_WEBHOOK_SECRET", "")


# ── Field mapping: sheet column header → CRM field name ─────────────────────
# Only fields listed here are accepted from the sheet (whitelist approach).
# Keys are normalised (stripped, lowercased, underscored).
SHEET_TO_CRM: Dict[str, str] = {
    # Core fields admins commonly edit in sheets
    "full_name":            "full_name",
    "name":                 "full_name",
    "email":                "email",
    "phone":                "phone",
    "whatsapp":             "whatsapp",
    "country":              "country",
    "source":               "source",
    "course_interested":    "course_interested",
    "course":               "course_interested",
    "status":               "status",
    "lead_status":          "status",
    "assigned_to":          "assigned_to",
    "counselor":            "assigned_to",
    "follow_up_date":       "follow_up_date",
    "followup_date":        "follow_up_date",
    "next_action":          "next_action",
    "priority_level":       "priority_level",
    "priority":             "priority_level",
    "expected_revenue":     "expected_revenue",
    "actual_revenue":       "actual_revenue",
    "loss_reason":          "loss_reason",
    "loss_note":            "loss_note",
    "qualification":        "qualification",
    "company":              "company",
    "utm_source":           "utm_source",
    "utm_medium":           "utm_medium",
    "utm_campaign":         "utm_campaign",
}

# Fields that must never be overwritten by the sheet
READONLY_FIELDS = {
    "lead_id", "id", "created_at", "ai_score", "ml_score",
    "rule_score", "ai_segment", "conversion_probability",
    "buying_signal_strength", "churn_risk", "scoring_method",
    "tenant_id",
}

# Valid CRM statuses (sheet values are case-insensitively matched)
VALID_STATUSES = {
    "Fresh", "Contacted", "Interested", "Follow Up", "Not Interested",
    "Converted", "Lost", "Junk", "Enrolled", "In Progress",
}

# Valid priority levels
VALID_PRIORITIES = {"low", "normal", "high", "urgent"}


# ── Normalisation helpers ─────────────────────────────────────────────────────

def _normalise_key(raw: str) -> str:
    """'Your Highest Qualification:' → 'your_highest_qualification'"""
    return re.sub(r"[^a-z0-9]+", "_", raw.strip().lower()).strip("_")


def _parse_ts(raw: Any) -> Optional[datetime]:
    """Parse a timestamp string / epoch float into a UTC datetime."""
    if not raw:
        return None
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(raw, tz=timezone.utc)
        except Exception:
            return None
    s = str(raw).strip()
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        except ValueError:
            pass
    return None


def _coerce_field(field: str, raw_value: Any) -> Tuple[Any, Optional[str]]:
    """
    Coerce and validate a raw sheet value for the given CRM field.
    Returns (coerced_value, error_message_or_None).
    """
    val = str(raw_value).strip() if raw_value is not None else ""

    if field == "status":
        # Case-insensitive match
        for s in VALID_STATUSES:
            if s.lower() == val.lower():
                return s, None
        return None, f"Invalid status '{val}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}"

    if field == "priority_level":
        if val.lower() in VALID_PRIORITIES:
            return val.lower(), None
        return None, f"Invalid priority '{val}'"

    if field in ("expected_revenue", "actual_revenue"):
        # Strip currency symbols / commas
        cleaned = re.sub(r"[^0-9.]", "", val)
        try:
            return float(cleaned) if cleaned else 0.0, None
        except ValueError:
            return None, f"Invalid revenue value '{val}'"

    if field == "follow_up_date":
        dt = _parse_ts(val)
        if dt:
            return dt.isoformat(), None
        return None, f"Invalid date '{val}'"

    if field == "email" and val:
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", val):
            return None, f"Invalid email '{val}'"

    if field in ("phone", "whatsapp") and val:
        digits = re.sub(r"[^0-9+]", "", val)
        if len(digits) < 7:
            return None, f"Phone number too short: '{val}'"
        return digits, None

    return val or None, None


# ── Signature verification ────────────────────────────────────────────────────

def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """
    Verify HMAC-SHA256 signature from Apps Script.
    Apps Script sends: X-Webhook-Signature: sha256=<hex>
    """
    if not WEBHOOK_SECRET:
        # No secret configured — accept all (dev mode only)
        logger.warning("SHEETS_WEBHOOK_SECRET not set — skipping signature check")
        return True

    if not signature:
        return False

    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ── Core merge logic ──────────────────────────────────────────────────────────

class SheetsSyncService:
    """
    Merges an inbound sheet-edit payload into the CRM.

    Single method:  process_sheet_edit(payload) → SyncResult
    """

    def process_sheet_edit(self, payload: dict) -> "SyncResult":
        """
        Process a row-edit webhook from Apps Script.

        Expected payload shape:
        {
          "lead_id":    "LEAD260508AB1234",   // required
          "row_number": 42,                   // sheet row (for push-back)
          "sheet_name": "Leads",
          "_edited_at": "2026-05-11T12:34:56Z",  // when admin made the edit
          "changes": {                         // only changed columns
            "status":       "Converted",
            "follow_up_date": "2026-05-20",
            "assigned_to":  "Priya Sharma"
          }
        }
        """
        result = SyncResult(lead_id=payload.get("lead_id", ""))

        # ── 1. Validate required fields ───────────────────────────────────────
        lead_id = payload.get("lead_id", "").strip()
        if not lead_id:
            return result.fail("Missing lead_id in payload")

        # ── 2. Fetch CRM record ───────────────────────────────────────────────
        lead = supabase_data.get_lead_by_id(lead_id)
        if not lead:
            return result.fail(f"Lead {lead_id} not found in CRM")

        crm_updated_at = _parse_ts(lead.get("updated_at"))
        sheet_edited_at = _parse_ts(payload.get("_edited_at"))

        # ── 3. Process each changed column ────────────────────────────────────
        changes_raw: dict = payload.get("changes", {})
        if not changes_raw:
            return result.skip("No changes in payload")

        accepted: dict  = {}
        rejected: dict  = {}
        errors:   list  = []

        for raw_key, raw_value in changes_raw.items():
            norm_key   = _normalise_key(raw_key)
            crm_field  = SHEET_TO_CRM.get(norm_key)

            # Skip unmapped or read-only columns
            if not crm_field:
                logger.debug("Sheets sync: skipping unmapped column '%s'", raw_key)
                continue
            if crm_field in READONLY_FIELDS:
                logger.debug("Sheets sync: skipping read-only field '%s'", crm_field)
                continue

            # Coerce value
            coerced, err = _coerce_field(crm_field, raw_value)
            if err:
                errors.append(err)
                continue

            # Conflict resolution: "latest write wins"
            if crm_updated_at and sheet_edited_at:
                if crm_updated_at > sheet_edited_at:
                    # CRM is newer — reject sheet value; note for push-back
                    rejected[crm_field] = {
                        "sheet_value": raw_value,
                        "crm_value":   lead.get(crm_field),
                        "reason":      "CRM has newer update",
                    }
                    result.conflicts.append(crm_field)
                    continue

            # Sheet is newer (or no timestamps) — accept
            accepted[crm_field] = coerced

        # ── 4. Write accepted fields to Supabase ──────────────────────────────
        if accepted:
            updated = supabase_data.update_lead(lead_id, accepted)
            if not updated:
                return result.fail(f"Supabase write failed for lead {lead_id}")

            # Log an activity for the sync
            try:
                iid = lead.get("id")
                if iid:
                    changed_summary = ", ".join(
                        f"{k}: {v}" for k, v in accepted.items()
                    )
                    supabase_data.create_activity(
                        lead_id=int(iid),
                        activity_type="field_update",
                        description=f"[Sheets sync] {changed_summary}",
                        created_by="Google Sheets",
                    )
            except Exception as ae:
                logger.warning("Sheets sync: activity log failed — %s", ae)

            result.accepted = accepted
            result.status   = "ok"
            logger.info(
                "Sheets sync OK  lead=%s  accepted=%s  conflicts=%s",
                lead_id, list(accepted.keys()), result.conflicts,
            )
        else:
            result.status = "no_change"

        result.rejected = rejected
        result.errors   = errors
        return result

    def push_lead_to_sheet(
        self,
        lead: dict,
        sheet_id: str,
        sheet_name: str,
        row_number: int,
        service,  # googleapiclient sheets resource
    ) -> bool:
        """
        Write CRM field values back to a specific sheet row.
        Called when conflict resolution determines CRM is authoritative.

        Returns True on success.
        """
        if not service:
            return False
        try:
            # Build an update for each mapped field in the lead
            # We write the whole row in one batchUpdate call
            updates = []
            for sheet_col, crm_field in SHEET_TO_CRM.items():
                val = lead.get(crm_field)
                if val is None:
                    continue
                updates.append({
                    "sheet_col": sheet_col,
                    "value":     str(val),
                })

            if not updates:
                return True

            # Get header row to find column indices
            hdr_resp = service.spreadsheets().values().get(
                spreadsheetId=sheet_id,
                range=f"'{sheet_name}'!1:1",
            ).execute()
            headers = [h.strip().lower() for h in (hdr_resp.get("values") or [[]])[0]]

            value_range_body = {"valueInputOption": "USER_ENTERED", "data": []}
            for u in updates:
                col_key = _normalise_key(u["sheet_col"])
                try:
                    col_idx = headers.index(col_key)
                except ValueError:
                    continue
                col_letter = _col_letter(col_idx)
                value_range_body["data"].append({
                    "range":  f"'{sheet_name}'!{col_letter}{row_number}",
                    "values": [[u["value"]]],
                })

            if value_range_body["data"]:
                service.spreadsheets().values().batchUpdate(
                    spreadsheetId=sheet_id,
                    body=value_range_body,
                ).execute()

            logger.info("Sheets push OK  lead=%s  row=%d", lead.get("lead_id"), row_number)
            return True

        except Exception as exc:
            logger.error("Sheets push failed  lead=%s  row=%d  — %s",
                         lead.get("lead_id"), row_number, exc)
            return False


def _col_letter(idx: int) -> str:
    """Convert 0-based column index to A1 notation letter(s). Works up to ZZ."""
    result = ""
    idx += 1
    while idx:
        idx, rem = divmod(idx - 1, 26)
        result = chr(65 + rem) + result
    return result


# ── Result dataclass ──────────────────────────────────────────────────────────

class SyncResult:
    def __init__(self, lead_id: str):
        self.lead_id   = lead_id
        self.status    = "pending"     # ok | no_change | skipped | error
        self.accepted  : dict = {}
        self.rejected  : dict = {}
        self.conflicts : list = []
        self.errors    : list = []
        self.message   = ""

    def fail(self, msg: str) -> "SyncResult":
        self.status  = "error"
        self.message = msg
        logger.warning("Sheets sync FAIL  lead=%s  — %s", self.lead_id, msg)
        return self

    def skip(self, msg: str) -> "SyncResult":
        self.status  = "no_change"
        self.message = msg
        return self

    def to_dict(self) -> dict:
        return {
            "lead_id":   self.lead_id,
            "status":    self.status,
            "message":   self.message,
            "accepted":  self.accepted,
            "conflicts": self.conflicts,
            "errors":    self.errors,
        }


# Module-level singleton
sheets_sync = SheetsSyncService()
