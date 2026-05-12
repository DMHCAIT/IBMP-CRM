import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Switch, InputNumber, Button, Tag, Table, Tooltip, Alert,
  Divider, Statistic, message, Tabs, Badge,
} from 'antd';
import {
  ThunderboltOutlined, PlayCircleOutlined, SettingOutlined,
  HistoryOutlined, EyeOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import { decayAPI } from '../api/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/* ─── colour helpers ────────────────────────────────────────── */
const statusColor = (s) => ({
  Hot: '#ef4444', Warm: '#f59e0b', Fresh: '#3b82f6',
  'Follow Up': '#8b5cf6', 'Not Interested': '#9ca3af',
  'Not Answering': '#6b7280', Junk: '#6b7280', Enrolled: '#10b981',
}[s] || '#9ca3af');

const reasonLabel = { hot_to_warm: '🔥→⚡ Hot to Warm', warm_to_stale: '⚡→🔄 Warm to Follow-up', score_only: '📉 Score decay', none: '—' };
const reasonColor = { hot_to_warm: 'red', warm_to_stale: 'orange', score_only: 'purple', none: 'default' };

const fmtHours = (h) => {
  if (h < 1)   return `${Math.round(h * 60)}m`;
  if (h < 24)  return `${h.toFixed(0)}h`;
  return `${(h / 24).toFixed(1)}d`;
};

/* ─── ConfigCard ────────────────────────────────────────────── */
const ConfigCard = ({ config, onSave, saving }) => {
  const [local, setLocal] = useState(config);
  const set = (k, v) => setLocal((c) => ({ ...c, [k]: v }));

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 12,
      border: '1px solid var(--border-color)', padding: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            <SettingOutlined style={{ marginRight: 8, color: '#6b7280' }} />
            Decay Thresholds
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Configure when leads are automatically downgraded
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Engine</span>
          <Switch
            checked={local.enabled}
            onChange={(v) => set('enabled', v)}
            checkedChildren="ON"
            unCheckedChildren="OFF"
            style={{ background: local.enabled ? '#10b981' : undefined }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {/* Hot → Warm */}
        <div style={{
          padding: 16, borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fecaca',
        }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🔥 → ⚡</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b', marginBottom: 4 }}>
            Hot → Warm
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
            Downgrade Hot leads after this many hours of silence
          </div>
          <InputNumber
            min={1} max={720}
            value={local.hot_to_warm_hours}
            onChange={(v) => set('hot_to_warm_hours', v)}
            addonAfter="hours"
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            = {fmtHours(local.hot_to_warm_hours)} of silence
          </div>
        </div>

        {/* Warm → Follow Up */}
        <div style={{
          padding: 16, borderRadius: 10,
          background: '#fffbeb', border: '1px solid #fde68a',
        }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>⚡ → 🔄</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 4 }}>
            Warm → Follow Up
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
            Downgrade Warm leads after this many hours of silence
          </div>
          <InputNumber
            min={24} max={2160}
            value={local.warm_to_stale_hours}
            onChange={(v) => set('warm_to_stale_hours', v)}
            addonAfter="hours"
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            = {fmtHours(local.warm_to_stale_hours)} of silence
          </div>
        </div>

        {/* Score decay */}
        <div style={{
          padding: 16, borderRadius: 10,
          background: '#fdf4ff', border: '1px solid #e9d5ff',
          opacity: local.apply_score_decay ? 1 : 0.5,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>📉</div>
            <Switch
              size="small"
              checked={local.apply_score_decay}
              onChange={(v) => set('apply_score_decay', v)}
            />
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#6b21a8', marginBottom: 4 }}>
            AI Score Decay
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
            Points deducted per day without contact
          </div>
          <InputNumber
            min={0.5} max={20} step={0.5}
            value={local.score_decay_per_day}
            onChange={(v) => set('score_decay_per_day', v)}
            addonAfter="pts/day"
            disabled={!local.apply_score_decay}
            style={{ width: '100%' }}
          />
        </div>

        {/* Check interval */}
        <div style={{
          padding: 16, borderRadius: 10,
          background: '#eff6ff', border: '1px solid #bfdbfe',
        }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>⏱️</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1d4ed8', marginBottom: 4 }}>
            Check Interval
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
            How often the background engine runs
          </div>
          <InputNumber
            min={0.25} max={24} step={0.25}
            value={local.check_interval_hours}
            onChange={(v) => set('check_interval_hours', v)}
            addonAfter="hours"
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            ≈ every {fmtHours(local.check_interval_hours)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Button
          type="primary"
          loading={saving}
          onClick={() => onSave(local)}
          style={{ background: '#10b981', borderColor: '#10b981' }}
        >
          Save Configuration
        </Button>
      </div>

      {config.updated_at && (
        <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 8 }}>
          Last updated {dayjs(config.updated_at).fromNow()}
          {config.updated_by ? ` by ${config.updated_by}` : ''}
        </div>
      )}
    </div>
  );
};

/* ─── PreviewTable ──────────────────────────────────────────── */
const PreviewTable = ({ data, onRunNow, running }) => {
  const statusChanges = (data?.leads || []).filter(
    (l) => l.pending_changes.some((p) => p.type === 'status')
  );
  const scoreOnly = (data?.leads || []).filter(
    (l) => l.pending_changes.every((p) => p.type === 'score')
  );

  const columns = [
    {
      title: 'Lead',
      render: (_, r) => (
        <div>
          <a href={`/leads/${r.lead_id}`} style={{ fontWeight: 600, fontSize: 13 }}>
            {r.full_name}
          </a>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.assigned_to || 'Unassigned'}</div>
        </div>
      ),
    },
    {
      title: 'Silent for',
      render: (_, r) => (
        <span style={{
          fontWeight: 700, fontSize: 13,
          color: r.hours_since_contact > 72 ? '#ef4444' : r.hours_since_contact > 48 ? '#f59e0b' : '#6b7280',
        }}>
          {fmtHours(r.hours_since_contact)}
        </span>
      ),
      sorter: (a, b) => b.hours_since_contact - a.hours_since_contact,
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Pending Changes',
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {r.pending_changes.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {c.type === 'status' ? (
                <>
                  <Tag color={statusColor(c.from) === '#ef4444' ? 'red' : 'orange'} style={{ margin: 0 }}>
                    {c.from}
                  </Tag>
                  <ArrowDownOutlined style={{ color: '#6b7280', fontSize: 10 }} />
                  <Tag color="default" style={{ margin: 0 }}>{c.to}</Tag>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600 }}>
                    Score {c.from} → {c.to}
                  </span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    (−{(c.from - c.to).toFixed(1)})
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* stats strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Will be downgraded', value: statusChanges.length, color: '#ef4444', bg: '#fef2f2' },
          { label: 'Score will decay',   value: scoreOnly.length + statusChanges.filter(l => l.pending_changes.some(p=>p.type==='score')).length, color: '#8b5cf6', bg: '#fdf4ff' },
          { label: 'Total affected',     value: data?.count || 0, color: '#f59e0b', bg: '#fffbeb' },
        ].map((s) => (
          <div key={s.label} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10,
            background: s.bg, border: `1px solid ${s.color}30`,
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {data?.count === 0 ? (
        <div style={{
          padding: '32px 24px', textAlign: 'center',
          background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: '#065f46' }}>All leads are up to date!</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            No leads qualify for decay on the next cycle.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {data?.count} lead{data?.count !== 1 ? 's' : ''} would be affected — preview only, no changes made
            </span>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={running}
              onClick={onRunNow}
              danger
            >
              Apply Now
            </Button>
          </div>
          <Table
            dataSource={data?.leads || []}
            columns={columns}
            rowKey="lead_id"
            size="small"
            pagination={{ pageSize: 10, showTotal: (t) => `${t} leads` }}
            rowStyle={(r) =>
              r.pending_changes.some((p) => p.type === 'status')
                ? { background: '#fff7ed' }
                : {}
            }
          />
        </>
      )}
    </div>
  );
};

/* ─── DecayLogTable ─────────────────────────────────────────── */
const DecayLogTable = ({ data }) => {
  const columns = [
    {
      title: 'Lead',
      render: (_, r) => (
        <div>
          <a href={`/leads/${r.lead_id}`} style={{ fontWeight: 600, fontSize: 13 }}>
            {r.lead_name || r.lead_id}
          </a>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.assigned_to || 'Unassigned'}</div>
        </div>
      ),
    },
    {
      title: 'Change',
      render: (_, r) => (
        <div>
          <Tag color={reasonColor[r.reason] || 'default'} style={{ fontSize: 11 }}>
            {reasonLabel[r.reason] || r.reason}
          </Tag>
          {r.old_status && r.new_status && (
            <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ color: statusColor(r.old_status), fontWeight: 600 }}>{r.old_status}</span>
              <ArrowDownOutlined style={{ fontSize: 9, color: '#9ca3af' }} />
              <span style={{ color: statusColor(r.new_status), fontWeight: 600 }}>{r.new_status}</span>
            </div>
          )}
          {r.old_score !== null && r.new_score !== null && (
            <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 2 }}>
              Score: {r.old_score} → {r.new_score}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Silent',
      dataIndex: 'hours_since_contact',
      render: (h) => (
        <span style={{ fontWeight: 600, color: h > 72 ? '#ef4444' : '#f59e0b' }}>
          {fmtHours(h)}
        </span>
      ),
    },
    {
      title: 'When',
      dataIndex: 'created_at',
      render: (d) => (
        <Tooltip title={dayjs(d).format('DD MMM YYYY HH:mm')}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{dayjs(d).fromNow()}</span>
        </Tooltip>
      ),
    },
  ];

  return (
    <Table
      dataSource={data?.events || []}
      columns={columns}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 20, showTotal: (t) => `${t} events` }}
      locale={{ emptyText: 'No decay events yet — the engine will log here once it runs.' }}
    />
  );
};

/* ─── Main page ─────────────────────────────────────────────── */
const ScoreDecayPage = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['decay-config'],
    queryFn: () => decayAPI.getConfig().then((r) => r.data),
  });

  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ['decay-preview'],
    queryFn: () => decayAPI.getPreview().then((r) => r.data),
  });

  const { data: log, isLoading: logLoading } = useQuery({
    queryKey: ['decay-log'],
    queryFn: () => decayAPI.getLog({ limit: 200 }).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => decayAPI.updateConfig(data),
    onSuccess: () => {
      message.success('Configuration saved!');
      queryClient.invalidateQueries({ queryKey: ['decay-config'] });
      refetchPreview();
    },
    onError: (e) => message.error(e.message),
  });

  const runMutation = useMutation({
    mutationFn: () => decayAPI.runNow(),
    onSuccess: (res) => {
      const d = res.data;
      message.success(
        `Cycle complete — ${d.downgraded} downgraded, ${d.score_decayed} scores decayed`
      );
      queryClient.invalidateQueries({ queryKey: ['decay-log'] });
      queryClient.invalidateQueries({ queryKey: ['decay-preview'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => message.error(e.message),
  });

  const totalDecays    = log?.total || 0;
  const todayDecays    = (log?.events || []).filter(
    (e) => dayjs(e.created_at).isAfter(dayjs().startOf('day'))
  ).length;
  const statusDecays   = (log?.events || []).filter(
    (e) => e.reason !== 'score_only'
  ).length;

  const tabItems = [
    {
      key: 'preview',
      label: (
        <span>
          <EyeOutlined /> Preview
          {preview?.count > 0 && (
            <Badge count={preview.count} style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: previewLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading preview…</div>
      ) : (
        <PreviewTable
          data={preview}
          onRunNow={() => runMutation.mutate()}
          running={runMutation.isPending}
        />
      ),
    },
    {
      key: 'log',
      label: (
        <span>
          <HistoryOutlined /> Decay Log
          {totalDecays > 0 && (
            <Tag style={{ marginLeft: 6, fontSize: 11 }}>{totalDecays}</Tag>
          )}
        </span>
      ),
      children: logLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading log…</div>
      ) : (
        <DecayLogTable data={log} />
      ),
    },
  ];

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #fef2f2, #fdf4ff)',
              border: '1px solid #fecaca',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>
              📉
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Score Decay Engine
              </h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                Automatically downgrade stale Hot/Warm leads to keep your pipeline honest
              </p>
            </div>
          </div>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={runMutation.isPending}
            onClick={() => runMutation.mutate()}
            danger
            size="large"
          >
            Run Cycle Now
          </Button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12, marginBottom: 24,
      }}>
        {[
          { label: 'Total Decays',    value: totalDecays,  color: '#6b7280', icon: '📋' },
          { label: 'Today',           value: todayDecays,  color: '#ef4444', icon: '📅' },
          { label: 'Status Changes',  value: statusDecays, color: '#f59e0b', icon: '🔄' },
          { label: 'At Risk Now',     value: preview?.count || 0, color: '#8b5cf6', icon: '⚠️' },
        ].map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 10, padding: '14px 16px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginTop: 4 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Config card ── */}
      {!configLoading && config && (
        <div style={{ marginBottom: 24 }}>
          <ConfigCard
            config={config}
            onSave={(d) => saveMutation.mutate(d)}
            saving={saveMutation.isPending}
          />
        </div>
      )}

      {/* ── Explainer ── */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20, borderRadius: 10 }}
        message="How the decay engine works"
        description={
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            The engine runs every <strong>{config?.check_interval_hours || 1}h</strong> in the background.
            Hot leads with no recorded contact are downgraded to <strong>Warm</strong> after{' '}
            <strong>{config?.hot_to_warm_hours || 48}h</strong>. Warm leads are downgraded to{' '}
            <strong>Follow Up</strong> after{' '}
            <strong>{fmtHours(config?.warm_to_stale_hours || 168)}</strong>.
            {config?.apply_score_decay && (
              <> AI scores additionally drop <strong>{config?.score_decay_per_day || 3} pts/day</strong> without contact.</>
            )}{' '}
            Each decay event is logged below and added as a system note on the lead's timeline.
          </div>
        }
      />

      {/* ── Preview + Log tabs ── */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 12,
        border: '1px solid var(--border-color)', padding: '0 24px 24px',
      }}>
        <Tabs items={tabItems} />
      </div>
    </div>
  );
};

export default ScoreDecayPage;
