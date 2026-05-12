# 📊 CRM Pages & Access Control Guide

## 🎯 Total Pages: 14 Pages

### 📋 Complete Page List & Access Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PAGE ACCESS MATRIX                              │
├──────────────────────┬────────┬────────────┬─────────┬─────────┬────────┤
│ Page                 │ Admin  │ Counsellor │ Manager │ Finance │ Public │
├──────────────────────┼────────┼────────────┼─────────┼─────────┼────────┤
│ 1. Dashboard         │   ✅   │     ✅     │    ✅   │   ✅    │   ❌   │
│ 2. Leads             │   ✅   │     ✅     │    ✅   │   ✅    │   ❌   │
│ 3. Lead Details      │   ✅   │     ✅     │    ✅   │   ✅    │   ❌   │
│ 4. Pipeline          │   ✅   │     ✅     │    ✅   │   ✅    │   ❌   │
│ 5. Lead Analysis     │   ✅   │     ✅     │    ✅   │   ✅    │   ❌   │
│ 6. Analytics         │   ✅   │     ✅     │    ✅   │   ✅    │   ❌   │
│ 7. Hospitals         │   ✅   │     ✅     │    ✅   │   ✅    │   ✅   │
│ 8. Courses           │   ✅   │     ✅     │    ✅   │   ✅    │   ✅   │
│ 9. Team (Users)      │   ✅   │     ❌     │    ✅   │   ❌    │   ❌   │
│ 10. User Activity    │   ✅   │     ❌     │    ✅   │   ❌    │   ❌   │
│ 11. Audit Logs       │   ✅   │     ❌     │    ❌   │   ❌    │   ❌   │
└──────────────────────┴────────┴────────────┴─────────┴─────────┴────────┘
```

---

## 🔐 Role-Based Access Breakdown

### 1️⃣ ADMIN (Superuser) - 11 Pages
**Can see everything:**
- ✅ Dashboard (Admin view with org-wide stats)
- ✅ Leads (all leads)
- ✅ Lead Details (any lead)
- ✅ Pipeline (all leads)
- ✅ Lead Analysis (team analytics)
- ✅ Analytics (full dashboard)
- ✅ Hospitals
- ✅ Courses
- ✅ Team (Users Management)
- ✅ User Activity
- ✅ **Audit Logs** (admin only)

**Sidebar Menu Items Shown:** 11 items

---

### 2️⃣ COUNSELLOR (Sales Rep) - 8 Pages
**Can see own data:**
- ✅ Dashboard (Counsellor view - personal stats)
- ✅ Leads (own leads only)
- ✅ Lead Details (own leads only)
- ✅ Pipeline (own leads only)
- ✅ Lead Analysis (own analytics)
- ✅ Analytics (own performance)
- ✅ Hospitals (view only)
- ✅ Courses (view only)
- ❌ Team (Users) - **HIDDEN**
- ❌ User Activity - **HIDDEN**
- ❌ Audit Logs - **HIDDEN**

**Sidebar Menu Items Shown:** 8 items

**Data Restrictions:**
- Sees ONLY their assigned leads
- Cannot view other counsellors' data
- Cannot manage users
- Cannot access audit logs

---

### 3️⃣ MANAGER (Team Lead) - 10 Pages
**Can see team data:**
- ✅ Dashboard (Admin view with team focus)
- ✅ Leads (all team leads)
- ✅ Lead Details (any lead)
- ✅ Pipeline (all team leads)
- ✅ Lead Analysis (team analytics)
- ✅ Analytics (team performance)
- ✅ Hospitals
- ✅ Courses
- ✅ Team (Users) - can view team
- ✅ User Activity - can monitor team
- ❌ Audit Logs - **HIDDEN**

**Sidebar Menu Items Shown:** 10 items

**Permissions:**
- Can assign leads to team members
- Can view all team members' leads
- Can export reports
- **Cannot** access audit logs
- **Cannot** manage system settings

---

### 4️⃣ FINANCE (Accounts) - 8 Pages
**Can see revenue data:**
- ✅ Dashboard (Admin view with revenue focus)
- ✅ Leads (read-only, all leads)
- ✅ Lead Details (read-only, payment focus)
- ✅ Pipeline (read-only)
- ✅ Lead Analysis (financial metrics)
- ✅ Analytics (revenue dashboards)
- ✅ Hospitals
- ✅ Courses
- ❌ Team (Users) - **HIDDEN**
- ❌ User Activity - **HIDDEN**
- ❌ Audit Logs - **HIDDEN**

**Sidebar Menu Items Shown:** 8 items

**Permissions:**
- Can manage payments
- Can export financial data
- **Cannot** create/edit leads (read-only)
- **Cannot** manage users
- **Cannot** assign leads

---

## 🗺️ Route Paths

| # | Route Path | Component | Protected |
|---|------------|-----------|-----------|
| 1 | `/` | Redirect to `/dashboard` | No |
| 2 | `/dashboard` | RoleBasedDashboard | Yes (any authenticated user) |
| 3 | `/leads` | LeadsPageEnhanced | Yes (requires VIEW_OWN_LEADS or VIEW_ALL_LEADS) |
| 4 | `/leads/:leadId` | LeadDetails | Yes (requires VIEW_OWN_LEADS or VIEW_ALL_LEADS) |
| 5 | `/pipeline` | DragDropPipeline | Yes (requires VIEW_OWN_LEADS or VIEW_ALL_LEADS) |
| 6 | `/lead-analysis` | LeadAnalysisPage | Yes (requires VIEW_ANALYTICS) |
| 7 | `/analytics` | AnalyticsPage | Yes (requires VIEW_ANALYTICS) |
| 8 | `/hospitals` | HospitalsPage | No (public to logged-in users) |
| 9 | `/courses` | CoursesPageEnhanced | No (public to logged-in users) |
| 10 | `/users` | UsersPage | Yes (requires VIEW_USERS) |
| 11 | `/user-activity` | UserActivityPage | Yes (requires VIEW_USERS) |
| 12 | `/audit-logs` | AuditLogs | Yes (requires VIEW_AUDIT_LOGS - Admin only) |

---

## 🎨 Dashboard Views (Same Route, Different Content)

The `/dashboard` route shows **different dashboards** based on role:

### Admin Dashboard
- Total Revenue (₹15.2L)
- Total Leads (all time)
- Team Performance (avg conversion %)
- Active Users count
- Revenue trend chart (30 days)
- Funnel leakage analysis
- Team performance comparison

### Counsellor Dashboard
- My Leads count
- Today's Follow-ups
- My Conversion Rate
- My Revenue
- Performance trend (7 days)
- Lead distribution chart (Hot/Warm/Cold)
- Today's urgent follow-ups list

### Manager Dashboard
- Same as Admin Dashboard
- Focus on team metrics
- Can drill down by team member

### Finance Dashboard
- Same as Admin Dashboard
- Focus on revenue metrics
- Payment tracking emphasis

---

## 🔒 How Protection Works

### ProtectedRoute Component
```javascript
<ProtectedRoute route="/users">
  <UsersPage />
