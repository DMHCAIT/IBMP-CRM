import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { callTimingAPI } from '../../api/api';

/* ─── helpers ──────────────────────────────────────────────── */
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BUSINESS_HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am–7pm

const fmtHour = (h) => {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
};

/* colour for a cell: white → light green → deep green */
const cellColor = (rate, maxRate) => {
  if (rate === null || rate === undefined || maxRate === 0) return '#f3f4f6';
  const t = Math.min(rate / maxRate, 1);
  const r = Math.round(240 - t * 170);
  const g = Math.round(210 + t * 45);
  const b = Math.round(240 - t * 190);
  return `rgb(${r},${g},${b})`;
};

/* ─── Rank medals ───────────────────────────────────────────── */
const MEDALS = ['🥇', '🥈', '🥉'];

/* ─────────────────────────────────────────────────────────────
   COMPACT variant — single-row summary for hover preview
───────────────────────────────────────────────────────────── */
export const CallTimeBestRow = ({ country }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['call-timing', country || 'global'],
    queryFn: () => callTimingAPI.getCallTiming(country).then((r) => r.data),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) return <span style={{ color: '#9ca3af' }}>…</span>;

  const best = data?.best_windows?.[0];
  if (!best) return <span style={{ color: '#9ca3af' }}>—</span>;

  const label =
    best.dow !== undefined
      ? `${DAYS_SHORT[best.dow]} ${fmtHour(best.hour)}`
      : fmtHour(best.hour);

  return (
    <span style={{ fontWeight: 700, color: '#10b981' }}>
      {label}
      <span style={{ fontWeight: 500, color: '#6b7280', marginLeft: 6 }}>
        ({(best.rate * 100).toFixed(0)}% connect)
      </span>
    </span>
  );
};

