import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Tag, Spin, Empty, InputNumber, Form, message, Tooltip } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';
import { ShieldCheck, ShieldAlert, ShieldX, Clock, AlertTriangle, Save } from 'lucide-react';
import { slaAPI } from '../api/api';

/* ─── helpers ─────────────────────────────────────────── */
const rateColor = (r) =>
  r == null ? '#9ca3af' : r >= 90 ? '#10b981' : r >= 70 ? '#f59e0b' : '#ef4444';

const fmtHours = (h) => {
  if (h == null) return '—';
  if (h < 1)  return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
};

const SlaTypeTag = ({ type }) => {
  const cfg = {
    first_contact: { color: 'blue',   label: 'First Contact' },
    no_activity:   { color: 'orange', label: 'No Activity'   },
    followup:      { color: 'purple', label: 'Follow-up'     },
  }[type] || { color: 'default', label: type };
  return <Tag color={cfg.color} style={{ fontSize: 11 }}>{cfg.label}</Tag>;
};

/* ─── Gauge SVG ───────────────────────────────────────── */
const BigGauge = ({ rate }) => {
  const r = 70, cx = 90, cy = 90;
  const circ  = Math.PI * r;
  const filled = (rate ?? 0) / 100;
  const color  = rateColor(rate);
  return (
    <svg width="180" height="110" viewBox="0 0 180 110">
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
        fill="none" stroke="var(--bg-tertiary,#e5e7eb)" strokeWidth="14" strokeLinecap="round" />
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
        fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${filled * circ} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={cx} y={cy - 8}  textAnchor="middle" fontSize="30" fontWeight="800" fill={color}>
        {rate != null ? `${rate}%` : '—'}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="12" fill="var(--text-secondary,#6b7280)">
        Overall Compliance
      </text>
    </svg>
  );
};

