import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spin, Empty, Tooltip as AntTooltip, Tag, Alert, Select } from 'antd';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { cohortAPI } from '../api/api';

/* ─── colour helpers ─────────────────────────────────────── */
// Heat-map cell: 0 % = white, 100 % = deep green
// below-avg cells lean amber/red
const heatColor = (rate, avg, mature) => {
  if (!mature) return { bg: '#f3f4f6', text: '#9ca3af' }; // immature – grey
  if (rate == null) return { bg: '#f3f4f6', text: '#9ca3af' };
  if (avg == null) {
    const t = Math.min(rate / 50, 1);
    return { bg: `rgba(16,185,129,${0.12 + t * 0.55})`, text: rate > 15 ? '#fff' : '#065f46' };
  }
  const delta = rate - avg;
  if (delta >= 10)  return { bg: '#059669', text: '#fff' };
  if (delta >= 2)   return { bg: '#10b981', text: '#fff' };
  if (delta >= -5)  return { bg: '#d1fae5', text: '#065f46' };
  if (delta >= -15) return { bg: '#fef3c7', text: '#92400e' };
  return             { bg: '#fee2e2', text: '#991b1b' };
};

const LINE_PALETTE = [
  '#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899',
  '#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4',
];

/* ─── tiny helpers ───────────────────────────────────────── */
const pct  = (v) => (v == null ? '—' : `${v}%`);
const num  = (v) => (v == null ? '—' : v);
const WINDOWS = [
  { key: 'rate_30', label: '30-Day',  mkey: 'mature_30', bkey: 'avg_rate_30',  days: 30 },
  { key: 'rate_60', label: '60-Day',  mkey: 'mature_60', bkey: 'avg_rate_60',  days: 60 },
  { key: 'rate_90', label: '90-Day',  mkey: 'mature_90', bkey: 'avg_rate_90',  days: 90 },
  { key: 'rate_total', label: 'Total', mkey: null,        bkey: 'avg_rate_total', days: null },
];

/* ─── curve data builder ─────────────────────────────────── */
const buildCurves = (cohorts) =>
  [30, 60, 90].map(d => {
    const pt = { day: `Day ${d}` };
    cohorts.forEach(c => { pt[c.label] = c[`rate_${d}`]; });
    return pt;
  });

/* ─── volume data builder ────────────────────────────────── */
const buildVolume = (cohorts) =>
  cohorts.map(c => ({ name: c.label, size: c.size, enrolled: c.conv_total, active: c.active, dead: c.dead }));

