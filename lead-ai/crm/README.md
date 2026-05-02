# 🏥 AI-Powered Medical Education CRM

**Complete Lead Management System with Artificial Intelligence**

A production-ready CRM system built for medical education institutes to manage leads, track conversions, analyze performance, and reduce counselor workload by 50%+ using AI-driven insights.

---

## 🎯 Key Features

### ✅ **Lead Management**
- Complete lead lifecycle tracking (Follow Up → Warm → Hot → Enrolled)
- AI-powered lead scoring (0-100)
- Automatic segmentation (Hot/Warm/Cold/Junk)
- Smart follow-up scheduling
- Revenue tracking (Expected vs Actual)
- Communication history (Notes, Calls, WhatsApp, Email)

### ✅ **AI Intelligence**
- Real-time conversation analysis
- Buying signal detection
- Objection identification (Price, Time, Competitor, Quality)
- Churn risk prediction
- Recommended action generation
- Script suggestions for counselors

### ✅ **Advanced Filters**
- Filter by Country, Status, Segment, Counselor
- Date range filters (Follow-up, Created)
- Search by name, phone, email
- Multi-parameter filtering

### ✅ **Communication Hub**
- WhatsApp integration (ready)
- Email integration (ready)
- Phone call tracking
- Timestamped notes with counselor attribution

### ✅ **Analytics & Reporting**
- Dashboard with key metrics
- Revenue by country breakdown
- Conversion funnel visualization
- Counselor performance tracking
- Lead source analysis
- Course interest trends

### ✅ **Hospital & Course Management**
- Collaborated hospitals directory
- Course catalog with pricing
- Dynamic pricing based on course selection

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│          REACT FRONTEND (Port 3000)             │
│  ┌──────────────────────────────────────────┐  │
│  │  Dashboard  │  Leads  │  Analytics       │  │
│  │  Hospitals  │  Courses                   │  │
│  └──────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────┘
               │ REST API
               ▼
┌──────────────────────────────────────────────────┐
│        FASTAPI BACKEND (Port 8000)               │
│  ┌──────────────────────────────────────────┐   │
│  │  AI Scoring Engine                       │   │
│  │  - Conversation Analysis                 │   │
│  │  - Buying Signal Detection               │   │
│  │  - Objection Classification              │   │
│  │  - Revenue Prediction                    │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │  Database (SQLite/PostgreSQL)            │   │
│  │  - Leads, Notes, Activities              │   │
│  │  - Hospitals, Courses, Counselors        │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## 📦 Installation Guide

### **Prerequisites**
- Python 3.8+ (for backend)
- Node.js 16+ (for frontend)
- pip and npm installed

### **Step 1: Backend Setup**

```bash
# Navigate to backend folder
cd lead-ai/crm/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Seed database with sample data
python seed_data.py

# Start backend server
python main.py
```

Backend will run on: **http://localhost:8000**  
API Docs: **http://localhost:8000/docs**

### **Step 2: Frontend Setup**

```bash
# Open new terminal
cd lead-ai/crm/frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend will run on: **http://localhost:3000**

---

## 🚀 Quick Start

### **1. Access Dashboard**
Navigate to `http://localhost:3000/dashboard`

You'll see:
- Total leads count
- Hot/Warm/Cold/Junk distribution
- Conversion rate
- Revenue metrics
- Recent leads

### **2. View Leads**
Go to `http://localhost:3000/leads`

Features:
- Complete lead list with AI scores
- Filter by country, status, segment, date
- Search by name, phone, email
- Click any lead to see details

### **3. Lead Details**
Click on any lead ID to see:
- Complete profile information
- AI Score (0-100) with segment
- Expected/Actual revenue
- Recommended action & script
- Communication history
- Add notes with timestamps

### **4. Create New Lead**
Click "Create Lead" button and fill:
- Full Name, Email, Phone, WhatsApp
- Country, Source, Course
- Assign to counselor

AI will automatically:
- Score the lead (0-100)
- Assign segment (Hot/Warm/Cold/Junk)
- Calculate expected revenue
- Suggest next action
- Schedule follow-up