</ProtectedRoute>
```

**Logic:**
1. Gets user from `localStorage`
2. Checks `canAccessRoute(userRole, route)`
3. If no permission → Shows **403 Forbidden** page
4. If authorized → Renders the page

### Sidebar Menu Filtering
```javascript
menuItems.filter(item => 
  !item.permission || hasPermission(userRole, item.permission)
)
```

**Result:** Users only see menu items they can access

---

## 🚫 Forbidden Page (403)

When user tries to access unauthorized page:
- 🔒 Lock icon displayed
- "Access Denied" message
- "You don't have permission to access this page."
- "Go Back" button

---

## 📱 Current Implementation Status

✅ **11 pages fully implemented**
✅ **RBAC protection active**
✅ **Role-based dashboards working**
✅ **Sidebar filtering by permissions**
✅ **403 error page for unauthorized access**

---

## 🎯 Quick Reference: Who Sees What

| Feature | Admin | Counsellor | Manager | Finance |
|---------|-------|------------|---------|---------|
| **Total Pages** | 11 | 8 | 10 | 8 |
| **All Leads** | ✅ | ❌ (own only) | ✅ | ✅ (read-only) |
| **Create/Edit Leads** | ✅ | ✅ | ✅ | ❌ |
| **Assign Leads** | ✅ | ❌ | ✅ | ❌ |
| **Team Management** | ✅ | ❌ | ✅ | ❌ |
| **Audit Logs** | ✅ | ❌ | ❌ | ❌ |
| **Payment Management** | ✅ | ❌ | ❌ | ✅ |
| **Export Reports** | ✅ | ❌ | ✅ | ✅ |

---

## 🔧 Testing Different Roles

To test different role views:

### Set User Role in localStorage:
```javascript
// Admin
localStorage.setItem('user', JSON.stringify({ 
  role: 'admin', 
  name: 'Admin User' 
}));

// Counsellor
localStorage.setItem('user', JSON.stringify({ 
  role: 'counsellor', 
  name: 'John Doe' 
}));

// Manager
localStorage.setItem('user', JSON.stringify({ 
  role: 'manager', 
  name: 'Jane Manager' 
}));

// Finance
localStorage.setItem('user', JSON.stringify({ 
  role: 'finance', 
  name: 'Bob Finance' 
}));
```

Then **refresh the page** to see role-specific menu and access.

---

## 🎓 Summary

- **Total Pages:** 11 unique pages + 1 redirect
- **Public Pages:** 2 (Hospitals, Courses - but require login)
- **Protected Pages:** 9 (require specific permissions)
- **Admin-Only Pages:** 1 (Audit Logs)
- **Role-Specific Dashboards:** 4 variants of same route

**Navigation is dynamic** - each role sees only what they're allowed to access!