/* ─── Heatmap table ──────────────────────────────────────── */
const HeatmapTable = ({ cohorts, benchmarks, underperforming }) => {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-tertiary,#f1f5f9)' }}>
            {['Cohort', 'Size', '30-Day Conv.', '60-Day Conv.', '90-Day Conv.', 'Total Conv.', 'Active', 'Median Days'].map(h => (
              <th key={h} style={{
                padding: '10px 12px', fontWeight: 700, fontSize: 11,
                textAlign: h === 'Cohort' ? 'left' : 'center',
                color: 'var(--text-secondary,#6b7280)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                borderBottom: '2px solid var(--border-color,#e5e7eb)',
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
          {/* benchmark row */}
          <tr style={{ background: '#f0f9ff' }}>
            <td style={{ padding: '6px 12px', fontWeight: 700, fontSize: 11, color: '#0284c7', borderBottom: '1px solid #bae6fd' }}>
              ✦ Avg (mature)
            </td>
            <td style={{ borderBottom: '1px solid #bae6fd' }} />
            {['avg_rate_30','avg_rate_60','avg_rate_90','avg_rate_total'].map(k => (
              <td key={k} style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: '#0284c7', borderBottom: '1px solid #bae6fd', padding: '6px 4px' }}>
                {pct(benchmarks[k])}
              </td>
            ))}
            <td style={{ borderBottom: '1px solid #bae6fd' }} />
            <td style={{ borderBottom: '1px solid #bae6fd' }} />
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c, i) => {
            const isUnder = underperforming.includes(c.cohort);
            return (
              <tr key={c.cohort} style={{
                background: i % 2 === 0 ? 'var(--bg-primary,#fff)' : 'var(--bg-secondary,#f9fafb)',
                outline: isUnder ? '2px solid #fca5a5' : 'none',
              }}>
                {/* label */}
                <td style={{ padding: '9px 12px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color,#e5e7eb)' }}>
                  {c.label}
                  {isUnder && (
                    <span style={{ marginLeft: 6, fontSize: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                      UNDER
                    </span>
                  )}
                </td>
                {/* size */}
                <td style={{ textAlign: 'center', padding: '9px 8px', borderBottom: '1px solid var(--border-color,#e5e7eb)' }}>
                  {c.size}
                </td>
                {/* heat cells */}
                {WINDOWS.map(w => {
                  const rate   = c[w.key];
                  const mature = w.mkey ? c[w.mkey] : true;
                  const avg    = benchmarks[w.bkey];
                  const col    = heatColor(rate, avg, mature);
                  const count  = w.key === 'rate_total' ? c.conv_total
                               : w.key === 'rate_30'    ? c.conv_30
                               : w.key === 'rate_60'    ? c.conv_60
                               : c.conv_90;
                  return (
                    <td key={w.key} style={{
                      textAlign: 'center', padding: '9px 8px',
                      background: col.bg, color: col.text,
                      fontWeight: 700, fontSize: 13,
                      borderBottom: '1px solid var(--border-color,#e5e7eb)',
                    }}>
                      <AntTooltip title={mature ? `${count} / ${c.size} leads` : 'Cohort too young for this window'}>
                        <span>
                          {mature ? pct(rate) : (
                            <span style={{ fontSize: 11, fontWeight: 400 }}>⏳ —</span>
                          )}
                        </span>
                      </AntTooltip>
                    </td>
                  );
                })}
                {/* active */}
                <td style={{ textAlign: 'center', padding: '9px 8px', borderBottom: '1px solid var(--border-color,#e5e7eb)' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>{c.active}</span>
                </td>
                {/* median */}
                <td style={{ textAlign: 'center', padding: '9px 8px', borderBottom: '1px solid var(--border-color,#e5e7eb)' }}>
                  {c.median_days != null ? `${c.median_days}d` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ─── Conversion curve chart ─────────────────────────────── */
const CurveChart = ({ cohorts, underperforming, visibleCohorts }) => {
  const visible = cohorts.filter(c => visibleCohorts.length === 0 || visibleCohorts.includes(c.cohort));
  const data = buildCurves(visible);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 'auto']} />
        <Tooltip formatter={(v, name) => [`${v}%`, name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {visible.map((c, i) => {
          const isUnder = underperforming.includes(c.cohort);
          return (
            <Line
              key={c.cohort}
              type="monotone"
              dataKey={c.label}
              stroke={isUnder ? '#ef4444' : LINE_PALETTE[i % LINE_PALETTE.length]}
              strokeWidth={isUnder ? 2.5 : 1.8}
              strokeDasharray={isUnder ? '5 3' : undefined}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
};

/* ─── Volume bar chart ───────────────────────────────────── */
const VolumeChart = ({ cohorts }) => {
  const data = buildVolume(cohorts);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={52} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="size"     name="Total Leads"   stackId="a" fill="#c7d2fe" radius={[0,0,0,0]} />
        <Bar dataKey="enrolled" name="Enrolled"       stackId="a" fill="#10b981" radius={[0,0,0,0]} />
        <Bar dataKey="active"   name="Still Active"   stackId="a" fill="#60a5fa" radius={[0,0,0,0]} />
        <Bar dataKey="dead"     name="Lost"           stackId="a" fill="#f87171" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

/* ─── Page ───────────────────────────────────────────────── */
const CohortAnalysisPage = () => {
  const [visibleCohorts, setVisibleCohorts] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['cohort-analysis'],
    queryFn: () => cohortAPI.getCohorts().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const cohorts     = data?.cohorts        ?? [];
  const benchmarks  = data?.benchmarks     ?? {};
  const underperf   = data?.underperforming ?? [];

  // Recent 12 cohorts for the curve chart (too many lines = unreadable)
  const recent12 = useMemo(() => cohorts.slice(-12), [cohorts]);

  const cohortOptions = useMemo(() =>
    cohorts.map(c => ({ label: c.label, value: c.cohort })),
  [cohorts]);

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /></div>;
  }
  if (!cohorts.length) {
    return <Empty description="No cohort data available — leads need a created_at date." style={{ padding: '80px 0' }} />;
  }

  return (
    <div style={{ padding: '0 0 52px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Cohort Analysis</h1>
        <p style={{ color: 'var(--text-secondary,#6b7280)', marginTop: 6, marginBottom: 0, fontSize: 14 }}>
          Leads grouped by creation month. Track their 30 / 60 / 90-day conversion curves and spot
          under-performing cohorts before they age out.
        </p>
      </div>

      {/* Alert strip — underperforming */}
      {underperf.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 20, borderRadius: 10 }}
          message={
            <span>
              <strong>{underperf.length} cohort{underperf.length > 1 ? 's' : ''} under-performing</strong>
              {' '}— 90-day conversion rate is ≥15 pp below the average:&nbsp;
              {underperf.map(k => {
                const c = cohorts.find(x => x.cohort === k);
                return (
                  <Tag color="red" key={k} style={{ marginRight: 4 }}>
                    {c?.label ?? k} ({c?.rate_90}%)
                  </Tag>
                );
              })}
            </span>
          }
        />
      )}

      {/* KPI strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Cohorts',     value: cohorts.length,             accent: '#6366f1' },
          { label: 'Avg 30-Day Rate',   value: `${benchmarks.avg_rate_30 ?? '—'}%`,  accent: '#10b981' },
          { label: 'Avg 60-Day Rate',   value: `${benchmarks.avg_rate_60 ?? '—'}%`,  accent: '#3b82f6' },
          { label: 'Avg 90-Day Rate',   value: `${benchmarks.avg_rate_90 ?? '—'}%`,  accent: '#f59e0b' },
          { label: 'Under-performing',  value: underperf.length,            accent: underperf.length > 0 ? '#ef4444' : '#9ca3af' },
        ].map(k => (
          <div key={k.label} style={{
            flex: 1, minWidth: 140,
            background: 'var(--bg-secondary,#f9fafb)',
            borderRadius: 12, borderLeft: `4px solid ${k.accent}`,
            padding: '14px 18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary,#9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.accent, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Heatmap table */}
      <Section title="Cohort Heatmap" sub="Green = above average · Amber = slightly below · Red = significantly below · ⏳ = cohort too young for this window">
        <HeatmapTable cohorts={cohorts} benchmarks={benchmarks} underperforming={underperf} />
      </Section>

      {/* Conversion curves */}
      <Section
        title="30 / 60 / 90-Day Conversion Curves"
        sub="Red dashed lines = under-performing cohorts. Showing most recent 12 cohorts by default."
        controls={
          <Select
            mode="multiple"
            placeholder="Filter cohorts…"
            options={cohortOptions}
            value={visibleCohorts}
            onChange={setVisibleCohorts}
            style={{ minWidth: 220 }}
            maxTagCount={3}
            allowClear
            size="small"
          />
        }
      >
        <CurveChart
          cohorts={visibleCohorts.length ? cohorts.filter(c => visibleCohorts.includes(c.cohort)) : recent12}
          underperforming={underperf}
          visibleCohorts={visibleCohorts}
        />
      </Section>

      {/* Volume chart */}
      <Section title="Cohort Volume & Outcome Mix" sub="Stacked bars show how each cohort's leads are distributed across enrolled / active / lost.">
        <VolumeChart cohorts={cohorts} />
      </Section>

    </div>
  );
};

/* ─── Section wrapper ────────────────────────────────────── */
const Section = ({ title, sub, controls, children }) => (
  <div style={{
    background: 'var(--bg-secondary,#f9fafb)',
    borderRadius: 16,
    border: '1px solid var(--border-color,#e5e7eb)',
    padding: '20px 24px',
    marginBottom: 24,
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-tertiary,#9ca3af)', marginTop: 2 }}>{sub}</div>}
      </div>
      {controls && <div>{controls}</div>}
    </div>
    {children}
  </div>
);

export default CohortAnalysisPage;