/* ─────────────────────────────────────────────────────────────
   FULL widget — for LeadDetails right-column card
───────────────────────────────────────────────────────────── */
const CallTimeWidget = ({ country }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['call-timing', country || 'global'],
    queryFn: () => callTimingAPI.getCallTiming(country).then((r) => r.data),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  const nowHour = new Date().getHours();
  const nowDow  = new Date().getDay();

  if (isLoading) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
        Analysing call patterns…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: '12px 0', color: '#9ca3af', fontSize: 13 }}>
        No call data available yet. Add call notes to see patterns here.
      </div>
    );
  }

  // Not enough data yet
  if (!data.best_windows?.length && data.data_quality === 'insufficient') {
    return (
      <div style={{
        padding: '16px', background: '#fafafa', borderRadius: 8,
        border: '1px dashed #e5e7eb', textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📞</div>
        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>
          No call data yet
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          Once your team logs call notes, this will show the best
          times to reach leads from <strong>{data.country || 'this country'}</strong>.
        </div>
      </div>
    );
  }

  const bestWindows = data.best_windows || [];
  const heatmap     = data.heatmap     || {};

  /* is the current moment a "good" window? */
  const isGoodNow = bestWindows.some(
    (w) => w.hour === nowHour && (w.dow === undefined || w.dow === nowDow)
  );

  /* pre-compute max rate for colour scale */
  const allRates = Object.values(heatmap).flatMap((hourMap) =>
    Object.values(hourMap).map((cell) => cell?.rate ?? 0)
  );
  const maxRate = Math.max(...allRates, 0.001);

  return (
    <div>
      {/* ── "good now?" badge ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20,
            background: isGoodNow ? '#ecfdf5' : '#fffbeb',
            border: `1px solid ${isGoodNow ? '#a7f3d0' : '#fde68a'}`,
            color: isGoodNow ? '#059669' : '#d97706',
            fontWeight: 700, fontSize: 12,
          }}
        >
          {isGoodNow ? '✅ Good time to call now' : '⏰ Not optimal right now'}
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          {fmtHour(nowHour)} IST · {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][nowDow]}
        </span>
        {data.data_quality === 'low' && (
          <span style={{ fontSize: 11, color: '#f59e0b', fontStyle: 'italic' }}>
            ⚠ limited data ({data.overall?.total_calls || 0} calls logged)
          </span>
        )}
      </div>

      {/* ── Best windows ──────────────────────────────────── */}
      {bestWindows.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
          }}>
            Top Windows
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bestWindows.slice(0, 3).map((w, i) => {
              const timeLabel =
                w.dow !== undefined
                  ? `${DAYS_SHORT[w.dow]} · ${fmtHour(w.hour)}`
                  : fmtHour(w.hour);
              const isNow = w.hour === nowHour && (w.dow === undefined || w.dow === nowDow);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 12px', borderRadius: 8,
                    background: isNow ? '#ecfdf5' : i === 0 ? '#f0fdf4' : '#f9fafb',
                    border: `1px solid ${isNow ? '#6ee7b7' : i === 0 ? '#bbf7d0' : '#e5e7eb'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{MEDALS[i]}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {timeLabel}
                    </span>
                    {isNow && (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        background: '#10b981', color: '#fff',
                        borderRadius: 10, padding: '1px 7px',
                      }}>
                        NOW
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                      {(w.rate * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{w.calls} calls</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Heatmap ───────────────────────────────────────── */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#6b7280',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
        }}>
          Connection Rate · {country || 'All Countries'} · times in IST
        </div>

        {/* hour labels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `28px repeat(${BUSINESS_HOURS.length}, 1fr)`,
          gap: 2, marginBottom: 2,
        }}>
          <div />
          {BUSINESS_HOURS.map((h) => (
            <div
              key={h}
              style={{
                fontSize: 8, color: '#9ca3af', textAlign: 'center',
                visibility: h % 3 === 0 ? 'visible' : 'hidden',
              }}
            >
              {fmtHour(h)}
            </div>
          ))}
        </div>

        {/* rows: one per day */}
        {DAYS_SHORT.map((dayName, dow) => (
          <div
            key={dow}
            style={{
              display: 'grid',
              gridTemplateColumns: `28px repeat(${BUSINESS_HOURS.length}, 1fr)`,
              gap: 2, marginBottom: 2,
            }}
          >
            <div style={{
              fontSize: 9, color: '#6b7280', fontWeight: 600,
              display: 'flex', alignItems: 'center',
            }}>
              {dayName}
            </div>
            {BUSINESS_HOURS.map((hour) => {
              const cell  = heatmap?.[String(dow)]?.[String(hour)];
              const rate  = cell?.rate ?? null;
              const calls = cell?.calls ?? 0;
              const isNowCell = dow === nowDow && hour === nowHour;
              return (
                <div
                  key={hour}
                  title={
                    rate !== null
                      ? `${dayName} ${fmtHour(hour)}: ${(rate * 100).toFixed(0)}% (${calls} calls)`
                      : 'No data'
                  }
                  style={{
                    height: 14, borderRadius: 2,
                    background: cellColor(rate, maxRate),
                    outline: isNowCell ? '2px solid #3b82f6' : 'none',
                    outlineOffset: 1,
                  }}
                />
              );
            })}
          </div>
        ))}

        {/* legend */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginTop: 8, justifyContent: 'flex-end',
        }}>
          <span style={{ fontSize: 9, color: '#9ca3af' }}>0%</span>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
            <div
              key={t}
              style={{
                width: 14, height: 10, borderRadius: 2,
                background: cellColor(t * maxRate, maxRate),
              }}
            />
          ))}
          <span style={{ fontSize: 9, color: '#9ca3af' }}>
            {(maxRate * 100).toFixed(0)}%
          </span>
        </div>

        {/* overall stats footer */}
        {data.overall && (
          <div style={{
            display: 'flex', gap: 16, marginTop: 10,
            padding: '8px 12px', borderRadius: 8, background: '#f9fafb',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                {data.overall.total_calls}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>Total calls</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>
                {(data.overall.avg_connection_rate * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>Avg connect</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>
                {fmtHour(data.overall.best_hour)}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>Best hour</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallTimeWidget;
