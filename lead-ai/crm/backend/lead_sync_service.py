"""
Google Sheets Lead Sync Service
Handles syncing leads from Google Sheets to CRM
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
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
        
        # Remove all non-digit characters except +
        phone = re.sub(r'[^\d+]', '', str(phone))
        
        # If it doesn't start with +, add +91 for India
        if phone and not phone.startswith('+'):
            phone = '+91' + phone
        
        return phone
    
    def normalize_email(self, email: str) -> str:
        """Normalize email address"""
        if not email:
            return ''
        
        return str(email).strip().lower()
    
    def parse_meta_timestamp(self, timestamp: str) -> Optional[str]:
        """
        Parse Meta/Facebook timestamp and convert to ISO format
        Supports formats like: "2024-05-02 14:30:45", "2024-05-02T14:30:45Z", etc.
        """
        if not timestamp:
            return None
        
        try:
            # Try parsing different formats
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%dT%H:%M:%SZ',
                '%Y-%m-%d',
            ]
            
            for fmt in formats:
                try:
                    dt = datetime.strptime(timestamp.strip(), fmt)
                    return dt.isoformat() + 'Z'
                except ValueError:
                    continue
            
            # If all parsing fails, use current time
            logger.warning(f"⚠️ Could not parse timestamp: {timestamp}, using current time")
            return datetime.utcnow().isoformat() + 'Z'
            
        except Exception as e:
            logger.warning(f"⚠️ Error parsing timestamp {timestamp}: {e}")
            return datetime.utcnow().isoformat() + 'Z'
    
    def map_sheet_lead_to_crm(self, sheet_lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map Google Sheet lead data to CRM lead format
        
        Args:
            sheet_lead: Lead data from Google Sheet
        
        Returns:
            CRM-formatted lead data
        """
        # Generate unique lead_id from meta lead id
        meta_lead_id = sheet_lead.get('meta_lead_id', '')
        lead_id = f"META{meta_lead_id[:8]}" if meta_lead_id else None
        
        # Get sheet name (course category)
        sheet_name = sheet_lead.get('_sheet_name', '')
        course_from_field = (sheet_lead.get('course_interested') or '').strip()
        course_category = course_from_field or (sheet_name if sheet_name else 'Not Specified')
        
        # Map to CRM fields
        crm_lead = {
            'lead_id': lead_id,
            'full_name': sheet_lead.get('full_name', '').strip(),
            'email': self.normalize_email(sheet_lead.get('email', '')),
            'phone': self.normalize_phone(sheet_lead.get('phone', '') or sheet_lead.get('phone_number', '')),
            'country': sheet_lead.get('country', '').strip() or 'India',
            'source': f"Meta - {sheet_lead.get('platform', 'Facebook')}",
            'course_interested': course_category,  # Use sheet name as course category
            'status': 'New',
            'ai_segment': 'Cold',
            'ai_score': 0.0,
            'conversion_probability': 0.0,
            'expected_revenue': 0.0,
            'actual_revenue': 0.0,
            'priority_level': 'Medium',
            'next_action': 'Call - Initial Contact',
            'assigned_to': 'Auto-assigned',
            'created_at': self.parse_meta_timestamp(sheet_lead.get('created_time', '')),
            'updated_at': datetime.utcnow().isoformat() + 'Z',
            
            # Store Meta-specific data in notes or custom fields
            'meta_data': {
                'meta_lead_id': meta_lead_id,
                'ad_id': sheet_lead.get('ad_id', ''),
                'ad_name': sheet_lead.get('ad_name', ''),
                'adset_id': sheet_lead.get('adset_id', ''),
                'adset_name': sheet_lead.get('adset_name', ''),
                'campaign_id': sheet_lead.get('campaign_id', ''),
                'campaign_name': sheet_lead.get('campaign_name', ''),
                'form_id': sheet_lead.get('form_id', ''),
                'form_name': sheet_lead.get('form_name', ''),
                'platform': sheet_lead.get('platform', ''),
                'is_organic': sheet_lead.get('is_organic', ''),
                'qualification': sheet_lead.get('qualification', ''),
                'sheet_lead_status': sheet_lead.get('sheet_lead_status', ''),
                'course_category': course_category,
            }
        }
        
        return crm_lead
    
    def should_sync_lead(self, sheet_lead: Dict[str, Any]) -> tuple[bool, str]:
        """
        Check if a lead should be synced
        
        Returns:
            (should_sync, reason)
        """
        # Check required fields
        if not sheet_lead.get('full_name', '').strip():
            return False, 'Missing full name'
        
        email = sheet_lead.get('email', '').strip()
        phone = (sheet_lead.get('phone') or sheet_lead.get('phone_number') or '').strip()
        
        if not email and not phone:
            return False, 'Missing both email and phone'
        
        # Check if already synced
        if sheet_lead.get('Sync_Status', '').strip().lower() == 'synced':
            return False, 'Already synced'
        
        return True, 'OK'
    
    def check_duplicate(self, crm_lead: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Check if lead already exists in CRM
        
        Returns:
            Existing lead if found, None otherwise
        """
        try:
            # Check by email
            email = crm_lead.get('email', '').strip()
            if email:
                existing = supabase_data.get_leads(search=email, limit=1)
                if existing and len(existing) > 0:
                    return existing[0]
            
            # Check by phone
            phone = crm_lead.get('phone', '').strip()
            if phone:
                existing = supabase_data.get_leads(search=phone, limit=1)
                if existing and len(existing) > 0:
                    return existing[0]
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Error checking for duplicate: {e}")
            return None
    
    def sync_single_lead(self, sheet_lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sync a single lead from Google Sheet to CRM
        
        Returns:
            Result dict with status and message
        """
        row_number = sheet_lead.get('_row_number')
        sheet_name = sheet_lead.get('_sheet_name', 'Unknown')
        
        # Check if should sync
        should_sync, reason = self.should_sync_lead(sheet_lead)
        if not should_sync:
            return {
                'status': 'skipped',
                'reason': reason,
                'row': row_number,
                'sheet': sheet_name
            }
        
        try:
            # Map to CRM format
            crm_lead = self.map_sheet_lead_to_crm(sheet_lead)
            
            # Check for duplicates
            existing = self.check_duplicate(crm_lead)
            if existing:
                logger.info(f"📝 Lead already exists: {crm_lead.get('full_name')} ({crm_lead.get('email', crm_lead.get('phone'))}) from {sheet_name}")
                
                # Mark as synced in sheet
                if row_number:
                    google_sheets_service.mark_as_synced(row_number, sheet_name)
                
                return {
                    'status': 'duplicate',
                    'reason': 'Lead already exists in CRM',
                    'lead_id': existing.get('lead_id'),
                    'row': row_number,
                    'sheet': sheet_name
                }
            
            # Create lead in CRM
            created_lead = supabase_data.create_lead(crm_lead)
            
            if created_lead:
                logger.info(f"✅ Synced lead: {crm_lead.get('full_name')} from {sheet_name} ({crm_lead.get('email', crm_lead.get('phone'))})")
                
                # Create initial note with Meta data
                meta_data = crm_lead.get('meta_data', {})
                note_content = f"""Lead imported from Meta/Facebook Lead Ads
Course Category: {sheet_name}

Campaign: {meta_data.get('campaign_name', 'N/A')}
Ad Set: {meta_data.get('adset_name', 'N/A')}
Ad: {meta_data.get('ad_name', 'N/A')}
Platform: {meta_data.get('platform', 'N/A')}
Form: {meta_data.get('form_name', 'N/A')}
Qualification: {meta_data.get('qualification', 'N/A')}

Meta Lead ID: {meta_data.get('meta_lead_id', 'N/A')}
"""
                
                try:
                    supabase_data.create_note({
                        'lead_id': created_lead['lead_id'],
                        'content': note_content,
                        'note_type': 'System',
                        'created_by': 'System - Google Sheets Sync',
                        'created_at': datetime.utcnow().isoformat() + 'Z'
                    })
                except Exception as e:
                    logger.warning(f"⚠️ Could not create note for lead: {e}")
                
                # Mark as synced in sheet
                if row_number:
                    google_sheets_service.mark_as_synced(row_number, sheet_name)
                
                return {
                    'status': 'success',
                    'lead_id': created_lead.get('lead_id'),
                    'row': row_number,
                    'sheet': sheet_name
                }
            else:
                logger.error(f"❌ Failed to create lead: {crm_lead.get('full_name')} from {sheet_name}")
                return {
                    'status': 'error',
                    'reason': 'Failed to create lead in CRM',
                    'row': row_number,
                    'sheet': sheet_name
                }
            
        except Exception as e:
            logger.error(f"❌ Error syncing lead from {sheet_name}: {e}")
            return {
                'status': 'error',
                'reason': str(e),
                'row': row_number,
                'sheet': sheet_name
            }
    
    def sync_all_unsynced_leads(self) -> Dict[str, Any]:
        """
        Sync all unsynced leads from Google Sheet
        
        Returns:
            Summary of sync operation
        """
        if self.sync_stats['is_syncing']:
            return {
                'status': 'error',
                'message': 'Sync already in progress'
            }
        
        self.sync_stats['is_syncing'] = True
        
        try:
            logger.info("🔄 Starting Google Sheets sync...")
            
            # Check if service is available
            if not google_sheets_service.is_available():
                return {
                    'status': 'error',
                    'message': 'Google Sheets service not available'
                }
            
            # Get unsynced leads
            unsynced_leads = google_sheets_service.get_unsynced_leads()
            
            if not unsynced_leads:
                logger.info("✅ No unsynced leads found")
                return {
                    'status': 'success',
                    'message': 'No new leads to sync',
                    'synced': 0,
                    'failed': 0,
                    'skipped': 0,
                    'duplicates': 0
                }
            
            logger.info(f"📊 Found {len(unsynced_leads)} unsynced leads")
            
            # Sync each lead
            results = {
                'synced': 0,
                'failed': 0,
                'skipped': 0,
                'duplicates': 0,
                'details': []
            }
            
            for sheet_lead in unsynced_leads:
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
            
            # Update stats
            self.sync_stats['last_sync'] = datetime.utcnow().isoformat()
            self.sync_stats['total_synced'] += results['synced']
            self.sync_stats['total_failed'] += results['failed']
            self.sync_stats['total_skipped'] += results['skipped']
            
            logger.info(f"✅ Sync complete: {results['synced']} synced, {results['duplicates']} duplicates, {results['skipped']} skipped, {results['failed']} failed")
            
            return {
                'status': 'success',
                'message': f"Synced {results['synced']} new leads",
                **results
            }
            
        except Exception as e:
            logger.error(f"❌ Sync failed: {e}")
            return {
                'status': 'error',
                'message': str(e)
            }
        finally:
            self.sync_stats['is_syncing'] = False
    
    def get_sync_stats(self) -> Dict[str, Any]:
        """Get current sync statistics"""
        return {
            **self.sync_stats,
            'google_sheets_available': google_sheets_service.is_available(),
            'supabase_available': True  # Always true if code is running
        }


# Global instance
lead_sync_service = LeadSyncService()
