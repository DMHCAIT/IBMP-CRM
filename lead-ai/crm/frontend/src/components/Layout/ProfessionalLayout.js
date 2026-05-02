import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Drawer } from 'antd';
import {
  LayoutDashboard,
  Users,
  Hospital,
  BookOpen,
  BarChart3,
  ChevronLeft,
  TrendingUp,
  GitBranch,
  UserPlus,
  Activity,
  Search,
  Shield,
  CalendarClock,
  DollarSign,
  Settings,
  Timer,
  Users2,
  ShieldCheck,
  TrendingDown,
  ClipboardList,
  Megaphone,
} from 'lucide-react';
import SmartNotifications from '../../features/notifications/SmartNotifications';
import { isFeatureEnabled } from '../../config/featureFlags';
import { authAPI, aiSearchAPI, leadsAPI, usersAPI, dashboardAPI, coursesAPI, systemAPI } from '../../api/api';


// Global Search Component
const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (value) => {
    if (value.trim().length === 0) {
      setResults([]);
      setDrawerOpen(false);
      return;
    }

    setSearching(true);
    try {
      const response = await aiSearchAPI.search(value);
      setResults(response.data?.results || []);
      setDrawerOpen(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleResultClick = (leadId) => {
    navigate(`/leads/${leadId}`);
    setDrawerOpen(false);
    setQuery('');
  };

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: 'var(--bg-secondary)',
        borderRadius: 8,
        width: 320,
      }}>
        <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          placeholder="Search leads..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch(query);
            }
          }}
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            width: '100%',
          }}
        />
      </div>

      <Drawer
        title="Search Results"
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={400}
      >
        {searching ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <p>Searching...</p>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
            {query ? 'No results found' : 'Enter a search query'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {results.map((result) => (
              <motion.div
                key={result.lead_id}
                whileHover={{ x: 4 }}
                onClick={() => handleResultClick(result.lead_id)}
                style={{
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  {result.full_name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {result.course || 'No course'}
                </div>
                {result.score && (
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Match score: {(result.score * 100).toFixed(0)}%
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
};

const ProfessionalLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const initials = currentUser.full_name
    ? currentUser.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  // ── Keep the Render backend warm while any user has the app open ──────────
  // Render free tier spins down after 15 min of inactivity.
  // Ping /health every 4 minutes so the server never cold-starts mid-session.
  useEffect(() => {
    // Immediate ping on mount so the server wakes up as soon as user logs in
    systemAPI.health().catch(() => {});
    const id = setInterval(() => {
      systemAPI.health().catch(() => {});
    }, 4 * 60 * 1000); // every 4 minutes
    return () => clearInterval(id);
  }, []);

  // Prefetch the most-used data when user hovers a nav item
  const prefetchRoute = useCallback((route) => {
    const stale = 10 * 60 * 1000;
    if (route === '/leads' || route === '/pipeline' || route === '/lead-analysis') {
      queryClient.prefetchQuery({
        queryKey: ['prefetch', 'leads'],
        queryFn: () => leadsAPI.getAll({ limit: 500 }).then(r => r.data),
        staleTime: stale,
      });
    }
    if (route === '/dashboard' || route === '/followups') {
      queryClient.prefetchQuery({
        queryKey: ['prefetch', 'dashboard-stats'],
        queryFn: () => dashboardAPI.getStats().then(r => r.data),
        staleTime: stale,
      });
    }
    if (route === '/users' || route === '/user-activity' || route === '/lead-analysis' || route === '/lead-update-activity') {
      queryClient.prefetchQuery({
        queryKey: ['prefetch', 'users'],
        queryFn: () => usersAPI.getAll().then(r => r.data),
        staleTime: stale,
      });
    }
    if (route === '/courses') {
      queryClient.prefetchQuery({
        queryKey: ['prefetch', 'courses'],
        queryFn: () => coursesAPI.getAll().then(r => r.data),
        staleTime: stale,
      });
    }
  }, [queryClient]);

  const menuItems = [
    { key: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { key: '/followups', icon: CalendarClock, label: "Today's Follow-ups" },
    { key: '/leads', icon: Users, label: 'Leads' },
    { key: '/pipeline', icon: GitBranch, label: 'Pipeline' },
    { key: '/lead-analysis', icon: TrendingUp, label: 'Lead Analysis' },
    { key: '/hospitals', icon: Hospital, label: 'Hospitals' },
    { key: '/courses', icon: BookOpen, label: 'Courses' },
    { key: '/users', icon: UserPlus, label: 'Team' },
    { key: '/user-activity', icon: Activity, label: 'User Activity' },
    { key: '/lead-update-activity', icon: ClipboardList, label: 'Lead Updates' },
    { key: '/analytics', icon: BarChart3, label: 'Analytics' },
    { key: '/campaigns', icon: Megaphone, label: 'Campaign Performance' },
    { key: '/conversion-time', icon: Timer, label: 'Conversion Time' },
    { key: '/cohort-analysis', icon: Users2, label: 'Cohort Analysis' },
    { key: '/sla', icon: ShieldCheck, label: 'SLA Tracker' },
    { key: '/score-decay', icon: TrendingDown, label: 'Score Decay' },
    { key: '/audit-logs', icon: Shield, label: 'Audit Logs' },
    { key: '/payments', icon: DollarSign, label: 'Payments' },
    { key: '/settings', icon: Settings, label: 'Settings' },
  ];

  // Show all menu items (no role restrictions - authentication disabled)
  const roleMenuItems = menuItems;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-secondary)' }}>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 240 }}
        style={{
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          padding: collapsed ? '0 16px' : '0 24px',
          borderBottom: '1px solid var(--border)',
          gap: 12
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0
          }}>
            🏥
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ 
                fontSize: 'var(--text-lg)', 
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              Med CRM
            </motion.span>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px 8px', overflowY: 'auto' }}>
          {roleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.key;
            
            return (
              <motion.button
                key={item.key}
                onClick={() => navigate(item.key)}
                onMouseEnter={() => prefetchRoute(item.key)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: collapsed ? '12px' : '12px 16px',
                  marginBottom: 4,
                  borderRadius: 8,
                  border: 'none',
                  background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  fontWeight: isActive ? 500 : 400,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </motion.button>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 8,
              border: 'none',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronLeft size={20} />
            </motion.div>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          height: 64,
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {roleMenuItems.find(item => item.key === location.pathname)?.label || 'Dashboard'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Search */}
            <SearchBar />

            {/* Smart Notifications */}
            {isFeatureEnabled('SMART_NOTIFICATIONS') && <SmartNotifications />}

            {/* User Info (no logout - authentication disabled) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingLeft: 16,
              borderLeft: '1px solid var(--border)',
            }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {currentUser.full_name || 'User'}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {currentUser.role || ''}
                </div>
              </div>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
              }}>
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: 24,
        }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default ProfessionalLayout;
