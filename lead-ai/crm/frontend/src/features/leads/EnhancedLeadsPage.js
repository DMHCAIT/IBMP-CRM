/**
 * EnhancedLeadsPage — Server-side filtered, paginated lead list.
 *
 * What changed vs the old version:
 *  - Filtering is done on the SERVER (Supabase) — no longer fetching 500 leads
 *    and filtering in the browser.
 *  - Search is debounced 350 ms before triggering an API call.
 *  - Pagination: configurable page size (default 50), "Load More" or page nav.
 *  - Segment counts come from the backend stats endpoint — not re-counted
 *    from the current page's data.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Filter, Download, Eye, Mail, MessageCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { leadsAPI, dashboardAPI } from '../../api/api';
import { AIScoreTooltip } from '../../components/ai/AIInsightCard';
import { Button, Badge } from '../../components/ui/FormComponents';
import { TableSkeleton } from '../../components/ui/Skeletons';
import { EmptyState } from '../../components/ui/EmptyStates';
import { isFeatureEnabled } from '../../config/featureFlags';

const PAGE_SIZE = 50;

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const SEGMENT_CONFIG = [
  { key: 'all',  label: 'All Leads', color: null },
  { key: 'HOT',  label: 'Hot',       color: '#ef4444' },
  { key: 'WARM', label: 'Warm',      color: '#f59e0b' },
  { key: 'COLD', label: 'Cold',      color: '#10b981' },
  { key: 'JUNK', label: 'Junk',      color: '#6b7280' },
];

const EnhancedLeadsPage = () => {
  const navigate    = useNavigate();
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [searchInput, setSearchInput]         = useState('');
  const [page, setPage]                       = useState(1);

  // Debounce search — API call fires 350 ms after the user stops typing
  const debouncedSearch = useDebounce(searchInput, 350);

  // Reset to page 1 whenever filter/search changes
  const resetPage = useCallback(() => setPage(1), []);
  React.useEffect(resetPage, [selectedSegment, debouncedSearch, resetPage]);

  // Build backend query params from UI state
  const queryParams = {
    limit: PAGE_SIZE,
    skip:  (page - 1) * PAGE_SIZE,
    ...(selectedSegment !== 'all' && { segment: selectedSegment }),
    ...(debouncedSearch.trim()    && { search: debouncedSearch.trim() }),
  };

  // ── Main leads query (server-side filtered + paginated) ──────────────────
  const {
    data:      leadsData,
    isLoading: leadsLoading,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ['leads', 'list', queryParams],
    queryFn:  () => leadsAPI.getAll(queryParams).then(r => r.data),
    keepPreviousData: true,  // keep old data visible while new page loads
    staleTime: 60_000,
  });

  const leads      = leadsData?.leads    ?? [];
  const totalLeads = leadsData?.total    ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE));

  // ── Stats for segment pill counts (separate lightweight query) ───────────
  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn:  () => dashboardAPI.getStats().then(r => r.data),
    staleTime: 120_000,
  });

  const segmentCount = useCallback((key) => {
    if (key === 'all')  return stats?.total_leads  ?? '—';
    if (key === 'HOT')  return stats?.hot_leads    ?? '—';
    if (key === 'WARM') return stats?.warm_leads   ?? '—';
    if (key === 'COLD') return stats?.cold_leads   ?? '—';
    if (key === 'JUNK') return stats?.junk_leads   ?? '—';
    return '—';
  }, [stats]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (leadsLoading && page === 1) return <TableSkeleton rows={10} />;
  if (isError) return (
    <EmptyState
      title="Failed to load leads"
      description="Could not reach the server. Check your connection and try again."
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Lead Management
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {totalLeads.toLocaleString()} leads
            {isFetching && <span style={{ marginLeft: 8, color: 'var(--accent)', fontSize: 11 }}>↻ refreshing…</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon={Download}>Export</Button>
          <Button variant="secondary" icon={Filter}>Filters</Button>
          <Button variant="primary"   icon={Plus}   onClick={() => navigate('/leads/new')}>Add Lead</Button>
        </div>
      </div>

      {/* ── Segment filter pills ── */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {SEGMENT_CONFIG.map(seg => {
          const active = selectedSegment === seg.key;
          return (
            <button
              key={seg.key}
              onClick={() => setSelectedSegment(seg.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: active ? 'var(--accent)' : 'var(--bg-primary)',
                color: active ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {seg.color && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: active ? 'rgba(255,255,255,0.8)' : seg.color,
                  flexShrink: 0,
                }} />
              )}
              {seg.label}
              <span style={{
                padding: '1px 7px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                background: active ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
              }}>
                {segmentCount(seg.key)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search bar ── */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Search size={15} color="var(--text-tertiary)" />
        <input
          type="text"
          placeholder="Search by name, email or phone… (server-side)"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          }}
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {leads.length === 0 ? (
        <EmptyState
          title="No leads found"
          description={debouncedSearch ? 'Try a different search term' : 'Add your first lead to get started'}
        />
      ) : (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          opacity: isFetching ? 0.7 : 1,
          transition: 'opacity 0.2s ease',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 100px',
            gap: 12,
            padding: '12px 20px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            <div>Lead</div><div>Contact</div><div>Segment</div>
            <div>AI Score</div><div>Revenue</div><div>Actions</div>
          </div>

          {/* Rows */}
          {leads.map((lead, idx) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }} // cap delay at 300ms
              whileHover={{ backgroundColor: 'var(--bg-secondary)' }}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 100px',
                gap: 12,
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background-color 0.1s ease',
              }}
              onClick={() => navigate(`/leads/${lead.id}`)}
            >
              {/* Lead Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 13,
                }}>
                  {lead.full_name?.charAt(0)?.toUpperCase() || 'L'}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {lead.full_name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    {lead.lead_id || `#${lead.id}`}
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  {lead.email || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {lead.phone || lead.whatsapp || '—'}
                </div>
              </div>

              {/* Segment */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Badge variant={
                  lead.ai_segment === 'HOT'  ? 'error'   :
                  lead.ai_segment === 'WARM' ? 'warning' :
                  lead.ai_segment === 'JUNK' ? 'default' : 'success'
                }>
                  {lead.ai_segment || 'COLD'}
                </Badge>
              </div>

              {/* AI Score */}
              <div style={{ display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                {isFeatureEnabled('AI_INSIGHTS') ? (
                  <AIScoreTooltip score={lead.ai_score ?? 0} />
                ) : (
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {lead.ai_score ?? 0}
                  </span>
                )}
              </div>

              {/* Revenue */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--success)' }}>
                  {lead.expected_revenue
                    ? `₹${Number(lead.expected_revenue).toLocaleString('en-IN')}`
                    : '—'}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                {[
                  { icon: Eye,           title: 'View',    fn: () => navigate(`/leads/${lead.id}`) },
                  { icon: Mail,          title: 'Email',   fn: () => {} },
                  { icon: MessageCircle, title: 'WhatsApp',fn: () => {} },
                ].map(({ icon: Icon, title, fn }) => (
                  <button
                    key={title}
                    title={title}
                    onClick={fn}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            Page {page} of {totalPages} &nbsp;·&nbsp; {totalLeads.toLocaleString()} total leads
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-primary)', cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4,
                color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
              }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-primary)', cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4,
                color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default EnhancedLeadsPage;