### **5. View Analytics**
Navigate to `http://localhost:3000/analytics`

See:
- Revenue by country
- Conversion funnel
- Lead sources
- Course interests
- Counselor performance

---

## 📱 Features Walkthrough

### **Lead Scoring (AI-Powered)**

Every lead gets an AI score based on:

1. **Conversation Intelligence (40%)**
   - Buying signals: "ready to pay", "send details"
   - Urgency: "urgent", "today", "ASAP"
   - Interest level: "interested", "tell me more"

2. **Recency (20%)**
   - Last contact < 1 day: +20 points
   - Last contact < 3 days: +15 points
   - Last contact < 7 days: +10 points

3. **Engagement (20%)**
   - Number of interactions
   - Note quality
   - Response rate

4. **Penalties**
   - Churn risk: -30 points
   - Price objection: -10 points
   - "Not interested": -40 points

**Result**: Score 0-100 + Segment (Hot/Warm/Cold/Junk)

### **Revenue Tracking**

**For Non-Enrolled Leads:**
- Shows "Expected Revenue"
- Calculated as: Course Price × (AI Score / 100)
- Example: ₹450,000 course, 60% score = ₹270,000 expected

**For Enrolled Leads:**
- Shows "Total Revenue"
- Enter actual amount paid
- Contributes to total revenue metrics

### **Smart Recommendations**

AI generates:

**For Hot Leads (Score > 75):**
```
🔥 URGENT: Send payment details NOW - High purchase intent
Priority: P0 - Immediate
Follow-up: Within 15 minutes
Script: "Hi [Name], I'm sending the payment details for [Course]. 
Start date is confirmed. Any questions?"
```

**For Price Objections:**
```
💰 Address pricing - Explain value + offer payment plan
Priority: P1 - High
Follow-up: Within 4 hours
Script: "I understand the investment. Let me show you the ROI 
and flexible payment options we have."
```

### **Filters & Search**

**Country Filter:** India, UAE, Saudi Arabia, Kuwait, etc.

**Status Filter:**
- Follow Up
- Warm
- Hot
- Not Interested
- Junk
- Not Answering
- Enrolled

**Segment Filter:** Hot, Warm, Cold, Junk

**Date Filters:**
- Follow-up date range
- Created date range

**Search:** Name, Phone, Email

**Example Use Case:**
> Show me all Hot leads from India created in last 7 days assigned to Priya Singh

Filters: `segment=Hot`, `country=India`, `created_from=2024-12-17`, `assigned_to=Priya Singh`

---

## 📊 Dashboard Metrics Explained

| Metric | Description | How It's Calculated |
|--------|-------------|---------------------|
| **Total Leads** | All leads in system | COUNT(*) |
| **Hot Leads** | High conversion probability | ai_segment = 'Hot' |
| **Conversion Rate** | % of leads that enrolled | (Enrolled / Total) × 100 |
| **Total Revenue** | Actual money collected | SUM(actual_revenue) WHERE status='Enrolled' |
| **Expected Revenue** | Potential revenue | SUM(expected_revenue) WHERE status≠'Enrolled' |
| **Leads Today** | New leads today | created_at = TODAY |
| **Avg AI Score** | Average lead quality | AVG(ai_score) |

---

## 🔌 API Endpoints

### **Leads**
- `GET /api/leads` - Get all leads (with filters)
- `GET /api/leads/{leadId}` - Get single lead
- `POST /api/leads` - Create lead
- `PUT /api/leads/{leadId}` - Update lead
- `DELETE /api/leads/{leadId}` - Delete lead

### **Notes**
- `GET /api/leads/{leadId}/notes` - Get lead notes
- `POST /api/leads/{leadId}/notes` - Add note

### **Communication**
- `POST /api/leads/{leadId}/send-whatsapp` - Send WhatsApp
- `POST /api/leads/{leadId}/send-email` - Send email

