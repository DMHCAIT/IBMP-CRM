// Feature flags configuration
export const featureFlags = {
  // Phase 1 - Core AI Features
  AI_INSIGHTS: process.env.REACT_APP_FEATURE_AI_INSIGHTS !== 'false',
  REVENUE_ANALYTICS_BETA: process.env.REACT_APP_FEATURE_REVENUE_ANALYTICS === 'true',
  DRAG_DROP_PIPELINE: process.env.REACT_APP_FEATURE_DRAG_DROP !== 'false',
  SMART_RECOMMENDATIONS: process.env.REACT_APP_FEATURE_SMART_RECOMMENDATIONS !== 'false',
  
  // Phase 2 - Enterprise Features
  ACTIVITY_TIMELINE: process.env.REACT_APP_FEATURE_ACTIVITY_TIMELINE !== 'false',
  SMART_NOTIFICATIONS: process.env.REACT_APP_FEATURE_SMART_NOTIFICATIONS !== 'false',
  ROLE_BASED_DASHBOARDS: process.env.REACT_APP_FEATURE_RBAC !== 'false',
  AUDIT_LOGS: process.env.REACT_APP_FEATURE_AUDIT_LOGS !== 'false',
  GLOBAL_SEARCH: process.env.REACT_APP_FEATURE_GLOBAL_SEARCH === 'true',
  
  // Phase 3 - Advanced Features
  AI_ACTIVITY_SUMMARY: process.env.REACT_APP_FEATURE_AI_SUMMARY !== 'false',
  WEBSOCKET_NOTIFICATIONS: process.env.REACT_APP_FEATURE_WEBSOCKET === 'true',
  PAYMENT_TRACKING: process.env.REACT_APP_FEATURE_PAYMENT_TRACKING !== 'false',

  // SaaS onboarding wizard — disabled by default (single-tenant deployment)
  // Set REACT_APP_FEATURE_SAAS_ONBOARDING=true to enable for multi-tenant SaaS mode
  SAAS_ONBOARDING: process.env.REACT_APP_FEATURE_SAAS_ONBOARDING === 'true',
};

export const isFeatureEnabled = (feature) => {
  return featureFlags[feature] || false;
};
