"""
AI Assistant Module - GPT-4 Integration
Provides intelligent features like natural language search, smart replies, and content generation
"""

import os
from typing import List, Dict, Optional, Any
from openai import OpenAI
from dotenv import load_dotenv
from logger_config import logger
import json

load_dotenv()

class AIAssistant:
    """GPT-4 powered AI assistant for CRM operations"""
    
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = None
        self.model = "gpt-4o-mini"  # Cost-effective GPT-4 variant
        
        if self.api_key:
            try:
                self.client = OpenAI(api_key=self.api_key)
                logger.info("✅ OpenAI GPT-4 client initialized", extra={"system": "ai"})
            except Exception as e:
                logger.error(f"❌ OpenAI initialization failed: {e}", extra={"system": "ai"})
        else:
            logger.warning("⚠️ OPENAI_API_KEY not found - AI features disabled", extra={"system": "ai"})
    
    def is_available(self) -> bool:
        """Check if AI assistant is available"""
        return self.client is not None
    
    async def natural_language_search(self, query: str, leads: List[Dict]) -> List[Dict]:
        """
        Search leads using natural language queries
        
        Example queries:
        - "Show me all hot leads from India who are interested in MBBS"
        - "Find leads that haven't been contacted in 7 days"
        - "Which leads have high conversion probability but low engagement?"
        """
        
        if not self.is_available():
            logger.warning("AI search unavailable, returning all leads", extra={"system": "ai"})
            return leads[:10]  # Return first 10 as fallback
        
        try:
            # Create a summarized version of leads for GPT
            lead_summaries = [
                {
                    "id": lead.get("id"),
                    "name": lead.get("full_name"),
                    "country": lead.get("country"),
                    "course": lead.get("course_interested"),
                    "status": lead.get("status"),
                    "ai_segment": lead.get("ai_segment"),
                    "ai_score": lead.get("ai_score"),
                    "conversion_probability": lead.get("conversion_probability"),
                    "last_contact": lead.get("updated_at")
                }
                for lead in leads[:50]  # Limit context
            ]
            
            prompt = f"""You are a CRM assistant. Analyze this query and return the IDs of matching leads.

Query: "{query}"

Available leads:
{json.dumps(lead_summaries, indent=2)}

Instructions:
1. Understand the user's natural language query
2. Match leads based on the criteria (status, country, course, scores, etc.)
3. Return ONLY a JSON array of matching lead IDs
4. If no specific criteria, return top relevant leads

Response format: {{"lead_ids": [1, 2, 3]}}
"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a CRM data analyst. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            result = response.choices[0].message.content
            parsed = json.loads(result)
            matching_ids = parsed.get("lead_ids", [])
            
            # Filter original leads
            filtered_leads = [lead for lead in leads if lead.get("id") in matching_ids]
            
            logger.info(
                f"🔍 NL Search: '{query}' → {len(filtered_leads)} results",
                extra={"system": "ai", "query": query}
            )
            
            return filtered_leads
            
        except Exception as e:
            logger.error(f"AI search failed: {e}", extra={"system": "ai"})
            return leads[:10]  # Fallback
    
    async def generate_smart_reply(self, lead_data: Dict, context: str = "follow-up") -> str:
        """
        Generate personalized email/WhatsApp messages
        
        Contexts: follow-up, welcome, reminder, thank-you
        """
        
        if not self.is_available():
            return f"Hello {lead_data.get('full_name', 'there')}, thank you for your interest!"
        
        try:
            prompt = f"""Generate a professional, personalized message for a medical education lead.

Context: {context}
Lead Details:
- Name: {lead_data.get('full_name')}
- Country: {lead_data.get('country')}
- Course Interest: {lead_data.get('course_interested')}
- Status: {lead_data.get('status')}
- AI Score: {lead_data.get('ai_score', 0):.0f}/100

Requirements:
1. Warm and professional tone
2. Personalized based on their country and course
3. Maximum 3 short paragraphs
4. Include a clear call-to-action
5. Sign off as "Medical Education Team"

Generate the message:"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a medical education counselor writing personalized messages."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=300
            )
            
            message = response.choices[0].message.content.strip()
            
            logger.info(
                f"✉️ Generated {context} message for {lead_data.get('full_name')}",
                extra={"system": "ai"}
            )
            
            return message
            
        except Exception as e:
            logger.error(f"Smart reply generation failed: {e}", extra={"system": "ai"})
            return f"Hello {lead_data.get('full_name', 'there')}, thank you for your interest in {lead_data.get('course_interested', 'our courses')}!"
    
    async def summarize_notes(self, notes: List[Dict]) -> str:
        """
        Summarize multiple lead notes into key insights
        """
        
        if not self.is_available() or not notes:
            return "No notes available to summarize."
        
        try:
            notes_text = "\n\n".join([
                f"[{note.get('created_at', 'Unknown date')}] {note.get('content', '')}"
                for note in notes[-10:]  # Last 10 notes
            ])
            
            prompt = f"""Summarize these lead interaction notes into key insights:

{notes_text}

Provide:
1. Overall sentiment and engagement level
2. Main concerns or questions raised
3. Next recommended actions
4. Any red flags or urgent matters

Keep it concise (5-7 bullet points):"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a CRM analyst summarizing lead interactions."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=400
            )
            
            summary = response.choices[0].message.content.strip()
            
            logger.info(f"📝 Summarized {len(notes)} notes", extra={"system": "ai"})
            
            return summary
            
        except Exception as e:
            logger.error(f"Note summarization failed: {e}", extra={"system": "ai"})
            return "Unable to generate summary at this time."
    
    async def predict_best_action(self, lead_data: Dict, activities: List[Dict]) -> Dict:
        """
        Predict the best next action for a lead based on their data and history
        """
        
        if not self.is_available():
            return {
                "action": "follow_up_call",
                "reason": "Standard follow-up recommended",
                "priority": "medium"
            }
        
        try:
            activity_summary = ", ".join([
                f"{act.get('activity_type', 'action')} on {act.get('created_at', 'date')}"
                for act in activities[-5:]
            ])
            
            prompt = f"""Analyze this lead and recommend the best next action:

