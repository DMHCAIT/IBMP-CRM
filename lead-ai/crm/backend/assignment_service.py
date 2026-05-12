"""
Automated Lead Assignment Service
Intelligent lead distribution with round-robin, skill-based routing, and workload balancing
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
import json


class LeadAssignmentEngine:
    """Intelligent lead assignment with multiple strategies"""
    
    def __init__(self, db: Session):
        self.db = db
        
    def assign_lead(
        self,
        lead_id: int,
        strategy: str = "intelligent",
        preferences: Optional[Dict] = None
    ) -> Dict:
        """
        Assign lead to counselor using specified strategy
        
        Strategies:
        - intelligent: AI-based matching (score, specialty, workload)
        - round_robin: Rotate assignments evenly
        - skill_based: Match course expertise
        - workload: Assign to least busy counselor
        """
        
        from main import DBLead, DBUser
        
        lead = self.db.query(DBLead).filter(DBLead.id == lead_id).first()
        if not lead:
            return {"success": False, "error": "Lead not found"}
        
        if lead.assigned_to:
            return {
                "success": False,
                "error": f"Lead already assigned to {lead.assigned_to}"
            }
        
        # Get available counselors
        counselors = self.db.query(DBUser).filter(
            DBUser.role.in_(["Counselor", "Manager", "Team Leader"])
        ).all()
        
        if not counselors:
            return {"success": False, "error": "No counselors available"}
        
        # Select counselor based on strategy
        if strategy == "intelligent":
            counselor = self._intelligent_assignment(lead, counselors)
        elif strategy == "round_robin":
            counselor = self._round_robin_assignment(counselors)
        elif strategy == "skill_based":
            counselor = self._skill_based_assignment(lead, counselors)
        elif strategy == "workload":
            counselor = self._workload_based_assignment(counselors)
        else:
            counselor = self._intelligent_assignment(lead, counselors)
        
        # Assign lead
        lead.assigned_to = counselor.full_name  # Use full_name instead of username
        self.db.commit()
        
        return {
            "success": True,
            "assigned_to": counselor.full_name,
            "strategy": strategy,
            "lead_id": lead.lead_id,
            "reason": self._get_assignment_reason(strategy, lead, counselor)
        }
    
    def _intelligent_assignment(self, lead, counselors: List) -> object:
        """AI-powered assignment considering multiple factors"""
        
        scores = []
        
        for counselor in counselors:
            score = 0
            reasons = []
            
            # Factor 1: Workload (30% weight)
            workload = self._get_counselor_workload(counselor.full_name)
            workload_score = max(0, 100 - workload * 5)  # Lower workload = higher score
            score += workload_score * 0.3
            reasons.append(f"Workload: {workload} leads ({workload_score:.0f} pts)")
            
            # Factor 2: Course expertise (40% weight)
            expertise_score = self._get_expertise_match(lead, counselor)
            score += expertise_score * 0.4
            reasons.append(f"Expertise: {expertise_score:.0f} pts")
            
            # Factor 3: Performance (20% weight)
            performance_score = self._get_counselor_performance(counselor.full_name)
            score += performance_score * 0.2
            reasons.append(f"Performance: {performance_score:.0f} pts")
            
            # Factor 4: Availability (10% weight)
            availability_score = self._get_availability_score(counselor.full_name)
            score += availability_score * 0.1
            reasons.append(f"Availability: {availability_score:.0f} pts")
            
            scores.append({
                "counselor": counselor,
                "score": score,
                "reasons": reasons
            })
        
        # Select counselor with highest score
        best_match = max(scores, key=lambda x: x["score"])
        return best_match["counselor"]
    
    def _round_robin_assignment(self, counselors: List) -> object:
        """Round-robin: Rotate assignments evenly"""
        
        from main import DBLead
        
        # Get assignment counts
        assignment_counts = []
        for counselor in counselors:
            count = self.db.query(DBLead).filter(
                DBLead.assigned_to == counselor.full_name
            ).count()
            assignment_counts.append((counselor, count))
        
        # Return counselor with fewest assignments
        return min(assignment_counts, key=lambda x: x[1])[0]
    
    def _skill_based_assignment(self, lead, counselors: List) -> object:
        """Assign based on course expertise"""
        
        expertise_scores = []
        
        for counselor in counselors:
            score = self._get_expertise_match(lead, counselor)
            expertise_scores.append((counselor, score))
        
        # If no clear expertise match, fall back to round-robin
        best_score = max(expertise_scores, key=lambda x: x[1])[1]
        if best_score < 50:
            return self._round_robin_assignment(counselors)
        
        return max(expertise_scores, key=lambda x: x[1])[0]
    
    def _workload_based_assignment(self, counselors: List) -> object:
        """Assign to counselor with lowest workload"""
        
        workloads = []
        
        for counselor in counselors:
            workload = self._get_counselor_workload(counselor.full_name)
            workloads.append((counselor, workload))
        
        return min(workloads, key=lambda x: x[1])[0]
    
    def _get_counselor_workload(self, counselor_name: str) -> int:
        """Get current lead count for counselor"""
        
        from main import DBLead
        
        active_leads = self.db.query(DBLead).filter(
            and_(
                DBLead.assigned_to == counselor_name,
                DBLead.status.in_(["FRESH", "FOLLOW_UP", "WARM", "HOT"])
            )
        ).count()
        
        return active_leads
    
    def _get_expertise_match(self, lead, counselor) -> float:
        """Calculate expertise match score (0-100)"""
        
        # Extract course keywords
        course = (lead.course_interested or "").lower()
        
        # Define expertise areas (could be loaded from counselor profile)
        expertise_map = {
            "mbbs": ["mbbs", "medicine", "medical", "doctor"],
            "engineering": ["engineering", "b.tech", "btech", "technology"],
            "nursing": ["nursing", "bsc nursing", "gnm"],
            "pharmacy": ["pharmacy", "b.pharma", "pharm.d"],
            "abroad": ["russia", "ukraine", "georgia", "abroad", "international"]
        }
        
        score = 50  # Base score
        
        # Check if counselor username suggests expertise
        counselor_name_lower = counselor.full_name.lower()
        
        for area, keywords in expertise_map.items():
            if any(kw in course for kw in keywords):
                if area in counselor_name_lower or any(kw in counselor_name_lower for kw in keywords):
                    score += 30
                    break
        
        # Bonus for manager role (can handle any lead)
        if counselor.role in ["Manager", "Team Leader"]:
            score += 10
        
        return min(100, score)
    
    def _get_counselor_performance(self, counselor_name: str) -> float:
        """Calculate counselor performance score based on conversion rate"""
        
        from main import DBLead
        
        # Get total assigned leads
        total_leads = self.db.query(DBLead).filter(
            DBLead.assigned_to == counselor_name
        ).count()
        
        if total_leads == 0:
            return 70  # Default score for new counselors
        
        # Get converted leads
        converted_leads = self.db.query(DBLead).filter(
            and_(
                DBLead.assigned_to == counselor_name,
                DBLead.status == "won"
            )
        ).count()
        
        # Calculate conversion rate
        conversion_rate = (converted_leads / total_leads) * 100
        
        # Score based on conversion rate (0-30% = 50, 30-50% = 75, 50%+ = 100)
        if conversion_rate >= 50:
            return 100
        elif conversion_rate >= 30:
            return 75
        else:
            return 50 + conversion_rate
    
    def _get_availability_score(self, counselor_name: str) -> float:
        """Check if counselor is available (not overloaded)"""
        
        workload = self._get_counselor_workload(counselor_name)
        
        # Score based on workload thresholds
        if workload < 10:
            return 100  # Fully available
        elif workload < 20:
            return 75   # Moderately busy
        elif workload < 30:
            return 50   # Busy
        else:
            return 25   # Overloaded
    
    def _get_assignment_reason(self, strategy: str, lead, counselor) -> str:
        """Generate human-readable assignment reason"""
        
        if strategy == "intelligent":
            return f"Best match based on expertise, workload, and performance"
        elif strategy == "round_robin":
            return f"Round-robin rotation for fair distribution"
        elif strategy == "skill_based":
            return f"Matched based on {lead.course_interested} expertise"
        elif strategy == "workload":
            return f"Assigned to least busy counselor"
        else:
            return "Automated assignment"
    
    def bulk_assign_unassigned(self, strategy: str = "intelligent") -> Dict:
        """Assign all unassigned leads"""
        
        from main import DBLead
        
        unassigned_leads = self.db.query(DBLead).filter(
            or_(DBLead.assigned_to == None, DBLead.assigned_to == "")
        ).all()
        
        results = {
            "total": len(unassigned_leads),
            "assigned": 0,
            "failed": 0,
            "assignments": []
        }
        
        for lead in unassigned_leads:
            result = self.assign_lead(lead.id, strategy)
            if result["success"]:
                results["assigned"] += 1
                results["assignments"].append({
                    "lead_id": lead.lead_id,
                    "assigned_to": result["assigned_to"]
                })
            else:
                results["failed"] += 1
        
        return results
    
    def reassign_lead(
        self,
        lead_id: int,
        new_counselor: str,
        reason: str = "Manual reassignment"
    ) -> Dict:
        """Reassign lead to different counselor"""
        
        from main import DBLead, DBNote
        
        lead = self.db.query(DBLead).filter(DBLead.id == lead_id).first()
        if not lead:
            return {"success": False, "error": "Lead not found"}
        
        old_counselor = lead.assigned_to
        lead.assigned_to = new_counselor
        
        # Add note about reassignment
        note = DBNote(
            lead_id=lead.id,
            content=f"[Reassignment] Lead reassigned from {old_counselor} to {new_counselor}. Reason: {reason}",
            channel="system",
            created_by="System"
        )
        self.db.add(note)
        self.db.commit()
        
        return {
            "success": True,
            "lead_id": lead.lead_id,
            "old_counselor": old_counselor,
            "new_counselor": new_counselor,
            "reason": reason
        }


class WorkflowAutomation:
    """Automated workflows based on triggers"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def check_and_trigger_workflows(self) -> List[Dict]:
        """Check all leads and trigger appropriate workflows"""
        
        from main import DBLead
        
        triggered = []
        
        # Get all active leads
        leads = self.db.query(DBLead).filter(
            DBLead.status.in_(["new", "contacted", "qualified", "proposal"])
        ).all()
        
        for lead in leads:
            # Workflow 1: No response after 3 days
            if self._should_trigger_followup(lead):
                result = await self._trigger_followup_workflow(lead)
                triggered.append(result)
            
            # Workflow 2: High churn risk
            if self._should_trigger_churn_prevention(lead):
                result = await self._trigger_churn_prevention_workflow(lead)
                triggered.append(result)
            
            # Workflow 3: Hot lead immediate action
            if self._should_trigger_hot_lead_alert(lead):
                result = await self._trigger_hot_lead_workflow(lead)
                triggered.append(result)
            
            # Workflow 4: Stale lead cleanup
            if self._should_trigger_stale_cleanup(lead):
                result = await self._trigger_stale_workflow(lead)
                triggered.append(result)
        
        return triggered
    
    def _should_trigger_followup(self, lead) -> bool:
        """Check if lead needs follow-up"""
        
        from main import DBNote
        
        # Check if no contact in last 3 days
        three_days_ago = datetime.now() - timedelta(days=3)
        
        recent_notes = self.db.query(DBNote).filter(
            and_(
                DBNote.lead_id == lead.id,
                DBNote.created_at >= three_days_ago
            )
        ).count()
        
        return recent_notes == 0 and lead.status in ["contacted", "qualified"]
    
    def _should_trigger_churn_prevention(self, lead) -> bool:
        """Check if lead has high churn risk"""
        return lead.churn_risk > 0.7
    
    def _should_trigger_hot_lead_alert(self, lead) -> bool:
        """Check if lead is hot and needs immediate attention"""
        return lead.ai_score >= 90 and lead.status == "new"
    
    def _should_trigger_stale_cleanup(self, lead) -> bool:
        """Check if lead is stale (no activity for 30+ days)"""
        
        thirty_days_ago = datetime.now() - timedelta(days=30)
        return lead.last_contact_date and lead.last_contact_date < thirty_days_ago
    
    async def _trigger_followup_workflow(self, lead) -> Dict:
        """Trigger automated follow-up"""
        
        from communication_service import comm_service
        
        lead_data = {
            "id": lead.lead_id,
            "name": lead.full_name or "there",
            "email": lead.email,
            "whatsapp": lead.whatsapp,
            "course": lead.course_interested or "our courses",
            "counselor": lead.assigned_to or "Your counselor"
        }
        
        results = await comm_service.campaign.trigger_follow_up(
            lead_data,
            "We haven't heard from you in a few days. Are you still interested in pursuing medical education?",
            priority="normal"
        )
        
        return {
            "workflow": "follow_up",
            "lead_id": lead.lead_id,
            "triggered": True,
            "results": results
        }
    
    async def _trigger_churn_prevention_workflow(self, lead) -> Dict:
        """Trigger churn prevention workflow"""
        
        from communication_service import comm_service
        
        lead_data = {
            "id": lead.lead_id,
            "name": lead.full_name or "there",
            "email": lead.email,
            "whatsapp": lead.whatsapp,
            "course": lead.course_interested or "our courses",
            "counselor": lead.assigned_to or "Your counselor"
        }
        
        results = await comm_service.campaign.trigger_follow_up(
            lead_data,
            "We noticed you've been inactive. Is there anything we can help you with? We're here to answer any questions!",
            priority="urgent"
        )
        
        return {
            "workflow": "churn_prevention",
            "lead_id": lead.lead_id,
            "churn_risk": lead.churn_risk,
            "triggered": True,
            "results": results
        }
    
    async def _trigger_hot_lead_workflow(self, lead) -> Dict:
        """Trigger hot lead immediate action workflow"""
        
        from communication_service import comm_service
        
        lead_data = {
            "id": lead.lead_id,
            "name": lead.full_name or "there",
            "email": lead.email,
            "whatsapp": lead.whatsapp,
            "course": lead.course_interested or "our courses",
            "counselor": lead.assigned_to or "Your counselor"
        }
        
        results = await comm_service.campaign.trigger_follow_up(
            lead_data,
            f"🔥 URGENT: Limited seats available for {lead.course_interested}! Your profile shows excellent potential. Let's discuss your options today!",
            priority="urgent"
        )
        
        return {
            "workflow": "hot_lead_alert",
            "lead_id": lead.lead_id,
            "ai_score": lead.ai_score,
            "triggered": True,
            "results": results
        }
    
    async def _trigger_stale_workflow(self, lead) -> Dict:
        """Mark stale leads as lost"""
        
        from main import DBNote
        
        # Update status to lost
        lead.status = "lost"
        
        # Add note
        note = DBNote(
            lead_id=lead.id,
            content="[Automated] Lead marked as lost due to 30+ days of inactivity",
            channel="system",
            created_by="System"
        )
        self.db.add(note)
        self.db.commit()
        
        return {
            "workflow": "stale_cleanup",
            "lead_id": lead.lead_id,
            "triggered": True,
            "action": "marked_as_lost"
        }
