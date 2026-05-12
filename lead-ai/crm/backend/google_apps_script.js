/**
 * IBMP CRM — Google Apps Script
 * ================================
 * Paste this entire file into your Google Apps Script editor
 * (Extensions → Apps Script inside your Google Sheet).
 *
 * What it does:
 *   1. onEdit trigger  → sends any cell edit instantly to the CRM
 *   2. syncNewLeads()  → imports rows that have no CRM Lead ID yet
 *   3. testConnection()→ verifies the webhook URL is reachable
 *
 * Setup (one-time):
 *   1. Open your Google Sheet
 *   2. Extensions → Apps Script
 *   3. Paste this file and save (Ctrl+S)
 *   4. Edit the CONFIG section below (CRM_URL and WEBHOOK_SECRET)
 *   5. Run testConnection() once to confirm it works
 *   6. Set up triggers:
 *        - onEdit    → From spreadsheet → On edit
 *        - syncNewLeads → Time-driven → Every 5 minutes
 */

// ── CONFIG — edit these two values ──────────────────────────────────────────
var CRM_URL        = "https://ibmp-crm-1.onrender.com";   // your Render URL
var WEBHOOK_SECRET = "change-me-set-same-in-render-env";  // SHEETS_WEBHOOK_SECRET
// ────────────────────────────────────────────────────────────────────────────

var WEBHOOK_ENDPOINT  = CRM_URL + "/api/webhooks/google-sheets";
var LEADS_ENDPOINT    = CRM_URL + "/api/leads/bulk-create";

/**
 * Column header → CRM field mapping.
 * Add or rename columns here to match your sheet headers.
 */
var COLUMN_MAP = {
  // Name
  "Full Name":                   "full_name",
  "Name":                        "full_name",
  "full_name":                   "full_name",

  // Contact
  "Email":                       "email",
  "email":                       "email",
  "Phone":                       "phone",
  "Phone Number":                "phone",
  "phone_number":                "phone",           // Meta sheet column
  "WhatsApp":                    "whatsapp",
  "whatsapp":                    "whatsapp",

  // Location
  "Country":                     "country",
  "country":                     "country",
  "City":                        "city",
  "city":                        "city",

  // Source / Status
  "Source":                      "source",
  "source":                      "source",
  "Platform":                    "campaign_medium", // Meta sheet: Facebook/Instagram
  "platform":                    "campaign_medium",
  "Status":                      "status",
  "Lead Status":                 "status",
  "lead_status":                 "status",          // Meta sheet column

  // Course
  "Course":                      "course_interested",
  "Course Interested":           "course_interested",
  "course_interested":           "course_interested",

  // Assignment & follow-up
  "Assigned To":                 "assigned_to",
  "Counselor":                   "assigned_to",
  "Lead Owner":                  "assigned_to",
  "lead_owner":                  "assigned_to",
  "Follow Up Date":              "follow_up_date",
  "follow_up_date":              "follow_up_date",
  "Next Action":                 "next_action",
  "next_action":                 "next_action",

  // Priority & qualification
  "Priority":                    "priority_level",
  "priority_level":              "priority_level",
  "Qualification":               "qualification",
  "Your Highest Qualification:": "qualification",   // Meta sheet column (with colon)
  "your_highest_qualification:": "qualification",
  "Your Highest Qualification":  "qualification",
  "your_highest_qualification":  "qualification",

  // Company & notes
  "Company":                     "company",
  "company":                     "company",
  "Notes":                       "notes",
  "notes":                       "notes",

  // Campaign / marketing fields
  "Campaign Name":               "campaign_name",
  "campaign_name":               "campaign_name",   // Meta sheet column
  "Campaign Medium":             "campaign_medium",
  "campaign_medium":             "campaign_medium",
  "Campaign Group":              "campaign_group",
  "campaign_group":              "campaign_group",
  "Ad Name":                     "ad_name",
  "ad_name":                     "ad_name",         // Meta sheet column
  "Adset Name":                  "adset_name",
  "adset_name":                  "adset_name",      // Meta sheet column
  "Form Name":                   "form_name",
  "form_name":                   "form_name",       // Meta sheet column
  "Lead Quality":                "lead_quality",
  "lead_quality":                "lead_quality",
  "Lead Rating":                 "lead_rating",
  "lead_rating":                 "lead_rating",
};

/** Column that stores the CRM Lead ID (e.g. "LEAD2605XXXX"). */
var LEAD_ID_COLUMN = "Lead ID";

// ── 1. onEdit trigger ─────────────────────────────────────────────────────────

