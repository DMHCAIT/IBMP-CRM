import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  Target,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api, { userStatsAPI, dashboardAPI } from '../../api/api';

const CounselorDashboard = ({ user }) => {
  // Fetch counselor's personal stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['counselor-stats', user.id],
    queryFn: () => userStatsAPI.getStats(user.id).then(res => res.data),
  });

  // Fetch today's follow-ups (using dashboardAPI which handles assigned_to param)
  const { data: followUps = [], isLoading: followUpsLoading } = useQuery({
    queryKey: ['today-followups', user.id],
    queryFn: () => api.get('/api/leads/followups/today', { params: { assigned_to: user.id } })
      .then(res => Array.isArray(res.data) ? res.data : []),
  });

  // Fetch performance trend (last 7 days)
  const { data: performanceTrend = [] } = useQuery({
    queryKey: ['performance-trend', user.id],
    queryFn: () => userStatsAPI.getPerformance(user.id, 7)
      .then(res => Array.isArray(res.data) ? res.data : []),
  });

  // Ensure followUps is always an array
  const safeFollowUps = Array.isArray(followUps) ? followUps : [];

  const statCards = [
    {
      title: 'My Leads',
      value: stats?.total_leads || 0,
      icon: Users,
      color: '#3b82f6',
      trend: stats?.leads_trend || 0,
    },
    {
      title: "Today's Follow-ups",
      value: safeFollowUps.length,
      icon: Clock,
      color: '#f59e0b',
      urgent: safeFollowUps.filter(f => f.priority === 'high').length,
    },
    {
      title: 'Conversion Rate',
      value: `${stats?.conversion_rate || 0}%`,
      icon: Target,
      color: '#10b981',
      trend: stats?.conversion_trend || 0,
    },
    {
      title: 'My Revenue',
      value: `₹${(stats?.total_revenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: '#8b5cf6',
      trend: stats?.revenue_trend || 0,
    },
  ];

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '600', marginBottom: 'var(--space-2)' }}>
          Welcome back, {user.name}! 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>
          Here's your performance overview
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -4 }}
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: 'var(--space-4)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                  {stat.title}
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {stat.value}
                </div>
              </div>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: `${stat.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <stat.icon size={24} color={stat.color} />
              </div>
            </div>
            
            {stat.trend !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                {stat.trend > 0 ? (
                  <>
                    <ArrowUp size={14} color="#10b981" />
                    <span style={{ fontSize: 'var(--text-sm)', color: '#10b981', fontWeight: '500' }}>
                      {stat.trend}% vs last week
                    </span>
                  </>
                ) : stat.trend < 0 ? (
                  <>
                    <ArrowDown size={14} color="#ef4444" />
                    <span style={{ fontSize: 'var(--text-sm)', color: '#ef4444', fontWeight: '500' }}>
                      {Math.abs(stat.trend)}% vs last week
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                    No change
                  </span>
                )}
              </div>
            )}

            {stat.urgent !== undefined && stat.urgent > 0 && (
              <div style={{ 
                marginTop: 'var(--space-2)',
                padding: 'var(--space-2)',
                background: '#ef444415',
                borderRadius: '6px',
                fontSize: 'var(--text-xs)',
                color: '#ef4444',
                fontWeight: '500',
              }}>
                {stat.urgent} urgent follow-ups
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        {/* Performance Trend */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: 'var(--space-4)',
          border: '1px solid var(--border-color)',
        }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            Your Performance (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={performanceTrend}>
              <defs>
                <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-tertiary)" style={{ fontSize: '12px' }} />
              <YAxis stroke="var(--text-tertiary)" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  background: 'var(--bg-primary)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                }}
              />
              <Area type="monotone" dataKey="conversions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorConversions)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Distribution */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: 'var(--space-4)',
          border: '1px solid var(--border-color)',
        }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            My Lead Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats?.lead_distribution || []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                label
              >
                {(stats?.lead_distribution || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Today's Follow-ups */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: 'var(--space-4)',
        border: '1px solid var(--border-color)',
      }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
          Today's Follow-ups ({followUps.length})
        </h3>
        
        {followUps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>
            <CheckCircle size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
            <p>All caught up! No follow-ups for today.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {followUps.map((followUp) => (
              <motion.div
                key={followUp.id}
                whileHover={{ x: 4 }}
                style={{
                  padding: 'var(--space-3)',
                  background: 'var(--bg-primary)',
                  borderRadius: '8px',
                  border: `1px solid ${followUp.priority === 'high' ? '#ef4444' : 'var(--border-color)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: '4px' }}>
                    {followUp.lead_name}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    {followUp.note || 'Follow-up required'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {followUp.priority === 'high' && (
                    <span style={{
                      padding: '4px 8px',
                      background: '#ef444415',
                      color: '#ef4444',
                      borderRadius: '6px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: '600',
                    }}>
                      URGENT
                    </span>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: 'var(--text-sm)',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Contact Now
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CounselorDashboard;
