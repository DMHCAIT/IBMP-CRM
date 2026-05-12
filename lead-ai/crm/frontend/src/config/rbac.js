/**
 * RBAC — Role-Based Access Control
 *
 * Department structure (from DMHCA CRM Structure Plan):
 *   CEO          → Full CRM access, all reports
 *   Marketing    → Lead generation, campaigns, CPL/ROAS
 *   Sales        → Calling, counseling, follow-ups, WhatsApp
 *   Academic     → Student docs, university processing, application tracking
 *   Accounts     → Fee collection, invoices, pending payments, revenue
 *   HR           → Employee mgmt, attendance, recruitment, performance
 *   Super Admin  → Everything (IT/system level)
 *
 * CRM Workflow:
 *   Marketing → Sales → Academic → Accounts → Enrollment Complete
 */

// ── Roles ─────────────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN:        'Super Admin',
  CEO:                'CEO',
  // Marketing department
  MARKETING_MANAGER:  'Marketing Manager',
  MARKETING_EXEC:     'Marketing Executive',
  // Sales department
  SALES_MANAGER:      'Sales Manager',
  COUNSELOR:          'Counselor',
  TEAM_LEADER:        'Team Leader',
  // Academic / Admin department
  ACADEMIC_ADMIN:     'Academic Admin',
  ACADEMIC_EXEC:      'Academic Executive',
  // Accounts department
  ACCOUNTS_MANAGER:   'Accounts Manager',
  FINANCE_EXEC:       'Finance Executive',
  // HR department
  HR_MANAGER:         'HR Manager',
  HR_EXEC:            'HR Executive',
  // Legacy aliases (keep for backward compat with existing DB values)
  MANAGER:            'Manager',
  FINANCE:            'finance',
};

// ── Departments ────────────────────────────────────────────────────────────
export const DEPARTMENTS = {
  CEO:       'CEO',
  MARKETING: 'Marketing',
  SALES:     'Sales',
  ACADEMIC:  'Academic',
  ACCOUNTS:  'Accounts',
  HR:        'HR',
  ADMIN:     'Admin',
};

/** Map any role string → its department */
export function getDepartment(role) {
  const map = {
    [ROLES.SUPER_ADMIN]:       DEPARTMENTS.ADMIN,
    [ROLES.CEO]:               DEPARTMENTS.CEO,
    [ROLES.MARKETING_MANAGER]: DEPARTMENTS.MARKETING,
    [ROLES.MARKETING_EXEC]:    DEPARTMENTS.MARKETING,
    [ROLES.SALES_MANAGER]:     DEPARTMENTS.SALES,
    [ROLES.COUNSELOR]:         DEPARTMENTS.SALES,
    [ROLES.TEAM_LEADER]:       DEPARTMENTS.SALES,
    [ROLES.ACADEMIC_ADMIN]:    DEPARTMENTS.ACADEMIC,
    [ROLES.ACADEMIC_EXEC]:     DEPARTMENTS.ACADEMIC,
    [ROLES.ACCOUNTS_MANAGER]:  DEPARTMENTS.ACCOUNTS,
    [ROLES.FINANCE_EXEC]:      DEPARTMENTS.ACCOUNTS,
    [ROLES.HR_MANAGER]:        DEPARTMENTS.HR,
    [ROLES.HR_EXEC]:           DEPARTMENTS.HR,
    // legacy
    [ROLES.MANAGER]:           DEPARTMENTS.SALES,
    [ROLES.FINANCE]:           DEPARTMENTS.ACCOUNTS,
  };
  return map[role] || DEPARTMENTS.SALES;
}

/** Department display label + color for badges */
export const DEPT_META = {
  [DEPARTMENTS.CEO]:       { label: 'CEO',       color: '#7c3aed', bg: '#ede9fe' },
  [DEPARTMENTS.MARKETING]: { label: 'Marketing', color: '#d97706', bg: '#fef3c7' },
  [DEPARTMENTS.SALES]:     { label: 'Sales',     color: '#2563eb', bg: '#dbeafe' },
  [DEPARTMENTS.ACADEMIC]:  { label: 'Academic',  color: '#059669', bg: '#d1fae5' },
  [DEPARTMENTS.ACCOUNTS]:  { label: 'Accounts',  color: '#dc2626', bg: '#fee2e2' },
  [DEPARTMENTS.HR]:        { label: 'HR',         color: '#db2777', bg: '#fce7f3' },
  [DEPARTMENTS.ADMIN]:     { label: 'IT / Admin', color: '#374151', bg: '#f3f4f6' },
};

