/**
 * IBMP CRM — Google Apps Script
 * ================================
 * Paste this entire file into your Google Apps Script editor
 * (Extensions → Apps Script inside your Google Sheet).
 *
 * What it does:
 *   1. onOpen()        → adds "IBMP CRM" menu to the sheet toolbar
 *   2. onEdit trigger  → sends any cell edit instantly to the CRM
 *   3. syncNewLeads()  → imports rows that have no CRM Lead ID yet
 *   4. syncAllLeads()  → (re)syncs ALL rows to CRM — use the menu button
 *   5. testConnection()→ verifies the webhook URL is reachable
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
 *
 * To sync all leads manually: use the "IBMP CRM → Sync All Leads to CRM" menu
 * (no Google Cloud credentials needed — pushes directly to CRM)
 */

// ── CONFIG — edit these two values ──────────────────────────────────────────
var CRM_URL        = "https://ibmp-crm-1.onrender.com";   // your Render URL
var WEBHOOK_SECRET = "change-me-set-same-in-render-env";  // SHEETS_WEBHOOK_SECRET
// ────────────────────────────────────────────────────────────────────────────

var WEBHOOK_ENDPOINT  = CRM_URL + "/api/webhooks/google-sheets";
var LEADS_ENDPOINT    = CRM_URL + "/api/leads/bulk-create";
var SYNC_ALL_ENDPOINT = CRM_URL + "/api/webhooks/sync-all-from-sheet";

// ── 0. Custom menu ────────────────────────────────────────────────────────────

/**
 * Adds the "IBMP CRM" menu to the Google Sheet toolbar.
 * Runs automatically when the sheet is opened.
 * Install as a trigger: From spreadsheet → On open.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("IBMP CRM")
    .addItem("Sync All Leads to CRM", "syncAllLeads")
    .addItem("Sync New Leads Only", "syncNewLeads")
    .addSeparator()
    .addItem("Test Connection", "testConnection")
    .addItem("Enable Auto-Sync (Every 5 Min)", "setupAutoSyncTrigger")
    .addToUi();
}

/**
 * Column header → CRM field mapping.
 * Add or rename columns here to match your sheet headers.
 */
