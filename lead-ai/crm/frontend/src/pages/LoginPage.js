import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { getDepartment, DEPT_META } from '../config/rbac';

const DEPARTMENTS_INFO = [
  { icon: '👑', label: 'CEO',       desc: 'Full organisational access' },
  { icon: '📣', label: 'Marketing', desc: 'Lead gen & campaigns' },
  { icon: '📞', label: 'Sales',     desc: 'Counseling & follow-ups' },
  { icon: '🎓', label: 'Academic',  desc: 'University & visa processing' },
  { icon: '💰', label: 'Accounts',  desc: 'Fee & revenue management' },
  { icon: '👥', label: 'HR',        desc: 'Employee & performance' },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(username.trim(), password);
      const { user, access_token } = res.data;
      login({ ...user, token: access_token });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.left} className="login-left">
        {/* Brand panel */}
        <div style={{ marginBottom: 48 }}>
          <div style={s.brandIcon}>🏥</div>
          <div style={s.brandTitle}>IBMP CRM</div>
          <div style={s.brandSub}>Integrated Business Management Platform</div>
          <div style={s.brandDesc}>
            Department-wise CRM for IBMP & DMHCA — managing leads, students,
            admissions and revenue in one unified platform.
          </div>
        </div>

        <div style={s.deptGrid}>
          {DEPARTMENTS_INFO.map(d => (
            <div key={d.label} style={s.deptCard}>
              <div style={s.deptIcon}>{d.icon}</div>
              <div>
                <div style={s.deptLabel}>{d.label}</div>
                <div style={s.deptDesc}>{d.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={s.workflow}>
          Marketing → Sales → Academic → Accounts → Enrolled ✓
        </div>
      </div>

      <div style={s.right} className="login-right">
        <div style={s.card}>
          {/* Logo row */}
          <div style={s.logoRow}>
            <div style={s.logoIcon}>🏥</div>
            <div>
              <div style={s.logoTitle}>IBMP CRM</div>
              <div style={s.logoSub}>Sign in to your department</div>
            </div>
          </div>

          <h2 style={s.heading}>Welcome back</h2>
          <p style={s.subHeading}>Your dashboard will load based on your department and role.</p>

          {error && <div style={s.errorBox}>{error}</div>}

          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Work Email</label>
              <input
                type="email"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="yourname@ibmpcrm.xyz"
                required
                autoFocus
                style={s.input}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={s.input}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ ...s.button, opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={s.hint}>
            <strong>Need access?</strong> Contact your HR or System Administrator to create your account.
          </div>
        </div>
      </div>
    </div>
  );
};

const s = {
  page: {
    minHeight: '100vh', display: 'flex',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  // Left panel
  left: {
    flex: 1, background: 'linear-gradient(160deg, #1e3a5f 0%, #1e293b 60%, #0f172a 100%)',
    padding: '52px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
    color: '#fff',
  },
  brandIcon: { fontSize: 48, marginBottom: 12 },
  brandTitle: { fontSize: 32, fontWeight: 800, letterSpacing: -0.5 },
  brandSub:   { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  brandDesc:  { fontSize: 14, color: '#cbd5e1', lineHeight: 1.7, maxWidth: 380 },
  deptGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28,
  },
  deptCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  deptIcon:  { fontSize: 20, flexShrink: 0 },
  deptLabel: { fontSize: 13, fontWeight: 600, color: '#f1f5f9' },
  deptDesc:  { fontSize: 11, color: '#94a3b8' },
  workflow: {
    fontSize: 12, color: '#64748b', fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.04)', padding: '8px 14px', borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  // Right panel
  right: {
    width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f8fafc', padding: 32,
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '40px 36px',
    width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  logoIcon: {
    width: 46, height: 46, borderRadius: 12,
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
  },
  logoTitle:   { fontSize: 18, fontWeight: 700, color: '#1e293b' },
  logoSub:     { fontSize: 12, color: '#64748b' },
  heading:     { fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' },
  subHeading:  { fontSize: 13, color: '#64748b', marginBottom: 24 },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
    borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151' },
  input: {
    padding: '11px 14px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 14, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  },
  button: {
    marginTop: 4, padding: '12px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #6366f1)',
    color: '#fff', fontSize: 15, fontWeight: 600,
  },
  hint: {
    marginTop: 20, padding: '11px 14px', background: '#f1f5f9',
    borderRadius: 8, fontSize: 12, color: '#64748b', lineHeight: 1.7,
  },
};

export default LoginPage;
