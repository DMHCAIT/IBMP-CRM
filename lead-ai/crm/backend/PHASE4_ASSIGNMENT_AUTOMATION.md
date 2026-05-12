# Phase 4: Automated Lead Assignment & Workflow Automation

## 🎯 Overview

Phase 4 implements intelligent lead distribution and automated workflow triggers to ensure optimal counselor-lead matching and timely follow-ups.

## ✅ Completed Features

### 1. Intelligent Lead Assignment Engine

**File:** `assignment_service.py` (426 lines)

#### Assignment Strategies

##### **A. Intelligent Assignment (AI-Based)**
Uses weighted scoring algorithm to match leads with counselors:

- **Workload (30%)**: Favors counselors with fewer active leads
- **Expertise (40%)**: Matches based on course specialization
- **Performance (20%)**: Prioritizes counselors with higher conversion rates
- **Availability (10%)**: Checks if counselor is overloaded

**Example:**
```bash
curl -X POST http://localhost:8000/api/leads/LEAD00001/assign \
  -H "Content-Type: application/json" \
  -d '{"strategy": "intelligent"}'
```

**Response:**
```json
{
  "success": true,
  "assigned_to": "Michael Chen",
  "strategy": "intelligent",
  "lead_id": "LEAD00001",
  "reason": "Best match based on expertise, workload, and performance"
}
```

##### **B. Round Robin**
Distributes leads evenly across all counselors based on assignment count.

**Example:**
```bash
curl -X POST http://localhost:8000/api/leads/LEAD00002/assign \
  -H "Content-Type: application/json" \
  -d '{"strategy": "round_robin"}'
```

##### **C. Skill-Based**
Matches leads to counselors based on course expertise:
- MBBS students → Medical specialists
- Engineering courses → Technical counselors
- Nursing/Pharmacy → Healthcare counselors
- Abroad studies → International advisors

**Example:**
```bash
curl -X POST http://localhost:8000/api/leads/LEAD00003/assign \
  -H "Content-Type: application/json" \
  -d '{"strategy": "skill_based"}'
```

##### **D. Workload-Based**
Assigns lead to the counselor with the lowest current workload.

**Example:**
```bash
curl -X POST http://localhost:8000/api/leads/LEAD00004/assign \
  -H "Content-Type: application/json" \
  -d '{"strategy": "workload"}'
```

### 2. Bulk Assignment

Assign all unassigned leads at once using your preferred strategy.

**Example:**
```bash
curl -X POST http://localhost:8000/api/leads/assign-all \
  -H "Content-Type: application/json" \
  -d '{"strategy": "intelligent"}'
```

**Response:**
```json
{
  "total": 5,
  "assigned": 5,
  "failed": 0,
  "assignments": [
    {"lead_id": "LEAD00001", "assigned_to": "Michael Chen"},
    {"lead_id": "LEAD00002", "assigned_to": "Priya Sharma"},
    {"lead_id": "LEAD00003", "assigned_to": "David Martinez"}
  ]
}
```

### 3. Lead Reassignment

Manually reassign leads between counselors with documented reasoning.

**Example:**
```bash
curl -X POST http://localhost:8000/api/leads/LEAD00001/reassign \
  -H "Content-Type: application/json" \
  -d '{
    "new_counselor": "Priya Sharma",
    "reason": "Lead requires MBBS specialization"
  }'
```

**Response:**
```json
{
  "success": true,
  "lead_id": "LEAD00001",
  "old_counselor": "Michael Chen",
  "new_counselor": "Priya Sharma",
  "reason": "Lead requires MBBS specialization"
}
```

### 4. Counselor Workload Analytics

Monitor real-time workload distribution across all counselors.

**Example:**
```bash
curl http://localhost:8000/api/counselors/workload
```

**Response:**
```json
{
  "counselors": [
    {
      "full_name": "Michael Chen",
      "email": "michael.chen@crm.com",
      "role": "Manager",
      "active_leads": 3,
      "performance_score": 50.0,
      "status": "available"
    },
    {
      "full_name": "Priya Sharma",
      "email": "priya.sharma@crm.com",
      "role": "Manager",
      "active_leads": 1,
      "performance_score": 50.0,
      "status": "available"
    }
  ],
  "total_counselors": 14,
  "total_active_leads": 4,
  "average_workload": 0.3
}
```

**Workload Status Levels:**
- **Available**: < 10 active leads (🟢)
- **Busy**: 10-20 active leads (🟡)
- **Overloaded**: > 30 active leads (🔴)

### 5. Automated Workflow Triggers

**File:** `assignment_service.py` - `WorkflowAutomation` class

#### Workflow Types

##### **A. Follow-up Workflow**
**Trigger:** No contact in 3+ days  
**Action:** Sends normal priority Email + WhatsApp reminder

