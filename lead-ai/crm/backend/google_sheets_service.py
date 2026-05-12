"""
Google Sheets Integration Service
Syncs lead data from Google Sheets to CRM.

Supports two credential modes:
  1. GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON env var (JSON string) — preferred for cloud deploys
  2. GOOGLE_SHEETS_CREDENTIALS_PATH file path — for local dev
"""
import os
import re
from typing import List, Dict, Optional, Any
from datetime import datetime
import json

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GOOGLE_SHEETS_AVAILABLE = True
except ImportError:
    GOOGLE_SHEETS_AVAILABLE = False

from logger_config import logger

# Flexible column mapping: normalised header → CRM field name.
# Headers are normalised (lowered, stripped, non-alnum replaced with _) before lookup.
_COLUMN_ALIAS_MAP: Dict[str, str] = {
    # identifiers
    'id':                           'meta_lead_id',
    'lead_id':                      'meta_lead_id',
    'meta_lead_id':                 'meta_lead_id',

    # timestamps
    'created_time':                 'created_time',
    'created_at':                   'created_time',
    'date':                         'created_time',
    'timestamp':                    'created_time',
    'created_date':                 'created_time',
    'submission_date':              'created_time',

    # contact
    'full_name':                    'full_name',
    'name':                         'full_name',
    'student_name':                 'full_name',
    'candidate_name':               'full_name',
    'first_name':                   'first_name',
    'last_name':                    'last_name',
    'phone_number':                 'phone',
    'phone':                        'phone',
    'mobile':                       'phone',
    'mobile_number':                'phone',
    'contact':                      'phone',
    'contact_number':               'phone',
    'whatsapp':                     'whatsapp',
    'whatsapp_number':              'whatsapp',
    'email':                        'email',
    'email_address':                'email',
    'email_id':                     'email',

    # location
    'country':                      'country',
    'city':                         'city',
    'state':                        'state',
    'location':                     'country',

    # course / education
    'course':                       'course_interested',
    'course_interested':            'course_interested',
    'course_name':                  'course_interested',
    'program':                      'course_interested',
    'programme':                    'course_interested',
    'interested_course':            'course_interested',
    'your_highest_qualification_':  'qualification',
    'your_highest_qualification':   'qualification',
    'qualification':                'qualification',
    'highest_qualification':        'qualification',
    'education':                    'qualification',

    # source / campaign
    'source':                       'source',
    'lead_source':                  'source',
    'platform':                     'platform',
    'ad_name':                      'ad_name',
    'ad_id':                        'ad_id',
    'adset_id':                     'adset_id',
    'adset_name':                   'adset_name',
    'campaign_name':                'campaign_name',
    'campaign_id':                  'campaign_id',
    'form_name':                    'form_name',
    'form_id':                      'form_id',
    'is_organic':                   'is_organic',
    'utm_source':                   'utm_source',
    'utm_medium':                   'utm_medium',
    'utm_campaign':                 'utm_campaign',

    # status
    'lead_status':                  'sheet_lead_status',
    'status':                       'sheet_lead_status',

    # sync
    'sync_status':                  'Sync_Status',
}


def _normalise_header(raw: str) -> str:
    """Lowercase, strip, replace non-alnum with underscore, collapse repeats."""
    return re.sub(r'_+', '_', re.sub(r'[^a-z0-9]+', '_', raw.strip().lower())).strip('_')


