import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, Spin, Empty, Table, Tag } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';
import { conversionTimeAPI } from '../api/api';

/* ─── palette & helpers ────────────────────────────────── */
const SPEED_PALETTE = [
  '#10b981', '#34d399', '#6ee7b7',
  '#fbbf24', '#f97316', '#ef4444',
];

const speedColor = (avgDays, globalAvg) => {
  if (avgDays == null) return '#9ca3af';
  if (avgDays <= globalAvg * 0.6) return '#10b981';
  if (avgDays <= globalAvg * 0.85) return '#34d399';
  if (avgDays <= globalAvg) return '#fbbf24';
  if (avgDays <= globalAvg * 1.3) return '#f97316';
  return '#ef4444';
};

const fmtDays = (d) => (d == null ? '—' : `${d}d`);

const DaysTooltip = ({ active, payload, label, globalAvg }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const diff = globalAvg ? ((val - globalAvg) / globalAvg * 100).toFixed(0) : null;
  return (
    <div style={{
      background: 'var(--bg-primary,#fff)',
      border: '1px solid var(--border-color,#e5e7eb)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ color: speedColor(val, globalAvg) }}>
        Avg: <strong>{fmtDays(val)}</strong>
      </div>
      {diff !== null && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary,#9ca3af)', marginTop: 2 }}>
          {diff > 0 ? `+${diff}% vs avg` : `${diff}% vs avg`}
        </div>
      )}
    </div>
  );
};

/* ─── KPI card ─────────────────────────────────────────── */
const KpiCard = ({ label, value, sub, accent }) => (
  <div style={{
    flex: 1, minWidth: 140,
    background: 'var(--bg-secondary,#f9fafb)',
    borderRadius: 12,
    borderLeft: `4px solid ${accent}`,
    padding: '14px 18px',
  }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary,#9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary,#6b7280)', marginTop: 4 }}>{sub}</div>}
  </div>
);

/* ─── Distribution histogram ────────────────────────────── */
const DistributionChart = ({ data, globalAvg }) => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={data} barCategoryGap="20%">
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
      <Tooltip
        formatter={(v) => [v, 'Leads']}
        contentStyle={{ borderRadius: 8, fontSize: 13 }}
      />
      {globalAvg != null && (
        <ReferenceLine
          x={data.find(d => d.lo <= globalAvg && globalAvg <= d.hi)?.bucket}
          stroke="#6366f1" strokeDasharray="4 3"
          label={{ value: 'avg', position: 'top', fontSize: 10, fill: '#6366f1' }}
        />
      )}
      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
        {data.map((entry, i) => (
          <Cell key={i} fill={SPEED_PALETTE[Math.min(i, SPEED_PALETTE.length - 1)]} />
        ))}
        <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

/* ─── Breakdown panel (chart + table) ─────────────────── */
const BreakdownPanel = ({ rows, globalAvg, nameLabel }) => {
  if (!rows?.length) return <Empty description="No data" style={{ padding: '40px 0' }} />;

  const top = rows.slice(0, 12);

  const tableColumns = [
    {
      title: '#',
      key: 'rank',
      width: 44,
      render: (_, __, i) => (
        <span style={{
          fontWeight: 700, fontSize: 12,
          color: i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : i === 2 ? '#f59e0b' : '#9ca3af',
        }}>
          {i + 1}
        </span>
      ),
    },
    {
      title: nameLabel,
      dataIndex: 'name',
      key: 'name',
      render: (v) => <strong style={{ fontSize: 13 }}>{v}</strong>,
    },
    {
      title: 'Enrolled',
      dataIndex: 'count',
      key: 'count',
      align: 'center',
      render: (v) => <Tag color="green">{v}</Tag>,
    },
    {
      title: 'Avg Days',
      dataIndex: 'avg_days',
      key: 'avg_days',
      align: 'center',
      sorter: (a, b) => (a.avg_days ?? 9999) - (b.avg_days ?? 9999),
      render: (v) => (
        <span style={{ fontWeight: 700, color: speedColor(v, globalAvg) }}>
          {fmtDays(v)}
        </span>
      ),
    },
    {
      title: 'Median',
      dataIndex: 'median_days',
      key: 'median_days',
      align: 'center',
      render: (v) => fmtDays(v),
    },
    {
      title: 'Fastest',
      dataIndex: 'min_days',
      key: 'min_days',
      align: 'center',
      render: (v) => <span style={{ color: '#10b981' }}>{fmtDays(v)}</span>,
    },
    {
      title: 'Slowest',
      dataIndex: 'max_days',
      key: 'max_days',
      align: 'center',
      render: (v) => <span style={{ color: '#ef4444' }}>{fmtDays(v)}</span>,
    },
    {
      title: 'vs Avg',
      key: 'vs_avg',
      align: 'center',
      render: (_, row) => {
        if (row.avg_days == null || globalAvg == null) return '—';
        const pct = Math.round(((row.avg_days - globalAvg) / globalAvg) * 100);
        return (
          <Tag color={pct <= -15 ? 'green' : pct <= 10 ? 'blue' : pct <= 30 ? 'orange' : 'red'}>
            {pct > 0 ? `+${pct}%` : `${pct}%`}
          </Tag>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Horizontal bar chart */}
      <ResponsiveContainer width="100%" height={Math.max(200, top.length * 36)}>
        <BarChart data={top} layout="vertical" margin={{ left: 8, right: 56 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `${v}d`}
            tick={{ fontSize: 11 }}
            domain={[0, 'auto']}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 11 }}
          />
          {globalAvg != null && (
            <ReferenceLine
              x={globalAvg}
              stroke="#6366f1"
              strokeDasharray="5 3"
              label={{ value: `avg ${globalAvg}d`, position: 'insideTopRight', fontSize: 10, fill: '#6366f1' }}
            />
          )}
          <Tooltip content={<DaysTooltip globalAvg={globalAvg} />} />
          <Bar dataKey="avg_days" radius={[0, 6, 6, 0]}>
            {top.map((entry, i) => (
              <Cell key={i} fill={speedColor(entry.avg_days, globalAvg)} />
            ))}
            <LabelList
              dataKey="avg_days"
              position="right"
              formatter={(v) => fmtDays(v)}
              style={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-primary,#111)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <Table
        dataSource={rows.map((r, i) => ({ ...r, key: r.name || i }))}
        columns={tableColumns}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        size="small"
        scroll={{ x: 640 }}
      />
    </div>
  );
};

/* ─── Page ─────────────────────────────────────────────── */
const ConversionTimePage = () => {
  const [tab, setTab] = useState('counselor');

  const { data, isLoading } = useQuery({
    queryKey: ['conversion-time'],
    queryFn: () => conversionTimeAPI.getConversionTime().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) return <Empty description="No conversion data available" />;

  const { overall, distribution, by_counselor, by_course, by_country } = data;
  const globalAvg = overall?.avg_days;

  const tabItems = [
    {
      key: 'counselor',
      label: `By Counselor (${by_counselor?.length ?? 0})`,
      children: (
        <BreakdownPanel rows={by_counselor} globalAvg={globalAvg} nameLabel="Counselor" />
      ),
    },
    {
      key: 'course',
      label: `By Course (${by_course?.length ?? 0})`,
      children: (
        <BreakdownPanel rows={by_course} globalAvg={globalAvg} nameLabel="Course" />
      ),
    },
    {
      key: 'country',
      label: `By Country (${by_country?.length ?? 0})`,
      children: (
        <BreakdownPanel rows={by_country} globalAvg={globalAvg} nameLabel="Country" />
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 48px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
          Time-to-Conversion Funnel
        </h1>
        <p style={{ color: 'var(--text-secondary,#6b7280)', marginTop: 6, marginBottom: 0, fontSize: 14 }}>
          How long does it take a lead to move from <strong>Fresh → Enrolled</strong>?
          Broken down by counselor, course, and country.
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <KpiCard
          label="Avg Conversion Time"
          value={fmtDays(overall?.avg_days)}
          sub={`across ${overall?.count ?? 0} enrolled leads`}
          accent="#6366f1"
        />
        <KpiCard
          label="Median"
          value={fmtDays(overall?.median_days)}
          sub="50th percentile"
          accent="#3b82f6"
        />
        <KpiCard
          label="Fastest Ever"
          value={fmtDays(overall?.min_days)}
          sub="quickest single conversion"
          accent="#10b981"
        />
        <KpiCard
          label="Slowest Ever"
          value={fmtDays(overall?.max_days)}
          sub="longest single conversion"
          accent="#ef4444"
        />
        <KpiCard
          label="25th Percentile"
          value={fmtDays(overall?.p25_days)}
          sub="fastest quarter"
          accent="#f59e0b"
        />
        <KpiCard
          label="75th Percentile"
          value={fmtDays(overall?.p75_days)}
          sub="slowest quarter"
          accent="#8b5cf6"
        />
      </div>

      {/* Distribution histogram */}
      <div style={{
        background: 'var(--bg-secondary,#f9fafb)',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 28,
        border: '1px solid var(--border-color,#e5e7eb)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          Conversion Time Distribution
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary,#9ca3af)', marginBottom: 16 }}>
          How many enrolled leads converted within each time window
        </div>
        <DistributionChart data={distribution ?? []} globalAvg={globalAvg} />
      </div>

      {/* Breakdown tabs */}
      <div style={{
        background: 'var(--bg-secondary,#f9fafb)',
        borderRadius: 16,
        padding: '20px 24px',
        border: '1px solid var(--border-color,#e5e7eb)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          Breakdown
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary,#9ca3af)', marginBottom: 16 }}>
          Sorted fastest → slowest. The dashed line marks the overall average ({fmtDays(globalAvg)}).
        </div>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={tabItems}
          size="small"
        />
      </div>
    </div>
  );
};

export default ConversionTimePage;
