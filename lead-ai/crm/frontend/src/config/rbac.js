// RBAC Configuration
// Role values must match exactly what the backend stores in the database
export const ROLES = {
  ADMIN: 'Super Admin',
  COUNSELLOR: 'Counselor',
  MANAGER: 'Manager',
  TEAM_LEADER: 'Team Leader',
  FINANCE: 'finance',
};

export const PERMISSIONS = {
  // Lead permissions
  VIEW_ALL_LEADS: 'view_all_leads',
  VIEW_OWN_LEADS: 'view_own_leads',
  CREATE_LEAD: 'create_lead',
  EDIT_LEAD: 'edit_lead',
  DELETE_LEAD: 'delete_lead',
  ASSIGN_LEAD: 'assign_lead',
  
  // User permissions
  VIEW_USERS: 'view_users',
  CREATE_USER: 'create_user',
  EDIT_USER: 'edit_user',
  DELETE_USER: 'delete_user',
  
  // Financial permissions
  VIEW_REVENUE: 'view_revenue',
  VIEW_ALL_REVENUE: 'view_all_revenue',
  MANAGE_PAYMENTS: 'manage_payments',
  EXPORT_FINANCIAL_DATA: 'export_financial_data',
  
  // Analytics permissions
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_TEAM_ANALYTICS: 'view_team_analytics',
  EXPORT_REPORTS: 'export_reports',
  
  // System permissions
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_ROLES: 'manage_roles',
};

export const rolePermissions = {
  [ROLES.ADMIN]: [
    // Full access
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.VIEW_OWN_LEADS,    // Added for menu visibility
    PERMISSIONS.CREATE_LEAD,
    PERMISSIONS.EDIT_LEAD,
    PERMISSIONS.DELETE_LEAD,
    PERMISSIONS.ASSIGN_LEAD,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.CREATE_USER,
    PERMISSIONS.EDIT_USER,
    PERMISSIONS.DELETE_USER,
    PERMISSIONS.VIEW_REVENUE,      // Added for completeness
    PERMISSIONS.VIEW_ALL_REVENUE,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.EXPORT_FINANCIAL_DATA,
    PERMISSIONS.VIEW_ANALYTICS,    // Added for menu visibility
    PERMISSIONS.VIEW_TEAM_ANALYTICS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.MANAGE_ROLES,
  ],
  
  [ROLES.COUNSELLOR]: [
    // Limited to own leads
    PERMISSIONS.VIEW_OWN_LEADS,
    PERMISSIONS.CREATE_LEAD,
    PERMISSIONS.EDIT_LEAD,
    PERMISSIONS.VIEW_REVENUE, // Own revenue only
    PERMISSIONS.VIEW_ANALYTICS, // Own analytics only
  ],
  
  [ROLES.MANAGER]: [
    // Team management
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.CREATE_LEAD,
    PERMISSIONS.EDIT_LEAD,
    PERMISSIONS.ASSIGN_LEAD,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_ALL_REVENUE,
    PERMISSIONS.VIEW_TEAM_ANALYTICS,
    PERMISSIONS.EXPORT_REPORTS,
  ],
  
  [ROLES.TEAM_LEADER]: [
    // Team lead - between counselor and manager
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.CREATE_LEAD,
    PERMISSIONS.EDIT_LEAD,
    PERMISSIONS.ASSIGN_LEAD,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_ALL_REVENUE,
    PERMISSIONS.VIEW_TEAM_ANALYTICS,
    PERMISSIONS.EXPORT_REPORTS,
  ],

  [ROLES.FINANCE]: [
    // Financial focus
    PERMISSIONS.VIEW_ALL_LEADS, // Read-only
    PERMISSIONS.VIEW_ALL_REVENUE,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.EXPORT_FINANCIAL_DATA,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
};

export const hasPermission = (userRole, permission) => {
  // All permissions granted - authentication disabled
  return true;
};

export const hasAnyPermission = (userRole, permissionList) => {
  // All permissions granted - authentication disabled
  return true;
};

export const canAccessRoute = (userRole, route) => {
  // All routes accessible - authentication disabled
  return true;
};