Lead Profile:
- Name: {lead_data.get('full_name')}
- Status: {lead_data.get('status')}
- AI Score: {lead_data.get('ai_score', 0):.0f}/100
- Segment: {lead_data.get('ai_segment')}
- Conversion Probability: {lead_data.get('conversion_probability', 0):.0%}
- Course: {lead_data.get('course_interested')}
- Country: {lead_data.get('country')}

Recent Activities: {activity_summary or 'None'}

Recommend the BEST next action from:
- follow_up_call
- send_whatsapp
- send_email
- schedule_consultation
- send_brochure
- escalate_to_manager

Return JSON format:
{{
  "action": "recommended_action",
  "reason": "brief explanation (1 sentence)",
  "priority": "high/medium/low",
  "timing": "when to do it (e.g., 'within 24 hours')"
}}
"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a CRM strategy advisor. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.4,
                max_tokens=200
            )
            
            result = json.loads(response.choices[0].message.content)
            
            logger.info(
                f"🎯 Predicted action for {lead_data.get('full_name')}: {result.get('action')}",
                extra={"system": "ai"}
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Action prediction failed: {e}", extra={"system": "ai"})
            return {
                "action": "follow_up_call",
                "reason": "Default recommendation",
                "priority": "medium",
                "timing": "within 48 hours"
            }
    
    async def analyze_conversion_barriers(self, lead_data: Dict, notes: List[Dict]) -> List[str]:
        """
        Identify potential barriers to conversion based on lead data and notes
        """
        
        if not self.is_available():
            return ["AI analysis unavailable"]
        
        try:
            notes_text = "\n".join([note.get('content', '') for note in notes[-5:]])
            
            prompt = f"""Analyze potential barriers preventing this lead from converting:

Lead Data:
- Status: {lead_data.get('status')}
- AI Score: {lead_data.get('ai_score', 0):.0f}/100
- Conversion Probability: {lead_data.get('conversion_probability', 0):.0%}
- Expected Revenue: ${lead_data.get('expected_revenue', 0):,.0f}

Recent Notes:
{notes_text or 'No notes available'}

Identify 3-5 potential barriers (e.g., budget concerns, documentation issues, timing, competition, etc.)
List them as brief bullet points:"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a conversion optimization specialist."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.6,
                max_tokens=300
            )
            
            barriers_text = response.choices[0].message.content.strip()
            # Parse bullet points
            barriers = [
                line.strip().lstrip('•-*').strip()
                for line in barriers_text.split('\n')
                if line.strip() and not line.strip().startswith('#')
            ]
            
            logger.info(f"🚧 Identified {len(barriers)} conversion barriers", extra={"system": "ai"})
            
            return barriers[:5]
            
        except Exception as e:
            logger.error(f"Barrier analysis failed: {e}", extra={"system": "ai"})
            return ["Unable to analyze conversion barriers"]
    
    async def generate_course_recommendation(self, lead_data: Dict, available_courses: List[Dict]) -> Dict:
        """
        Recommend the best course for a lead based on their profile
        """
        
        if not self.is_available() or not available_courses:
            return available_courses[0] if available_courses else {}
        
        try:
            courses_info = [
                {
                    "name": course.get("course_name"),
                    "category": course.get("category"),
                    "duration": course.get("duration"),
                    "price": course.get("price")
                }
                for course in available_courses
            ]
            
            prompt = f"""Recommend the best course for this lead:

Lead Profile:
- Country: {lead_data.get('country')}
- Current Interest: {lead_data.get('course_interested')}
- Budget Indicator (AI Score): {lead_data.get('ai_score', 0):.0f}/100

Available Courses:
{json.dumps(courses_info, indent=2)}

Return JSON with the recommended course name and reason:
{{
  "recommended_course": "exact course name",
  "reason": "1-2 sentence explanation"
}}
"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a medical education advisor. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=200
            )
            
            result = json.loads(response.choices[0].message.content)
            recommended_name = result.get("recommended_course")
            
            # Find the full course object
            recommended_course = next(
                (c for c in available_courses if c.get("course_name") == recommended_name),
                available_courses[0] if available_courses else {}
            )
            
            recommended_course["ai_recommendation_reason"] = result.get("reason")
            
            logger.info(
                f"🎓 Recommended {recommended_name} for {lead_data.get('full_name')}",
                extra={"system": "ai"}
            )
            
            return recommended_course
            
        except Exception as e:
            logger.error(f"Course recommendation failed: {e}", extra={"system": "ai"})
            return available_courses[0] if available_courses else {}


# Global instance
ai_assistant = AIAssistant()

logger.info("🤖 AI Assistant module loaded", extra={"system": "ai"})
