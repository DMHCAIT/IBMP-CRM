import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDepartment, DEPARTMENTS } from '../config/rbac';
import CEODashboard        from '../features/dashboards/CEODashboard';
import MarketingDashboard  from '../features/dashboards/MarketingDashboard';
import AdminDashboard      from '../features/dashboards/AdminDashboard';
import CounselorDashboard  from '../features/dashboards/CounselorDashboard';
import FinanceDashboard    from '../features/dashboards/FinanceDashboard';
import AcademicDashboard   from '../features/dashboards/AcademicDashboard';
import HRDashboard         from '../features/dashboards/HRDashboard';

const RoleBasedDashboard = () => {
  const { user } = useAuth();
  const role = user?.role || '';
  const dept = getDepartment(role);

  useEffect(() => {
    document.title = `Dashboard — ${user?.full_name || 'CRM'}`;
  }, [user?.full_name]);

  switch (dept) {
    case DEPARTMENTS.CEO:
      return <CEODashboard />;

    case DEPARTMENTS.MARKETING:
      return <MarketingDashboard />;

    case DEPARTMENTS.SALES:
      if (['Sales Manager', 'Team Leader', 'Manager'].includes(role)) {
        return <AdminDashboard />;
      }
      return <CounselorDashboard user={user} />;

    case DEPARTMENTS.ACADEMIC:
      return <AcademicDashboard />;

    case DEPARTMENTS.ACCOUNTS:
      return <FinanceDashboard />;

    case DEPARTMENTS.HR:
      return <HRDashboard />;

    case DEPARTMENTS.ADMIN:
    default:
      return <CEODashboard />;
  }
};

export default RoleBasedDashboard;
