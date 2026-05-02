# 🏥 IBMP Medical Education CRM

AI-Powered CRM System for Medical Education with Automated Google Sheets Integration

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-orange.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 🚀 Features

### Core Features
- ✅ **AI Lead Scoring** - CatBoost ML model (96.5% ROC-AUC)
- ✅ **Google Sheets Integration** - Automatic sync from Meta Lead Ads
- ✅ **Multi-Course Support** - 10+ medical course categories
- ✅ **Real-time Dashboard** - Analytics and KPIs
- ✅ **Campaign Tracking** - Meta/Facebook campaign data
- ✅ **Duplicate Detection** - By email and phone
- ✅ **Revenue Forecasting** - Expected vs actual revenue
- ✅ **Lead Management** - Status tracking, notes, activities

### Google Sheets Integration
- 📊 **Multi-Tab Sync** - Automatically syncs ALL tabs (Pulmonology, Pediatrics, etc.)
- 🔄 **Auto-Sync** - Every 5 minutes
- 🎯 **Smart Mapping** - Tab name → Course category
- 📝 **Campaign Data** - Preserves ad name, campaign, platform
- 🔍 **Duplicate Check** - Prevents duplicate leads
- ✅ **Sync Status** - Marks leads as "Synced" in Google Sheet

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **Supabase** - PostgreSQL cloud database
- **CatBoost** - Machine learning for lead scoring
- **APScheduler** - Automated sync scheduler
- **Google Sheets API** - Lead data integration

### Frontend
- **React 18** - UI framework
- **Ant Design** - Professional UI components
- **React Query** - Data fetching and caching
- **Recharts** - Data visualization
- **React Router** - Navigation

### ML & AI
- **CatBoost** - Lead conversion prediction (96.5% accuracy)
- **Feature Engineering** - 50+ features from lead data
- **Scoring System** - AI score + rule-based score

---

## 📦 Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account
- Google Cloud account (for Sheets integration)

### 1. Clone Repository
```bash
git clone https://github.com/DMHCAIT/IBMP-CRM.git
cd IBMP-CRM
```

### 2. Backend Setup
```bash
cd lead-ai/crm/backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Seed demo data
python seed_supabase_demo.py

# Start server
python main.py
```

Backend runs on: **http://localhost:8080**

### 3. Frontend Setup
```bash
cd lead-ai/crm/frontend

# Install dependencies
npm install

# Start development server
PORT=5172 npm start
```

Frontend runs on: **http://localhost:5172**

---

## 🔧 Configuration

### Supabase Setup

1. **Create Supabase Project**
   - Go to: https://supabase.com
   - Create new project
   - Get URL and service role key

2. **Update Backend `.env`**
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-service-role-key
   DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
   JWT_SECRET_KEY=your-secret-key
   ```

3. **Run Database Migrations**
   ```bash
   # Tables are created automatically by seeding script
   python seed_supabase_demo.py
   ```

### Google Sheets Integration

See detailed guide: **[SETUP_GOOGLE_SHEETS.md](lead-ai/crm/backend/SETUP_GOOGLE_SHEETS.md)**

**Quick Setup (5 minutes):**

1. **Create Google Cloud Service Account**
   - Go to: https://console.cloud.google.com/
   - Create project: "CRM-Google-Sheets-Sync"
   - Enable Google Sheets API
   - Create service account
   - Download JSON credentials

2. **Share Your Google Sheet**
   - Copy service account email from credentials
   - Share your Google Sheet with service account (Editor permission)

3. **Install Credentials**
   ```bash
   mv ~/Downloads/google-credentials-*.json lead-ai/crm/backend/google-credentials.json
   ```

4. **Configure Sheet ID** (in `.env`)
   ```env
   GOOGLE_SHEET_ID=your-sheet-id-here
   GOOGLE_SHEET_NAME=Sheet1
   ```

5. **Restart Backend** - Auto-sync will start!

---

## 📊 Google Sheets Sync

### How It Works

1. **Every 5 minutes**, system checks ALL tabs in your Google Sheet
2. **Finds unsynced leads** (where `Sync_Status` column is empty)
3. **Validates** required fields (name, email/phone)
4. **Checks duplicates** in CRM by email and phone
5. **Creates leads** with course category = tab name
6. **Adds campaign note** with ad name, campaign, platform
7. **Marks as "Synced"** in Google Sheet

### Sheet Structure

Your Google Sheet should have these columns:

| Column | Description | Required |
|--------|-------------|----------|
| `id` | Meta lead ID | Yes |
| `created_time` | Lead creation date | Yes |
| `full_name` | Contact name | Yes |
| `email` | Email address | Yes* |
| `phone_number` | Phone number | Yes* |
| `country` | Country | No |
| `campaign_name` | Campaign name | No |
| `ad_name` | Ad name | No |
| `platform` | Facebook/Instagram | No |
| `Sync_Status` | Sync tracking | Required |

*Either email OR phone required

### Multi-Tab Support

Each tab represents a course category:
- **Pulmonology** tab → Course: "Pulmonology"
- **Pediatrics** tab → Course: "Pediatrics"
- **Critical Care** tab → Course: "Critical Care"
- And so on...

---

## 🎯 API Endpoints

### Leads Management
```
GET    /api/leads                    # List leads with filters
GET    /api/leads/{lead_id}          # Get lead details
POST   /api/leads                    # Create lead
PUT    /api/leads/{lead_id}          # Update lead
DELETE /api/leads/{lead_id}          # Delete lead
```

### Google Sheets Sync
```
GET    /api/sync/google-sheets/status           # Get sync stats
GET    /api/sync/google-sheets/test-connection  # Test connection
POST   /api/sync/google-sheets/trigger          # Start background sync
POST   /api/sync/google-sheets/sync-now         # Sync immediately
```

### Dashboard & Analytics
```
GET    /api/dashboard/stats          # Get dashboard KPIs
GET    /api/analytics/conversion     # Conversion analytics
GET    /api/analytics/revenue        # Revenue analytics
```

### Health & Status
```
GET    /health                       # Health check
GET    /metrics                      # Prometheus metrics
```

---

## 🧪 Testing

### Test Google Sheets Integration

```bash
# Test connection
curl -s http://localhost:8080/api/sync/google-sheets/test-connection | python3 -m json.tool