// ── Permissions ────────────────────────────────────────────────────────────
export const PERMISSIONS = {
  // Leads
  VIEW_ALL_LEADS:       'view_all_leads',
  VIEW_OWN_LEADS:       'view_own_leads',
  CREATE_LEAD:          'create_lead',
  EDIT_LEAD:            'edit_lead',
  DELETE_LEAD:          'delete_lead',
  ASSIGN_LEAD:          'assign_lead',
  EXPORT_LEADS:         'export_leads',

  // Pipeline / Sales workflow
  VIEW_PIPELINE:        'view_pipeline',
  MANAGE_PIPELINE:      'manage_pipeline',
  VIEW_FOLLOWUPS:       'view_followups',

  // Users / team
  VIEW_USERS:           'view_users',
  CREATE_USER:          'create_user',
  EDIT_USER:            'edit_user',
  DELETE_USER:          'delete_user',

  // Financial
  VIEW_REVENUE:         'view_revenue',
  VIEW_ALL_REVENUE:     'view_all_revenue',
  MANAGE_PAYMENTS:      'manage_payments',
  EXPORT_FINANCIAL:     'export_financial',

  // Analytics / reports
  VIEW_ANALYTICS:       'view_analytics',
  VIEW_TEAM_ANALYTICS:  'view_team_analytics',
  EXPORT_REPORTS:       'export_reports',
  VIEW_CAMPAIGNS:       'view_campaigns',
  MANAGE_CAMPAIGNS:     'manage_campaigns',

  // Academic module
  VIEW_ACADEMIC:        'view_academic',
  MANAGE_ACADEMIC:      'manage_academic',

  // HR module
  VIEW_HR:              'view_hr',
  MANAGE_HR:            'manage_hr',

  // System
  MANAGE_SETTINGS:      'manage_settings',
  VIEW_AUDIT_LOGS:      'view_audit_logs',
  MANAGE_ROLES:         'manage_roles',
};

const P = PERMISSIONS;

