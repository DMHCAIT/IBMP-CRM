# 🚀 Quick Reference Guide - Lead Assignment System

## Assignment API Endpoints

### 1. Assign Single Lead
```bash
# Intelligent (AI-based)
curl -X POST http://localhost:8000/api/leads/LEAD00001/assign \
  -H "Content-Type: application/json" \
  -d '{"strategy": "intelligent"}'

# Round Robin
curl -X POST http://localhost:8000/api/leads/LEAD00002/assign \
  -H "Content-Type: application/json" \
  -d '{"strategy": "round_robin"}'

# Skill-Based
curl -X POST http://localhost:8000/api/leads/LEAD00003/assign \
  -H "Content-Type: application/json" \
  -d '{"strategy": "skill_based"}'

# Workload-Based
curl -X POST http://localhost:8000/api/leads/LEAD00004/assign \
  -H "Content-Type: application/json" \
  -d '{"strategy": "workload"}'
```

### 2. Bulk Assign All Unassigned
```bash
curl -X POST http://localhost:8000/api/leads/assign-all \
  -H "Content-Type: application/json" \
  -d '{"strategy": "intelligent"}'
```

### 3. Reassign Lead
```bash
curl -X POST http://localhost:8000/api/leads/LEAD00001/reassign \
  -H "Content-Type: application/json" \
  -d '{
    "new_counselor": "Priya Sharma",
    "reason": "Requires MBBS expertise"
  }'
```

### 4. Get Counselor Workload
```bash
curl http://localhost:8000/api/counselors/workload
```

### 5. Trigger Workflows
```bash
curl -X POST http://localhost:8000/api/workflows/trigger
```

## Assignment Strategies Explained

| Strategy | Best For | Logic |
|----------|----------|-------|
| **intelligent** | General use, new leads | AI scoring (30% workload + 40% expertise + 20% performance + 10% availability) |
| **round_robin** | Fair distribution | Assigns to counselor with fewest total assignments |
| **skill_based** | Specialized courses | Matches course keywords to counselor expertise |
| **workload** | Urgent balancing | Assigns to counselor with lowest current active leads |

## Workload Status Levels

| Status | Active Leads | Emoji | Recommendation |
|--------|-------------|-------|----------------|
| Available | < 10 | 🟢 | Can accept new leads |
| Busy | 10-20 | 🟡 | Monitor closely |
| Overloaded | > 30 | 🔴 | Stop new assignments |

## Active Lead Statuses

Leads count as "active workload" only if status is:
- `FRESH` - New lead, no contact yet
- `FOLLOW_UP` - Requires follow-up
- `WARM` - Engaged but not converted
- `HOT` - High engagement, likely to convert

**Not counted:**
- `ENROLLED` - Already enrolled (closed/won)
- `NOT_INTERESTED` - Rejected
- `JUNK` - Invalid lead
- `NOT_ANSWERING` - Unresponsive

## Automated Workflows

| Workflow | Trigger | Priority | Channels |
|----------|---------|----------|----------|
| Follow-up | No contact in 3 days | Normal | Email + WhatsApp |
| Churn Prevention | Churn risk > 70% | Urgent | Email + WhatsApp |
| Hot Lead Alert | AI score ≥ 90, status=new | Urgent | Email + WhatsApp |
| Stale Cleanup | 30+ days inactive | System | Mark as lost |

## Course Expertise Keywords

| Specialization | Keywords |
|---------------|----------|
| Medical | mbbs, md, medicine, cardiology, oncology, fellowship |
| Engineering | engineering, btech, mtech, computer, mechanical |
| Nursing | nursing, bsc nursing, msc nursing |
| Pharmacy | pharmacy, pharma, d.pharm, b.pharm |
| International | abroad, international, usa, uk, australia, canada |

## Testing Commands

```bash
# Run full test suite
cd backend
source venv/bin/activate
python test_assignment.py

# Quick verification
curl http://localhost:8000/api/counselors/workload | python3 -m json.tool

# Assign test lead
curl -X POST http://localhost:8000/api/leads/LEAD00001/assign \
  -H "Content-Type: application/json" \
  -d '{"strategy": "intelligent"}' | python3 -m json.tool
```

## Troubleshooting

### Issue: 0 counselors detected
**Cause:** Role filtering case mismatch  
**Fix:** Roles must be "Counselor", "Manager", or "Team Leader" (capitalized)

### Issue: "Lead already assigned"
**Cause:** Lead already has `assigned_to` value  
**Fix:** Use reassignment endpoint instead, or set `assigned_to = NULL` first

### Issue: Status enum error
**Cause:** Invalid status value  
**Fix:** Use valid enum: FRESH, FOLLOW_UP, WARM, HOT, ENROLLED, NOT_INTERESTED, JUNK, NOT_ANSWERING

### Issue: AttributeError 'username'
**Cause:** DBUser has no username field  
**Fix:** Use `full_name` field instead

## Performance Tips

1. **Use Bulk Assignment** for multiple unassigned leads
2. **Run Workflows** during off-peak hours
3. **Monitor Workload** daily to prevent overload
4. **Use Intelligent Strategy** by default (best results)
5. **Document Reassignments** with clear reasons

## Integration Notes

- Assignment system integrates with **Phase 2 ML Model** (ai_score)
- Workflows use **Phase 3 Communication APIs** (Email + WhatsApp)
- Requires **Phase 1 JWT Authentication** for API access

## Database Queries

```sql
-- View current assignments
SELECT assigned_to, COUNT(*) as count, 
       SUM(CASE WHEN status IN ('FRESH','FOLLOW_UP','WARM','HOT') THEN 1 ELSE 0 END) as active
FROM leads 
WHERE assigned_to IS NOT NULL 
GROUP BY assigned_to 
ORDER BY count DESC;

-- Find unassigned leads
SELECT lead_id, full_name, course_interested, status 
FROM leads 
WHERE assigned_to IS NULL 
LIMIT 10;

-- Check counselor roles
SELECT full_name, role, is_active 
FROM users 
WHERE role IN ('Counselor', 'Manager', 'Team Leader') 
  AND is_active = 1;
```

## Response Format Examples

### Successful Assignment
```json
{
  "success": true,
  "assigned_to": "Michael Chen",
  "strategy": "intelligent",
  "lead_id": "LEAD00001",
  "reason": "Best match based on expertise, workload, and performance"
}
```

### Failed Assignment
```json
{
  "success": false,
  "error": "Lead already assigned to Anita Desai"
}
```

### Workload Response
```json
{
  "counselors": [...],
  "total_counselors": 14,
  "total_active_leads": 4,
  "average_workload": 0.3
}
```

---

**Version:** Phase 4.0  
**Last Updated:** December 25, 2024  
**Status:** Production Ready
