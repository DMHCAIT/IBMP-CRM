import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  Target,
  DollarSign,
  Award,
  AlertTriangle,
  Activity,
  ArrowUp,
  ArrowDown,
  Crown,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { adminAPI } from '../../api/api';
import SLAWidget from '../../components/dashboard/SLAWidget';

const AdminDashboard = () => {
  // Fetch admin stats
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminAPI.getStats().then(res => res.data),
  });

  // Fetch team performance
  const { data: teamPerformance = [] } = useQuery({
    queryKey: ['team-performance'],
    queryFn: () => adminAPI.getTeamPerformance().then(res => Array.isArray(res.data) ? res.data : []),
  });

  // Fetch funnel leakage analysis
  const { data: funnelLeakage = [] } = useQuery({
    queryKey: ['funnel-leakage'],
    queryFn: () => adminAPI.getFunnelAnalysis().then(res => Array.isArray(res.data) ? res.data : []),
  });

  // Fetch revenue trend
  const { data: revenueTrend = [] } = useQuery({
    queryKey: ['revenue-trend'],
    queryFn: () => adminAPI.getRevenueTrend(30).then(res => Array.isArray(res.data) ? res.data : []),
  });

  const statCards = [
    {
      title: 'Total Revenue',
      value: `₹${((stats?.total_revenue || 0) / 100000).toFixed(1)}L`,
      icon: DollarSign,
      color: '#10b981',
      trend: stats?.revenue_trend || 0,
      subtitle: 'This month',
    },
    {
      title: 'Total Leads',
      value: stats?.total_leads || 0,
      icon: Users,
      color: '#3b82f6',
      trend: stats?.leads_trend || 0,
      subtitle: 'All time',
    },
    {
      title: 'Team Performance',
      value: `${stats?.avg_conversion_rate || 0}%`,
      icon: Target,
      color: '#8b5cf6',
      trend: stats?.conversion_trend || 0,
      subtitle: 'Avg conversion rate',
    },
    {
      title: 'Active Users',
      value: stats?.active_users || 0,
      icon: Activity,
      color: '#f59e0b',
      subtitle: `${stats?.total_users || 0} total`,
    },
  ];

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <Crown size={28} color="#fbbf24" />
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '600', margin: 0 }}>
            Admin Dashboard
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>
          Complete overview of your organization
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
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {stat.subtitle}
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
                      {stat.trend}% vs last month
                    </span>
                  </>
                ) : stat.trend < 0 ? (
                  <>
                    <ArrowDown size={14} color="#ef4444" />
                    <span style={{ fontSize: 'var(--text-sm)', color: '#ef4444', fontWeight: '500' }}>
                      {Math.abs(stat.trend)}% vs last month
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                    No change
                  </span>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        {/* Revenue Trend */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: 'var(--space-4)',
          border: '1px solid var(--border-color)',
        }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            Revenue Trend (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueTrend}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Funnel Leakage */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: 'var(--space-4)',
          border: '1px solid var(--border-color)',
        }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            Funnel Leakage Analysis
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {funnelLeakage.map((stage) => (
              <div key={stage.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: '500' }}>{stage.stage}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    {stage.drop_rate}% drop
                  </span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div
                    style={{
                      width: `${100 - stage.drop_rate}%`,
                      height: '100%',
                      background: stage.drop_rate > 30 ? '#ef4444' : stage.drop_rate > 15 ? '#f59e0b' : '#10b981',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Performance + SLA side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: 'var(--space-4)',
          border: '1px solid var(--border-color)',
        }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            Team Performance Comparison
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" stroke="var(--text-tertiary)" style={{ fontSize: '12px' }} />
              <YAxis stroke="var(--text-tertiary)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="leads"       fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="conversions" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue"     fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* SLA Compliance Widget */}
        <SLAWidget />
      </div>
    </div>
  );
};

export default AdminDashboard;
