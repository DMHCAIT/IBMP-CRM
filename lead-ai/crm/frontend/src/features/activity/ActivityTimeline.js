import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, Clock, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { isFeatureEnabled } from '../../config/featureFlags';
import { CardSkeleton } from '../../components/ui/Skeletons';
import api from '../../api/api';

/* ─── helpers ─────────────────────────────────────────────── */

// Supabase often returns timestamps without a timezone suffix, e.g.
// "2026-04-30T12:41:00" instead of "2026-04-30T12:41:00Z".
// Without the Z, new Date() treats it as LOCAL time → displayed time is
// 5h 30m behind for IST users. Appending Z forces correct UTC→local conversion.
const safeDate = (ts) => {
  if (!ts) return new Date();
  const str = String(ts);
  const hasOffset = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str);
  return new Date(hasOffset ? str : str + 'Z');
};

const formatRelative = (ts) => {
  const diff = Date.now() - safeDate(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return safeDate(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (ts) =>
  safeDate(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const dateBucket = (ts) => {
  const d = Math.floor((Date.now() - safeDate(ts).getTime()) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return safeDate(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

/* ─── per-type config ─────────────────────────────────────── */
const TYPE_CFG = {
  whatsapp: {
    color: '#25D366',
    bg: '#f0fdf4',
    darkBg: '#052e16',
    label: 'WhatsApp',
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.845L0 24l6.335-1.507A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.37l-.36-.213-3.726.887.922-3.614-.234-.373A9.772 9.772 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/>
      </svg>
    ),
  },
  call: {
    color: '#3b82f6',
    bg: '#eff6ff',
    darkBg: '#1e3a5f',
    label: 'Call',
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
      </svg>
    ),
  },
  email: {
    color: '#f59e0b',
    bg: '#fffbeb',
    darkBg: '#451a03',
    label: 'Email',
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  note: {
    color: '#8b5cf6',
    bg: '#f5f3ff',
    darkBg: '#2e1065',
    label: 'Note',
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
    ),
  },
  status: {
    color: '#ec4899',
    bg: '#fdf2f8',
    darkBg: '#500724',
    label: 'Status',
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  created: {
    color: '#10b981',
    bg: '#f0fdf4',
    darkBg: '#052e16',
    label: 'Created',
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    ),
  },
};

const cfgFor = (type) => TYPE_CFG[type] || TYPE_CFG.note;

/* ─── WA tick component ───────────────────────────────────── */
const WATick = ({ status }) => {
  if (status === 'read') {
    return <span style={{ color: '#53bdeb', fontSize: '11px', fontWeight: 600 }}>✓✓</span>;
  }
  if (status === 'delivered') {
    return <span style={{ color: '#aaa', fontSize: '11px' }}>✓✓</span>;
  }
  return <span style={{ color: '#aaa', fontSize: '11px' }}>✓</span>;
};

/* ─── DateDivider ─────────────────────────────────────────── */
const DateDivider = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
    <span style={{
      fontSize: '11px',
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      background: 'var(--bg-primary)',
      padding: '2px 10px',
      borderRadius: '20px',
      border: '1px solid var(--border-color)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
  </div>
);

/* ─── FilterPill ──────────────────────────────────────────── */
const FilterPill = ({ id, label, count, active, color, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.97 }}
    onClick={() => onClick(id)}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '5px 12px',
      borderRadius: '20px',
      border: active ? `1.5px solid ${color}` : '1.5px solid var(--border-color)',
      background: active ? color : 'var(--bg-secondary)',
      color: active ? '#fff' : 'var(--text-secondary)',
      fontSize: '12px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}
  >
    {label}
    {count > 0 && (
      <span style={{
        background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary, #e5e7eb)',
        color: active ? '#fff' : 'var(--text-secondary)',
        borderRadius: '10px',
        padding: '0 6px',
        fontSize: '10px',
        fontWeight: 700,
        minWidth: '18px',
        textAlign: 'center',
      }}>
        {count}
      </span>
    )}
  </motion.button>
);

/* ─── ActivityCard ────────────────────────────────────────── */
const ActivityCard = ({ activity, index }) => {
  const cfg = cfgFor(activity.type);

  if (activity.type === 'status') {
    return (
      <motion.div
        key={activity.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.6) }}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '36px' }}
      >
        {/* dot */}
        <div style={{
          position: 'absolute',
          left: '0px',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: cfg.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          border: '3px solid var(--bg-primary)',
          zIndex: 2,
          flexShrink: 0,
        }}>
          {cfg.icon}
        </div>
        {/* banner */}
        <div style={{
          flex: 1,
          borderRadius: '8px',
          background: cfg.bg,
          border: `1px solid ${cfg.color}33`,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: cfg.color }}>
            {activity.title || 'Status changed'}
          </span>
          {activity.content && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{activity.content}</span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
            {formatRelative(activity.timestamp)}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={activity.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.6) }}
      style={{ position: 'relative', paddingLeft: '46px' }}
    >
      {/* icon dot */}
      <div style={{
        position: 'absolute',
        left: '0px',
        top: '10px',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: cfg.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        border: '3px solid var(--bg-primary)',
        zIndex: 2,
        boxShadow: `0 0 0 4px ${cfg.color}22`,
      }}>
        {cfg.icon}
      </div>

      {/* card */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          background: cfg.bg,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: cfg.color }}>
              {activity.title || cfg.label}
            </span>
            {activity.type === 'whatsapp' && activity.direction === 'inbound' && (
              <span style={{ fontSize: '10px', color: '#25D366', fontWeight: 600, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', padding: '1px 5px' }}>
                IN
              </span>
            )}
            {activity.type === 'whatsapp' && activity.direction === 'outbound' && (
              <span style={{ fontSize: '10px', color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '1px 5px' }}>
                OUT
              </span>
            )}
            {activity.type === 'call' && activity.duration && (
              <span style={{ fontSize: '11px', color: '#3b82f6', background: '#eff6ff', borderRadius: '4px', padding: '1px 6px', border: '1px solid #bfdbfe' }}>
                ⏱ {activity.duration}
              </span>
            )}
            {activity.type === 'whatsapp' && activity.status && (
              <WATick status={activity.status} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {activity.user && (
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <User size={10} />
                {activity.user}
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={10} />
              {formatTime(activity.timestamp)}
            </span>
          </div>
        </div>

        {/* body */}
        {activity.content && (
          <div style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {activity.content}
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ─── AISummaryBanner ─────────────────────────────────────── */
const AISummaryBanner = ({ aiSummary }) => {
  const [open, setOpen] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '14px 16px',
        color: 'white',
        marginBottom: '4px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? '12px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} />
          <span style={{ fontWeight: 700, fontSize: '14px' }}>AI Summary — Last 7 Days</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}
        >
          <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', opacity: 0.85, marginBottom: '2px' }}>Engagement Level</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{aiSummary.engagement_level || 'Moderate — 3 interactions this week'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', opacity: 0.85, marginBottom: '2px' }}>Next Best Action</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{aiSummary.next_action || 'Follow up with course brochure — High interest detected'}</div>
              </div>
              {aiSummary.insights?.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginBottom: '4px' }}>Key Insights</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {aiSummary.insights.map((ins, i) => <li key={i}>{ins}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ─── Main Component ──────────────────────────────────────── */
const FILTER_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'call', label: 'Calls' },
  { id: 'email', label: 'Email' },
  { id: 'note', label: 'Notes' },
  { id: 'status', label: 'Status' },
];

const ActivityTimeline = ({ leadId }) => {
  const [activeFilter, setActiveFilter] = useState('all');

  const { data: allActivities = [], isLoading } = useQuery({
    queryKey: ['activities', leadId],
    queryFn: async () => {
      const res = await api.get(`/api/leads/${leadId}/activities`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: aiSummary } = useQuery({
    queryKey: ['ai-summary', leadId],
    queryFn: async () => {
      const res = await api.get(`/api/leads/${leadId}/ai-summary`);
      return res.data;
    },
    enabled: isFeatureEnabled('AI_ACTIVITY_SUMMARY'),
    staleTime: 5 * 60 * 1000,
  });

  /* counts per type */
  const counts = useMemo(() => {
    const c = {};
    for (const a of allActivities) c[a.type] = (c[a.type] || 0) + 1;
    return c;
  }, [allActivities]);

  /* filtered + grouped by date bucket */
  const grouped = useMemo(() => {
    const filtered = activeFilter === 'all'
      ? allActivities
      : allActivities.filter(a => a.type === activeFilter);

    const groups = {};
    for (const a of filtered) {
      const bucket = dateBucket(a.timestamp);
      if (!groups[bucket]) groups[bucket] = [];
      groups[bucket].push(a);
    }
    return Object.entries(groups);
  }, [allActivities, activeFilter]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* AI Summary */}
      {isFeatureEnabled('AI_ACTIVITY_SUMMARY') && aiSummary && (
        <AISummaryBanner aiSummary={aiSummary} />
      )}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {FILTER_TYPES.map(f => (
          <FilterPill
            key={f.id}
            id={f.id}
            label={f.label}
            count={f.id === 'all' ? allActivities.length : (counts[f.id] || 0)}
            active={activeFilter === f.id}
            color={f.id === 'all' ? '#6366f1' : cfgFor(f.id).color}
            onClick={setActiveFilter}
          />
        ))}
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: '14px' }}>
          No activities found
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* spine */}
          <div style={{
            position: 'absolute',
            left: '15px',
            top: '4px',
            bottom: '4px',
            width: '2px',
            background: 'linear-gradient(to bottom, var(--border-color), transparent)',
            zIndex: 0,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {grouped.map(([bucket, items]) => (
              <React.Fragment key={bucket}>
                <DateDivider label={bucket} />
                {items.map((activity, idx) => (
                  <div key={activity.id} style={{ position: 'relative' }}>
                    <ActivityCard activity={activity} index={idx} />
                    {/* connector line between cards within a group */}
                    {idx < items.length - 1 && (
                      <div style={{
                        position: 'absolute',
                        left: '15px',
                        top: '42px',
                        bottom: '-12px',
                        width: '2px',
                        background: 'var(--border-color)',
                        zIndex: 0,
                      }} />
                    )}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityTimeline;
