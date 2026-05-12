/**
 * LeadTimeline
 * =============
 * A production-grade vertical timeline showing every touchpoint for a lead,
 * merged from four sources (notes, activities, chat_messages, communication_history)
 * plus synthetic lifecycle events.
 *
 * Features:
 *  - Live refresh via WebSocket (no manual reload needed)
 *  - Date-group headers ("Today", "Yesterday", "Mon 5 May 2026")
 *  - Kind filter chips (All · WhatsApp · Email · Call · Note · Status · AI · System)
 *  - Load-more pagination (200 items per page)
 *  - Inline "Add note" form
 *  - Direction badges (← Received / → Sent)
 *  - Collapsible long bodies (> 3 lines auto-collapsed)
 *  - Skeleton loading state
 *  - Empty-state illustration
 *
 * Usage:
 *   <LeadTimeline leadId="LEAD26050812AB1234" />
 *
 * Relies on:
 *   - useWsEvent  (auto-invalidates on note.created / activity.created)
 *   - leadsAPI.getTimeline, leadsAPI.addNote
 *   - Ant Design (Tag, Tooltip, Skeleton, message, Input, Button)
 */

import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag, Tooltip, Skeleton, message, Input, Button, Badge,
} from 'antd';
import {
  MessageOutlined,
  MailOutlined,
  PhoneOutlined,
  FileTextOutlined,
  SwapOutlined,
  RobotOutlined,
  PlusCircleOutlined,
  SendOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
// Use lucide-react for arrow icons — avoids webpack HMR lazy-load path issue
// with @ant-design/icons v5 dynamic icon resolution
import { ArrowUp, ArrowDown } from 'lucide-react';
import { leadsAPI } from '../api/api';
import useWsEvent from '../hooks/useWsEvent';

const { TextArea } = Input;

// ── Kind configuration ────────────────────────────────────────────────────────
const KIND = {
  whatsapp: {
    label:  'WhatsApp',
    color:  '#25d366',
    bg:     '#e8fdf0',
    border: '#25d36633',
    Icon:   MessageOutlined,
  },
  email: {
    label:  'Email',
    color:  '#3b82f6',
    bg:     '#eff6ff',
    border: '#3b82f633',
    Icon:   MailOutlined,
  },
  call: {
    label:  'Call',
    color:  '#8b5cf6',
    bg:     '#f5f3ff',
    border: '#8b5cf633',
    Icon:   PhoneOutlined,
  },
  note: {
    label:  'Note',
    color:  '#f59e0b',
    bg:     '#fffbeb',
    border: '#f59e0b33',
    Icon:   FileTextOutlined,
  },
  status_change: {
    label:  'Status',
    color:  '#0ea5e9',
    bg:     '#f0f9ff',
    border: '#0ea5e933',
    Icon:   SwapOutlined,
  },
  activity: {
    label:  'Update',
    color:  '#64748b',
    bg:     '#f8fafc',
    border: '#64748b33',
    Icon:   SyncOutlined,
  },
  ai_score: {
    label:  'AI',
    color:  '#ec4899',
    bg:     '#fdf2f8',
    border: '#ec489933',
    Icon:   RobotOutlined,
  },
  lifecycle: {
    label:  'System',
    color:  '#10b981',
    bg:     '#ecfdf5',
    border: '#10b98133',
    Icon:   CheckCircleOutlined,
  },
};

const ALL_KINDS = Object.keys(KIND);

// ── Date helpers ──────────────────────────────────────────────────────────────
function _parseDate(ts) {
  try { return new Date(ts); } catch { return new Date(0); }
}

function _dayKey(ts) {
  const d = _parseDate(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function _dayLabel(ts) {
  const d  = _parseDate(ts);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function _timeLabel(ts) {
  try {
    return _parseDate(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusIcon({ status }) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'read' || s === 'seen') return <CheckCircleOutlined style={{ color: '#25d366', fontSize: 11 }} />;
  if (s === 'delivered') return <CheckCircleOutlined style={{ color: '#94a3b8', fontSize: 11 }} />;
  if (s === 'failed' || s === 'error') return <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 11 }} />;
  if (s === 'sent') return <CheckCircleOutlined style={{ color: '#cbd5e1', fontSize: 11 }} />;
  return null;
}

// ── Collapsible body ──────────────────────────────────────────────────────────
function CollapsibleBody({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const lines = text.split('\n');
  const isLong = lines.length > 3 || text.length > 180;
  const shown  = isLong && !expanded ? lines.slice(0, 3).join('\n') : text;
  return (
    <div>
      <p style={{
        margin: '4px 0 0',
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {shown}{isLong && !expanded ? '…' : ''}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', padding: 0, marginTop: 2,
            fontSize: 12, color: '#3b82f6', cursor: 'pointer',
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// ── Single timeline item ──────────────────────────────────────────────────────
function TimelineItem({ item }) {
  const cfg       = KIND[item.kind] || KIND.activity;
  const { Icon }  = cfg;
  const isInbound = item.direction === 'inbound';

  return (
    <div style={{
      display:       'flex',
      gap:           12,
      padding:       '12px 0',
      borderBottom:  '0.5px solid var(--color-border-tertiary)',
    }}>
      {/* Icon dot */}
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <div style={{
          width:        32,
          height:       32,
          borderRadius: '50%',
          background:   cfg.bg,
          border:       `1px solid ${cfg.border}`,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
        }}>
          <Icon style={{ fontSize: 14, color: cfg.color }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {item.title}
          </span>

          {/* Direction badge */}
          {item.direction && (
            <span style={{
              display:     'inline-flex',
              alignItems:  'center',
              gap:          3,
              fontSize:     10,
              padding:      '1px 6px',
              borderRadius: 4,
              background:   isInbound ? '#eff6ff' : '#f0fdf4',
              color:        isInbound ? '#1d4ed8' : '#166534',
              border:       `0.5px solid ${isInbound ? '#93c5fd' : '#86efac'}`,
            }}>
              {isInbound
                ? <><ArrowDown size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> Received</>
                : <><ArrowUp   size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> Sent</>
              }
            </span>
          )}

          {/* Delivery status */}
          <StatusIcon status={item.status} />
        </div>

        {/* Body */}
        <CollapsibleBody text={item.body} />

        {/* Footer meta */}
        <div style={{ display: 'flex', gap: 12, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {item.actor && item.actor !== 'System' && (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <UserOutlined style={{ fontSize: 10 }} />
              {item.actor}
            </span>
          )}
          {item.meta?.duration && (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <ClockCircleOutlined style={{ fontSize: 10 }} />
              {item.meta.duration}
            </span>
          )}
          <Tooltip title={new Date(item.ts).toLocaleString()}>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
              {_timeLabel(item.ts)}
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// ── Date group header ─────────────────────────────────────────────────────────
function DayDivider({ label }) {
  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        8,
      margin:     '16px 0 4px',
    }}>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
      <span style={{
        fontSize:  11,
        fontWeight: 500,
        color:      'var(--color-text-tertiary)',
        whiteSpace: 'nowrap',
        padding:    '0 6px',
        background: 'var(--color-background-primary)',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
    </div>
  );
}

// ── Add-note inline form ──────────────────────────────────────────────────────
function AddNoteForm({ leadId, onSuccess }) {
  const [open, setOpen]       = useState(false);
  const [text, setText]       = useState('');
  const [channel, setChannel] = useState('manual');
  const textRef               = useRef(null);

  const mutation = useMutation({
    mutationFn: () => leadsAPI.addNote(leadId, { content: text.trim(), channel }),
    onSuccess: () => {
      message.success('Note added');
      setText('');
      setOpen(false);
      onSuccess?.();
    },
    onError: () => message.error('Failed to add note'),
  });

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => textRef.current?.focus(), 50); }}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:          6,
          width:       '100%',
          padding:     '9px 14px',
          marginTop:   12,
          background:  'var(--color-background-secondary)',
          border:      '0.5px dashed var(--color-border-secondary)',
          borderRadius: 8,
          fontSize:    13,
          color:       'var(--color-text-tertiary)',
          cursor:      'pointer',
        }}
      >
        <PlusCircleOutlined style={{ fontSize: 14 }} />
        Add a note, call log or activity…
      </button>
    );
  }

  return (
    <div style={{
      marginTop:    12,
      background:   'var(--color-background-secondary)',
      border:       '0.5px solid var(--color-border-secondary)',
      borderRadius: 8,
      padding:      12,
    }}>
      {/* Channel selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {[
          { key: 'manual',    label: 'Note' },
          { key: 'call',      label: 'Call' },
          { key: 'whatsapp',  label: 'WhatsApp' },
          { key: 'email',     label: 'Email' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setChannel(key)}
            style={{
              padding:      '3px 10px',
              borderRadius: 4,
              fontSize:     12,
              fontWeight:   channel === key ? 500 : 400,
              cursor:       'pointer',
              border:       channel === key
                ? `1px solid ${KIND[key === 'manual' ? 'note' : key]?.color || '#3b82f6'}`
                : '0.5px solid var(--color-border-tertiary)',
              background:   channel === key
                ? (KIND[key === 'manual' ? 'note' : key]?.bg || '#eff6ff')
                : 'transparent',
              color:        channel === key
                ? (KIND[key === 'manual' ? 'note' : key]?.color || '#3b82f6')
                : 'var(--color-text-secondary)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <TextArea
        ref={textRef}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={
          channel === 'call'     ? 'Call summary, outcome, follow-up agreed…' :
          channel === 'whatsapp' ? 'Paste the message or summarise the conversation…' :
          channel === 'email'    ? 'Email subject and summary…' :
                                   'Add a note…'
        }
        autoSize={{ minRows: 2, maxRows: 6 }}
        style={{ fontSize: 13, marginBottom: 8 }}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) {
            mutation.mutate();
          }
        }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={() => { setText(''); setOpen(false); }}>
          Cancel
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined />}
          loading={mutation.isPending}
          disabled={!text.trim()}
          onClick={() => mutation.mutate()}
        >
          Save  <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2 }}>⌘↵</span>
        </Button>
      </div>
    </div>
  );
}

// ── Filter chips ──────────────────────────────────────────────────────────────
function KindFilter({ value, onChange, counts }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      <button
        onClick={() => onChange(null)}
        style={{
          padding:      '3px 10px',
          borderRadius: 4,
          fontSize:     12,
          fontWeight:   !value ? 500 : 400,
          cursor:       'pointer',
          border:       !value ? '1px solid #3b82f6' : '0.5px solid var(--color-border-tertiary)',
          background:   !value ? '#eff6ff' : 'transparent',
          color:        !value ? '#1d4ed8' : 'var(--color-text-secondary)',
        }}
      >
        All{counts.total ? ` · ${counts.total}` : ''}
      </button>
      {ALL_KINDS.map(k => {
        const cfg     = KIND[k];
        const isActive = value === k;
        const count   = counts[k] || 0;
        if (!count && !isActive) return null;
        return (
          <button
            key={k}
            onClick={() => onChange(isActive ? null : k)}
            style={{
              padding:      '3px 10px',
              borderRadius: 4,
              fontSize:     12,
              fontWeight:   isActive ? 500 : 400,
              cursor:       'pointer',
              border:       isActive ? `1px solid ${cfg.color}` : '0.5px solid var(--color-border-tertiary)',
              background:   isActive ? cfg.bg : 'transparent',
              color:        isActive ? cfg.color : 'var(--color-text-secondary)',
            }}
          >
            {cfg.label}{count ? ` · ${count}` : ''}
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LeadTimeline({ leadId, compact = false }) {
  const queryClient         = useQueryClient();
  const [kindFilter, setKindFilter] = useState(null);
  const [page, setPage]     = useState(0);
  const LIMIT               = 200;

  const qKey = ['timeline', leadId, kindFilter, page];

  const { data, isLoading, isError } = useQuery({
    queryKey: qKey,
    queryFn:  () => leadsAPI.getTimeline(leadId, {
      limit:  LIMIT,
      offset: page * LIMIT,
      ...(kindFilter ? { kinds: kindFilter } : {}),
    }).then(r => r.data),
    enabled:  !!leadId,
    staleTime: 30_000,
  });

  // Live refresh on WS events
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['timeline', leadId] });
  }, [queryClient, leadId]);

  useWsEvent('note.created',     invalidate);
  useWsEvent('activity.created', invalidate);
  useWsEvent('status.changed',   invalidate);
  useWsEvent('lead.updated',     invalidate);
  useWsEvent('ai.score_updated', invalidate);

  // Count items per kind for filter chips
  const counts = React.useMemo(() => {
    const all = data?.items || [];
    const c   = { total: data?.total || 0 };
    ALL_KINDS.forEach(k => { c[k] = all.filter(i => i.kind === k).length; });
    return c;
  }, [data]);

  // Group items by day
  const grouped = React.useMemo(() => {
    const items = data?.items || [];
    const groups = [];
    let lastKey  = null;
    items.forEach(item => {
      const key = _dayKey(item.ts);
      if (key !== lastKey) {
        groups.push({ type: 'divider', key, label: _dayLabel(item.ts) });
        lastKey = key;
      }
      groups.push({ type: 'item', item });
    });
    return groups;
  }, [data]);

  const hasMore = data ? (page + 1) * LIMIT < data.total : false;

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: compact ? 0 : '4px 0' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            <Skeleton.Avatar active size={32} />
            <div style={{ flex: 1 }}>
              <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 1, width: '80%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
        Failed to load timeline. <button onClick={() => queryClient.invalidateQueries({ queryKey: qKey })}
          style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: compact ? 0 : '4px 0' }}>
      {/* Filter chips + total count */}
      <KindFilter value={kindFilter} onChange={setKindFilter} counts={counts} />

      {/* Add note */}
      {!compact && (
        <AddNoteForm leadId={leadId} onSuccess={invalidate} />
      )}

      {/* Empty state */}
      {grouped.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: 0 }}>
            No activity yet. Add a note to start the conversation history.
          </p>
        </div>
      )}

      {/* Timeline items */}
      {grouped.map((row, i) => (
        row.type === 'divider'
          ? <DayDivider key={`div-${row.key}`} label={row.label} />
          : <TimelineItem key={row.item.id} item={row.item} />
      ))}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => setPage(p => p + 1)}
          style={{
            width:        '100%',
            marginTop:    12,
            padding:      '8px 0',
            background:   'transparent',
            border:       '0.5px solid var(--color-border-secondary)',
            borderRadius: 6,
            fontSize:     13,
            color:        'var(--color-text-secondary)',
            cursor:       'pointer',
          }}
        >
          Load older events ({data.total - (page + 1) * LIMIT} remaining)
        </button>
      )}
    </div>
  );
}