var COLUMN_MAP = {
  // Name
  "Full Name":                              "full_name",
  "Name":                                   "full_name",
  "full_name":                              "full_name",

  // Contact
  "Email":                                  "email",
  "email":                                  "email",
  "Phone":                                  "phone",
  "Phone Number":                           "phone",
  "phone_number":                           "phone",           // Meta sheet column
  "WhatsApp":                               "whatsapp",
  "whatsapp":                               "whatsapp",

  // Location
  "Country":                                "country",
  "country":                                "country",
  "City":                                   "city",
  "city":                                   "city",

  // Source / Status
  "Source":                                 "source",
  "source":                                 "source",
  "Platform":                               "campaign_medium", // Meta sheet: Facebook/Instagram
  "platform":                               "campaign_medium",
  "Is Organic":                             "is_organic",
  "is_organic":                             "is_organic",      // Meta sheet column
  // Status columns removed - all new leads imported as Fresh
  // "Status":                                 "status",
  // "Lead Status":                            "status",
  // "lead_status":                            "status",          // Meta sheet column

  // Course / Program Interest
  "Course":                                 "course_interested",
  "Course Interested":                      "course_interested",
  "course_interested":                      "course_interested",
  "In Which Program Are You Interested?":   "course_interested",
  "in_which_program_are_you_interested_?":  "course_interested", // Meta sheet column

  // Assignment & follow-up
  "Assigned To":                            "assigned_to",
  "Counselor":                              "assigned_to",
  "Lead Owner":                             "assigned_to",
  "lead_owner":                             "assigned_to",
  "Follow Up Date":                         "follow_up_date",
  "follow_up_date":                         "follow_up_date",
  "Next Action":                            "next_action",
  "next_action":                            "next_action",

  // Priority & qualification
  "Priority":                               "priority_level",
  "priority_level":                         "priority_level",
  "Qualification":                          "qualification",
  "Your Highest Qualification:":            "qualification",   // Meta sheet column (with colon)
  "your_highest_qualification:":            "qualification",
  "your_highest_qualification":             "qualification",   // Meta sheet column (no colon)
  "Your Highest Qualification":             "qualification",

  // Company & notes
  "Company":                                "company",
  "company":                                "company",
  "Notes":                                  "notes",
  "notes":                                  "notes",

  // Campaign / marketing fields - IDs
  "ID":                                     "external_id",     // Sheet row ID
  "id":                                     "external_id",
  "Campaign ID":                            "campaign_id",
  "campaign_id":                            "campaign_id",     // Meta sheet column
  "Ad ID":                                  "ad_id",
  "ad_id":                                  "ad_id",           // Meta sheet column
  "Adset ID":                               "adset_id",
  "adset_id":                               "adset_id",        // Meta sheet column
  "Form ID":                                "form_id",
  "form_id":                                "form_id",         // Meta sheet column

  // Campaign / marketing fields - Names
  "Campaign Name":                          "campaign_name",
  "campaign_name":                          "campaign_name",   // Meta sheet column
  "Campaign Medium":                        "campaign_medium",
  "campaign_medium":                        "campaign_medium",
  "Campaign Group":                         "campaign_group",
  "campaign_group":                         "campaign_group",
  "Ad Name":                                "ad_name",
  "ad_name":                                "ad_name",         // Meta sheet column
  "Adset Name":                             "adset_name",
  "adset_name":                             "adset_name",      // Meta sheet column
  "Form Name":                              "form_name",
  "form_name":                              "form_name",       // Meta sheet column

  // Date/Time fields
  "Created Time":                           "created_at",
  "created_time":                           "created_at",      // Meta sheet column
  "Created At":                             "created_at",
  "created_at":                             "created_at",
  "Date":                                   "created_at",
  "Timestamp":                              "created_at",
  "timestamp":                              "created_at",

  // Quality & rating
  "Lead Quality":                           "lead_quality",
  "lead_quality":                           "lead_quality",
  "Lead Rating":                            "lead_rating",
  "lead_rating":                            "lead_rating",
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
 * Scans ALL sheets in the workbook, not just the active one.
 * Install as a time-driven trigger (every 5 minutes or every hour).
 * Can also be run manually from the Apps Script editor.
 */
function syncNewLeads() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheets  = ss.getSheets();  // Scan ALL sheets instead of just active
  
  var allLeads = [];  // Collect leads from all sheets
  var sheetRowMap = [];  // Track which sheet + row each lead came from

  // Loop through every sheet in the workbook
  for (var s = 0; s < sheets.length; s++) {
    var sheet   = sheets[s];
    var sheetName = sheet.getName();
    
    try {
      var data    = sheet.getDataRange().getValues();
      if (data.length < 2) continue;  // Skip empty sheets
      
      var headers = data[0];
      var leadIdColIdx = headers.indexOf(LEAD_ID_COLUMN);
      
      // If "Lead ID" column doesn't exist, create it
      if (leadIdColIdx < 0) {
        Logger.log("Creating 'Lead ID' column in sheet: " + sheetName);
        leadIdColIdx = headers.length;  // Add at the end
        sheet.getRange(1, leadIdColIdx + 1).setValue(LEAD_ID_COLUMN);
        // Refresh headers array
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }

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

        // Removed validation — sync ALL rows regardless of missing fields

        // Map platform shortcuts to CRM source values
        if (lead.campaign_medium) {
          var platformLower = String(lead.campaign_medium).toLowerCase().trim();
          if (platformLower === "fb" || platformLower === "facebook") {
            lead.source = "Facebook";
          } else if (platformLower === "ig" || platformLower === "instagram") {
            lead.source = "Instagram";
          } else if (platformLower === "wa" || platformLower === "whatsapp") {
            lead.source = "WhatsApp";
          } else if (platformLower === "google" || platformLower === "gads") {
            lead.source = "Google Ads";
          } else if (platformLower === "linkedin" || platformLower === "li") {
            lead.source = "LinkedIn";
          } else {
            lead.source = lead.campaign_medium;  // Use as-is if no match
          }
        }
        
        // Default status only
        if (!lead.status) lead.status = "Fresh";

        allLeads.push(lead);
        sheetRowMap.push({ sheet: sheet, sheetName: sheetName, row: r + 1, leadIdColIdx: leadIdColIdx });
      }
    } catch (sheetErr) {
      Logger.log("syncNewLeads: Error processing sheet '" + sheetName + "': " + sheetErr.message);
    }
  }

  if (allLeads.length === 0) {
    Logger.log("syncNewLeads: no new rows to import across any sheets.");
    return;
  }

  Logger.log("syncNewLeads: importing " + allLeads.length + " leads from " + sheets.length + " sheets...");

  try {
    // Use webhook endpoint instead of /api/leads/bulk-create to avoid 401 error
    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "X-Webhook-Secret": WEBHOOK_SECRET  // Use webhook auth instead of Bearer token
      },
      payload: JSON.stringify({ leads: allLeads }),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(SYNC_ALL_ENDPOINT, options);
    var statusCode = response.getResponseCode();
    var body = response.getContentText();
    
    Logger.log("CRM response [" + statusCode + "]: " + body);

    if (statusCode >= 200 && statusCode < 300) {
      // Write back the assigned Lead IDs and log duplicates
      var parsed = JSON.parse(body);
      var duplicates = [];
      
      if (parsed.results && parsed.results.length > 0) {
        for (var i = 0; i < parsed.results.length && i < sheetRowMap.length; i++) {
          var result = parsed.results[i];
          var mapping = sheetRowMap[i];
          
          if (result.action === "duplicate") {
            // Track duplicate leads with owner info
            duplicates.push({
              row: mapping.row,
              sheet: mapping.sheetName,
              phone: allLeads[i].phone || "",
              name: allLeads[i].full_name || "",
              existing_lead_id: result.existing_lead_id || "",
              existing_owner: result.existing_owner || "Unassigned",
              existing_status: result.existing_status || ""
            });
            
            // ALWAYS write the existing Lead ID to prevent re-importing duplicates
            if (result.existing_lead_id && mapping.leadIdColIdx >= 0) {
              mapping.sheet.getRange(mapping.row, mapping.leadIdColIdx + 1).setValue(result.existing_lead_id);
              Logger.log("Wrote duplicate Lead ID " + result.existing_lead_id + " to row " + mapping.row + " in sheet " + mapping.sheetName);
            }
          } else if (result.lead_id && mapping.leadIdColIdx >= 0) {
            // Write new Lead ID
            mapping.sheet.getRange(mapping.row, mapping.leadIdColIdx + 1).setValue(result.lead_id);
            Logger.log("Wrote new Lead ID " + result.lead_id + " to row " + mapping.row + " in sheet " + mapping.sheetName);
          }
        }
      }
      
      // Log summary
      Logger.log("Sync complete: " + parsed.created + " created, " + parsed.updated + " updated, " + (parsed.skipped || 0) + " duplicates");
      
      // Log duplicate details
      if (duplicates.length > 0) {
        Logger.log("=== DUPLICATE LEADS FOUND ===");
        for (var d = 0; d < duplicates.length; d++) {
          var dup = duplicates[d];
          Logger.log("Row " + dup.row + " (" + dup.sheet + "): " + dup.name + " (" + dup.phone + ") - Already exists as " + dup.existing_lead_id + " (Owner: " + dup.existing_owner + ", Status: " + dup.existing_status + ")");
        }
      }
    } else {
      Logger.log("syncNewLeads: CRM returned error code " + statusCode);
    }
  } catch (err) {
    Logger.log("syncNewLeads error: " + err.message);
  }
}