// ── Role → Permissions map ─────────────────────────────────────────────────
export const rolePermissions = {
  [ROLES.SUPER_ADMIN]: Object.values(P), // everything

  [ROLES.CEO]: Object.values(P), // full access — same as Super Admin visibility

  [ROLES.MARKETING_MANAGER]: [
    P.VIEW_ALL_LEADS, P.CREATE_LEAD, P.EDIT_LEAD, P.ASSIGN_LEAD, P.EXPORT_LEADS,
    P.VIEW_ANALYTICS, P.VIEW_TEAM_ANALYTICS, P.EXPORT_REPORTS,
    P.VIEW_CAMPAIGNS, P.MANAGE_CAMPAIGNS,
    P.VIEW_USERS,
    P.VIEW_REVENUE,
  ],

  [ROLES.MARKETING_EXEC]: [
    P.VIEW_ALL_LEADS, P.CREATE_LEAD, P.EDIT_LEAD, P.EXPORT_LEADS,
    P.VIEW_ANALYTICS,
    P.VIEW_CAMPAIGNS, P.MANAGE_CAMPAIGNS,
    P.VIEW_REVENUE,
  ],

  [ROLES.SALES_MANAGER]: [
    P.VIEW_ALL_LEADS, P.CREATE_LEAD, P.EDIT_LEAD, P.ASSIGN_LEAD, P.DELETE_LEAD, P.EXPORT_LEADS,
    P.VIEW_PIPELINE, P.MANAGE_PIPELINE,
    P.VIEW_FOLLOWUPS,
    P.VIEW_USERS,
    P.VIEW_ALL_REVENUE, P.VIEW_REVENUE,
    P.VIEW_ANALYTICS, P.VIEW_TEAM_ANALYTICS, P.EXPORT_REPORTS,
  ],

  [ROLES.TEAM_LEADER]: [
    P.VIEW_ALL_LEADS, P.CREATE_LEAD, P.EDIT_LEAD, P.ASSIGN_LEAD, P.EXPORT_LEADS,
    P.VIEW_PIPELINE, P.MANAGE_PIPELINE,
    P.VIEW_FOLLOWUPS,
    P.VIEW_USERS,
    P.VIEW_ALL_REVENUE,
    P.VIEW_ANALYTICS, P.VIEW_TEAM_ANALYTICS, P.EXPORT_REPORTS,
  ],

  [ROLES.COUNSELOR]: [
    P.VIEW_OWN_LEADS, P.CREATE_LEAD, P.EDIT_LEAD,
    P.VIEW_PIPELINE,
    P.VIEW_FOLLOWUPS,
    P.VIEW_REVENUE,
    P.VIEW_ANALYTICS,
  ],

  [ROLES.ACADEMIC_ADMIN]: [
    P.VIEW_ALL_LEADS, P.EDIT_LEAD,
    P.VIEW_ACADEMIC, P.MANAGE_ACADEMIC,
    P.VIEW_ANALYTICS,
    P.EXPORT_REPORTS,
  ],

  [ROLES.ACADEMIC_EXEC]: [
    P.VIEW_ALL_LEADS,
    P.VIEW_ACADEMIC, P.MANAGE_ACADEMIC,
    P.VIEW_ANALYTICS,
  ],

  [ROLES.ACCOUNTS_MANAGER]: [
    P.VIEW_ALL_LEADS,
    P.VIEW_ALL_REVENUE, P.VIEW_REVENUE, P.MANAGE_PAYMENTS, P.EXPORT_FINANCIAL,
    P.VIEW_ANALYTICS, P.EXPORT_REPORTS,
  ],

  [ROLES.FINANCE_EXEC]: [
    P.VIEW_ALL_LEADS,
    P.VIEW_REVENUE, P.VIEW_ALL_REVENUE, P.MANAGE_PAYMENTS, P.EXPORT_FINANCIAL,
    P.VIEW_ANALYTICS,
  ],

  [ROLES.HR_MANAGER]: [
    P.VIEW_USERS, P.CREATE_USER, P.EDIT_USER,
    P.VIEW_HR, P.MANAGE_HR,
    P.VIEW_ANALYTICS, P.EXPORT_REPORTS,
  ],

  [ROLES.HR_EXEC]: [
    P.VIEW_USERS,
    P.VIEW_HR, P.MANAGE_HR,
    P.VIEW_ANALYTICS,
  ],

  // Legacy aliases
  [ROLES.MANAGER]: [
    P.VIEW_ALL_LEADS, P.CREATE_LEAD, P.EDIT_LEAD, P.ASSIGN_LEAD, P.EXPORT_LEADS,
    P.VIEW_PIPELINE, P.MANAGE_PIPELINE, P.VIEW_FOLLOWUPS,
    P.VIEW_USERS,
    P.VIEW_ALL_REVENUE,
    P.VIEW_ANALYTICS, P.VIEW_TEAM_ANALYTICS, P.EXPORT_REPORTS,
  ],

  [ROLES.FINANCE]: [
    P.VIEW_ALL_LEADS,
    P.VIEW_ALL_REVENUE, P.MANAGE_PAYMENTS, P.EXPORT_FINANCIAL,
    P.VIEW_ANALYTICS,
  ],
};

// ── Permission helpers ─────────────────────────────────────────────────────

function getPermissions(role) {
  return rolePermissions[role] || [];
}

export function hasPermission(userRole, permission) {
  return getPermissions(userRole).includes(permission);
}

export function hasAnyPermission(userRole, permissionList) {
  const perms = getPermissions(userRole);
  return permissionList.some(p => perms.includes(p));
}

export function hasAllPermissions(userRole, permissionList) {
  const perms = getPermissions(userRole);
  return permissionList.every(p => perms.includes(p));
}