# Manual sync
curl -X POST http://localhost:8080/api/sync/google-sheets/sync-now | python3 -m json.tool

# Check sync status
curl -s http://localhost:8080/api/sync/google-sheets/status | python3 -m json.tool
```

### Test Lead API

```bash
# Get all leads
curl http://localhost:8080/api/leads

# Get lead by ID
curl http://localhost:8080/api/leads/LEAD00001

# Create lead
curl -X POST http://localhost:8080/api/leads \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test Lead","email":"test@example.com","phone":"+919876543210"}'
```

---

## 📁 Project Structure

```
IBMP-CRM/
├── lead-ai/
│   └── crm/
│       ├── backend/
│       │   ├── main.py                    # FastAPI application
│       │   ├── google_sheets_service.py   # Google Sheets API
│       │   ├── lead_sync_service.py       # Sync logic
│       │   ├── supabase_client.py         # Supabase connection
│       │   ├── supabase_data_layer.py     # Data access layer
│       │   ├── auth.py                    # Authentication
│       │   ├── requirements.txt           # Python dependencies
│       │   └── .env                       # Configuration (not in git)
│       └── frontend/
│           ├── src/
│           │   ├── components/            # React components
│           │   ├── pages/                 # Page components
│           │   ├── api/                   # API client
│           │   └── context/               # React context
│           ├── package.json               # Node dependencies
│           └── .env.local                 # Frontend config
├── models/
│   └── lead_conversion_model_latest.cbm   # ML model
├── SETUP_GOOGLE_SHEETS.md                 # Setup guide
└── README.md                              # This file
```

---

## 🔐 Security

### Protected Files (Not in Git)
- ✅ `google-credentials.json` - Service account credentials
- ✅ `.env` - Supabase credentials and secrets
- ✅ `crm_database.db` - Local database (not used)
- ✅ `*.cbm` - ML model files (large)

### Environment Variables
```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
DATABASE_URL=postgresql://xxx

# JWT
JWT_SECRET_KEY=xxx

# Google Sheets
GOOGLE_SHEET_ID=xxx
GOOGLE_SHEETS_CREDENTIALS_PATH=google-credentials.json

# Optional
OPENAI_API_KEY=xxx
RESEND_API_KEY=xxx
```

---

## 🚀 Deployment

### Backend (Render/Railway)

1. **Environment Variables**
   - Set all required env vars
   - Upload `google-credentials.json` as secret file

2. **Build Command**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start Command**
   ```bash
   python main.py
   ```

### Frontend (Vercel/Netlify)

1. **Environment Variables**
   ```env
   REACT_APP_API_URL=https://your-backend-url.com
   ```

2. **Build Command**
   ```bash
   npm run build
   ```

3. **Publish Directory**
   ```
   build
   ```

---

## 📚 Documentation

- **[SETUP_GOOGLE_SHEETS.md](lead-ai/crm/backend/SETUP_GOOGLE_SHEETS.md)** - Complete setup guide
- **[GOOGLE_SHEETS_SYNC_GUIDE.md](lead-ai/crm/GOOGLE_SHEETS_SYNC_GUIDE.md)** - Technical documentation
- **[QUICK_START_GOOGLE_SHEETS.md](lead-ai/crm/QUICK_START_GOOGLE_SHEETS.md)** - Quick reference

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🆘 Support

### Common Issues

**Google Sheets not syncing?**
- Check `google-credentials.json` exists
- Verify service account has Editor permission
- Check backend logs for errors

**Backend won't start?**
- Verify all environment variables are set
- Check Supabase credentials are correct
- Ensure port 8080 is available

**Frontend errors?**
- Check `REACT_APP_API_URL` is set correctly
- Verify backend is running
- Clear browser cache

### Contact

For support, please open an issue on GitHub.

---

## ✨ Features Roadmap

- [ ] WhatsApp integration
- [ ] Email automation
- [ ] SMS notifications
- [ ] Advanced analytics dashboard
- [ ] Team collaboration features
- [ ] Mobile app
- [ ] API documentation (Swagger)
- [ ] Unit tests
- [ ] CI/CD pipeline

---

**Built with ❤️ for Medical Education**

🏥 IBMP Medical Education CRM - Empowering medical education with AI and automation