// ── 3. syncAllLeads — push every row (all sheets) to CRM ─────────────────────

/**
 * Reads ALL rows from ALL sheet tabs and sends them to the CRM.
 * Triggered from the "IBMP CRM → Sync All Leads to CRM" menu.
 * No Google Cloud credentials needed — uses the same webhook secret.
 *
 * Rows that already have a Lead ID are treated as updates (upsert).
 * Rows without a Lead ID are created as new leads.
 * Lead IDs returned by the CRM are written back to the sheet.
 */
function syncAllLeads() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheets  = ss.getSheets();
  var ui      = SpreadsheetApp.getUi();

  var totalSent    = 0;
  var totalCreated = 0;
  var totalUpdated = 0;
  var totalSkipped = 0;
  var totalFailed  = 0;
  var errors       = [];
  var allDuplicates = [];

  for (var s = 0; s < sheets.length; s++) {
    var sheet   = sheets[s];
    var data    = sheet.getDataRange().getValues();
    if (data.length < 2) continue;  // skip empty or header-only sheets

    var headers      = data[0];
    var leadIdColIdx = headers.indexOf(LEAD_ID_COLUMN);
    
    // If "Lead ID" column doesn't exist, create it
    if (leadIdColIdx < 0) {
      Logger.log("Creating 'Lead ID' column in sheet: " + sheet.getName());
      leadIdColIdx = headers.length;  // Add at the end
      sheet.getRange(1, leadIdColIdx + 1).setValue(LEAD_ID_COLUMN);
      // Refresh headers array
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
    
    var batch        = [];
    var rowMap       = [];  // maps batch index → sheet row number (1-indexed)

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (row.every(function(c) { return c === ""; })) continue;

      var lead = { _sheet_name: sheet.getName(), _row_number: r + 1 };

      // Include existing lead ID so the CRM can upsert
      if (leadIdColIdx >= 0 && row[leadIdColIdx]) {
        lead.lead_id = String(row[leadIdColIdx]);
      }

      for (var c = 0; c < headers.length; c++) {
        var crmField = COLUMN_MAP[headers[c]];
        if (crmField && row[c] !== "") {
          lead[crmField] = String(row[c]);
        }
      }

      if (!lead.full_name && !lead.phone) continue;

      // Map platform shortcuts to CRM source values
      if (lead.campaign_medium && !lead.source) {
        var platformLower = String(lead.campaign_medium).toLowerCase().trim();
        if (platformLower === "fb" || platformLower === "facebook") {
          lead.source = "Facebook";
        } else if (platformLower === "ig" || platformLower === "instagram") {
          lead.source = "Instagram";
        } else if (platformLower === "wa" || platformLower === "whatsapp") {
          lead.source = "WhatsApp";
        } else if (platformLower === "google" || platformLower === "gads") {
          lead.source = "Google Ads";
        } else if (platformLower === "linkedin" || platformLower === "li") {
          lead.source = "LinkedIn";
        } else {
          lead.source = lead.campaign_medium;  // Use as-is if no match
        }
      }
      
      // Default status only
      if (!lead.status) lead.status = "Fresh";

      batch.push(lead);
      rowMap.push(r + 1);
    }

    if (batch.length === 0) continue;

    // Send in chunks of 100
    var CHUNK = 100;
    for (var i = 0; i < batch.length; i += CHUNK) {
      var chunk = batch.slice(i, i + CHUNK);
      try {
        var resp     = _postDetailed(SYNC_ALL_ENDPOINT, { leads: chunk });
        var parsed   = null;

        try {
          parsed = JSON.parse(resp.bodyText || "{}");
        } catch (_jsonErr) {
          parsed = null;
        }

        if (resp.statusCode >= 200 && resp.statusCode < 300 && parsed) {
          totalSent    += chunk.length;
          totalCreated += (parsed.created || 0);
          totalUpdated += (parsed.updated || 0);
          totalSkipped += (parsed.skipped || 0);

          // Write back Lead IDs and track duplicates
          if (parsed.results && leadIdColIdx >= 0) {
            for (var j = 0; j < parsed.results.length; j++) {
              var res = parsed.results[j];
              var sheetRow = rowMap[i + j];
              
              if (res.action === "duplicate") {
                // Track duplicate with owner info
                allDuplicates.push({
                  row: sheetRow,
                  sheet: sheet.getName(),
                  phone: chunk[j].phone || "",
                  name: chunk[j].full_name || "",
                  existing_lead_id: res.existing_lead_id || "",
                  existing_owner: res.existing_owner || "Unassigned",
                  existing_status: res.existing_status || ""
                });
                
                // ALWAYS write existing Lead ID to prevent re-importing duplicates
                if (res.existing_lead_id) {
                  sheet.getRange(sheetRow, leadIdColIdx + 1).setValue(res.existing_lead_id);
                  Logger.log("Wrote duplicate Lead ID " + res.existing_lead_id + " to row " + sheetRow + " in sheet " + sheet.getName());
                }
              } else if (res.lead_id && !chunk[j].lead_id) {
                // Write new Lead ID
                sheet.getRange(sheetRow, leadIdColIdx + 1).setValue(res.lead_id);
                Logger.log("Wrote new Lead ID " + res.lead_id + " to row " + sheetRow + " in sheet " + sheet.getName());
              }
            }
          }
        } else {
          totalFailed += chunk.length;
          var detail = parsed && parsed.detail ? parsed.detail : (resp.bodyText || "Unknown error");
          errors.push(
            sheet.getName() + " rows " + (i + 1) + "-" + Math.min(i + CHUNK, batch.length)
            + " → HTTP " + resp.statusCode + " — " + detail
          );
        }
      } catch (err) {
        totalFailed += chunk.length;
        errors.push(sheet.getName() + " rows " + (i + 1) + "-" + Math.min(i + CHUNK, batch.length) + ": " + err.message);
      }
    }
  }

  var msg = "Sync complete!\n\n"
    + "Sent:       " + totalSent    + "\n"
    + "Created:    " + totalCreated + "\n"
    + "Updated:    " + totalUpdated + "\n"
    + "Duplicates: " + totalSkipped + "\n"
    + "Failed:     " + totalFailed  + "\n";
  
  if (allDuplicates.length > 0) {
    msg += "\n=== DUPLICATE LEADS ===\n";
    for (var d = 0; d < Math.min(allDuplicates.length, 10); d++) {
      var dup = allDuplicates[d];
      msg += "Row " + dup.row + " (" + dup.sheet + "): " + dup.name + " (" + dup.phone + ")\n"
           + "  → Already exists as " + dup.existing_lead_id 
           + " (Owner: " + dup.existing_owner + ", Status: " + dup.existing_status + ")\n";
    }
    if (allDuplicates.length > 10) {
      msg += "  ... and " + (allDuplicates.length - 10) + " more duplicates\n";
    }
  }
  
  if (errors.length > 0) {
    msg += "\nErrors:\n" + errors.slice(0, 5).join("\n");
  }
  if (totalFailed > 0 && errors.join(" ").indexOf("Invalid webhook secret") >= 0) {
    msg += "\n\nHint: WEBHOOK_SECRET in Apps Script must match SHEETS_WEBHOOK_SECRET on Render.";
  }
  ui.alert("IBMP CRM — Sync All Leads", msg, ui.ButtonSet.OK);
}

