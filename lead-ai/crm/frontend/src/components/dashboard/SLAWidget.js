import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react';
import { slaAPI } from '../../api/api';

/* ─── mini compliance bar ─────────────────────────────── */
const Bar = ({ label, rate, count }) => {
  const color = rate == null ? '#9ca3af'
              : rate >= 90   ? '#10b981'
              : rate >= 70   ? '#f59e0b'
              :                '#ef4444';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color, flexShrink: 0, marginLeft: 8 }}>
          {rate != null ? `${rate}%` : '—'} <span style={{ fontWeight: 400, color: 'var(--text-tertiary,#9ca3af)' }}>({count})</span>
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-tertiary,#e5e7eb)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${rate ?? 0}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
};

/* ─── Gauge arc (SVG) ─────────────────────────────────── */
const Gauge = ({ rate }) => {
  const r   = 44;
  const cx  = 56, cy = 56;
  const circ = Math.PI * r; // half circle = π·r
  const filled = (rate ?? 0) / 100;
  const color  = rate == null ? '#9ca3af' : rate >= 90 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="112" height="72" viewBox="0 0 112 72">
      {/* track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="var(--bg-tertiary,#e5e7eb)" strokeWidth="10" strokeLinecap="round"
      />
      {/* fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${filled * circ} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontWeight="800" fill={color}>
        {rate != null ? `${rate}%` : '—'}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--text-tertiary,#9ca3af)">
        SLA compliance
      </text>
    </svg>
  );
};

/* ─── Widget ──────────────────────────────────────────── */
const SLAWidget = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['sla-compliance'],
    queryFn: () => slaAPI.getCompliance().then(r => r.data),
    staleTime: 3 * 60 * 1000,
  });

  const overall  = data?.overall;
  const counsel  = (data?.by_counselor ?? []).slice(0, 6); // top 6
  const active_b = data?.active_breaches ?? 0;
  const cfg      = data?.config;

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: 12,
      border: '1px solid var(--border-color)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(overall?.compliance_rate ?? 100) >= 80
            ? <ShieldCheck size={18} color="#10b981" />
            : <ShieldAlert size={18} color="#ef4444" />}
          <span style={{ fontWeight: 700, fontSize: 14 }}>SLA Compliance</span>
          {cfg && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary,#9ca3af)', marginLeft: 2 }}>
              first contact ≤{cfg.first_contact_hours}h
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/sla')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-primary,#3b82f6)', fontSize: 12, fontWeight: 600 }}
        >
          Details <ExternalLink size={12} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}><Spin /></div>
      ) : (
        <>
          {/* gauge + alert counts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Gauge rate={overall?.compliance_rate} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Compliant',  val: overall?.compliant,  color: '#10b981' },
                { label: 'Breached',   val: overall?.breached,   color: '#ef4444' },
                { label: 'Pending',    val: overall?.pending,    color: '#f59e0b' },
                { label: 'Active breaches', val: active_b,       color: '#8b5cf6' },
              ].map(it => (
                <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{it.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 'auto', paddingLeft: 8 }}>{it.val ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* per-counselor bars */}
          {counsel.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                By Counselor
              </div>
              {counsel.map(c => (
                <Bar key={c.counselor} label={c.counselor} rate={c.compliance_rate} count={c.total} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SLAWidget;
