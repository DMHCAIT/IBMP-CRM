import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useQuery } from '@tanstack/react-query';
import { callTimingAPI } from '../../api/api';

dayjs.extend(relativeTime);

/* ─── helpers ───────────────────────────────────────────── */
const segColor = (seg) =>
  seg === 'Hot' ? '#ef4444' : seg === 'Warm' ? '#f59e0b' : '#10b981';

const segEmoji = (seg) =>
  seg === 'Hot' ? '🔥' : seg === 'Warm' ? '⚡' : '❄️';

const statusColor = (s) => {
  const m = { Enrolled: '#10b981', Hot: '#ef4444', Warm: '#f59e0b', Fresh: '#3b82f6',
    'Follow Up': '#8b5cf6', 'Not Interested': '#9ca3af', 'Not Answering': '#6b7280', Junk: '#ef4444' };
  return m[s] || '#9ca3af';
};

/* ─── Score ring ─────────────────────────────────────────── */
const ScoreRing = ({ score }) => {
  const s = Math.round(score || 0);
  const r = 22, cx = 28, cy = 28;
  const circ = 2 * Math.PI * r;
  const fill = (s / 100) * circ;
  const color = s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize="12" fontWeight="800" fill={color}>{s}</text>
    </svg>
  );
};

/* ─── Row item ───────────────────────────────────────────── */
const Row = ({ icon, label, value, valueColor }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
    borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
    <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, width: 80 }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: 600, color: valueColor || '#111827',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {value || '—'}
    </span>
  </div>
);

/* ─── Best-time helper ───────────────────────────────────── */
const DAYS_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtH   = (h) => h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

const BestTimeValue = ({ country }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['call-timing', country || 'global'],
    queryFn: () => callTimingAPI.getCallTiming(country).then((r) => r.data),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
  if (isLoading) return <span style={{ color: '#9ca3af' }}>…</span>;
  const best = data?.best_windows?.[0];
  if (!best) return <span style={{ color: '#9ca3af' }}>—</span>;
  const label = best.dow !== undefined
    ? `${DAYS_S[best.dow]} ${fmtH(best.hour)}`
    : fmtH(best.hour);
  return (
    <span style={{ fontWeight: 700, color: '#10b981' }}>
      {label}
      <span style={{ fontWeight: 500, color: '#9ca3af', marginLeft: 5 }}>
        {(best.rate * 100).toFixed(0)}%
      </span>
    </span>
  );
};

/* ─── Portal card ────────────────────────────────────────── */
const CARD_W = 288;
const CARD_H = 356;

