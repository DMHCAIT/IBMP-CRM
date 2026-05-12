import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  User,
  FileEdit,
  Trash2,
  Eye,
  Clock,
  Filter,
  Download,
  Search,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { TableSkeleton } from '../../components/ui/Skeletons';
import api from '../../api/api';

const AuditLogs = () => {
  const [filters, setFilters] = useState({
    user: '',
    action: '',
    entityType: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const [page, setPage] = useState(1);
  const limit = 50;

  // Fetch audit logs via centralized axios (handles 401 redirect automatically)
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () => {
      const params = {};
      if (filters.user) params.user = filters.user;
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.dateFrom) params.from = filters.dateFrom;
      if (filters.dateTo) params.to = filters.dateTo;
      if (filters.search) params.search = filters.search;
      params.page = page;
      params.limit = limit;
      const res = await api.get('/api/audit-logs', { params });
      return res.data;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  const logs = data?.logs || [];
  const totalPages = data?.totalPages || 1;

  const getActionIcon = (action) => {
    const icons = {
      create: FileEdit,
      update: FileEdit,
      delete: Trash2,
      view: Eye,
      login: User,
      logout: User,
    };
    return icons[action] || FileEdit;
  };

  const getActionColor = (action) => {
    const colors = {
      create: '#10b981',
      update: '#3b82f6',
      delete: '#ef4444',
      view: '#6b7280',
      login: '#8b5cf6',
      logout: '#f59e0b',
    };
    return colors[action] || '#6b7280';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Changes'].join(','),
      ...logs.map(log => [
        formatTimestamp(log.createdAt),
        log.performedBy,
        log.action,
        log.entityType,
        log.entityId,
        log.ipAddress || 'N/A',
        JSON.stringify(log.after || {}).replace(/,/g, ';'),
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <Shield size={28} color="#3b82f6" />
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '600', margin: 0 }}>
            Audit Logs
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>
          Immutable record of all system activities • Enterprise compliance ready
        </p>
      </div>

      {/* Filters */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: 'var(--space-4)',
        border: '1px solid var(--border-color)',
        marginBottom: 'var(--space-4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <Filter size={18} />
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', margin: 0 }}>Filters</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          {/* Search */}
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', display: 'block' }}>
              Search
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search logs..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              />
            </div>
          </div>

          {/* Action */}
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', display: 'block' }}>
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="view">View</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
            </select>
          </div>

          {/* Entity Type */}
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', display: 'block' }}>
              Entity Type
            </label>
            <select
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <option value="">All Types</option>
              <option value="lead">Lead</option>
              <option value="user">User</option>
              <option value="payment">Payment</option>
              <option value="role">Role</option>
              <option value="settings">Settings</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', display: 'block' }}>
              From Date
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>

          {/* Date To */}
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', display: 'block' }}>
              To Date
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>

          {/* Export Button */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={exportToCSV}
              disabled={logs.length === 0}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--color-primary)',
                color: 'white',
                fontSize: 'var(--text-sm)',
                fontWeight: '500',
                cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
                opacity: logs.length === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Download size={16} />
              Export CSV
            </motion.button>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-4)' }}>
            <TableSkeleton rows={10} />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>
            <Shield size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
            <p>No audit logs found</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Timestamp
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      User
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Action
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Entity
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      IP Address
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Changes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => {
                    const Icon = getActionIcon(log.action);
                    return (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        style={{ 
                          borderBottom: '1px solid var(--border-color)',
                          background: index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                        }}
                      >
                        <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <Clock size={14} color="var(--text-tertiary)" />
                            {formatTimestamp(log.createdAt)}
                          </div>
                        </td>
                        <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <User size={14} color="var(--text-tertiary)" />
                            {log.performedBy}
                          </div>
                        </td>
                        <td style={{ padding: 'var(--space-3)' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 'var(--space-1)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: `${getActionColor(log.action)}15`,
                              color: getActionColor(log.action),
                              fontSize: 'var(--text-xs)',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                            }}
                          >
                            <Icon size={12} />
                            {log.action}
                          </div>
                        </td>
                        <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                          <div>
                            <div style={{ fontWeight: '500' }}>{log.entityType}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                              ID: {log.entityId}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                          {log.ipAddress || 'N/A'}
                        </td>
                        <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                          {log.before && log.after ? (
                            <details>
                              <summary style={{ cursor: 'pointer', color: 'var(--color-primary)', fontSize: 'var(--text-xs)' }}>
                                View changes
                              </summary>
                              <div style={{ 
                                marginTop: 'var(--space-2)', 
                                padding: 'var(--space-2)', 
                                background: 'var(--bg-primary)',
                                borderRadius: '4px',
                                fontSize: 'var(--text-xs)',
                                fontFamily: 'monospace',
                              }}>
                                <div style={{ color: '#ef4444', marginBottom: '4px' }}>
                                  - {JSON.stringify(log.before)}
                                </div>
                                <div style={{ color: '#10b981' }}>
                                  + {JSON.stringify(log.after)}
                                </div>
                              </div>
                            </details>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ 
                padding: 'var(--space-4)', 
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.5 : 1,
                  }}
                >
                  Previous
                </motion.button>
                
                <div style={{ 
                  padding: '8px 16px', 
                  display: 'flex', 
                  alignItems: 'center',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                }}>
                  Page {page} of {totalPages}
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    opacity: page === totalPages ? 0.5 : 1,
                  }}
                >
                  Next
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          marginTop: 'var(--space-4)',
          padding: 'var(--space-3)',
          background: '#3b82f615',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          display: 'flex',
          gap: 'var(--space-3)',
        }}
      >
        <AlertCircle size={20} color="#3b82f6" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600', color: '#3b82f6', marginBottom: '4px' }}>
            Compliance & Security
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Audit logs are immutable and cannot be deleted. All system activities are tracked for compliance purposes.
            Logs are automatically encrypted and backed up daily.
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuditLogs;