/* ─── SLA Config form ─────────────────────────────────── */
const ConfigCard = ({ config, onSave, saving }) => {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (config) form.setFieldsValue(config);
  }, [config, form]);

  return (
    <div style={{
      background: 'var(--bg-secondary,#f9fafb)',
      border: '1px solid var(--border-color,#e5e7eb)',
      borderRadius: 14, padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Clock size={18} color="#6366f1" />
        <span style={{ fontWeight: 700, fontSize: 15 }}>SLA Thresholds</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary,#9ca3af)', marginLeft: 4 }}>
          Changes apply immediately to all future compliance calculations
        </span>
      </div>
      <Form form={form} layout="inline" onFinish={onSave}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <Form.Item name="first_contact_hours" label="First contact within"
          rules={[{ required: true, type: 'number', min: 0.5, max: 168 }]}>
          <InputNumber min={0.5} max={168} step={0.5} addonAfter="hours" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="no_activity_days" label="No-activity limit"
          rules={[{ required: true, type: 'number', min: 1, max: 90 }]}>
          <InputNumber min={1} max={90} addonAfter="days" style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="followup_response_hours" label="Follow-up response within"
          rules={[{ required: true, type: 'number', min: 1, max: 168 }]}>
          <InputNumber min={1} max={168} addonAfter="hours" style={{ width: 170 }} />
        </Form.Item>
        <Form.Item>
          <button type="submit" disabled={saving} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 16px', borderRadius: 8, border: 'none',
            background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </Form.Item>
      </Form>
    </div>
  );
};

/* ─── Counselor chart ─────────────────────────────────── */
const CounselorChart = ({ rows }) => {
  const data = rows
    .filter(r => r.compliance_rate != null)
    .map(r => ({ name: r.counselor, rate: r.compliance_rate, total: r.total }));
  if (!data.length) return null;

  const avg = Math.round(data.reduce((s, d) => s + d.rate, 0) / data.length);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
        <ReferenceLine x={avg} stroke="#6366f1" strokeDasharray="5 3"
          label={{ value: `avg ${avg}%`, position: 'insideTopRight', fontSize: 10, fill: '#6366f1' }} />
        <RTooltip formatter={(v) => [`${v}%`, 'Compliance']}
          contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
          {data.map((e, i) => <Cell key={i} fill={rateColor(e.rate)} />)}
          <LabelList dataKey="rate" position="right"
            formatter={v => `${v}%`}
            style={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-primary,#111)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/* ─── Page ────────────────────────────────────────────── */
const SLAPage = () => {
  const [tab, setTab] = useState('breaches'); // 'breaches' | 'counselors'
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sla-compliance'],
    queryFn: () => slaAPI.getCompliance().then(r => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const { data: cfgData } = useQuery({
    queryKey: ['sla-config'],
    queryFn: () => slaAPI.getConfig().then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (values) => slaAPI.updateConfig(values),
    onSuccess: () => {
      message.success('SLA thresholds saved');
      queryClient.invalidateQueries({ queryKey: ['sla-compliance'] });
      queryClient.invalidateQueries({ queryKey: ['sla-config'] });
    },
    onError: () => message.error('Failed to save SLA config'),
  });

  const overall     = data?.overall;
  const byC         = data?.by_counselor ?? [];
  const breaches    = data?.breaches     ?? [];
  const activeBreach = data?.active_breaches ?? 0;

  /* ── breach table columns ──────────────────────────── */
  const breachCols = [
    {
      title: 'Lead',
      dataIndex: 'lead_name',
      key: 'lead_name',
      render: (v) => <strong style={{ fontSize: 13 }}>{v}</strong>,
    },
    {
      title: 'Counselor',
      dataIndex: 'counselor',
      key: 'counselor',
      filters: [...new Set(breaches.map(b => b.counselor))].map(c => ({ text: c, value: c })),
      onFilter: (v, r) => r.counselor === v,
    },
    {
      title: 'SLA Type',
      dataIndex: 'sla_type',
      key: 'sla_type',
      render: (v) => <SlaTypeTag type={v} />,
      filters: [
        { text: 'First Contact', value: 'first_contact' },
        { text: 'No Activity',   value: 'no_activity'   },
      ],
      onFilter: (v, r) => r.sla_type === v,
    },
    {
      title: 'Lead Status',
      dataIndex: 'lead_status',
      key: 'lead_status',
      render: (v) => {
        const colorMap = { Enrolled: 'green', Hot: 'red', Warm: 'orange', Fresh: 'blue', Junk: 'default' };
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—',
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: 'First Contact',
      dataIndex: 'first_contact_at',
      key: 'first_contact_at',
      render: (v) => v
        ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : <span style={{ color: '#ef4444', fontWeight: 600 }}>None</span>,
    },
    {
      title: 'Over SLA by',
      dataIndex: 'hours_over_sla',
      key: 'hours_over_sla',
      defaultSortOrder: 'descend',
      sorter: (a, b) => (a.hours_over_sla ?? 0) - (b.hours_over_sla ?? 0),
      render: (v) => (
        <span style={{ color: v > 48 ? '#ef4444' : v > 12 ? '#f59e0b' : '#6b7280', fontWeight: 700 }}>
          {fmtHours(v)}
        </span>
      ),
    },
    {
      title: 'Course',
      dataIndex: 'course',
      key: 'course',
      render: (v) => v || '—',
    },
  ];

  /* ── counselor table columns ───────────────────────── */
  const counselorCols = [
    {
      title: '#',
      key: 'rank',
      width: 44,
      render: (_, __, i) => <span style={{ fontWeight: 700, color: i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : '#9ca3af' }}>{i + 1}</span>,
    },
    {
      title: 'Counselor',
      dataIndex: 'counselor',
      key: 'counselor',
      render: (v) => <strong>{v}</strong>,
    },
    {
      title: 'Total Leads',
      dataIndex: 'total',
      key: 'total',
      align: 'center',
    },
    {
      title: 'Compliant',
      dataIndex: 'compliant',
      key: 'compliant',
      align: 'center',
      render: (v) => <Tag color="green">{v}</Tag>,
    },
    {
      title: 'Breached',
      dataIndex: 'breached',
      key: 'breached',
      align: 'center',
      render: (v) => <Tag color={v > 0 ? 'red' : 'default'}>{v}</Tag>,
    },
    {
      title: 'Pending',
      dataIndex: 'pending',
      key: 'pending',
      align: 'center',
      render: (v) => <Tag color="orange">{v}</Tag>,
    },
    {
      title: 'Compliance %',
      dataIndex: 'compliance_rate',
      key: 'compliance_rate',
      defaultSortOrder: 'descend',
      sorter: (a, b) => (a.compliance_rate ?? -1) - (b.compliance_rate ?? -1),
      render: (v) => {
        const color = rateColor(v);
        const pct = v != null ? v : null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 8, background: 'var(--bg-tertiary,#e5e7eb)', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
              <div style={{ width: `${pct ?? 0}%`, height: '100%', background: color, borderRadius: 4 }} />
            </div>
            <span style={{ fontWeight: 700, color, minWidth: 40, textAlign: 'right' }}>
              {pct != null ? `${pct}%` : '—'}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Avg Response',
      dataIndex: 'avg_response_hours',
      key: 'avg_response_hours',
      align: 'center',
      sorter: (a, b) => (a.avg_response_hours ?? 999) - (b.avg_response_hours ?? 999),
      render: (v) => fmtHours(v),
    },
    {
      title: 'Worst Breach',
      dataIndex: 'worst_breach_hours',
      key: 'worst_breach_hours',
      align: 'center',
      render: (v) => v ? <span style={{ color: '#ef4444', fontWeight: 600 }}>{fmtHours(v)}</span> : <span style={{ color: '#10b981' }}>None</span>,
    },
  ];

  if (isLoading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: '0 0 52px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>SLA Breach Tracker</h1>
        <p style={{ color: 'var(--text-secondary,#6b7280)', marginTop: 6, marginBottom: 0, fontSize: 14 }}>
          Monitor response-time SLAs. Track first-contact compliance per counselor and surface active breaches.
        </p>
      </div>

      {/* Config */}
      <div style={{ marginBottom: 20 }}>
        <ConfigCard
          config={cfgData}
          onSave={(v) => saveMutation.mutate(v)}
          saving={saveMutation.isPending}
        />
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: '0 0 auto' }}>
          <BigGauge rate={overall?.compliance_rate} />
        </div>
        {[
          { label: 'Total Leads',      val: overall?.total,     Icon: ShieldCheck, color: '#6366f1' },
          { label: 'Compliant',        val: overall?.compliant, Icon: ShieldCheck, color: '#10b981' },
          { label: 'Breached',         val: overall?.breached,  Icon: ShieldX,     color: '#ef4444' },
          { label: 'Pending',          val: overall?.pending,   Icon: Clock,       color: '#f59e0b' },
          { label: 'Active Breaches',  val: activeBreach,       Icon: AlertTriangle, color: activeBreach > 0 ? '#ef4444' : '#10b981' },
        ].map(k => (
          <div key={k.label} style={{
            flex: 1, minWidth: 130,
            background: 'var(--bg-secondary,#f9fafb)',
            borderRadius: 12, borderLeft: `4px solid ${k.color}`,
            padding: '14px 18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary,#9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {k.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <k.Icon size={20} color={k.color} />
              <span style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.val ?? '—'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'breaches',   label: `Breach List (${breaches.length})` },
          { key: 'counselors', label: `By Counselor (${byC.length})` },
          { key: 'chart',      label: 'Compliance Chart' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 18px', borderRadius: 8,
            border: tab === t.key ? '1.5px solid #6366f1' : '1.5px solid var(--border-color,#e5e7eb)',
            background: tab === t.key ? '#6366f1' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--text-secondary,#6b7280)',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div style={{
        background: 'var(--bg-secondary,#f9fafb)',
        borderRadius: 16,
        border: '1px solid var(--border-color,#e5e7eb)',
        padding: '20px 24px',
      }}>
        {tab === 'breaches' && (
          breaches.length === 0
            ? <Empty description="No SLA breaches detected 🎉" />
            : <Table
                dataSource={breaches.map((b, i) => ({ ...b, key: `${b.lead_id}-${b.sla_type}-${i}` }))}
                columns={breachCols}
                pagination={{ pageSize: 15, showSizeChanger: true }}
                size="middle"
                scroll={{ x: 900 }}
              />
        )}

        {tab === 'counselors' && (
          byC.length === 0
            ? <Empty description="No counselor data" />
            : <Table
                dataSource={byC.map((r, i) => ({ ...r, key: r.counselor }))}
                columns={counselorCols}
                pagination={false}
                size="middle"
                scroll={{ x: 780 }}
              />
        )}

        {tab === 'chart' && (
          byC.length === 0
            ? <Empty description="No data" />
            : <>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>First-Contact SLA Compliance by Counselor</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary,#9ca3af)', marginBottom: 16 }}>
                  Dashed line = team average. Green ≥ 90% · Amber ≥ 70% · Red &lt; 70%
                </div>
                <CounselorChart rows={byC} />
              </>
        )}
      </div>
    </div>
  );
};

export default SLAPage;
