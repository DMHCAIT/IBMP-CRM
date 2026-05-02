# 🚀 Quick Start - How to See Pages

## ❗ Problem: Pages Not Showing

**Root Cause:** No user role is set in localStorage, so RBAC protection is blocking access.

---

## ✅ Solution: Set a User Role

### Option 1: Use the Role Selector Page (EASIEST)

1. **Open this URL in your browser:**
   ```
   http://localhost:3000/set-role.html
   ```

2. **Click on a role card:**
   - 👑 **Admin** - See all 11 pages
   - 📊 **Manager** - See 10 pages
   - 💼 **Counsellor** - See 8 pages (own data only)
   - 💰 **Finance** - See 8 pages (revenue focus)

3. **Click "Set Role"** button

4. **App will automatically redirect** to dashboard with your selected role!

---

### Option 2: Use Browser Console (MANUAL)

1. **Open browser DevTools** (F12 or Right-click → Inspect)

2. **Go to Console tab**

3. **Paste ONE of these commands:**

```javascript
// For ADMIN (see all 11 pages)
localStorage.setItem('user', JSON.stringify({ 
  id: '1',
  role: 'admin', 
  name: 'Admin User',
  email: 'admin@medcrm.com'
}));

// For MANAGER (see 10 pages)
localStorage.setItem('user', JSON.stringify({ 
  id: '2',
  role: 'manager', 
  name: 'Manager User',
  email: 'manager@medcrm.com'
}));

// For COUNSELLOR (see 8 pages - own data)
localStorage.setItem('user', JSON.stringify({ 
  id: '3',
  role: 'counsellor', 
  name: 'John Counsellor',
  email: 'john@medcrm.com'
}));

// For FINANCE (see 8 pages - revenue focus)
localStorage.setItem('user', JSON.stringify({ 
  id: '4',
  role: 'finance', 
  name: 'Bob Finance',
  email: 'bob@medcrm.com'
}));
```

4. **Press Enter**

5. **Refresh the page** (F5 or Cmd+R)

---

## 📊 What You'll See After Setting Role

### Admin Role → 11 Menu Items:
```
✅ Dashboard
✅ Leads
✅ Pipeline
✅ Lead Analysis
✅ Hospitals
✅ Courses
✅ Team
✅ User Activity
✅ Analytics
✅ Audit Logs    ← Only Admin can see this!
```

### Manager Role → 10 Menu Items:
```
✅ Dashboard
✅ Leads
✅ Pipeline
✅ Lead Analysis
✅ Hospitals
✅ Courses
✅ Team
✅ User Activity
✅ Analytics
❌ Audit Logs    ← Hidden for Manager
```

### Counsellor Role → 8 Menu Items:
```
✅ Dashboard     (shows personal stats)
✅ Leads         (only YOUR leads)
✅ Pipeline      (only YOUR leads)
✅ Lead Analysis (only YOUR data)
✅ Hospitals
✅ Courses
✅ Analytics     (only YOUR performance)
❌ Team          ← Hidden
❌ User Activity ← Hidden
❌ Audit Logs    ← Hidden
```

### Finance Role → 8 Menu Items:
```
✅ Dashboard     (revenue focus)
✅ Leads         (read-only)
✅ Pipeline      (read-only)
✅ Lead Analysis (financial metrics)
✅ Hospitals
✅ Courses
✅ Analytics     (revenue dashboards)
❌ Team          ← Hidden
❌ User Activity ← Hidden
❌ Audit Logs    ← Hidden
```

---

## 🔄 Switch Roles Anytime

To test different roles:

1. **Go to:** http://localhost:3000/set-role.html
2. **Select a different role**
3. **Click "Set Role"**
4. **App reloads with new role!**

---

## 📱 Current App Status

✅ **App running at:** http://localhost:3000  
✅ **Role selector at:** http://localhost:3000/set-role.html  
✅ **All 11 pages working**  
✅ **RBAC protection active**  
✅ **Smart menu filtering enabled**

---

## 🎯 Recommended Testing Flow

1. **Start as ADMIN** to see all features
2. **Switch to COUNSELLOR** to see restricted view
3. **Try accessing** `/audit-logs` as Counsellor → See 403 Forbidden page
4. **Switch to MANAGER** to see team features
5. **Switch to FINANCE** to see revenue focus

---

## 💡 Pro Tips

- **Sidebar shows only allowed pages** - menu items auto-filter by role
- **Try clicking restricted pages** - you'll see a nice 403 error page
- **Different dashboard per role** - same URL, different content
- **Check notifications** - Smart Notifications bell shows in header

---

## 🐛 Troubleshooting

### "No pages showing in sidebar"
→ Set a user role using steps above

### "Getting 403 Forbidden"
→ Your role doesn't have permission for that page

### "Dashboard is blank"
→ Backend API not running (expected - frontend only for now)

### "Changes not appearing"
→ Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

---

## 📚 Documentation Files

1. **PAGE_ACCESS_GUIDE.md** - Complete access matrix
2. **ARCHITECTURE_DIAGRAM.md** - System architecture
3. **ENTERPRISE_FEATURES.md** - Feature documentation
4. **TANSTACK_QUERY_V5_MIGRATION.md** - Query migration guide

---

**🎉 You're all set! Go to http://localhost:3000/set-role.html to get started!**