##### **B. Churn Prevention Workflow**
**Trigger:** Churn risk > 70%  
**Action:** Sends urgent re-engagement Email + WhatsApp

##### **C. Hot Lead Alert Workflow**
**Trigger:** AI score >= 90 AND status = "new"  
**Action:** Immediate urgent Email + WhatsApp notification

##### **D. Stale Lead Cleanup Workflow**
**Trigger:** 30+ days inactive  
**Action:** Marks lead as "lost" status

**Manual Trigger:**
```bash
curl -X POST http://localhost:8000/api/workflows/trigger
```

**Response:**
```json
{
  "triggered": 3,
  "workflows": [
    {
      "lead_id": "LEAD00005",
      "workflow_type": "follow_up",
      "actions_taken": ["email_sent", "whatsapp_sent"]
    }
  ]
}
```

## 🔧 Technical Implementation

### Database Schema Compatibility

**Important:** The assignment system uses the `DBUser` model with these fields:
- `full_name` (used for assignment)
- `email`
- `role` (must be "Counselor", "Manager", or "Team Leader")
- `is_active`

**Active Lead Statuses:**
Leads are counted as active workload only if status is:
- `FRESH`
- `FOLLOW_UP`
- `WARM`
- `HOT`

Leads with status `ENROLLED`, `NOT_INTERESTED`, `JUNK` are not counted in workload.

### Assignment Algorithm

**Intelligent Assignment Score Calculation:**
```python
score = (workload_score * 0.3) + 
        (expertise_score * 0.4) + 
        (performance_score * 0.2) + 
        (availability_score * 0.1)
```

**Workload Score:**
```python
max_workload = 40
workload_score = ((max_workload - current_workload) / max_workload) * 100
```

**Performance Score:**
```python
conversion_rate = (won_leads / total_leads) * 100
```

### Integration with Communication Service

Workflows automatically send messages via:
- **Email**: Resend API (`communication_service.send_email()`)
- **WhatsApp**: Twilio Business API (`communication_service.send_whatsapp()`)

## 📊 Testing

**Test Suite:** `test_assignment.py` (221 lines)

### Test Coverage

✅ Counselor workload analysis  
✅ Single lead assignment (all 4 strategies)  
✅ Bulk assignment  
✅ Lead reassignment  
✅ Workflow automation triggers  

### Running Tests

```bash
cd backend
source venv/bin/activate
python test_assignment.py
```

### Test Results
```
✅ Total Counselors: 14
📊 Total Active Leads: 4
📈 Average Workload: 0.3 leads/counselor

✅ ALL TESTS COMPLETED
```

## 🎓 Course Expertise Mapping

The system recognizes these specializations:

| Course Keywords | Expertise Area |
|----------------|---------------|
| mbbs, md, medicine, cardiology, oncology | Medical |
| engineering, btech, mtech | Engineering |
| nursing, bsc nursing, msc nursing | Nursing |
| pharmacy, pharma, d.pharm | Pharmacy |
| abroad, international, usa, uk | International |

Counselors with "Manager" or "Team Leader" roles get +10 bonus score (can handle any lead).

## 📈 Performance Metrics

### Current Statistics
- **Total Counselors:** 14 (2 Managers, 4 Team Leaders, 8 Counselors)
- **Active Leads:** 4
- **Average Workload:** 0.3 leads/counselor
- **Assignment Success Rate:** 100%

### Workload Distribution
| Counselor | Role | Active Leads | Status |
|-----------|------|--------------|--------|
| Michael Chen | Manager | 3 | Available |
| Priya Sharma | Manager | 1 | Available |
| Others | Various | 0 | Available |

## 🔐 API Authentication

All assignment endpoints require JWT authentication (from Phase 1).

**Example with Auth:**
```bash
curl -X POST http://localhost:8000/api/leads/LEAD00001/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"strategy": "intelligent"}'
```

## 🚀 Next Steps

After Phase 4:
- **Phase 5:** Error Handling & Logging (Sentry integration, structured logging)
- **Phase 6:** Performance Optimization (Caching, query optimization)
- **Phase 7:** AI-Powered Smart Features (GPT-4 responses, optimal contact time)

## 📝 System Notes

All reassignments are automatically logged as system notes in the database:
```
"Reassigned from {old_counselor} to {new_counselor}. Reason: {reason}"
```

## 🎯 Success Criteria (Met)

✅ 4 assignment strategies implemented  
✅ Bulk assignment working  
✅ Reassignment with audit trail  
✅ Real-time workload analytics  
✅ 4 automated workflow triggers  
✅ Email + WhatsApp integration  
✅ Comprehensive test suite  
✅ 100% test pass rate  

**Phase 4 Completion: 100% ✅**

---

**Last Updated:** Phase 4 Implementation Complete  
**Database:** crm_database.db  
**Backend Server:** Running on port 8000 (auto-reloading)
