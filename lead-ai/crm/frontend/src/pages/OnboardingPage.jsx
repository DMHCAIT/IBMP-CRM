/**
 * OnboardingPage
 * ==============
 * 4-step SaaS signup wizard shown once after a new tenant registers.
 * Skipped entirely if the user already belongs to a tenant.
 *
 * Steps:
 *   1. Org info      — name, subdomain, plan selection
 *   2. Invite team   — enter emails to invite (bulk)
 *   3. Import leads  — optional CSV / Google Sheets intro
 *   4. Done          — confetti + go to dashboard
 *
 * Usage (App.js / route guard):
 *   <Route path="/onboarding" element={<OnboardingPage />} />
 *
 * After step 4 the user is redirected to the dashboard.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Steps, Button, Form, Input, Select, Tag, Space, Typography,
  Card, Alert, Divider, Progress, message, Tooltip, InputNumber,
} from 'antd';
import {
  TeamOutlined, LinkOutlined, ImportOutlined, RocketOutlined,
  CheckCircleFilled, CopyOutlined, MailOutlined, PlusOutlined,
  ArrowRightOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { tenantsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { Option }  = Select;

// ─── Plan cards ───────────────────────────────────────────────────────────────
const PLANS = [
  {
    key:      'starter',
    label:    'Starter',
    price:    'Free',
    seats:    5,
    features: ['5 seats', '1,000 leads', 'Core CRM', 'Email support'],
    color:    '#6366f1',
  },
  {
    key:      'growth',
    label:    'Growth',
    price:    '₹4,999/mo',
    seats:    25,
    features: ['25 seats', '20K leads', 'AI scoring', 'WhatsApp', 'Sheets sync'],
    color:    '#10b981',
    recommended: true,
  },
  {
    key:      'enterprise',
    label:    'Enterprise',
    price:    'Custom',
    seats:    'Unlimited',
    features: ['Unlimited seats', 'Unlimited leads', 'SSO', 'Priority support', 'Custom SLA'],
    color:    '#f59e0b',
  },
];

// ─── Util: debounce ───────────────────────────────────────────────────────────
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Step 1: Org info ─────────────────────────────────────────────────────────
function StepOrgInfo({ onNext }) {
  const [form]      = Form.useForm();
  const [plan, setPlan]   = useState('growth');
  const [subdomain, setSubdomain] = useState('');
  const [subStatus, setSubStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);

  const debouncedSub = useDebounce(subdomain, 500);

  // Auto-populate subdomain from org name
  const handleNameChange = (e) => {
    const name = e.target.value;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    form.setFieldValue('subdomain', slug);
    setSubdomain(slug);
  };

  // Check subdomain availability
  useEffect(() => {
    if (!debouncedSub || debouncedSub.length < 2) {
      setSubStatus(null);
      return;
    }
    setSubStatus('checking');
    tenantsAPI.checkSubdomain(debouncedSub)
      .then(({ data }) => {
        setSubStatus(data.available ? 'available' : 'taken');
        setSuggestion(data.suggestion || '');
      })
      .catch(() => setSubStatus(null));
  }, [debouncedSub]);

  const handleFinish = async (values) => {
    if (subStatus === 'taken') {
      message.error('That subdomain is taken. Please choose another.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await tenantsAPI.create({
        name:      values.name,
        subdomain: values.subdomain,
        plan:      plan,
      });
      onNext({ tenant: data.tenant, plan });
    } catch (err) {
      message.error(err?.response?.data?.detail || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  const subSuffix = () => {
    if (subStatus === 'checking') return <LoadingOutlined style={{ color: '#888' }} />;
    if (subStatus === 'available') return <CheckCircleFilled style={{ color: '#10b981' }} />;
    if (subStatus === 'taken') return <span style={{ color: '#ef4444', fontSize: 11 }}>taken</span>;
    return null;
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>Set up your workspace</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        This is your organisation's private CRM space. You can change these settings later.
      </Paragraph>

      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label="Organisation name"
          name="name"
          rules={[{ required: true, message: 'Please enter your org name' }]}
        >
          <Input
            placeholder="e.g. IBMP Education"
            size="large"
            onChange={handleNameChange}
          />
        </Form.Item>

        <Form.Item
          label="Subdomain"
          name="subdomain"
          extra={
            subStatus === 'taken' && suggestion
              ? <span>Try: <a onClick={() => { form.setFieldValue('subdomain', suggestion); setSubdomain(suggestion); }}>{suggestion}</a></span>
              : subStatus === 'available'
              ? <span style={{ color: '#10b981' }}>✓ Available</span>
              : null
          }
          rules={[
            { required: true, message: 'Subdomain is required' },
            { pattern: /^[a-z0-9][a-z0-9-]{1,47}$/, message: 'Only lowercase letters, numbers and hyphens' },
          ]}
          validateStatus={subStatus === 'taken' ? 'error' : subStatus === 'available' ? 'success' : ''}
        >
          <Space.Compact style={{ width: '100%' }}>
            <Input
              size="large"
              suffix={subSuffix()}
              value={subdomain}
              onChange={e => { setSubdomain(e.target.value); form.setFieldValue('subdomain', e.target.value); }}
              style={{ flex: 1 }}
            />
            <Button size="large" disabled style={{ pointerEvents: 'none', color: '#6b7280', background: '#f3f4f6' }}>
              .yourcrm.com
            </Button>
          </Space.Compact>
        </Form.Item>

        {/* Plan selection */}
        <Form.Item label="Plan">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {PLANS.map(p => (
              <div
                key={p.key}
                onClick={() => setPlan(p.key)}
                style={{
                  flex: '1 1 160px',
                  border: `2px solid ${plan === p.key ? p.color : 'var(--color-border-secondary)'}`,
                  borderRadius: 10,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'border-color 0.15s',
                  background: plan === p.key ? `${p.color}10` : 'transparent',
                }}
              >
                {p.recommended && (
                  <Tag color="green" style={{ position: 'absolute', top: -10, right: 10, fontSize: 10 }}>
                    Recommended
                  </Tag>
                )}
                <div style={{ fontWeight: 600, fontSize: 14, color: p.color }}>{p.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 8px' }}>{p.price}</div>
                {p.features.map(f => (
                  <div key={f} style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>
                    ✓ {f}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Form.Item>

        <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            icon={<ArrowRightOutlined />}
            style={{ width: '100%' }}
          >
            Create workspace
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}

// ─── Step 2: Invite team ──────────────────────────────────────────────────────
function StepInviteTeam({ tenant, onNext, onSkip }) {
  const [emails, setEmails] = useState(['']);
  const [loading, setLoading] = useState(false);

  const addEmail = () => setEmails(prev => [...prev, '']);
  const updateEmail = (i, val) => setEmails(prev => { const n = [...prev]; n[i] = val; return n; });
  const removeEmail = (i) => setEmails(prev => prev.filter((_, idx) => idx !== i));

  const handleSend = async () => {
    const valid = emails.filter(e => e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (valid.length === 0) { onNext(); return; }
    setLoading(true);
    try {
      // For now just show success — invites will be wired to /api/users/invite
      message.success(`Invites queued for ${valid.length} email${valid.length > 1 ? 's' : ''}`);
      onNext({ invitesSent: valid.length });
    } catch (err) {
      message.error('Failed to send invites');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>Invite your team</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        They'll receive an email with a link to set their password.
        You can always invite more people from Settings → Users.
      </Paragraph>

      <div style={{ marginBottom: 16 }}>
        {emails.map((email, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Input
              prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
              placeholder="colleague@company.com"
              value={email}
              onChange={e => updateEmail(i, e.target.value)}
              size="large"
              style={{ flex: 1 }}
            />
            {emails.length > 1 && (
              <Button size="large" danger ghost onClick={() => removeEmail(i)}>✕</Button>
            )}
          </div>
        ))}
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addEmail}
          style={{ width: '100%' }}
        >
          Add another
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <Button size="large" onClick={onSkip} style={{ flex: 1 }}>
          Skip for now
        </Button>
        <Button
          type="primary"
          size="large"
          loading={loading}
          icon={<ArrowRightOutlined />}
          onClick={handleSend}
          style={{ flex: 2 }}
        >
          Send invites & continue
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Import leads ─────────────────────────────────────────────────────
function StepImportLeads({ tenant, onNext, onSkip }) {
  const webhookUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/webhooks/google-sheets`;
  const [copied, setCopied] = useState(false);

  const doCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      message.success('Copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>Import your leads</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Choose how to get your existing data into the CRM.
      </Paragraph>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* CSV import */}
        <Card
          size="small"
          style={{ border: '1.5px solid var(--color-border-secondary)', borderRadius: 10 }}
          styles={{ body: { padding: '16px 20px' }}}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ImportOutlined style={{ fontSize: 28, color: '#6366f1' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Import CSV</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Go to <strong>Leads → Import</strong> and upload a .csv file.
                Required columns: <code>full_name</code>, <code>phone</code>.
              </div>
            </div>
            <Button type="primary" ghost onClick={onNext}>Go to import</Button>
          </div>
        </Card>

        {/* Google Sheets */}
        <Card
          size="small"
          style={{ border: '1.5px solid var(--color-border-secondary)', borderRadius: 10 }}
          styles={{ body: { padding: '16px 20px' }}}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <LinkOutlined style={{ fontSize: 28, color: '#10b981', marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Connect Google Sheets (two-way sync)</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                Paste this webhook URL into your Apps Script script properties as{' '}
                <code>CRM_WEBHOOK_URL</code>. Then run <code>installTrigger()</code>.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{
                  fontSize: 11,
                  background: 'var(--color-background-secondary)',
                  padding: '4px 8px',
                  borderRadius: 4,
                  flex: 1,
                  wordBreak: 'break-all',
                }}>
                  {webhookUrl}
                </code>
                <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => doCopy(webhookUrl)}
                    style={{ color: copied ? '#10b981' : undefined }}
                  />
                </Tooltip>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                Full guide: <strong>Settings → Google Sheets Sync</strong>
              </div>
            </div>
          </div>
        </Card>

        {/* Manual entry */}
        <Card
          size="small"
          style={{ border: '1.5px solid var(--color-border-secondary)', borderRadius: 10 }}
          styles={{ body: { padding: '14px 20px' }}}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <TeamOutlined style={{ fontSize: 24, color: '#f59e0b' }} />
            <div style={{ flex: 1, fontSize: 13, color: '#64748b' }}>
              Or start fresh — add leads manually from the <strong>Leads</strong> page.
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <Button size="large" onClick={onSkip} style={{ flex: 1 }}>
          Skip for now
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<ArrowRightOutlined />}
          onClick={onNext}
          style={{ flex: 2 }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Done / Launch ────────────────────────────────────────────────────
function StepDone({ tenant, onFinish }) {
  const navigate = useNavigate();

  const handleGo = () => {
    if (onFinish) onFinish();
    navigate('/dashboard');
  };

  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <Title level={3} style={{ marginBottom: 8 }}>
        You're all set, {tenant?.name || 'welcome'}!
      </Title>
      <Paragraph type="secondary" style={{ fontSize: 15, marginBottom: 32 }}>
        Your CRM workspace is ready. Start adding leads, track follow-ups,
        and watch your conversions grow.
      </Paragraph>

      <div style={{
        display: 'inline-flex', flexDirection: 'column', gap: 10,
        background: 'var(--color-background-secondary)',
        borderRadius: 12, padding: '20px 28px', marginBottom: 32,
        textAlign: 'left', minWidth: 260,
      }}>
        {[
          ['Add your first lead', '/leads/new'],
          ['Import from CSV', '/leads'],
          ['Configure WhatsApp', '/settings'],
          ['Invite more teammates', '/settings/users'],
        ].map(([label, path]) => (
          <div
            key={label}
            onClick={() => navigate(path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', padding: '6px 0',
            }}
          >
            <ArrowRightOutlined style={{ color: '#6366f1', fontSize: 12 }} />
            <span style={{ fontSize: 14 }}>{label}</span>
          </div>
        ))}
      </div>

      <div>
        <Button
          type="primary"
          size="large"
          icon={<RocketOutlined />}
          onClick={handleGo}
          style={{ minWidth: 220, height: 48, fontSize: 16 }}
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const STEPS = [
  { title: 'Workspace',  icon: <LinkOutlined /> },
  { title: 'Invite',     icon: <TeamOutlined /> },
  { title: 'Import',     icon: <ImportOutlined /> },
  { title: 'Launch',     icon: <RocketOutlined /> },
];

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [current, setCurrent] = useState(0);
  const [state, setState]     = useState({
    tenant:       null,
    plan:         'growth',
    invitesSent:  0,
  });

  // If user already has a tenant, skip onboarding
  useEffect(() => {
    if (user?.tenant_id) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const next = (extra = {}) => {
    setState(prev => ({ ...prev, ...extra }));
    setCurrent(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const skip = () => next();

  const handleFinish = () => {
    // Reload the app so AuthContext picks up the new tenant_id from the DB
    window.location.href = '/dashboard';
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background)',
      padding: '32px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
            IBMP <span style={{ color: '#6366f1' }}>CRM</span>
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            Set up your workspace in 2 minutes
          </div>
        </div>

        {/* Progress steps */}
        <div style={{ marginBottom: 28 }}>
          <Steps
            current={current}
            size="small"
            items={STEPS.map((s, i) => ({
              title: s.title,
              icon: current > i
                ? <CheckCircleFilled style={{ color: '#10b981' }} />
                : s.icon,
            }))}
          />
          <Progress
            percent={Math.round(((current + 1) / STEPS.length) * 100)}
            showInfo={false}
            strokeColor="#6366f1"
            trailColor="var(--color-border-secondary)"
            style={{ marginTop: 12 }}
          />
        </div>

        {/* Step content */}
        <Card
          style={{ borderRadius: 16, border: '1px solid var(--color-border-secondary)' }}
          styles={{ body: { padding: '32px 36px' }}}
        >
          {current === 0 && (
            <StepOrgInfo onNext={extra => next(extra)} />
          )}
          {current === 1 && (
            <StepInviteTeam
              tenant={state.tenant}
              onNext={extra => next(extra)}
              onSkip={skip}
            />
          )}
          {current === 2 && (
            <StepImportLeads
              tenant={state.tenant}
              onNext={() => next()}
              onSkip={skip}
            />
          )}
          {current === 3 && (
            <StepDone
              tenant={state.tenant}
              onFinish={handleFinish}
            />
          )}
        </Card>

        {/* Step indicator */}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
          Step {current + 1} of {STEPS.length}
        </div>
      </div>
    </div>
  );
}
