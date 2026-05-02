# 👥 User Management System - Documentation

## Overview

The User Management System provides a comprehensive hierarchical team management solution with role-based access and lead assignment tracking. It supports a 4-level organizational hierarchy with visual representations in both table and tree views.

---

## 🏗️ Organizational Hierarchy

### Role Levels (4 Tiers)

```
Level 4: Super Admin
   │
   └─── Level 3: Manager
           │
           └─── Level 2: Team Leader
                   │
                   └─── Level 1: Counselor
```

### Role Descriptions

1. **Super Admin** 🔴
   - Top-level authority
   - Can manage all users across the organization
   - Full access to all features
   - Reports to: No one (top level)

2. **Manager** 🟣
   - Manages Team Leaders and Counselors
   - Oversees department operations
   - Reports to: Super Admin

3. **Team Leader** 🔵
   - Manages Counselors
   - Coordinates daily operations
   - Reports to: Manager

4. **Counselor** 🟢
   - Front-line team members
   - Handles lead interactions
   - Reports to: Team Leader

---

## 🎯 Key Features

### 1. Two View Modes

#### Table View
- Comprehensive user list with all details
- Filterable by role and active status
- Sortable by assigned leads
- Shows contact info, reporting structure, team size

#### Hierarchy View
- Visual tree structure
- Shows organizational relationships
- Expandable/collapsible teams
- Displays lead counts per user

### 2. User Management

#### Create User
- Full name, email, phone
- Password (auto-hashed in production)
- Role assignment
- Reports-to selection (prevents self-reporting)
- Active/Inactive status

#### Edit User
- Update any field except ID
- Change reporting structure
- Update role (affects hierarchy)
- Toggle active status

#### Delete User
- Confirmation required
- Permanently removes user
- Note: Consider deactivating instead of deleting

### 3. Lead Assignment Tracking

- Shows number of leads per user
- Click "View Leads" to see assigned leads
- Modal displays lead details:
  - Lead ID
  - Name
  - Course interested
  - Status (color-coded)
  - AI Score

### 4. Team Analytics

**Dashboard Stats:**
- Total Users
- Super Admins count
- Managers count
- Team Leaders count
- Counselors count

**Per User:**
- Team Members (direct reports)
- Assigned Leads
- Reporting relationship

---

## 📊 Database Schema

### Users Table

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    full_name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    phone VARCHAR,
    password VARCHAR,  -- Hashed in production
    role VARCHAR,      -- Super Admin, Manager, Team Leader, Counselor
    reports_to INTEGER,  -- Foreign key to users.id
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
);
```

### Relationships
- **Self-referential:** `reports_to` → `users.id`
- Enables hierarchical tree structure
- Supports unlimited depth (currently using 4 levels)

---

## 🔌 API Endpoints

### GET /api/users
Get all users in the organization

**Response:**
```json
[
  {
    "id": 1,
    "full_name": "Sarah Johnson",
    "email": "sarah.johnson@crm.com",
    "phone": "+1 555 0001",
    "role": "Super Admin",
    "reports_to": null,
    "is_active": true,
    "created_at": "2024-12-25T10:00:00",
    "updated_at": "2024-12-25T10:00:00"
  }
]
```

### GET /api/users/{user_id}
Get a specific user by ID

**Response:** Single user object

### POST /api/users
Create a new user

**Request Body:**
```json
{
  "full_name": "John Doe",
  "email": "john.doe@crm.com",
  "phone": "+1 555 0099",
  "password": "secure123",
  "role": "Counselor",
  "reports_to": 7,
  "is_active": true
}
```

**Response:** Created user object

### PUT /api/users/{user_id}
Update user information

**Request Body:** Partial user object (only fields to update)

### DELETE /api/users/{user_id}
Delete a user

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

---

## 💡 Sample Organization Structure

```
Sarah Johnson (Super Admin)
├─ Michael Chen (Manager)
│  ├─ David Martinez (Team Leader)
│  │  ├─ James Wilson (Counselor) - 8 leads
│  │  └─ Lisa Anderson (Counselor) - 6 leads
│  └─ Emily Wong (Team Leader)
│     ├─ Carlos Rodriguez (Counselor) - 10 leads
│     └─ Sophia Lee (Counselor) - 5 leads
└─ Priya Sharma (Manager)
   ├─ Rajesh Kumar (Team Leader)
   │  ├─ Amit Desai (Counselor) - 7 leads
   │  └─ Neha Gupta (Counselor) - 9 leads
   └─ Aisha Patel (Team Leader)
      ├─ Vikram Singh (Counselor) - 4 leads
      └─ Pooja Mehta (Counselor) - 11 leads