/**
 * Fires automatically on every cell edit.
 * Install as a trigger: From spreadsheet → On edit.
 */
function onEdit(e) {
  try {
    var sheet  = e.range.getSheet();
    var row    = e.range.getRow();
    var col    = e.range.getColumn();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Ignore edits on the header row
    if (row === 1) return;

    // Read the Lead ID for this row
    var leadIdCol = headers.indexOf(LEAD_ID_COLUMN) + 1;
    var leadId    = leadIdCol > 0 ? sheet.getRange(row, leadIdCol).getValue() : "";

    // Only sync rows that already have a CRM Lead ID
    if (!leadId) return;

    // Build the changes object from the edited column(s)
    var changes = {};
    var range   = e.range;
    for (var c = 0; c < range.getNumColumns(); c++) {
      var header   = headers[col - 1 + c];
      var crmField = COLUMN_MAP[header];
      if (crmField) {
        changes[crmField] = range.getCell(1, c + 1).getValue();
      }
    }

    if (Object.keys(changes).length === 0) return;

    var payload = {
      lead_id:    String(leadId),
      row_number: row,
      sheet_name: sheet.getName(),
      _edited_at: new Date().toISOString(),
      changes:    changes,
    };

    _post(WEBHOOK_ENDPOINT, payload);
  } catch (err) {
    Logger.log("onEdit error: " + err.message);
  }
}

// ── 2. syncNewLeads — import rows without a Lead ID ──────────────────────────

/**
 * Reads every row that has no Lead ID yet and bulk-creates them in the CRM.
 * Install as a time-driven trigger (every 5 minutes or every hour).
 * Can also be run manually from the Apps Script editor.
 */
function syncNewLeads() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getActiveSheet();
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];

  var leadIdColIdx = headers.indexOf(LEAD_ID_COLUMN);
  var newLeads     = [];
  var rowIndices   = [];  // track which rows to write Lead IDs back to

  for (var r = 1; r < data.length; r++) {
    var row    = data[r];
    var leadId = leadIdColIdx >= 0 ? row[leadIdColIdx] : "";

    // Skip rows that already have a Lead ID or are completely empty
    if (leadId || row.every(function(c) { return c === ""; })) continue;

    var lead = {};
    for (var c = 0; c < headers.length; c++) {
      var crmField = COLUMN_MAP[headers[c]];
      if (crmField && row[c] !== "") {
        lead[crmField] = String(row[c]);
      }
    }

    // Need at minimum a name or phone to create a lead
    if (!lead.full_name && !lead.phone) continue;

    // Defaults
    if (!lead.source) lead.source = "Website";
    if (!lead.status) lead.status = "Fresh";

    newLeads.push(lead);
    rowIndices.push(r + 1); // 1-indexed sheet row
  }

  if (newLeads.length === 0) {
    Logger.log("syncNewLeads: no new rows to import.");
    return;
  }

  Logger.log("syncNewLeads: importing " + newLeads.length + " leads...");

  try {
    var resp = _post(LEADS_ENDPOINT, newLeads);
    Logger.log("CRM response: " + resp);

    // Write back the assigned Lead IDs if the API returns them
    var parsed = JSON.parse(resp);
    if (parsed.results && parsed.results.success && leadIdColIdx >= 0) {
      var successes = parsed.results.success;
      for (var i = 0; i < successes.length && i < rowIndices.length; i++) {
        if (successes[i].lead_id) {
          sheet.getRange(rowIndices[i], leadIdColIdx + 1).setValue(successes[i].lead_id);
        }
      }
    }
  } catch (err) {
    Logger.log("syncNewLeads error: " + err.message);
  }
}

// ── 3. testConnection ─────────────────────────────────────────────────────────

/**
 * Verifies the CRM webhook URL is reachable.
 * Run this manually once after pasting the script.
 */
function testConnection() {
  try {
    var resp = UrlFetchApp.fetch(WEBHOOK_ENDPOINT, { method: "get", muteHttpExceptions: true });
    Logger.log("Status: " + resp.getResponseCode());
    Logger.log("Body:   " + resp.getContentText());
    SpreadsheetApp.getUi().alert("Connection OK!\n\n" + resp.getContentText());
  } catch (err) {
    SpreadsheetApp.getUi().alert("Connection FAILED:\n" + err.message);
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────

function _post(url, payload) {
  var options = {
    method:             "post",
    contentType:        "application/json",
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: {
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
  };
  var resp = UrlFetchApp.fetch(url, options);
  Logger.log("POST " + url + " → " + resp.getResponseCode());
  return resp.getContentText();
}
