# 🚀 User Management Quick Start Guide

## Accessing the User Management Page

Navigate to: **http://localhost:3000/users**

Or click **"Team"** in the sidebar menu (👥 icon)

---

## 📋 Quick Actions

### View Users
- **Table View:** Click "Table View" button - See all users in a detailed table
- **Hierarchy View:** Click "Hierarchy" button - See organizational tree structure

### Add New User
1. Click **"Add User"** (+ icon, top right)
2. Fill in:
   - Full Name
   - Email (must be unique)
   - Phone
   - Password (min 6 characters)
   - Role (Super Admin, Manager, Team Leader, Counselor)
   - Reports To (select manager)
   - Status (Active/Inactive)
3. Click **"Create"**

### Edit User
1. Find user in table
2. Click **Edit** icon (✏️ blue button)
3. Modify fields
4. Click **"Update"**

### Delete User
1. Find user in table
2. Click **Delete** icon (🗑️ red button)
3. Confirm deletion

### View User's Leads
1. Find user in table
2. Click **"View Leads"** button
3. See all assigned leads with status and AI scores

---

## 🎨 Role Colors & Icons

| Role | Color | Icon | Level |
|------|-------|------|-------|
| Super Admin | 🔴 Red | 👑 Crown | 4 |
| Manager | 🟣 Purple | 🛡️ Shield | 3 |
| Team Leader | 🔵 Blue | 👥 Team | 2 |
| Counselor | 🟢 Green | 👤 User | 1 |

---

## 📊 Dashboard Stats (Top Row)

- **Total Users:** All users in the system
- **Super Admins:** Count of super admins
- **Managers:** Count of managers
- **Team Leaders:** Count of team leaders
- **Counselors:** Count of counselors

---

## 🔍 Filters

### Filter by Role
Click role column filter → Select role → OK

### Filter by Status
Click status column filter → Select Active/Inactive → OK

### Sort by Leads
Click "Assigned Leads" column header to sort

---

## 👥 Sample Organization (Seeded Data)

```
📊 15 Users Created:

Sarah Johnson (Super Admin)
├─ Michael Chen (Manager)
│  ├─ David Martinez (Team Leader)
│  │  ├─ James Wilson (Counselor)
│  │  └─ Lisa Anderson (Counselor)
│  └─ Emily Wong (Team Leader)
│     ├─ Carlos Rodriguez (Counselor)
│     └─ Sophia Lee (Counselor)
└─ Priya Sharma (Manager)
   ├─ Rajesh Kumar (Team Leader)
   │  ├─ Amit Desai (Counselor)
   │  └─ Neha Gupta (Counselor)
   └─ Aisha Patel (Team Leader)
      ├─ Vikram Singh (Counselor)
      └─ Pooja Mehta (Counselor)
```

---

## 🔑 Test Login Credentials

```
Super Admin:
  Email: sarah.johnson@crm.com
  Password: admin123

Manager:
  Email: michael.chen@crm.com
  Password: manager123

Team Leader:
  Email: david.martinez@crm.com
  Password: leader123

Counselor:
  Email: james.wilson@crm.com
  Password: counselor123
```

*(Note: Login functionality not yet implemented - these are for reference)*

---

## 🎯 Common Use Cases

### Scenario 1: New Counselor Joins
1. Click "Add User"
2. Enter name, email, phone
3. Set password
4. Select role: **Counselor**
5. Select their Team Leader in "Reports To"
6. Set status: **Active**
7. Click "Create"

### Scenario 2: Promote Counselor to Team Leader
1. Find counselor in table
2. Click Edit
3. Change role to **Team Leader**
4. Change "Reports To" to a Manager
5. Click "Update"

### Scenario 3: Check Team Performance
1. Click "Hierarchy" view
2. Expand manager's team
3. See all team leaders and counselors
4. Check lead counts next to each name

### Scenario 4: Reassign Team
1. Find team leader in table
2. Click Edit
3. Change "Reports To" to different manager
4. Click "Update"
5. All their subordinates move with them

---

## 📈 Understanding the Table

| Column | Description |
|--------|-------------|
| **User** | Avatar, name, and ID |
| **Role** | User's position in hierarchy |
| **Contact** | Email and phone |
| **Reports To** | Their direct manager |
| **Team Members** | Number of direct reports |
| **Assigned Leads** | Number of leads they handle |
| **Status** | Active or Inactive |
| **Actions** | Edit and Delete buttons |

---

## ⚡ Keyboard Shortcuts

- **Esc** - Close drawer/modal
- **Click outside** - Close drawer/modal
- **Enter** - Submit form (when focused)

---

## 🔧 Technical Details

**Backend:** FastAPI + SQLAlchemy + SQLite
**Frontend:** React + Ant Design + React Query
**API Base:** http://localhost:8000/api
**Frontend:** http://localhost:3000

### API Endpoints Used:
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user
- `GET /api/leads` - Get leads (for assignment tracking)

---

## ✨ Features at a Glance

✅ Create, Read, Update, Delete users
✅ Hierarchical organization structure
✅ Visual tree view with expandable teams
✅ Lead assignment tracking
✅ Real-time statistics
✅ Role-based filtering
✅ Contact management
✅ Manager-subordinate relationships
✅ Active/Inactive status toggle
✅ Bulk data display with pagination

---

## 🚨 Important Notes

⚠️ **Email must be unique** - Cannot create two users with same email
⚠️ **Cannot self-report** - User cannot report to themselves
⚠️ **Deleting users is permanent** - Consider deactivating instead
⚠️ **Passwords are not hashed** - For development only
⚠️ **No authentication yet** - All endpoints are public

---

## 🎓 Best Practices

1. **Use hierarchy properly:**
   - Super Admin at top (no manager)
   - Managers report to Super Admin
   - Team Leaders report to Managers
   - Counselors report to Team Leaders

2. **Keep hierarchy clean:**
   - Don't skip levels
   - One manager per person
   - Clear reporting lines

3. **Manage leads effectively:**
   - Check "Assigned Leads" regularly
   - Balance load across counselors
   - Use "View Leads" to verify assignments

4. **Use status wisely:**
   - Set to Inactive instead of deleting
   - Keep historical data
   - Reactivate when needed

---

## 📞 Need Help?

1. Check **USERS_MANAGEMENT_DOCS.md** for full documentation
2. Visit API docs: http://localhost:8000/docs
3. Check browser console for errors
4. Review backend terminal for API logs

---

## 🎉 You're Ready!

Start managing your team:
1. Open http://localhost:3000/users
2. Explore the hierarchy view
3. Try creating a new user
4. Check lead assignments
5. Experiment with filters

**Happy Team Management! 👥🚀**