```

---

## 🎨 UI Components

### Stats Cards (Top Row)
- **Total Users:** Total count with UsergroupAddOutlined icon
- **Super Admins:** Red theme with CrownOutlined icon
- **Managers:** Purple theme with SafetyCertificateOutlined icon
- **Team Leaders:** Blue theme with TeamOutlined icon
- **Counselors:** Green theme with UserOutlined icon

### Table Columns

1. **User** (250px)
   - Avatar with role color
   - Full name (bold)
   - User ID (secondary)

2. **Role** (150px)
   - Color-coded tag
   - Role icon
   - Filterable

3. **Contact** (220px)
   - Email with icon
   - Phone with icon

4. **Reports To** (180px)
   - Manager avatar
   - Manager name
   - "Top Level" if no manager

5. **Team Members** (120px)
   - Badge count of direct reports
   - Purple theme

6. **Assigned Leads** (140px)
   - Badge count
   - "View Leads" button
   - Sortable

7. **Status** (100px)
   - Active/Inactive tag
   - Filterable

8. **Actions** (120px)
   - Edit button (blue)
   - Delete button (red)

### Drawer Form (Add/Edit User)
- Full Name input
- Email input (validated)
- Phone input
- Password input (create only)
- Role dropdown (4 options)
- Reports To dropdown (searchable)
- Status dropdown (Active/Inactive)

### Leads Modal
Shows all leads assigned to selected user:
- Lead ID
- Lead name
- Course interested
- Status (color-coded tag)
- AI Score (percentage)

---

## 🔒 Security Considerations

### Current Implementation (Development)
- Passwords stored as plain text
- No authentication/authorization
- All endpoints publicly accessible

### Production Recommendations
1. **Password Hashing:**
   ```python
   from passlib.context import CryptContext
   pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
   hashed = pwd_context.hash(password)
   ```

2. **JWT Authentication:**
   - Add login endpoint
   - Issue JWT tokens
   - Validate tokens on protected routes

3. **Role-Based Access Control (RBAC):**
   - Super Admin: Full access
   - Manager: Access to their teams
   - Team Leader: Access to their counselors
   - Counselor: Access to their own data only

4. **Data Validation:**
   - Email format validation
   - Phone number validation
   - Strong password requirements

---

## 📱 Usage Guide

### Adding a New User

1. Click **"Add User"** button (top right)
2. Fill in the form:
   - Enter full name
   - Enter valid email
   - Enter phone number
   - Create password (min 6 chars)
   - Select role
   - Select manager (optional)
   - Set status
3. Click **"Create"**
4. User appears in table/hierarchy

### Editing a User

1. Find user in table
2. Click **Edit** button (blue icon)
3. Drawer opens with pre-filled data
4. Modify fields
5. Click **"Update"**
6. Changes reflected immediately

### Viewing User's Leads

1. Find user in table
2. Click **"View Leads"** button
3. Modal opens showing all assigned leads
4. See lead details, status, AI scores
5. Click outside to close

### Switching Views

- **Table View:** Click "Table View" button (TeamOutlined icon)
- **Hierarchy View:** Click "Hierarchy" button (ApartmentOutlined icon)

### Filtering

**By Role:**
- Click column filter icon
- Select: All Roles, Super Admin, Manager, Team Leader, or Counselor

**By Status:**
- Click status filter icon
- Select: All, Active, or Inactive

**Sorting:**
- Click "Assigned Leads" column header
- Sorts by lead count (ascending/descending)

---

## 🧪 Testing

### Test User Credentials

```
Super Admin:
- Email: sarah.johnson@crm.com
- Password: admin123

Manager:
- Email: michael.chen@crm.com
- Password: manager123

Team Leader:
- Email: david.martinez@crm.com
- Password: leader123

Counselor:
- Email: james.wilson@crm.com
- Password: counselor123
```

### Test Scenarios

1. **Create User:**
   - Test all role types
   - Test with/without manager
   - Test email validation

2. **Update User:**
   - Change role
   - Change manager
   - Toggle active status

3. **Delete User:**
   - Delete counselor
   - Delete team leader (check subordinates)
   - Cancel deletion

4. **View Hierarchy:**
   - Expand/collapse teams
   - Verify reporting lines
   - Check lead counts

5. **Filter & Sort:**
   - Filter by each role
   - Filter by status
   - Sort by leads

---

## 🚀 Future Enhancements

### Planned Features

1. **Performance Metrics:**
   - Conversion rates per user
   - Revenue generated
   - Average response time

2. **Team Dashboard:**
   - Team performance overview
   - Leaderboards
   - Goal tracking

3. **Bulk Operations:**
   - Bulk user import (CSV)
   - Bulk status updates
   - Mass reassignment

4. **Advanced Hierarchy:**
   - Drag-and-drop reorganization
   - Multiple managers support
   - Matrix organization

5. **Permissions System:**
   - Granular permissions
   - Custom roles
   - Feature access control

6. **User Activity:**
   - Login history
   - Activity logs
   - Audit trail

7. **Notifications:**
   - New team member alerts
   - Lead assignment notifications
   - Performance reports

---

## 🐛 Troubleshooting

### Issue: Users not appearing in hierarchy
**Solution:** Check that `reports_to` is set correctly and forms valid tree structure

### Issue: Cannot delete user
**Solution:** Check if user has subordinates; reassign them first

### Issue: Duplicate email error
**Solution:** Each email must be unique; check existing users

### Issue: Leads modal shows no data
**Solution:** Verify lead's `assigned_to` field matches user's `full_name`

### Issue: Tree view empty
**Solution:** Ensure at least one user has `reports_to: null` (top level)

---

## 📞 Support

For issues or questions:
1. Check this documentation
2. Verify API endpoints are running (http://localhost:8000/docs)
3. Check browser console for errors
4. Review backend logs

---

## 🎉 Summary

The User Management System provides:
✅ 4-level organizational hierarchy
✅ Visual tree and table views
✅ Complete CRUD operations
✅ Lead assignment tracking
✅ Real-time stats and analytics
✅ Intuitive UI with Ant Design
✅ RESTful API backend
✅ Scalable architecture

**Access the page:** http://localhost:3000/users