const PreviewCard = ({ lead, pos, onMouseEnter, onMouseLeave }) => {
  /* smart positioning — never clip off screen */
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = pos.x + 20 + CARD_W > vw ? pos.x - CARD_W - 12 : pos.x + 20;
  const top  = pos.y + CARD_H > vh - 16  ? vh - CARD_H - 16    : pos.y;

  const followDate = lead.follow_up_date ? dayjs(lead.follow_up_date) : null;
  const isOverdue  = followDate && followDate.isBefore(dayjs(), 'day');
  const isToday    = followDate && followDate.isSame(dayjs(), 'day');

  const lastContact = lead.last_contact_date
    ? dayjs(lead.last_contact_date).fromNow()
    : 'No contact yet';

  const waPhone = (lead.whatsapp || lead.phone || '').replace(/[^\d+]/g, '');

  return ReactDOM.createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left, top, zIndex: 9999,
        width: CARD_W,
        background: '#ffffff',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.10)',
        border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
        pointerEvents: 'auto',
        animation: 'hoverPreviewIn 0.15s ease',
      }}
    >
      {/* header band */}
      <div style={{
        background: `linear-gradient(135deg, ${segColor(lead.ai_segment)}18, ${segColor(lead.ai_segment)}08)`,
        borderBottom: `3px solid ${segColor(lead.ai_segment)}`,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: segColor(lead.ai_segment),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 16,
        }}>
          {lead.full_name?.charAt(0)?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.full_name}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, background: segColor(lead.ai_segment),
              color: '#fff', borderRadius: 20, padding: '1px 7px' }}>
              {segEmoji(lead.ai_segment)} {lead.ai_segment}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, background: statusColor(lead.status) + '20',
              color: statusColor(lead.status), borderRadius: 20, padding: '1px 7px',
              border: `1px solid ${statusColor(lead.status)}40` }}>
              {lead.status}
            </span>
          </div>
        </div>
        {/* score ring */}
        <ScoreRing score={lead.ai_score} />
      </div>

      {/* body */}
      <div style={{ padding: '8px 14px 4px' }}>
        <Row icon="📞" label="Phone"        value={lead.phone} />
        <Row icon="🌍" label="Country"      value={lead.country} />
        <Row icon="📚" label="Course"       value={lead.course_interested} />
        <Row icon="🔗" label="Source"       value={lead.source} />
        <Row
          icon="🕐"
          label="Last contact"
          value={lastContact}
          valueColor={lead.last_contact_date ? '#374151' : '#9ca3af'}
        />
        <Row
          icon="📅"
          label="Follow-up"
          value={
            followDate
              ? `${followDate.format('MMM D')}${isOverdue ? ' · Overdue' : isToday ? ' · Today' : ''}`
              : null
          }
          valueColor={isOverdue ? '#ef4444' : isToday ? '#f59e0b' : '#374151'}
        />
        {/* Best time to call */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
          <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>📞</span>
          <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, width: 80 }}>Best time</span>
          <BestTimeValue country={lead.country} />
        </div>
      </div>

      {/* action row */}
      <div style={{ padding: '10px 14px 12px', display: 'flex', gap: 8 }}>
        <a
          href={waPhone ? `https://wa.me/${waPhone}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => !waPhone && e.preventDefault()}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: waPhone ? '#25d366' : '#e5e7eb',
            color: waPhone ? '#fff' : '#9ca3af',
            borderRadius: 8, padding: '7px 0',
            fontWeight: 700, fontSize: 12, textDecoration: 'none',
            cursor: waPhone ? 'pointer' : 'not-allowed',
            border: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.845L0 24l6.335-1.507A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.37l-.36-.213-3.726.887.922-3.614-.234-.373A9.772 9.772 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/>
          </svg>
          WhatsApp
        </a>
        <a
          href={`/leads/${lead.lead_id}`}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: '#f3f4f6', color: '#374151',
            borderRadius: 8, padding: '7px 0',
            fontWeight: 700, fontSize: 12, textDecoration: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View
        </a>
      </div>
    </div>,
    document.body
  );
};

/* ─── keyframe injection (once) ─────────────────────────── */
let styleInjected = false;
const injectStyle = () => {
  if (styleInjected) return;
  styleInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes hoverPreviewIn {
      from { opacity: 0; transform: translateY(6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)   scale(1);    }
    }
  `;
  document.head.appendChild(s);
};

/* ─── Main export ────────────────────────────────────────── */
const LeadHoverPreview = ({ lead, pos }) => {
  const [visible, setVisible] = useState(false);
  const hideTimer  = useRef(null);
  const showTimer  = useRef(null);

  // When lead changes, show after a short delay
  useEffect(() => {
    injectStyle();
    clearTimeout(hideTimer.current);
    if (lead) {
      showTimer.current = setTimeout(() => setVisible(true), 120);
    } else {
      clearTimeout(showTimer.current);
      setVisible(false);
    }
    return () => { clearTimeout(showTimer.current); clearTimeout(hideTimer.current); };
  }, [lead]);

  if (!visible || !lead || !pos) return null;

  return (
    <PreviewCard
      lead={lead}
      pos={pos}
      onMouseEnter={() => clearTimeout(hideTimer.current)}
      onMouseLeave={() => {
        hideTimer.current = setTimeout(() => setVisible(false), 150);
      }}
    />
  );
};

export default LeadHoverPreview;
