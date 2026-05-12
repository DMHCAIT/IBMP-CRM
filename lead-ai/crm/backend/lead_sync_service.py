"""
Google Sheets Lead Sync Service
Handles syncing leads from Google Sheets to CRM as Fresh Leads.
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import hashlib
import re

from google_sheets_service import google_sheets_service
from supabase_data_layer import supabase_data
from logger_config import logger


class LeadSyncService:
    """Service for syncing leads from Google Sheets to CRM"""
    
    def __init__(self):
        self.sync_stats = {
            'last_sync': None,
            'total_synced': 0,
            'total_failed': 0,
            'total_skipped': 0,
            'is_syncing': False
        }
    
    def normalize_phone(self, phone: str) -> str:
        """Normalize phone number to standard format"""
        if not phone:
            return ''
        phone = re.sub(r'[^\d+]', '', str(phone))
        if phone and not phone.startswith('+'):
            phone = '+91' + phone
        return phone
    
    def normalize_email(self, email: str) -> str:
        """Normalize email address"""
        if not email:
            return ''
        return str(email).strip().lower()
    
    def _generate_lead_id(self, sheet_lead: Dict[str, Any]) -> str:
        """Generate a unique lead_id from sheet data.
        
        Uses meta_lead_id if available, otherwise hashes name+phone+email+row
        to produce a deterministic, collision-resistant ID.
        """
        meta_id = str(sheet_lead.get('meta_lead_id', '')).strip()
        if meta_id:
            safe = re.sub(r'[^A-Za-z0-9]', '', meta_id)[:12]
            return f"LEAD{safe.upper()}"

        raw = '|'.join([
            str(sheet_lead.get('full_name', '')).strip(),
            str(sheet_lead.get('phone', sheet_lead.get('phone_number', ''))).strip(),
            str(sheet_lead.get('email', '')).strip(),
            str(sheet_lead.get('_sheet_name', '')),
            str(sheet_lead.get('_row_number', '')),
        ])
        digest = hashlib.md5(raw.encode()).hexdigest()[:10].upper()
        return f"LEAD{digest}"

    def parse_meta_timestamp(self, timestamp: str) -> Optional[str]:
        """Parse various timestamp formats and return ISO format."""
        if not timestamp:
            return None
        try:
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%dT%H:%M:%SZ',
                '%Y-%m-%d',
                '%d/%m/%Y %H:%M:%S',
                '%d/%m/%Y',
                '%m/%d/%Y %H:%M:%S',
                '%m/%d/%Y',
                '%d-%m-%Y',
            ]
            for fmt in formats:
                try:
                    dt = datetime.strptime(timestamp.strip(), fmt)
                    return dt.isoformat() + 'Z'
                except ValueError:
                    continue
            logger.warning(f"Could not parse timestamp: {timestamp}, using current time")
            return datetime.utcnow().isoformat() + 'Z'
        except Exception as e:
            logger.warning(f"Error parsing timestamp {timestamp}: {e}")
            return datetime.utcnow().isoformat() + 'Z'
    
    def map_sheet_lead_to_crm(self, sheet_lead: Dict[str, Any]) -> Dict[str, Any]:
        """Map Google Sheet lead data to CRM lead format.
        
        The google_sheets_service already maps headers to CRM field names,
        so most fields come through directly.
        """
        lead_id = self._generate_lead_id(sheet_lead)
        
        sheet_name = sheet_lead.get('_sheet_name', '')
        
        # Use explicit course_interested from sheet; fall back to sheet tab name
        course = (
            sheet_lead.get('course_interested', '').strip()
            or sheet_name
            or 'Not Specified'
        )
        
        # Phone: the sheets service maps phone_number → phone already
        phone_raw = (
            sheet_lead.get('phone', '')
            or sheet_lead.get('phone_number', '')
            or sheet_lead.get('mobile', '')
            or sheet_lead.get('contact', '')
        )
        
        email_raw = sheet_lead.get('email', '')
        
        platform = sheet_lead.get('platform', '').strip()
        source_raw = sheet_lead.get('source', '').strip()
        if source_raw:
            source = source_raw
        elif platform:
            source = f"Meta - {platform}"
        else:
            source = 'Google Sheets Import'

        crm_lead = {
            'lead_id': lead_id,
            'full_name': sheet_lead.get('full_name', '').strip(),
            'email': self.normalize_email(email_raw),
            'phone': self.normalize_phone(phone_raw),
            'whatsapp': self.normalize_phone(sheet_lead.get('whatsapp', '')),
            'country': sheet_lead.get('country', '').strip() or 'India',
            'source': source,
            'course_interested': course,
            'status': 'Fresh',
            'ai_segment': 'Cold',
            'ai_score': 0.0,
            'conversion_probability': 0.0,
            'expected_revenue': 0.0,
            'actual_revenue': 0.0,
            'priority_level': 'normal',
            'next_action': 'Call - Initial Contact',
            'assigned_to': 'Unassigned',
            'created_at': self.parse_meta_timestamp(sheet_lead.get('created_time', '')),
            'updated_at': datetime.utcnow().isoformat() + 'Z',
        }

        # Attach optional campaign fields
        for field in ('campaign_name', 'campaign_id', 'utm_source', 'utm_medium', 'utm_campaign'):
            val = sheet_lead.get(field, '').strip()
            if val:
                crm_lead[field] = val

        # Attach qualification if present
        qual = sheet_lead.get('qualification', '').strip()
        if qual:
            crm_lead['qualification'] = qual

        # Build meta_data dict for the import note
        crm_lead['_meta_data'] = {
            'meta_lead_id': sheet_lead.get('meta_lead_id', ''),
            'ad_id': sheet_lead.get('ad_id', ''),
            'ad_name': sheet_lead.get('ad_name', ''),
            'adset_id': sheet_lead.get('adset_id', ''),
            'adset_name': sheet_lead.get('adset_name', ''),
            'campaign_id': sheet_lead.get('campaign_id', ''),
            'campaign_name': sheet_lead.get('campaign_name', ''),
            'form_id': sheet_lead.get('form_id', ''),
            'form_name': sheet_lead.get('form_name', ''),
            'platform': platform,
            'is_organic': sheet_lead.get('is_organic', ''),
            'qualification': qual,
            'sheet_lead_status': sheet_lead.get('sheet_lead_status', ''),
            'sheet_name': sheet_name,
        }

        return crm_lead
    
    def should_sync_lead(self, sheet_lead: Dict[str, Any]) -> Tuple[bool, str]:
        """Check if a lead should be synced."""
        if not sheet_lead.get('full_name', '').strip():
            return False, 'Missing full name'
        
        email = sheet_lead.get('email', '').strip()
        phone = (
            sheet_lead.get('phone', '')
            or sheet_lead.get('phone_number', '')
            or sheet_lead.get('mobile', '')
        ).strip()
        
        if not email and not phone:
            return False, 'Missing both email and phone'
        
        if sheet_lead.get('Sync_Status', '').strip().lower() == 'synced':
            return False, 'Already synced'
        
        return True, 'OK'
    
    def check_duplicate(self, crm_lead: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Check if lead already exists in CRM by lead_id, email, or phone."""
        try:
            # Check by lead_id first (deterministic from sheet data)
            lid = crm_lead.get('lead_id', '').strip()
            if lid:
                existing = supabase_data.get_lead_by_id(lid)
                if existing:
                    return existing

            # Check by email
            email = crm_lead.get('email', '').strip()
            if email:
                result = supabase_data.get_leads(search=email, limit=5)
                leads = result.get('leads', []) if isinstance(result, dict) else []
                for lead in leads:
                    if lead.get('email', '').lower().strip() == email:
                        return lead
            
            # Check by phone
            phone = crm_lead.get('phone', '').strip()
            if phone and len(phone) >= 10:
                phone_digits = re.sub(r'[^\d]', '', phone)[-10:]
                result = supabase_data.get_leads(search=phone_digits, limit=5)
                leads = result.get('leads', []) if isinstance(result, dict) else []
                for lead in leads:
                    existing_digits = re.sub(r'[^\d]', '', lead.get('phone', ''))[-10:]
                    if existing_digits == phone_digits:
                        return lead
            
            return None
        except Exception as e:
            logger.error(f"Error checking for duplicate: {e}")
            return None
    
    def sync_single_lead(self, sheet_lead: Dict[str, Any]) -> Dict[str, Any]:
        """Sync a single lead from Google Sheet to CRM."""
        row_number = sheet_lead.get('_row_number')
        sheet_name = sheet_lead.get('_sheet_name', 'Unknown')
        
        should_sync, reason = self.should_sync_lead(sheet_lead)
        if not should_sync:
            return {
                'status': 'skipped',
                'reason': reason,
                'row': row_number,
                'sheet': sheet_name
            }
        
        try:
            crm_lead = self.map_sheet_lead_to_crm(sheet_lead)
            
            existing = self.check_duplicate(crm_lead)
            if existing:
                logger.info(f"Lead already exists: {crm_lead.get('full_name')} ({crm_lead.get('email') or crm_lead.get('phone')}) from {sheet_name}")
                if row_number:
                    google_sheets_service.mark_as_synced(row_number, sheet_name)
                return {
                    'status': 'duplicate',
                    'reason': 'Lead already exists in CRM',
                    'lead_id': existing.get('lead_id'),
                    'row': row_number,
                    'sheet': sheet_name
                }
            
            # Pop internal-only field before writing to DB
            meta_data = crm_lead.pop('_meta_data', {})
            
            created_lead = supabase_data.create_lead(crm_lead)
            
            if created_lead:
                logger.info(f"Synced lead: {crm_lead.get('full_name')} from {sheet_name} ({crm_lead.get('email') or crm_lead.get('phone')})")
                
                note_parts = [f"Lead imported from Google Sheets"]
                if sheet_name:
                    note_parts.append(f"Sheet: {sheet_name}")
                if meta_data.get('campaign_name'):
                    note_parts.append(f"Campaign: {meta_data['campaign_name']}")
                if meta_data.get('adset_name'):
                    note_parts.append(f"Ad Set: {meta_data['adset_name']}")
                if meta_data.get('ad_name'):
                    note_parts.append(f"Ad: {meta_data['ad_name']}")
                if meta_data.get('platform'):
                    note_parts.append(f"Platform: {meta_data['platform']}")
                if meta_data.get('form_name'):
                    note_parts.append(f"Form: {meta_data['form_name']}")
                if meta_data.get('qualification'):
                    note_parts.append(f"Qualification: {meta_data['qualification']}")
                if meta_data.get('meta_lead_id'):
                    note_parts.append(f"Meta Lead ID: {meta_data['meta_lead_id']}")
                
                note_content = '\n'.join(note_parts)
                
                try:
                    supabase_data.create_note(
                        lead_id=created_lead['id'],
                        content=note_content,
                        channel='system',
                        created_by='System - Google Sheets Sync',
                    )
                except Exception as e:
                    logger.warning(f"Could not create note for lead: {e}")
                
                if row_number:
                    google_sheets_service.mark_as_synced(row_number, sheet_name)
                
                return {
                    'status': 'success',
                    'lead_id': created_lead.get('lead_id'),
                    'row': row_number,
                    'sheet': sheet_name
                }
            else:
                logger.error(f"Failed to create lead: {crm_lead.get('full_name')} from {sheet_name}")
                return {
                    'status': 'error',
                    'reason': 'Failed to create lead in CRM',
                    'row': row_number,
                    'sheet': sheet_name
                }
            
        except Exception as e:
            logger.error(f"Error syncing lead from {sheet_name}: {e}")
            return {
                'status': 'error',
                'reason': str(e),
                'row': row_number,
                'sheet': sheet_name
            }
    
    def sync_all_leads(self) -> Dict[str, Any]:
        """Sync ALL leads from Google Sheet (ignores Sync_Status).
        
        Use this for the initial full import when connecting a new sheet.
        """
        if self.sync_stats['is_syncing']:
            return {'status': 'error', 'message': 'Sync already in progress'}

        self.sync_stats['is_syncing'] = True
        try:
            logger.info("Starting full Google Sheets sync (all leads)...")
            if not google_sheets_service.is_available():
                return {'status': 'error', 'message': 'Google Sheets service not available'}

            all_leads = google_sheets_service.get_all_leads()
            if not all_leads:
                return {
                    'status': 'success',
                    'message': 'No leads found in sheet',
                    'synced': 0, 'failed': 0, 'skipped': 0, 'duplicates': 0,
                }

            logger.info(f"Found {len(all_leads)} total leads in sheet")
            return self._process_lead_batch(all_leads)
        except Exception as e:
            logger.error(f"Full sync failed: {e}")
            return {'status': 'error', 'message': str(e)}
        finally:
            self.sync_stats['is_syncing'] = False

    def sync_all_unsynced_leads(self) -> Dict[str, Any]:
        """Sync only unsynced leads from Google Sheet."""
        if self.sync_stats['is_syncing']:
            return {'status': 'error', 'message': 'Sync already in progress'}
        
        self.sync_stats['is_syncing'] = True
        try:
            logger.info("Starting Google Sheets sync (unsynced only)...")
            if not google_sheets_service.is_available():
                return {'status': 'error', 'message': 'Google Sheets service not available'}
            
            unsynced_leads = google_sheets_service.get_unsynced_leads()
            if not unsynced_leads:
                logger.info("No unsynced leads found")
                return {
                    'status': 'success',
                    'message': 'No new leads to sync',
                    'synced': 0, 'failed': 0, 'skipped': 0, 'duplicates': 0,
                }
            
            logger.info(f"Found {len(unsynced_leads)} unsynced leads")
            return self._process_lead_batch(unsynced_leads)
        except Exception as e:
            logger.error(f"Sync failed: {e}")
            return {'status': 'error', 'message': str(e)}
        finally:
            self.sync_stats['is_syncing'] = False

    def _process_lead_batch(self, leads: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process a batch of leads for syncing."""
        results: Dict[str, Any] = {
            'synced': 0, 'failed': 0, 'skipped': 0, 'duplicates': 0, 'details': [],
        }

        for sheet_lead in leads:
            result = self.sync_single_lead(sheet_lead)
            results['details'].append(result)
            if result['status'] == 'success':
                results['synced'] += 1
            elif result['status'] == 'duplicate':
                results['duplicates'] += 1
            elif result['status'] == 'skipped':
                results['skipped'] += 1
            else:
                results['failed'] += 1

        self.sync_stats['last_sync'] = datetime.utcnow().isoformat()
        self.sync_stats['total_synced'] += results['synced']
        self.sync_stats['total_failed'] += results['failed']
        self.sync_stats['total_skipped'] += results['skipped']

        logger.info(
            f"Sync complete: {results['synced']} synced, {results['duplicates']} duplicates, "
            f"{results['skipped']} skipped, {results['failed']} failed"
        )
        return {
            'status': 'success',
            'message': f"Synced {results['synced']} new leads as Fresh Leads",
            **results,
        }

    def get_sync_stats(self) -> Dict[str, Any]:
        """Get current sync statistics"""
        return {
            **self.sync_stats,
            'google_sheets_available': google_sheets_service.is_available(),
            'supabase_available': True,
        }


# Global instance
lead_sync_service = LeadSyncService()
