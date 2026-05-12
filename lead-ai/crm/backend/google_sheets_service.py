"""
Google Sheets Integration Service
Syncs Meta lead ads data from Google Sheets to CRM
"""
import os
from typing import List, Dict, Optional, Any
from datetime import datetime
import json
import re

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GOOGLE_SHEETS_AVAILABLE = True
except ImportError:
    GOOGLE_SHEETS_AVAILABLE = False

from logger_config import logger

class GoogleSheetsService:
    """Service for reading and updating Google Sheets"""

    @staticmethod
    def _normalize_header(header: str) -> str:
        """Normalize sheet header for tolerant field mapping."""
        return re.sub(r'[^a-z0-9]+', '_', (header or '').strip().lower()).strip('_')
    
    def __init__(self):
        self.credentials = None
        self.service = None
        self.sheet_id = None
        self.sheet_name = None
        
        # Column mapping from Google Sheet to CRM fields
        self.column_mapping = {
            'id': 'meta_lead_id',
            'created_time': 'created_at',
            'full_name': 'full_name',
            'phone_number': 'phone',
            'email': 'email',
            'country': 'country',
            'ad_name': 'ad_name',
            'campaign_name': 'campaign_name',
            'form_name': 'form_name',
            'platform': 'platform',
            'your_highest_qualification:': 'qualification',
            'your_highest_qualification': 'qualification',
            'in_which_course_are_you_interested?': 'course_interested',
            'in_which_course_are_you_interested': 'course_interested',
            'lead_status': 'sheet_lead_status',
            'ad_id': 'ad_id',
            'adset_id': 'adset_id',
            'adset_name': 'adset_name',
            'campaign_id': 'campaign_id',
            'form_id': 'form_id',
            'is_organic': 'is_organic',
        }

        # Normalized fallback mapping (handles casing, spaces, punctuation)
        self.normalized_column_mapping = {
            self._normalize_header(k): v for k, v in self.column_mapping.items()
        }
        
        self._initialize()
    
    def _initialize(self):
        """Initialize Google Sheets API connection"""
        if not GOOGLE_SHEETS_AVAILABLE:
            logger.warning("⚠️ Google Sheets libraries not installed. Run: pip install google-auth google-auth-oauthlib google-api-python-client")
            return
        
        try:
            # ── Option 1: credentials JSON in env var (Render / cloud deployments) ──
            creds_json_str = os.getenv('GOOGLE_SHEETS_CREDENTIALS_JSON', '')
            if creds_json_str:
                import json as _json
                creds_info = _json.loads(creds_json_str)
                self.credentials = service_account.Credentials.from_service_account_info(
                    creds_info,
                    scopes=['https://www.googleapis.com/auth/spreadsheets']
                )
                logger.info("✅ Google Sheets credentials loaded from env var")
            else:
                # ── Option 2: credentials file on disk (local dev) ─────────────────
                creds_path = os.getenv('GOOGLE_SHEETS_CREDENTIALS_PATH', 'google-credentials.json')
                if not os.path.exists(creds_path):
                    logger.warning(
                        f"⚠️ Google Sheets credentials not found. "
                        f"Set GOOGLE_SHEETS_CREDENTIALS_JSON env var (cloud) "
                        f"or place google-credentials.json at: {creds_path}"
                    )
                    return
                self.credentials = service_account.Credentials.from_service_account_file(
                    creds_path,
                    scopes=['https://www.googleapis.com/auth/spreadsheets']
                )
                logger.info("✅ Google Sheets credentials loaded from file")

        except Exception as e:
            logger.error(f"❌ Failed to load Google Sheets credentials: {e}")
            return

        try:
            # Build the service
            self.service = build('sheets', 'v4', credentials=self.credentials)
            
            # Load sheet configuration
            self.sheet_id = os.getenv('GOOGLE_SHEET_ID', '1icOnwhO-kqdw-h716CBuQ01J5Anhl-SwqXBctY0qfZU')
            self.sheet_name = os.getenv('GOOGLE_SHEET_NAME', 'Sheet1')
            
            logger.info("✅ Google Sheets service initialized successfully")
            logger.info(f"📊 Sheet ID: {self.sheet_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Google Sheets service: {e}")
            self.service = None
    
    def is_available(self) -> bool:
        """Check if Google Sheets service is available"""
        return self.service is not None
    
    def get_all_leads(self) -> List[Dict[str, Any]]:
        """
        Fetch all leads from ALL sheets/tabs in the Google Sheet
        Returns list of lead dictionaries with sheet_name included
        """
        if not self.is_available():
            logger.warning("⚠️ Google Sheets service not available")
            return []
        
        try:
            # First, get all sheet names (tabs)
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=self.sheet_id
            ).execute()
            
            sheet_names = [sheet['properties']['title'] for sheet in spreadsheet.get('sheets', [])]
            logger.info(f"📊 Found {len(sheet_names)} sheets: {', '.join(sheet_names)}")
            
            all_leads = []
            
            # Process each sheet/tab
            for sheet_name in sheet_names:
                try:
                    # Read the sheet
                    range_name = f"'{sheet_name}'!A1:Z1000"  # Adjust range as needed
                    
                    result = self.service.spreadsheets().values().get(
                        spreadsheetId=self.sheet_id,
                        range=range_name
                    ).execute()
                    
                    values = result.get('values', [])
                    
                    if not values:
                        logger.info(f"📝 No data found in sheet: {sheet_name}")
                        continue
                    
                    # First row is headers
                    headers = values[0]
                    
                    # Process each row
                    for i, row in enumerate(values[1:], start=2):
                        # Skip if row is empty
                        if not any(row):
                            continue
                        
                        # Create lead dict with proper column mapping
                        lead = {
                            '_row_number': i,
                            '_sheet_name': sheet_name  # Store which tab this lead came from
                        }
                        
                        for col_idx, header in enumerate(headers):
                            # Get value if it exists, otherwise empty string
                            value = row[col_idx] if col_idx < len(row) else ''
                            
                            # Map to CRM field
                            crm_field = self.column_mapping.get(header)
                            if not crm_field:
                                crm_field = self.normalized_column_mapping.get(
                                    self._normalize_header(header),
                                    header,
                                )
                            lead[crm_field] = value
                        
                        all_leads.append(lead)
                    
                    logger.info(f"✅ Fetched {len(values)-1} leads from sheet: {sheet_name}")
                    
                except Exception as e:
                    logger.error(f"❌ Error fetching leads from sheet '{sheet_name}': {e}")
                    continue
            
            logger.info(f"✅ Total fetched: {len(all_leads)} leads from {len(sheet_names)} sheets")
            return all_leads
            
        except HttpError as e:
            logger.error(f"❌ Google Sheets API error: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Error fetching leads from Google Sheet: {e}")
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
