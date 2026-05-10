import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Drawer, Tooltip } from 'antd';
import {
  LayoutDashboard, Users, Hospital, BookOpen, BarChart3, ChevronLeft,
  TrendingUp, GitBranch, UserPlus, Activity, Search, Shield, CalendarClock,
  DollarSign, Settings, Timer, ShieldCheck, TrendingDown, ClipboardList,
  Megaphone, GraduationCap, UserCog, LogOut,
} from 'lucide-react';
import SmartNotifications from '../../features/notifications/SmartNotifications';
import { isFeatureEnabled } from '../../config/featureFlags';
import { aiSearchAPI, leadsAPI, usersAPI, dashboardAPI, coursesAPI, systemAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { getNavItemsForRole, getDepartment, DEPT_META } from '../../config/rbac';

// ── Icon registry (keeps rbac.js icon-library-agnostic) ──────────────────
const ICON_MAP = {
  LayoutDashboard, Users, Hospital, BookOpen, BarChart3, TrendingUp,
  GitBranch, UserPlus, Activity, Shield, CalendarClock, DollarSign,
  Settings, Timer, ShieldCheck, TrendingDown, ClipboardList, Megaphone,
  GraduationCap, UserCog,
};

// ── Global Search ─────────────────────────────────────────────────────────
const SearchBar = () => {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [drawerOpen, setDrawer] = useState(false);
  const [searching, setSearch]  = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (value) => {
    if (!value.trim()) { setResults([]); setDrawer(false); return; }
    setSearch(true);
    try {
      const res = await aiSearchAPI.search(value);
      setResults(res.data?.results || []);
      setDrawer(true);
    } catch { setResults([]); }
    finally { setSearch(false); }
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', background: 'var(--bg-secondary)',
        borderRadius: 8, width: 280,
      }}>
        <Search size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search leads, students..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            fontSize: 'var(--text-sm)', color: 'var(--text-primary)', width: '100%',
          }}
        />
      </div>

      <Drawer title="Search Results" placement="right" onClose={() => setDrawer(false)} open={drawerOpen} width={400}>
        {searching ? (
          <div style={{ textAlign: 'center', padding: 24 }}>Searching...</div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
            {query ? 'No results found' : 'Enter a search query'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {results.map(r => (
              <motion.div key={r.lead_id} whileHover={{ x: 4 }}
                onClick={() => { navigate(`/leads/${r.lead_id}`); setDrawer(false); setQuery(''); }}
                style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-color)' }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{r.course || 'No course'}</div>
                {r.score && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Match: {(r.score * 100).toFixed(0)}%</div>}
              </motion.div>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
};

// ── Main Layout ───────────────────────────────────────────────────────────
const ProfessionalLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate     = useNavigate();
  const location     = useLocation();
  const queryClient  = useQueryClient();
  const { user, logout } = useAuth();

  const role       = user?.role || '';
  const dept       = getDepartment(role);
  const deptMeta   = DEPT_META[dept] || DEPT_META['Sales'];
  const initials   = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  // Keep Render backend warm
  useEffect(() => {
    systemAPI.health().catch(() => {});
    const id = setInterval(() => systemAPI.health().catch(() => {}), 4 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Prefetch on hover
  const prefetchRoute = useCallback((route) => {
    const stale = 10 * 60 * 1000;
    if (['/leads', '/pipeline', '/lead-analysis'].includes(route))
      queryClient.prefetchQuery({ queryKey: ['prefetch', 'leads'], queryFn: () => leadsAPI.getAll({ limit: 500 }).then(r => r.data), staleTime: stale });
    if (['/dashboard', '/followups'].includes(route))
      queryClient.prefetchQuery({ queryKey: ['prefetch', 'stats'], queryFn: () => dashboardAPI.getStats().then(r => r.data), staleTime: stale });
    if (['/users', '/user-activity', '/hr'].includes(route))
      queryClient.prefetchQuery({ queryKey: ['prefetch', 'users'], queryFn: () => usersAPI.getAll().then(r => r.data), staleTime: stale });
    if (route === '/courses')
      queryClient.prefetchQuery({ queryKey: ['prefetch', 'courses'], queryFn: () => coursesAPI.getAll().then(r => r.data), staleTime: stale });
  }, [queryClient]);

  // Department-filtered nav items
  const navItems = getNavItemsForRole(role);

  const currentLabel = navItems.find(i => i.path === location.pathname)?.label
    || location.pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    || 'Dashboard';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-secondary)' }}>
      {/* ── Sidebar ── */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 240 }}
        style={{
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        }}
      >
        {/* Logo + company */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          padding: collapsed ? '0 16px' : '0 20px',
          borderBottom: '1px solid var(--border)', gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>🏥</div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>IBMP CRM</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Medical Education</div>
            </motion.div>
          )}
        </div>

        {/* Department badge */}
        {!collapsed && (
          <div style={{ padding: '10px 20px 4px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 20,
              background: deptMeta.bg, color: deptMeta.color,
              fontSize: 11, fontWeight: 600,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: deptMeta.color }} />
              {deptMeta.label} Dept
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon] || LayoutDashboard;
            const isActive = location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

            const btn = (
              <motion.button
                key={item.path}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => prefetchRoute(item.path)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px 0' : '10px 12px',
                  marginBottom: 2, borderRadius: 8, border: 'none',
                  background: isActive ? `${deptMeta.color}18` : 'transparent',
                  color: isActive ? deptMeta.color : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderLeft: isActive ? `3px solid ${deptMeta.color}` : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </motion.button>
            );

            return collapsed
              ? <Tooltip key={item.path} title={item.label} placement="right">{btn}</Tooltip>
              : <React.Fragment key={item.path}>{btn}</React.Fragment>;
          })}
        </nav>

        {/* Collapse toggle */}
        <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%', padding: 10, borderRadius: 8, border: 'none',
              background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronLeft size={18} />
            </motion.div>
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          height: 64, background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 24px', gap: 16,
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>
            {currentLabel}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
            <SearchBar />
            {isFeatureEnabled('SMART_NOTIFICATIONS') && <SmartNotifications />}

            {/* User chip */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              paddingLeft: 12, borderLeft: '1px solid var(--border)',
            }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user?.full_name || 'User'}
                </div>
                <div style={{ fontSize: 11, color: deptMeta.color, fontWeight: 500 }}>
                  {role}
                </div>
              </div>

              {/* Avatar */}
              <div style={{
                width: 38, height: 38, borderRadius: 8,
                background: `linear-gradient(135deg, ${deptMeta.color}, #8b5cf6)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {initials}
              </div>

              {/* Logout */}
              <Tooltip title="Sign out">
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', padding: 6, borderRadius: 6,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <LogOut size={17} />
                </button>
              </Tooltip>
            </div>
          </div>
        </header>

        {/* Page */}
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
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