// ── Route-level access ─────────────────────────────────────────────────────
const ROUTE_PERMISSIONS = {
  '/dashboard':            [],  // everyone gets a dashboard
  '/leads':                [P.VIEW_ALL_LEADS, P.VIEW_OWN_LEADS],
  '/leads/:id':            [P.VIEW_ALL_LEADS, P.VIEW_OWN_LEADS],
  '/followups':            [P.VIEW_FOLLOWUPS],
  '/pipeline':             [P.VIEW_PIPELINE],
  '/lead-analysis':        [P.VIEW_ANALYTICS],
  '/analytics':            [P.VIEW_ANALYTICS],
  '/campaigns':            [P.VIEW_CAMPAIGNS],
  '/hospitals':            [P.VIEW_ALL_LEADS],
  '/courses':              [P.VIEW_ALL_LEADS],
  '/payments':             [P.VIEW_REVENUE],
  '/users':                [P.VIEW_USERS],
  '/user-activity':        [P.VIEW_TEAM_ANALYTICS],
  '/lead-update-activity': [P.VIEW_TEAM_ANALYTICS],
  '/audit-logs':           [P.VIEW_AUDIT_LOGS],
  '/conversion-time':      [P.VIEW_ANALYTICS],
  '/cohort-analysis':      [P.VIEW_ANALYTICS],
  '/sla':                  [P.VIEW_ANALYTICS],
  '/score-decay':          [P.VIEW_ANALYTICS],
  '/settings':             [P.MANAGE_SETTINGS],
  '/academic':             [P.VIEW_ACADEMIC],
  '/hr':                   [P.VIEW_HR],
};

export function canAccessRoute(userRole, route) {
  const normalised = route.replace(/\/\d+$/, '/:id');
  const required = ROUTE_PERMISSIONS[normalised];
  if (!required) return true;           // unknown route — allow
  if (required.length === 0) return true; // no restriction
  return hasAnyPermission(userRole, required);
}

// ── Nav groups ─────────────────────────────────────────────────────────────
// Groups are collapsible sections in the sidebar.
// 'null' group = top-level item (no section header, never collapsible)
export const NAV_GROUPS = {
  SALES:    { key: 'sales',    label: 'Sales',    icon: 'UserPlus',     color: '#2563eb' },
  MARKETING:{ key: 'marketing',label: 'Marketing',icon: 'Megaphone',    color: '#d97706' },
  ACADEMIC: { key: 'academic', label: 'Academic', icon: 'GraduationCap',color: '#059669' },
  ACCOUNTS: { key: 'accounts', label: 'Accounts', icon: 'DollarSign',   color: '#dc2626' },
  HR:       { key: 'hr',       label: 'HR',        icon: 'UserCog',     color: '#db2777' },
  REPORTS:  { key: 'reports',  label: 'Reports',   icon: 'BarChart3',   color: '#7c3aed' },
  SYSTEM:   { key: 'system',   label: 'System',    icon: 'Settings',    color: '#374151' },
};

