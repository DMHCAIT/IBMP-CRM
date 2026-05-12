import React, { lazy, Suspense, useEffect } from 'react';
import { Spin } from 'antd';
import { useAuth } from '../context/AuthContext';
import { getDepartment, DEPARTMENTS } from '../config/rbac';

// Each dashboard is its own lazy chunk — avoids the TDZ circular-init
// error that happens when a lazy-loaded module eagerly imports many others.
const CEOCommandCenter   = lazy(() => import('../features/dashboards/CEOCommandCenter'));
const MarketingDashboard = lazy(() => import('../features/dashboards/MarketingDashboard'));
const AdminDashboard     = lazy(() => import('../features/dashboards/AdminDashboard'));
const CounselorDashboard = lazy(() => import('../features/dashboards/CounselorDashboard'));
const FinanceDashboard   = lazy(() => import('../features/dashboards/FinanceDashboard'));
const AcademicDashboard  = lazy(() => import('../features/dashboards/AcademicDashboard'));
const HRDashboard        = lazy(() => import('../features/dashboards/HRDashboard'));

const Loader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
    <Spin size="large" />
  </div>
);

const RoleBasedDashboard = () => {
  const { user } = useAuth();
  const role = user?.role || '';
  const dept = getDepartment(role);

  useEffect(() => {
    document.title = `Dashboard — ${user?.full_name || 'CRM'}`;
  }, [user?.full_name]);

  let Dashboard;
  switch (dept) {
    case DEPARTMENTS.CEO:
    case DEPARTMENTS.ADMIN:
      Dashboard = <CEOCommandCenter />;
      break;
    case DEPARTMENTS.MARKETING:
      Dashboard = <MarketingDashboard />;
      break;
    case DEPARTMENTS.SALES:
      Dashboard = ['Sales Manager', 'Team Leader', 'Manager'].includes(role)
        ? <AdminDashboard />
        : <CounselorDashboard user={user} />;
      break;
    case DEPARTMENTS.ACADEMIC:
      Dashboard = <AcademicDashboard />;
      break;
    case DEPARTMENTS.ACCOUNTS:
      Dashboard = <FinanceDashboard />;
      break;
    case DEPARTMENTS.HR:
      Dashboard = <HRDashboard />;
      break;
    default:
      Dashboard = <CEOCommandCenter />;
  }

  return <Suspense fallback={<Loader />}>{Dashboard}</Suspense>;
};

export default RoleBasedDashboard;
