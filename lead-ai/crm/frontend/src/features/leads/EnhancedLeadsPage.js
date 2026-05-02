import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Filter, Download, Eye, Trash2, Mail, MessageCircle } from 'lucide-react';
import { leadsAPI } from '../api/api';
import { AIScoreTooltip } from '../components/ai/AIInsightCard';
import { Button, Badge } from '../components/ui/FormComponents';
import { TableSkeleton } from '../components/ui/Skeletons';
import { EmptyState } from '../components/ui/EmptyStates';
import { isFeatureEnabled } from '../config/featureFlags';

const EnhancedLeadsPage = () => {
  const navigate = useNavigate();
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', selectedSegment],
    queryFn: () => leadsAPI.getAll({ limit: 500, skip: 0 }).then(res => res.data?.leads || []),
  });

  const filteredLeads = leads?.filter(lead => {
    const matchesSegment = selectedSegment === 'all' || lead.segment === selectedSegment;
    const matchesSearch = !searchTerm || 
      lead.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSegment && matchesSearch;
  });

  const segments = [
    { key: 'all', label: 'All Leads', count: leads?.length || 0 },
    { key: 'hot', label: 'Hot', count: leads?.filter(l => l.segment === 'hot').length || 0, color: '#ef4444' },
    { key: 'warm', label: 'Warm', count: leads?.filter(l => l.segment === 'warm').length || 0, color: '#f59e0b' },
    { key: 'cold', label: 'Cold', count: leads?.filter(l => l.segment === 'cold').length || 0, color: '#10b981' },
  ];

  if (isLoading) {
    return <TableSkeleton rows={10} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Lead Management
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {filteredLeads?.length || 0} total leads
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon={Download}>Export</Button>
          <Button variant="secondary" icon={Filter}>Filters</Button>
          <Button variant="primary" icon={Plus}>Add Lead</Button>
        </div>
      </div>

      {/* Segment Filters */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
        {segments.map(segment => (
          <button
            key={segment.key}
            onClick={() => setSelectedSegment(segment.key)}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: selectedSegment === segment.key ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: selectedSegment === segment.key ? 'var(--accent)' : 'var(--bg-primary)',
              color: selectedSegment === segment.key ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {segment.color && (
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: selectedSegment === segment.key ? '#fff' : segment.color,
              }} />
            )}
            {segment.label}
            <span style={{
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              background: selectedSegment === segment.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
            }}>
              {segment.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Leads Table */}
      {filteredLeads?.length === 0 ? (
        <EmptyState
          title="No leads found"
          description="Try adjusting your filters or add a new lead"
        />
      ) : (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 120px',
            gap: 16,
            padding: '16px 24px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
          }}>
            <div>Lead Info</div>
            <div>Contact</div>
            <div>Segment</div>
            <div>AI Score</div>
            <div>Revenue</div>
            <div>Actions</div>
          </div>

          {/* Table Rows */}
          <div>
            {filteredLeads?.map((lead, idx) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ backgroundColor: 'var(--bg-secondary)' }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 120px',
                  gap: 16,
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                {/* Lead Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14,
                  }}>
                    {lead.full_name?.charAt(0) || 'L'}
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {lead.full_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      ID: {lead.id}
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 4 }}>
                    {lead.email || 'No email'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    {lead.phone_number || 'No phone'}
                  </div>
                </div>

                {/* Segment */}
                <div>
                  <Badge
                    variant={
                      lead.segment === 'hot' ? 'error' :
                      lead.segment === 'warm' ? 'warning' :
                      'success'
                    }
                  >
                    {lead.segment?.toUpperCase() || 'COLD'}
                  </Badge>
                </div>

                {/* AI Score with Tooltip */}
                <div onClick={(e) => e.stopPropagation()}>
                  {isFeatureEnabled('AI_INSIGHTS') ? (
                    <AIScoreTooltip score={lead.score || 0} />
                  ) : (
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {lead.score || 0}
                    </div>
                  )}
                </div>

                {/* Revenue */}
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--success)' }}>
                    ${(lead.potential_revenue || 5000).toLocaleString()}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                  }}>
                    <Mail size={14} />
                  </button>
                  <button style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                  }}>
                    <MessageCircle size={14} />
                  </button>
                  <button style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--error)',
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedLeadsPage;