// ── 4. testConnection ─────────────────────────────────────────────────────────

/**
 * Verifies the CRM webhook URL is reachable.
 * Run this manually once after pasting the script.
 */
function testConnection() {
  try {
    var ui = SpreadsheetApp.getUi();

    // 1) Basic reachability
    var health = UrlFetchApp.fetch(WEBHOOK_ENDPOINT, { method: "get", muteHttpExceptions: true });
    var healthCode = health.getResponseCode();

    // 2) Secret validation (important): lightweight POST to sync-all endpoint
    var probe = _postDetailed(SYNC_ALL_ENDPOINT, { leads: [] });
    var probeMsg = "";
    try {
      var probeJson = JSON.parse(probe.bodyText || "{}");
      probeMsg = probeJson.detail || probe.bodyText;
    } catch (_e) {
      probeMsg = probe.bodyText;
    }

    var msg = "Health GET: HTTP " + healthCode + "\n"
      + "Sync POST: HTTP " + probe.statusCode + "\n\n"
      + "Response: " + probeMsg;

    if (probe.statusCode === 403) {
      msg += "\n\nSecret mismatch. Set WEBHOOK_SECRET in Apps Script equal to SHEETS_WEBHOOK_SECRET in Render.";
    }
    ui.alert("IBMP CRM — Connection Test", msg, ui.ButtonSet.OK);
  } catch (err) {
    SpreadsheetApp.getUi().alert("Connection FAILED:\n" + err.message);
  }
}

/**
 * Sets up automatic sync trigger to run every 5 minutes.
 * Run this function once from the Apps Script editor to install the trigger.
 * 
 * To verify: Tools → Triggers in the left sidebar.
 * To remove: Find "syncNewLeads" in Triggers and delete it.
 */
function setupAutoSyncTrigger() {
  try {
    // Remove existing syncNewLeads triggers to avoid duplicates
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "syncNewLeads") {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }

    // Create new time-driven trigger: every 5 minutes
    ScriptApp.newTrigger("syncNewLeads")
      .timeBased()
      .everyMinutes(5)
      .create();

    SpreadsheetApp.getUi().alert(
      "Auto-Sync Enabled",
      "syncNewLeads() will now run every 5 minutes.\n\n"
      + "To verify: Tools → Triggers\n"
      + "To disable: Delete the 'syncNewLeads' trigger from the Triggers page.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (err) {
    SpreadsheetApp.getUi().alert("Trigger Setup Failed:\n" + err.message);
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

function _postDetailed(url, payload) {
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
  var code = resp.getResponseCode();
  var body = resp.getContentText();
  Logger.log("POST " + url + " → " + code + " " + body);
  return { statusCode: code, bodyText: body };
}