class GoogleSheetsService:
    """Service for reading and updating Google Sheets"""
    
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
    DEFAULT_SHEET_ID = '1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU'

    def __init__(self):
        self.credentials = None
        self.service = None
        self.sheet_id = None
        self.sheet_name = None
        self._initialize()
    
    def _initialize(self):
        """Initialize Google Sheets API connection.
        
        Tries credentials in order:
          1. GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON env var (JSON string)
          2. GOOGLE_SHEETS_CREDENTIALS_PATH / google-credentials.json file
        """
        if not GOOGLE_SHEETS_AVAILABLE:
            logger.warning("Google Sheets libraries not installed. Run: pip install google-auth google-auth-oauthlib google-api-python-client")
            return

        creds = None

        # Method 1: JSON string from env var (preferred for Render / Docker / cloud)
        json_env = os.getenv('GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON', '').strip()
        if json_env:
            try:
                info = json.loads(json_env)
                creds = service_account.Credentials.from_service_account_info(
                    info, scopes=self.SCOPES,
                )
                logger.info("Google Sheets credentials loaded from GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON env var")
            except Exception as e:
                logger.error(f"Failed to parse GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON: {e}")

        # Method 2: Credentials file on disk
        if creds is None:
            creds_path = os.getenv('GOOGLE_SHEETS_CREDENTIALS_PATH', 'google-credentials.json')
            if os.path.exists(creds_path):
                try:
                    creds = service_account.Credentials.from_service_account_file(
                        creds_path, scopes=self.SCOPES,
                    )
                    logger.info(f"Google Sheets credentials loaded from file: {creds_path}")
                except Exception as e:
                    logger.error(f"Failed to load credentials from {creds_path}: {e}")
            else:
                logger.warning(f"Google Sheets credentials file not found at: {creds_path}")

        if creds is None:
            logger.warning(
                "Google Sheets sync disabled — set GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON env var "
                "or place a service account JSON file at GOOGLE_SHEETS_CREDENTIALS_PATH"
            )
            return

        try:
            self.credentials = creds
            self.service = build('sheets', 'v4', credentials=self.credentials)
            self.sheet_id = os.getenv('GOOGLE_SHEET_ID', self.DEFAULT_SHEET_ID)
            self.sheet_name = os.getenv('GOOGLE_SHEET_NAME', 'Sheet1')
            logger.info(f"Google Sheets service initialized — Sheet ID: {self.sheet_id}")
        except Exception as e:
            logger.error(f"Failed to build Google Sheets API service: {e}")
            self.service = None
    
    def is_available(self) -> bool:
        """Check if Google Sheets service is available"""
        return self.service is not None
    
    def _map_header(self, raw_header: str) -> str:
        """Map a raw sheet header to a CRM field using the flexible alias map."""
        norm = _normalise_header(raw_header)
        return _COLUMN_ALIAS_MAP.get(norm, raw_header)

    def get_all_leads(self) -> List[Dict[str, Any]]:
        """
        Fetch all leads from ALL sheets/tabs in the Google Sheet.
        Returns list of lead dictionaries with _sheet_name and _row_number metadata.
        """
        if not self.is_available():
            logger.warning("Google Sheets service not available")
            return []
        
        try:
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=self.sheet_id
            ).execute()
            
            sheet_names = [sheet['properties']['title'] for sheet in spreadsheet.get('sheets', [])]
            logger.info(f"Found {len(sheet_names)} sheets: {', '.join(sheet_names)}")
            
            all_leads = []
            
            for sheet_name in sheet_names:
                try:
                    range_name = f"'{sheet_name}'!A1:AZ10000"
                    
                    result = self.service.spreadsheets().values().get(
                        spreadsheetId=self.sheet_id,
                        range=range_name
                    ).execute()
                    
                    values = result.get('values', [])
                    
                    if not values:
                        logger.info(f"No data found in sheet: {sheet_name}")
                        continue
                    
                    raw_headers = values[0]
                    mapped_headers = [self._map_header(h) for h in raw_headers]
                    
                    for i, row in enumerate(values[1:], start=2):
                        if not any(cell.strip() for cell in row if isinstance(cell, str)):
                            continue
                        
                        lead: Dict[str, Any] = {
                            '_row_number': i,
                            '_sheet_name': sheet_name,
                        }
                        
                        for col_idx, crm_field in enumerate(mapped_headers):
                            value = row[col_idx].strip() if col_idx < len(row) else ''
                            lead[crm_field] = value
                        
                        # Build full_name from first_name + last_name if full_name is empty
                        if not lead.get('full_name', '').strip():
                            first = lead.get('first_name', '').strip()
                            last = lead.get('last_name', '').strip()
                            if first or last:
                                lead['full_name'] = f"{first} {last}".strip()
                        
                        all_leads.append(lead)
                    
                    logger.info(f"Fetched {len(values)-1} rows from sheet: {sheet_name}")
                    
                except Exception as e:
                    logger.error(f"Error fetching leads from sheet '{sheet_name}': {e}")
                    continue
            
            logger.info(f"Total fetched: {len(all_leads)} leads from {len(sheet_names)} sheets")
            return all_leads
            
        except HttpError as e:
            logger.error(f"Google Sheets API error: {e}")
            return []
        except Exception as e:
            logger.error(f"Error fetching leads from Google Sheet: {e}")
            return []
    
    def get_unsynced_leads(self) -> List[Dict[str, Any]]:
        """
        Fetch only unsynced leads (where Sync_Status is not 'Synced')
        Returns list of lead dictionaries
        """
        all_leads = self.get_all_leads()
        
        # Filter for unsynced leads
        unsynced = [
            lead for lead in all_leads 
            if lead.get('Sync_Status', '').strip().lower() != 'synced'
        ]
        
        logger.info(f"📊 Found {len(unsynced)} unsynced leads out of {len(all_leads)} total")
        return unsynced
    
    def mark_as_synced(self, row_number: int, sheet_name: str) -> bool:
        """
        Mark a lead as synced by updating Sync_Status column
        
        Args:
            row_number: Row number in the sheet (1-indexed, including header)
            sheet_name: Name of the sheet/tab
        
        Returns:
            True if successful, False otherwise
        """
        if not self.is_available():
            return False
        
        try:
            # Find Sync_Status column
            # First, get the header row to find the column
            range_name = f"'{sheet_name}'!A1:Z1"
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.sheet_id,
                range=range_name
            ).execute()
            
            headers = result.get('values', [[]])[0]
            
            # Find Sync_Status column index
            sync_col_idx = None
            for idx, header in enumerate(headers):
                if header.strip() == 'Sync_Status':
                    sync_col_idx = idx
                    break
            
            if sync_col_idx is None:
                logger.warning(f"⚠️ Sync_Status column not found in sheet: {sheet_name}")
                return False
            
            # Convert column index to letter (A, B, C, etc.)
            col_letter = chr(65 + sync_col_idx) if sync_col_idx < 26 else 'Z'
            
            # Update the cell
            range_name = f"'{sheet_name}'!{col_letter}{row_number}"
            
            self.service.spreadsheets().values().update(
                spreadsheetId=self.sheet_id,
                range=range_name,
                valueInputOption='RAW',
                body={'values': [['Synced']]}
            ).execute()
            
            logger.info(f"✅ Marked row {row_number} as synced in sheet: {sheet_name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error marking row {row_number} as synced in sheet '{sheet_name}': {e}")
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test Google Sheets connection and return status
        """
        if not GOOGLE_SHEETS_AVAILABLE:
            return {
                'status': 'error',
                'message': 'Google Sheets libraries not installed'
            }
        
        if not self.is_available():
            return {
                'status': 'error',
                'message': 'Google Sheets service not initialized'
            }
        
        try:
            # Get spreadsheet info including all sheets
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=self.sheet_id
            ).execute()
            
            sheet_names = [sheet['properties']['title'] for sheet in spreadsheet.get('sheets', [])]
            
            # Get sample from first sheet
            if sheet_names:
                first_sheet = sheet_names[0]
                range_name = f"'{first_sheet}'!A1:Z1"
                result = self.service.spreadsheets().values().get(
                    spreadsheetId=self.sheet_id,
                    range=range_name
                ).execute()
                
                headers = result.get('values', [[]])[0]
            else:
                headers = []
            
            return {
                'status': 'success',
                'message': 'Connected to Google Sheet',
                'sheet_id': self.sheet_id,
                'sheet_count': len(sheet_names),
                'sheet_names': sheet_names,
                'sample_columns': headers[:10] if headers else [],
                'column_count': len(headers)
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Failed to connect: {str(e)}'
            }


# Global instance
google_sheets_service = GoogleSheetsService()