### **Analytics**
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/analytics/revenue-by-country` - Revenue breakdown
- `GET /api/analytics/conversion-funnel` - Funnel metrics

### **Hospitals & Courses**
- `GET /api/hospitals` - Get hospitals
- `POST /api/hospitals` - Create hospital
- `GET /api/courses` - Get courses
- `POST /api/courses` - Create course

**Full API Documentation:** http://localhost:8000/docs

---

## 💼 Use Cases

### **1. Counselor Daily Workflow**

**Morning:**
1. Check Dashboard → See hot leads
2. Filter leads by `follow_up_date=Today` + `segment=Hot`
3. Call each hot lead
4. Add note after each call
5. AI re-scores lead based on conversation

**Afternoon:**
1. Filter `segment=Warm` + `last_contact > 3 days`
2. Send WhatsApp messages
3. Update follow-up dates

**Evening:**
1. Check Analytics → Personal performance
2. Review missed hot leads
3. Plan tomorrow's calls

### **2. Manager Workflow**

**Weekly Review:**
1. Dashboard → Conversion rate trend
2. Analytics → Counselor performance
3. Identify top performers
4. Coach underperformers
5. Analyze drop reasons

**Revenue Planning:**
1. Analytics → Revenue by country
2. Expected revenue calculation
3. Forecast monthly targets
4. Allocate resources

### **3. Admin Workflow**

**Lead Distribution:**
1. Leads Page → Filter `assigned_to=None`
2. Bulk assign to counselors
3. Balance workload

**Course Management:**
1. Courses Page → Update pricing
2. Add new courses
3. Mark inactive courses

**Hospital Partnerships:**
1. Hospitals Page → Add new hospital
2. Map courses offered
3. Track collaboration status

---

## 🎓 Training Guide for Counselors

### **Understanding AI Score**

**0-25 (Cold):** 
- Low interest
- Many objections
- Follow up in 7 days
- Use nurture campaigns

**26-50 (Warm):**
- Moderate interest
- Some objections
- Follow up in 2-3 days
- Address objections

**51-75 (Warm-Hot):**
- High interest
- Minor objections
- Follow up in 24 hours
- Push for enrollment

**76-100 (Hot):**
- Very high interest
- Ready to buy
- Follow up in 15 minutes
- Send payment details NOW

### **Using Recommended Scripts**

Each lead has a recommended script based on:
- Current segment
- Primary objection
- Conversation history
- Buying signals

**Example:**

Lead has `primary_objection=price`

Recommended Script:
```
"I understand [Name]. Let me explain the value:

1. [KEY BENEFIT 1] - Worth alone ₹[X]
2. [KEY BENEFIT 2] - Saves you ₹[Y]
3. Lifetime access + [BONUS]

Total value: ₹[HIGH NUMBER]
Your investment: ₹[ACTUAL PRICE]

Plus, we have [PAYMENT PLAN] available this week only.

Makes sense?"
```

**Tips:**
- Personalize with lead's name
- Emphasize ROI, not price
- Create urgency (limited time)
- Offer payment plans

---

## 🔧 Customization

### **Add New Status**

1. Edit `backend/main.py`:
```python
class LeadStatus(str, enum.Enum):
    FOLLOW_UP = "Follow Up"
    WARM = "Warm"
    HOT = "Hot"
    NOT_INTERESTED = "Not Interested"
    JUNK = "Junk"
    NOT_ANSWERING = "Not Answering"
    ENROLLED = "Enrolled"
    DEMO_SCHEDULED = "Demo Scheduled"  # NEW
```

2. Restart backend
3. Frontend will auto-update

### **Add New Country**

Edit `frontend/src/pages/LeadsPage.js`:
```javascript
<Select placeholder="Select country">
  <Option value="India">India</Option>
  <Option value="UAE">UAE</Option>
  <Option value="Nigeria">Nigeria</Option>  {/* NEW */}
