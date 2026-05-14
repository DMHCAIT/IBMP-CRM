"""
Supabase Data Layer - Using Supabase REST API
All database operations go through Supabase cloud
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
import os
import re
import json
import requests as _requests
from supabase_client import supabase_manager
from logger_config import logger

# ── Source normalisation ───────────────────────────────────────────────────────
_SOURCE_ALIAS_MAP = {
    'website': 'Website', 'web': 'Website', 'site': 'Website', 'online': 'Website',
    'google': 'Website', 'google ads': 'Website', 'google ad': 'Website',
    'seo': 'Website', 'organic': 'Website', 'search': 'Website',
    'instagram': 'Instagram', 'ig': 'Instagram', 'insta': 'Instagram',
    'facebook': 'Facebook', 'fb': 'Facebook', 'fb ads': 'Facebook',
    'facebook ads': 'Facebook', 'meta': 'Facebook', 'meta ads': 'Facebook',
    'referral': 'Referral', 'refer': 'Referral', 'reference': 'Referral',
    'ref': 'Referral', 'word of mouth': 'Referral', 'wom': 'Referral',
    'agent': 'Referral', 'friend': 'Referral', 'recommendation': 'Referral',
    'whatsapp': 'WhatsApp', 'whats app': 'WhatsApp', 'wa': 'WhatsApp',
    'wp': 'WhatsApp', 'wapp': 'WhatsApp',
    'import': 'Website', 'direct': 'Website', 'linkedin': 'Website',
    'youtube': 'Website', 'twitter': 'Website', 'x': 'Website',
    'email': 'Website', 'sms': 'WhatsApp', 'call': 'WhatsApp',
}
_CANONICAL_SOURCES = {'Website', 'Instagram', 'Facebook', 'Referral', 'WhatsApp'}

_STATUS_ALIAS_MAP = {
    'fresh': 'FRESH',
    'new': 'FRESH',
    'follow up': 'FOLLOW_UP',
    'follow-up': 'FOLLOW_UP',
    'follow_up': 'FOLLOW_UP',
    'warm': 'WARM',
    'hot': 'HOT',
    'not interested': 'NOT_INTERESTED',
    'not_interested': 'NOT_INTERESTED',
    'junk': 'JUNK',
    'not answering': 'NOT_ANSWERING',
    'not_answering': 'NOT_ANSWERING',
    'enrolled': 'ENROLLED',
    'success': 'ENROLLED',
    'won': 'ENROLLED',
    'converted': 'ENROLLED',
}
_CANONICAL_STATUSES = {
    'FRESH', 'FOLLOW_UP', 'WARM', 'HOT', 'NOT_INTERESTED', 'JUNK', 'NOT_ANSWERING', 'ENROLLED'
}


def _normalise_source_str(raw: str) -> str:
    """Return canonical source for a raw string"""
    if not raw:
        return raw
    if raw in _CANONICAL_SOURCES:
        return raw
    lower = raw.lower().strip()
    if lower in _SOURCE_ALIAS_MAP:
        return _SOURCE_ALIAS_MAP[lower]
    for alias, canonical in _SOURCE_ALIAS_MAP.items():
        if lower == alias or lower.startswith(alias) or alias.startswith(lower):
            return canonical
    return 'Website'


def _normalise_lead_source(lead: dict) -> dict:
    """Return a copy of the lead dict with the source field normalised"""
    src = lead.get('source')
    if src:
        normalised = _normalise_source_str(src)
        if normalised != src:
            lead = {**lead, 'source': normalised}
    return lead


def _normalise_status_str(raw: str) -> str:
    """Return canonical LeadStatus enum literal for a raw status string."""
    if not raw:
        return 'FRESH'
    upper = raw.strip().upper()
    if upper in _CANONICAL_STATUSES:
        return upper
    lower = raw.strip().lower()
    return _STATUS_ALIAS_MAP.get(lower, 'FRESH')


def _normalise_lead_status(lead: dict) -> dict:
    """Return a copy of lead dict with status normalised to LeadStatus enum."""
    status = lead.get('status')
    if status is None or status == '':
        return {**lead, 'status': 'FRESH'}
    if isinstance(status, str):
        normalised = _normalise_status_str(status)
        if normalised != status:
            return {**lead, 'status': normalised}
    return lead


class SupabaseDataLayer:
    """Data access layer using Supabase REST API"""
    
    def __init__(self):
        self.client = supabase_manager.get_client()

    def _strip_tenant_id(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Always remove tenant_id — the current schema does not use it."""
        data.pop('tenant_id', None)
        return data
    
    def get_leads(
        self,
        skip: int = 0,
        limit: int = 1000,
        status: Optional[str] = None,
        status_in: Optional[str] = None,
        country: Optional[str] = None,
        country_in: Optional[str] = None,
        segment: Optional[str] = None,
        segment_in: Optional[str] = None,
        assigned_to: Optional[str] = None,
        assigned_to_in: Optional[str] = None,
        course_interested: Optional[str] = None,
        source: Optional[str] = None,
        company: Optional[str] = None,
        company_in: Optional[str] = None,
        qualification: Optional[str] = None,
        qualification_in: Optional[str] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None,
        follow_up_from: Optional[str] = None,
        follow_up_to: Optional[str] = None,
        created_today: bool = False,
        overdue: bool = False,
        search: Optional[str] = None,
        created_on: Optional[str] = None,
        created_after: Optional[str] = None,
        created_before: Optional[str] = None,
        created_from: Optional[str] = None,
        created_to: Optional[str] = None,
        updated_on: Optional[str] = None,
        updated_after: Optional[str] = None,
        updated_before: Optional[str] = None,
        updated_from: Optional[str] = None,
        updated_to: Optional[str] = None,
        # Meta Ads filter parameters
        campaign_id: Optional[str] = None,
        ad_id: Optional[str] = None,
        adset_id: Optional[str] = None,
        form_id: Optional[str] = None,
        campaign_name: Optional[str] = None,
        is_organic: Optional[bool] = None,
        external_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get leads with filters using Supabase"""
        try:
            # Build base query
            query = self.client.table('leads').select('*', count='exact')
            
            # Apply filters
            _status = status_in if (status_in and not status) else status
            if _status:
                if ',' in _status:
                    raw_statuses = [s.strip() for s in _status.split(',') if s.strip()]
                    statuses = []
                    seen = set()
                    for s in raw_statuses:
                        normalised = _normalise_status_str(s)
                        if normalised not in seen:
                            statuses.append(normalised)
                            seen.add(normalised)
                    # Use eq for enum column (ilike not supported on enum type)
                    or_filter = ','.join([f"status.eq.{s}" for s in statuses])
                    query = query.or_(or_filter)
                else:
                    query = query.eq('status', _normalise_status_str(_status.strip()))
            
            _country = country_in if (country_in and not country) else country
            if _country:
                if ',' in _country:
                    countries = [c.strip() for c in _country.split(',') if c.strip()]
                    or_filter = ','.join([f"country.ilike.%{c}%" for c in countries])
                    query = query.or_(or_filter)
                else:
                    query = query.ilike('country', f'%{_country.strip()}%')
            
            _segment = segment_in if (segment_in and not segment) else segment
            if _segment:
                if ',' in _segment:
                    segments = [s.strip() for s in _segment.split(',') if s.strip()]
                    or_filter = ','.join([f"ai_segment.ilike.%{s}%" for s in segments])
                    query = query.or_(or_filter)
                else:
                    query = query.ilike('ai_segment', f'%{_segment.strip()}%')
            
            _assigned = assigned_to_in if (assigned_to_in and not assigned_to) else assigned_to
            if _assigned:
                if ',' in _assigned:
                    assignees = [a.strip() for a in _assigned.split(',') if a.strip()]
                    or_filter = ','.join([f"assigned_to.ilike.%{a}%" for a in assignees])
                    query = query.or_(or_filter)
                else:
                    query = query.ilike('assigned_to', f'%{_assigned.strip()}%')
            
            if course_interested:
                if ',' in course_interested:
                    courses = [c.strip() for c in course_interested.split(',') if c.strip()]
                    or_filter = ','.join([f"course_interested.ilike.%{c}%" for c in courses])
                    query = query.or_(or_filter)
                else:
                    query = query.ilike('course_interested', f'%{course_interested.strip()}%')
            
            if source:
                if ',' in source:
                    sources = [s.strip() for s in source.split(',') if s.strip()]
                    or_filter = ','.join([f"source.ilike.%{s}%" for s in sources])
                    query = query.or_(or_filter)
                else:
                    query = query.ilike('source', f'%{source.strip()}%')

            _company = company_in if (company_in and not company) else company
            if _company:
                if ',' in _company:
                    companies = [c.strip() for c in _company.split(',') if c.strip()]
                    or_filter = ','.join([f"company.ilike.%{c}%" for c in companies])
                    query = query.or_(or_filter)
                else:
                    query = query.ilike('company', f'%{_company.strip()}%')

            _qualification = qualification_in if (qualification_in and not qualification) else qualification
            if _qualification:
                if ',' in _qualification:
                    qualifications = [q.strip() for q in _qualification.split(',') if q.strip()]
                    or_filter = ','.join([f"qualification.ilike.%{q}%" for q in qualifications])
                    query = query.or_(or_filter)
                else:
                    query = query.ilike('qualification', f'%{_qualification.strip()}%')

            # Meta Ads filters
            if campaign_id:
                query = query.eq('campaign_id', campaign_id.strip())
            if ad_id:
                query = query.eq('ad_id', ad_id.strip())
            if adset_id:
                query = query.eq('adset_id', adset_id.strip())
            if form_id:
                query = query.eq('form_id', form_id.strip())
            if campaign_name:
                query = query.ilike('campaign_name', f'%{campaign_name.strip()}%')
            if is_organic is not None:
                query = query.eq('is_organic', is_organic)
            if external_id:
                query = query.eq('external_id', external_id.strip())

            if min_score is not None:
                query = query.gte('ai_score', min_score)
            if max_score is not None:
                query = query.lte('ai_score', max_score)
            
            if follow_up_from:
                query = query.gte('follow_up_date', follow_up_from)
            if follow_up_to:
                query = query.lte('follow_up_date', follow_up_to)
            
            if created_today:
                today = datetime.utcnow().date().isoformat()
                query = query.gte('created_at', today).lt('created_at', today + 'T23:59:59Z')
            
            if overdue:
                now = datetime.utcnow().isoformat()
                query = query.lt('follow_up_date', now)
            
            if search:
                safe_search = re.sub(r"[%_\(\),\"]", "", str(search)).strip()[:100]
                if safe_search:
                    or_filter = f"full_name.ilike.%{safe_search}%,email.ilike.%{safe_search}%,phone.ilike.%{safe_search}%,lead_id.ilike.%{safe_search}%"
                    query = query.or_(or_filter)
            
            if created_after:
                query = query.gt('created_at', created_after)
            if created_before:
                query = query.lt('created_at', created_before)
            if created_from and created_to:
                query = query.gte('created_at', created_from).lte('created_at', created_to)
            
            if updated_after:
                query = query.gt('updated_at', updated_after)
            if updated_before:
                query = query.lt('updated_at', updated_before)
            if updated_from and updated_to:
                query = query.gte('updated_at', updated_from).lte('updated_at', updated_to)
            
            # Apply ordering and pagination
            # Increased limit cap from 1000 to 100000 to support large datasets
            effective_limit = min(limit, 100000)
            query = query.order('updated_at', desc=True).order('created_at', desc=True)
            query = query.range(skip, skip + effective_limit - 1)
            
            # Execute query
            response = query.execute()
            leads = [_normalise_lead_source(lead) for lead in (response.data or [])]
            total = response.count if response.count is not None else len(leads)
            
            return {
                "leads": leads,
                "total": total,
                "skip": skip,
                "limit": effective_limit,
                "has_more": (skip + effective_limit) < total,
            }
        except Exception as e:
            logger.error(f"Error fetching leads from Supabase: {e}", exc_info=True)
            return {"leads": [], "total": 0, "skip": skip, "limit": limit, "has_more": False}
    
    def get_lead_by_id(self, lead_id: str) -> Optional[Dict[str, Any]]:
        """Get single lead by ID using Supabase"""
        try:
            response = self.client.table('leads').select('*').eq('lead_id', lead_id).limit(1).execute()
            if response.data:
                return _normalise_lead_source(response.data[0])
            return None
        except Exception as e:
            logger.error(f"Error fetching lead {lead_id}: {e}", exc_info=True)
            return None
    
    def get_lead_count(
        self,
        status: Optional[str] = None,
        segment: Optional[str] = None
    ) -> int:
        """Get total lead count using Supabase"""
        try:
            query = self.client.table('leads').select('*', count='exact')
            
            if status:
                if ',' in status:
                    raw_statuses = [s.strip() for s in status.split(',') if s.strip()]
                    statuses = []
                    seen = set()
                    for s in raw_statuses:
                        normalised = _normalise_status_str(s)
                        if normalised not in seen:
                            statuses.append(normalised)
                            seen.add(normalised)
                    if statuses:
                        or_filter = ','.join([f"status.eq.{s}" for s in statuses])
                        query = query.or_(or_filter)
                else:
                    query = query.eq('status', _normalise_status_str(status.strip()))
            if segment:
                query = query.ilike('ai_segment', f'%{segment.strip()}%')
            
            response = query.limit(0).execute()
            return response.count if response.count is not None else 0
        except Exception as e:
            logger.error(f"Error getting lead count: {e}", exc_info=True)
            return 0
    
    def update_lead(self, lead_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update lead"""
        data = _normalise_lead_status(data)
        data['updated_at'] = datetime.utcnow().isoformat() + 'Z'
        for key, value in list(data.items()):
            if isinstance(value, datetime):
                iso = value.isoformat()
                data[key] = iso if iso.endswith('Z') or '+' in iso else iso + 'Z'
        cleaned_data = {k: v for k, v in data.items() if v is not None}
        cleaned_data = self._strip_tenant_id(cleaned_data)
        
        NEW_COLUMNS = {
            'company', 'qualification', 'utm_source', 'utm_medium', 'utm_campaign',
            'campaign_name', 'campaign_medium', 'campaign_group',
            'lead_quality', 'lead_rating', 'city',
            'ad_name', 'adset_name', 'form_name', 'notes',
            'campaign_id', 'ad_id', 'adset_id', 'form_id', 'is_organic', 'external_id',
        }
        try:
            response = self.client.table('leads').update(cleaned_data).eq('lead_id', lead_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            err_str = str(e)
            missing = [c for c in NEW_COLUMNS if c in err_str]
            if missing:
                for col in missing:
                    cleaned_data.pop(col, None)
                    logger.warning(f"Column '{col}' missing in Supabase")
                try:
                    response = self.client.table('leads').update(cleaned_data).eq('lead_id', lead_id).execute()
                    return response.data[0] if response.data else None
                except Exception as e2:
                    logger.error(f"Error updating lead {lead_id} (fallback): {e2}", exc_info=True)
                    return None
            logger.error(f"Error updating lead {lead_id}: {e}", exc_info=True)
            return None
    
    # All optional columns that may not yet exist in the Supabase schema.
    # If an INSERT fails because one of these is missing, we retry without it.
    _OPTIONAL_COLUMNS = {
        'company', 'qualification', 'utm_source', 'utm_medium', 'utm_campaign',
        'campaign_name', 'campaign_medium', 'campaign_group',
        'lead_quality', 'lead_rating', 'city',
        'ad_name', 'adset_name', 'form_name',
        'notes',
        'campaign_id', 'ad_id', 'adset_id', 'form_id', 'is_organic', 'external_id',
    }

    def _supabase_insert(self, table: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Direct HTTP POST to Supabase REST API, bypassing postgrest-py's broken
        KeyError('code') exception handling.  Returns the first inserted row.
        Raises RuntimeError with the real Supabase error message on failure."""
        url  = supabase_manager.url
        key  = supabase_manager.key
        if not url or not key:
            raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars not set")
        endpoint = f"{url.rstrip('/')}/rest/v1/{table}"
        headers = {
            "apikey":        key,
            "Authorization": f"Bearer {key}",
            "Content-Type":  "application/json",
            "Prefer":        "return=representation",
        }
        resp = _requests.post(endpoint, headers=headers, data=json.dumps(payload), timeout=30)
        if resp.status_code in (200, 201):
            rows = resp.json()
            return rows[0] if rows else {}
        # Surface the actual Supabase/PostgREST error message
        try:
            err = resp.json()
            msg = err.get('message') or err.get('error') or err.get('details') or str(err)
            code = err.get('code', resp.status_code)
            hint = err.get('hint', '')
            full = f"[{code}] {msg}"
            if hint:
                full += f" | hint: {hint}"
        except Exception:
            full = resp.text or f"HTTP {resp.status_code}"
        raise RuntimeError(full)

    def create_lead(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create new lead via direct HTTP to bypass postgrest-py KeyError bug.
        Retries without optional columns on schema errors.
        Raises RuntimeError on failure so callers see the real DB error."""
        data = _normalise_lead_source(data)
        data = _normalise_lead_status(data)
        now = datetime.utcnow().isoformat() + 'Z'
        data['created_at'] = now
        data['updated_at'] = now
        for key, value in list(data.items()):
            if isinstance(value, datetime):
                iso = value.isoformat()
                data[key] = iso if iso.endswith('Z') or '+' in iso else iso + 'Z'
        cleaned_data = {k: v for k, v in data.items() if v is not None}
        cleaned_data = self._strip_tenant_id(cleaned_data)

        # --- Attempt 1: full payload ---
        first_error = None
        try:
            return self._supabase_insert('leads', cleaned_data)
        except RuntimeError as e:
            first_error = str(e)
            logger.warning(f"Lead insert attempt 1 failed ({e}) — retrying without optional columns")

        # --- Attempt 2: strip optional columns ---
        minimal_data = {k: v for k, v in cleaned_data.items() if k not in self._OPTIONAL_COLUMNS}
        try:
            return self._supabase_insert('leads', minimal_data)
        except RuntimeError as e2:
            logger.error(f"Lead insert attempt 2 also failed: {e2}")
            raise RuntimeError(f"DB insert failed (attempt1: {first_error}) (attempt2: {e2})") from None
    
    def delete_lead(self, lead_id: str) -> bool:
        """Delete lead and all its child records"""
        try:
            lead = self.get_lead_by_id(lead_id)
            if lead and lead.get("id") is not None:
                internal_id = lead.get("id")
                try:
                    self.client.table('chat_messages').delete().eq('lead_db_id', internal_id).execute()
                except Exception as e:
                    logger.warning(f"chat_messages cleanup failed for lead {lead_id}: {e}")
                try:
                    self.client.table('activities').delete().eq('lead_id', internal_id).execute()
                except Exception as e:
                    logger.warning(f"activities cleanup failed for lead {lead_id}: {e}")
                try:
                    self.client.table('notes').delete().eq('lead_id', internal_id).execute()
                except Exception as e:
                    logger.warning(f"notes cleanup failed for lead {lead_id}: {e}")
            self.client.table('leads').delete().eq('lead_id', lead_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting lead {lead_id}: {e}")
            return False
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email using Supabase"""
        try:
            response = self.client.table('users').select('*').ilike('email', email.strip()).limit(1).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error fetching user by email {email}: {e}")
            return None
    
    def get_all_users(self) -> List[Dict[str, Any]]:
        """Get all users"""
        try:
            response = self.client.table('users').select("id,full_name,email,phone,role,reports_to,is_active,created_at,updated_at").order('id', desc=False).execute()
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching users: {e}")
            return []
    
    def get_courses(self, is_active: bool = True) -> List[Dict[str, Any]]:
        """Get courses using Supabase"""
        try:
            query = self.client.table('courses').select("*")
            if is_active is not None:
                query = query.eq('is_active', is_active)
            response = query.order('course_name', desc=False).execute()
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching courses: {e}")
            return []
    
    def get_hospitals(self, country: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get hospitals"""
        try:
            query = self.client.table('hospitals').select("*")
            if country:
                query = query.ilike('country', country.strip())
            response = query.order('hospital_name', desc=False).execute()
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching hospitals: {e}")
            return []
    
    def create_note(self, lead_id: int, content: str, channel: str, created_by: str) -> Optional[Dict[str, Any]]:
        """Create a note for a lead"""
        try:
            note_data = {
                'lead_id': lead_id,
                'content': content,
                'channel': channel,
                'created_by': created_by,
                'created_at': datetime.utcnow().isoformat() + 'Z',
            }
            response = self.client.table('notes').insert(note_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating note: {e}")
            return None
    
    def get_notes_for_lead(self, lead_id: int) -> List[Dict[str, Any]]:
        """Get all notes for a lead (by internal ID)"""
        try:
            response = (
                self.client.table('notes')
                .select("*")
                .eq('lead_id', lead_id)
                .order('created_at', desc=True)
                .execute()
            )
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching notes for lead {lead_id}: {e}")
            return []
    
    def get_activities_for_lead(self, lead_id: int, activity_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get activities for a lead"""
        try:
            query = self.client.table('activities').select("*").eq('lead_id', lead_id)
            if activity_type:
                query = query.ilike('activity_type', activity_type.strip())
            response = query.order('created_at', desc=True).execute()
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching activities for lead {lead_id}: {e}")
            return []
    
    def create_activity(self, lead_id: int, activity_type: str, description: str, created_by: str) -> Optional[Dict[str, Any]]:
        """Create an activity log"""
        try:
            activity_data = {
                'lead_id': lead_id,
                'activity_type': activity_type,
                'description': description,
                'created_by': created_by,
                'created_at': datetime.utcnow().isoformat() + 'Z',
            }
            response = self.client.table('activities').insert(activity_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating activity: {e}")
            return None
    
    def get_dashboard_stats(self, assigned_to: Optional[str] = None) -> Dict[str, Any]:
        """Get dashboard statistics
        
        NOTE: Supabase PostgREST has default 1000 row limit.
        Use .range() instead of .limit() to bypass this limit and get ALL leads.
        """
        try:
            query = self.client.table('leads').select('status,ai_segment,actual_revenue,assigned_to')
            if assigned_to:
                query = query.ilike('assigned_to', assigned_to)
            # Use .range() to bypass 1000 row limit and get ALL leads (up to 100k)
            query = query.range(0, 99999)
            all_leads_resp = query.execute()
            leads = all_leads_resp.data if all_leads_resp.data else []
            
            total = len(leads)
            hot = sum(1 for l in leads if str(l.get('ai_segment', '')).lower() == 'hot')
            warm = sum(1 for l in leads if str(l.get('ai_segment', '')).lower() == 'warm')
            cold = sum(1 for l in leads if str(l.get('ai_segment', '')).lower() == 'cold')
            junk = sum(1 for l in leads if str(l.get('ai_segment', '')).lower() == 'junk')
            conversions = sum(1 for l in leads if str(l.get('status', '')).lower() == 'enrolled')
            revenue = sum(l.get('actual_revenue', 0) or 0 for l in leads)
            
            return {
                'total': total,
                'hot': hot,
                'warm': warm,
                'cold': cold,
                'junk': junk,
                'conversions': conversions,
                'revenue': round(revenue, 2),
                'conversion_rate': round((conversions / total * 100) if total > 0 else 0, 1)
            }
        except Exception as e:
            logger.error(f"Error getting dashboard stats: {e}")
            return {
                'total': 0, 'hot': 0, 'warm': 0, 'cold': 0, 'junk': 0,
                'conversions': 0, 'revenue': 0, 'conversion_rate': 0
            }
    
    def create_hospital(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new hospital"""
        try:
            response = self.client.table('hospitals').insert(data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating hospital: {e}")
            raise
    
    def update_hospital(self, hospital_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update hospital by ID"""
        try:
            response = self.client.table('hospitals').update(data).eq('id', hospital_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating hospital: {e}")
            return None
    
    def delete_hospital(self, hospital_id: int) -> bool:
        """Delete hospital by ID"""
        try:
            self.client.table('hospitals').delete().eq('id', hospital_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting hospital: {e}")
            return False
    
    def create_course(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new course"""
        try:
            response = self.client.table('courses').insert(data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating course: {e}")
            raise
    
    def update_course(self, course_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update course by ID"""
        try:
            response = self.client.table('courses').update(data).eq('id', course_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating course: {e}")
            return None
    
    def delete_course(self, course_id: int) -> bool:
        """Delete course by ID"""
        try:
            self.client.table('courses').delete().eq('id', course_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting course: {e}")
            return False
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user by numeric ID"""
        try:
            response = self.client.table('users').select('id,full_name,email,phone,role,reports_to,is_active,created_at,updated_at').eq('id', user_id).limit(1).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error getting user by ID: {e}")
            return None
    
    def create_user(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new user"""
        try:
            response = self.client.table('users').insert(data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise
    
    def update_user(self, user_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update user by ID"""
        try:
            response = self.client.table('users').update(data).eq('id', user_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating user: {e}")
            return None

    def delete_user(self, user_id: int) -> bool:
        """Delete user by ID"""
        try:
            self.client.table('users').delete().eq('id', user_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting user {user_id}: {e}")
            return False


# Global instance
supabase_data = SupabaseDataLayer()
data_layer = supabase_data  # Alias for compatibility
