import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import ProfessionalLayout from './components/Layout/ProfessionalLayout';
import LoginPage from './pages/LoginPage';
import { useAuth } from './context/AuthContext';
// Lazy-loaded pages — each becomes its own JS chunk (code splitting)
const RoleBasedDashboard  = lazy(() => import('./pages/RoleBasedDashboard'));
const LeadsPageEnhanced   = lazy(() => import('./pages/LeadsPageEnhanced'));
const LeadDetails         = lazy(() => import('./pages/LeadDetails'));
const HospitalsPage       = lazy(() => import('./pages/HospitalsPage'));
const CoursesPageEnhanced = lazy(() => import('./pages/CoursesPageEnhanced'));
const AnalyticsPage       = lazy(() => import('./pages/AnalyticsPage'));
const CampaignAnalyticsPage = lazy(() => import('./pages/CampaignAnalyticsPage'));
const UsersPage           = lazy(() => import('./pages/UsersPage'));
const DragDropPipeline    = lazy(() => import('./features/pipeline/DragDropPipeline'));
const UserActivityPage    = lazy(() => import('./pages/UserActivityPage'));
const LeadAnalysisPage    = lazy(() => import('./pages/LeadAnalysisPage'));
const AuditLogs           = lazy(() => import('./features/audit/AuditLogs'));
const FollowupTodayPage   = lazy(() => import('./pages/FollowupTodayPage'));
const PaymentsPage        = lazy(() => import('./pages/PaymentsPage'));
const SettingsPage        = lazy(() => import('./pages/SettingsPage'));
const ConversionTimePage  = lazy(() => import('./pages/ConversionTimePage'));
const CohortAnalysisPage  = lazy(() => import('./pages/CohortAnalysisPage'));
const SLAPage             = lazy(() => import('./pages/SLAPage'));
const ScoreDecayPage            = lazy(() => import('./pages/ScoreDecayPage'));
const LeadUpdateActivityPage    = lazy(() => import('./pages/LeadUpdateActivityPage'));
const HRPage                    = lazy(() => import('./pages/HRPage'));
const AcademicPage              = lazy(() => import('./pages/AcademicPage'));
import { isFeatureEnabled } from './config/featureFlags';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60 * 1000,    // 2 min — lead data must stay current in a live CRM
      gcTime: 15 * 60 * 1000,      // 15 min — keep data in memory between page navigations
      refetchOnMount: true,         // always check freshness when a page mounts
    },
  },
});

// Minimal skeleton shown while a lazy chunk is downloading (only on first visit)
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: 300,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid #e5e7eb',
        borderTopColor: '#3b82f6',
        animation: 'spin 0.6s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Router>
      <Routes>
        {/* Public login route */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        {/* All protected routes */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <ProfessionalLayout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<RoleBasedDashboard />} />
                  <Route path="/followups" element={<FollowupTodayPage />} />
                  <Route path="/leads" element={<LeadsPageEnhanced />} />
                  <Route path="/leads/:leadId" element={<LeadDetails />} />
                  <Route path="/pipeline" element={<DragDropPipeline />} />
                  <Route path="/lead-analysis" element={<LeadAnalysisPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/campaigns" element={<CampaignAnalyticsPage />} />
                  <Route path="/hospitals" element={<HospitalsPage />} />
                  <Route path="/courses" element={<CoursesPageEnhanced />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/user-activity" element={<UserActivityPage />} />
                  <Route path="/lead-update-activity" element={<LeadUpdateActivityPage />} />
                  {isFeatureEnabled('AUDIT_LOGS') && (
                    <Route path="/audit-logs" element={<AuditLogs />} />
                  )}
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/conversion-time" element={<ConversionTimePage />} />
                  <Route path="/cohort-analysis" element={<CohortAnalysisPage />} />
                  <Route path="/sla" element={<SLAPage />} />
                  <Route path="/score-decay" element={<ScoreDecayPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/hr" element={<HRPage />} />
                  <Route path="/academic" element={<AcademicPage />} />
                  </Routes>
                </Suspense>
              </ProfessionalLayout>
            </RequireAuth>
          }
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#3b82f6',
              borderRadius: 8,
              colorSuccess: '#10b981',
              colorWarning: '#f59e0b',
              colorError: '#ef4444',
              colorInfo: '#3b82f6',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            },
          }}
        >
          {/* AuthProvider wraps everything so any component can call useAuth() */}
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