// ── Nav menu items per role ────────────────────────────────────────────────
// Each item: { key, label, path, icon, group (null = top-level), depts }
export function getNavItemsForRole(role) {
  const dept = getDepartment(role);
  const perms = getPermissions(role);

  const G = NAV_GROUPS;
  const D = DEPARTMENTS;

  const all = [
    // ── Top-level (no group) ──────────────────────────────────────────────
    { key: 'dashboard',            label: 'Dashboard',        path: '/dashboard',            icon: 'LayoutDashboard', group: null,        depts: 'ALL' },

    // ── Sales ─────────────────────────────────────────────────────────────
    { key: 'followups',            label: 'Follow-ups Today', path: '/followups',            icon: 'CalendarClock',   group: G.SALES,     depts: [D.SALES, D.CEO, D.ADMIN] },
    { key: 'leads',                label: 'Leads',            path: '/leads',                icon: 'UserPlus',        group: G.SALES,     depts: [D.SALES, D.MARKETING, D.CEO, D.ADMIN, D.ACADEMIC, D.ACCOUNTS] },
    { key: 'pipeline',             label: 'Pipeline',         path: '/pipeline',             icon: 'GitBranch',       group: G.SALES,     depts: [D.SALES, D.CEO, D.ADMIN] },
    { key: 'lead-analysis',        label: 'Lead Analysis',    path: '/lead-analysis',        icon: 'TrendingUp',      group: G.SALES,     depts: [D.SALES, D.CEO, D.ADMIN] },

    // ── Marketing ─────────────────────────────────────────────────────────
    { key: 'campaigns',            label: 'Campaigns',        path: '/campaigns',            icon: 'Megaphone',       group: G.MARKETING, depts: [D.MARKETING, D.CEO, D.ADMIN] },
    { key: 'analytics',            label: 'Analytics',        path: '/analytics',            icon: 'BarChart3',       group: G.MARKETING, depts: [D.SALES, D.MARKETING, D.CEO, D.ADMIN, D.ACCOUNTS] },

    // ── Academic ──────────────────────────────────────────────────────────
    { key: 'academic',             label: 'Academic',         path: '/academic',             icon: 'GraduationCap',   group: G.ACADEMIC,  depts: [D.ACADEMIC, D.CEO, D.ADMIN] },
    { key: 'hospitals',            label: 'Hospitals',        path: '/hospitals',            icon: 'Hospital',        group: G.ACADEMIC,  depts: [D.SALES, D.ACADEMIC, D.CEO, D.ADMIN] },
    { key: 'courses',              label: 'Courses',          path: '/courses',              icon: 'BookOpen',        group: G.ACADEMIC,  depts: [D.SALES, D.ACADEMIC, D.MARKETING, D.CEO, D.ADMIN] },

    // ── Accounts ──────────────────────────────────────────────────────────
    { key: 'payments',             label: 'Payments',         path: '/payments',             icon: 'DollarSign',      group: G.ACCOUNTS,  depts: [D.ACCOUNTS, D.CEO, D.ADMIN] },

    // ── HR ────────────────────────────────────────────────────────────────
    { key: 'hr',                   label: 'HR',               path: '/hr',                   icon: 'UserCog',         group: G.HR,        depts: [D.HR, D.CEO, D.ADMIN] },
    { key: 'users',                label: 'Users',            path: '/users',                icon: 'Users',           group: G.HR,        depts: [D.HR, D.CEO, D.ADMIN, D.SALES] },
    { key: 'user-activity',        label: 'User Activity',    path: '/user-activity',        icon: 'Activity',        group: G.HR,        depts: [D.CEO, D.ADMIN] },

    // ── Reports ───────────────────────────────────────────────────────────
    { key: 'lead-update-activity', label: 'Lead Activity',    path: '/lead-update-activity', icon: 'ClipboardList',   group: G.REPORTS,   depts: [D.CEO, D.ADMIN, D.SALES] },
    { key: 'conversion-time',      label: 'Conversion Time',  path: '/conversion-time',      icon: 'Timer',           group: G.REPORTS,   depts: [D.SALES, D.CEO, D.ADMIN] },
    { key: 'cohort-analysis',      label: 'Cohort Analysis',  path: '/cohort-analysis',      icon: 'TrendingDown',    group: G.REPORTS,   depts: [D.CEO, D.ADMIN] },
    { key: 'sla',                  label: 'SLA',              path: '/sla',                  icon: 'ShieldCheck',     group: G.REPORTS,   depts: [D.CEO, D.ADMIN, D.SALES] },
    { key: 'score-decay',          label: 'Score Decay',      path: '/score-decay',          icon: 'TrendingDown',    group: G.REPORTS,   depts: [D.CEO, D.ADMIN] },

    // ── System ────────────────────────────────────────────────────────────
    { key: 'audit-logs',           label: 'Audit Logs',       path: '/audit-logs',           icon: 'Shield',          group: G.SYSTEM,    depts: [D.ADMIN, D.CEO] },
    { key: 'settings',             label: 'Settings',         path: '/settings',             icon: 'Settings',        group: G.SYSTEM,    depts: [D.ADMIN, D.CEO] },
  ];

  return all.filter(item => {
    if (item.depts === 'ALL') return true;
    if (!item.depts.includes(dept)) return false;
    const required = ROUTE_PERMISSIONS[item.path] || [];
    if (required.length === 0) return true;
    return required.some(p => perms.includes(p));
  });
}