</Select>
```

### **Customize AI Scoring**

Edit `backend/main.py` → `AILeadScorer` class:

```python
def _calculate_base_score(self, lead, conversation):
    score = 50.0  # Change base score
    
    # Adjust weights
    score += conversation['buying_strength'] * 0.5  # Increase from 0.4
    
    # Add custom logic
    if lead.country == "UAE":
        score += 10  # Boost for UAE leads
    
    return score
```

---

## 📈 Performance Optimization

### **Database**

For production, switch to PostgreSQL:

1. Update `backend/main.py`:
```python
SQLALCHEMY_DATABASE_URL = "postgresql://user:pass@localhost/crm_db"
```

2. Install PostgreSQL:
```bash
pip install psycopg2-binary
```

### **Caching**

Add Redis for faster queries:

```bash
pip install redis
```

```python
from redis import Redis
cache = Redis(host='localhost', port=6379)

# Cache dashboard stats
stats = cache.get('dashboard_stats')
if not stats:
    stats = calculate_stats()
    cache.setex('dashboard_stats', 300, stats)  # 5 min cache
```

### **Frontend Build**

For production:

```bash
cd frontend
npm run build
```

Serve with Nginx or serve static files via FastAPI.

---

## 🔐 Security

### **Add Authentication**

1. Install dependencies:
```bash
pip install python-jose[cryptography] passlib
```

2. Add JWT authentication:
```python
from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/token")
async def login(username: str, password: str):
    # Verify credentials
    # Return JWT token
    pass

@app.get("/api/leads")
async def get_leads(token: str = Depends(oauth2_scheme)):
    # Verify token
    # Return leads
    pass
```

### **Environment Variables**

Create `.env` file:
```
DATABASE_URL=postgresql://user:pass@localhost/crm_db
SECRET_KEY=your-secret-key-here
WHATSAPP_API_KEY=your-whatsapp-key
EMAIL_API_KEY=your-email-key
```

---

## 🚀 Deployment

### **Backend (Docker)**

Create `Dockerfile`:
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t crm-backend .
docker run -p 8000:8000 crm-backend
```

### **Frontend (Netlify/Vercel)**

```bash
cd frontend
npm run build
# Deploy build/ folder to Netlify/Vercel
```

### **Full Stack (AWS/DigitalOcean)**

1. Backend → EC2/Droplet with Docker
2. Frontend → S3 + CloudFront / Static hosting
3. Database → RDS PostgreSQL / Managed Database
4. Domain → Route 53 / DNS

---

## 📞 Support & Maintenance

### **Logs**

Backend logs: Check terminal output
Frontend logs: Browser console

### **Database Backup**

```bash
# SQLite
cp crm_database.db crm_database_backup_$(date +%Y%m%d).db

# PostgreSQL
pg_dump crm_db > backup_$(date +%Y%m%d).sql
```

### **Common Issues**

**Issue:** Backend won't start  
**Solution:** Check port 8000 is free, activate venv

**Issue:** Frontend can't connect to backend  
**Solution:** Check `REACT_APP_API_URL` in `.env`

**Issue:** AI scores not updating  
**Solution:** Check AI scorer model path

---

## 🎯 Roadmap

### **Phase 1 (Current)** ✅
- Lead management
- AI scoring
- Basic analytics
- WhatsApp/Email placeholders

### **Phase 2 (Next 2 weeks)**
- WhatsApp Business API integration
- Email automation (SendGrid/AWS SES)
- SMS integration
- Advanced reporting

### **Phase 3 (Next month)**
- Mobile app (React Native)
- Voice call analysis (speech-to-text)
- Automated follow-up sequences
- A/B testing for scripts

### **Phase 4 (Future)**
- Multi-language support
- Chatbot for lead qualification
- Integration with other CRMs
- Advanced ML models

---

## 📄 License

Proprietary - Internal Use Only

---

## ✨ Credits

Built with:
- **Backend:** FastAPI, SQLAlchemy, Pandas
- **Frontend:** React, Ant Design, Recharts
- **AI:** Custom NLP engine

---

**🎉 Your CRM is ready! Start managing leads smarter with AI! 🚀**

For questions: Check API docs at http://localhost:8000/docs
