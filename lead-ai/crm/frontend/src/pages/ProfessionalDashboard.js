import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spin } from 'antd';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Flame,
  DollarSign,
  ArrowUp,
  ArrowDown,
  ArrowRight,
} from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardAPI, analyticsAPI, leadsAPI } from '../api/api';
import CounselorPerformanceWidget from '../components/CounselorPerformanceWidget';

const SEGMENT_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#6b7280'];

const StatCard = ({ title, value, icon: Icon, trend, color }) => (
  <motion.div
    whileHover={{ y: -2, boxShadow: '0 8px 24px var(--shadow)' }}
    style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 24,
      cursor: 'pointer',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {title}
      </span>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: `${color}10`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
      }}>
        <Icon size={20} />
      </div>
    </div>
    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
      {value}
    </div>
    {trend && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {trend.isUp ? (
          <ArrowUp size={14} style={{ color: 'var(--success)' }} />
        ) : (
          <ArrowDown size={14} style={{ color: 'var(--error)' }} />
        )}
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          color: trend.isUp ? 'var(--success)' : 'var(--error)',
        }}>
          {trend.value}%
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          vs last month
        </span>
      </div>
    )}
  </motion.div>
);

const ChartCard = ({ title, children, action }) => (
  <div style={{
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 24,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {action && (
        <button style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 16px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          fontWeight: 500,
        }}>
          {action}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
    {children}
  </div>
);

const ProfessionalDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => dashboardAPI.getStats().then(res => res.data)
  });

  const { data: revenueByCountry } = useQuery({
    queryKey: ['revenueByCountry'],
    queryFn: () => analyticsAPI.getRevenueByCountry().then(res => res.data).catch(() => [])
  });

  const { data: conversionFunnel } = useQuery({
    queryKey: ['conversionFunnel'],
    queryFn: () => analyticsAPI.getConversionFunnel().then(res => res.data).catch(() => [])
  });

  const { data: recentLeads } = useQuery({
    queryKey: ['recentLeads'],
    queryFn: () => leadsAPI.getAll({ limit: 5 }).then(res => res.data.leads || []).catch(() => [])
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Leads',
      value: stats?.total_leads?.toLocaleString() || '0',
      icon: Users,
      color: '#3b82f6',
      trend: { value: 12.5, isUp: true },
    },
    {
      title: 'Hot Leads',
      value: stats?.hot_leads?.toLocaleString() || '0',
      icon: Flame,
      color: '#ef4444',
      trend: { value: 8.3, isUp: true },
    },
    {
      title: 'Conversion Rate',
      value: `${stats?.conversion_rate || 0}%`,
      icon: TrendingUp,
      color: '#10b981',
      trend: { value: 2.1, isUp: false },
    },
    {
      title: 'Revenue',
      value: `$${(stats?.total_revenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: '#f59e0b',
      trend: { value: 15.7, isUp: true },
    },
  ];

  const segmentData = [
    { name: 'Hot', value: stats?.hot_leads || 0 },
    { name: 'Warm', value: stats?.warm_leads || 0 },
    { name: 'Cold', value: stats?.cold_leads || 0 },
    { name: 'Junk', value: stats?.junk_leads || 0 },
  ];

  const funnelData = Array.isArray(conversionFunnel) ? conversionFunnel.map(item => ({
    stage: item.stage,
    count: item.count,
  })) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        {statCards.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        {/* Lead Distribution */}
        <ChartCard title="Lead Distribution" action="View Details">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={segmentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                dataKey="value"
              >
                {segmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={SEGMENT_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue Trend */}
        <ChartCard title="Revenue Trend" action="View Report">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueByCountry || []}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="country" stroke="var(--text-tertiary)" style={{ fontSize: 12 }} />
              <YAxis stroke="var(--text-tertiary)" style={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Conversion Funnel */}
      <ChartCard title="Conversion Funnel">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={funnelData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" stroke="var(--text-tertiary)" style={{ fontSize: 12 }} />
            <YAxis dataKey="stage" type="category" stroke="var(--text-tertiary)" style={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Recent Leads */}
      <ChartCard title="Recent Leads" action="View All">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recentLeads?.slice(0, 5).map((lead, idx) => (
            <motion.div
              key={idx}
              whileHover={{ x: 4 }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                background: 'var(--bg-secondary)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
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
                    {lead.email || 'No email'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  background: lead.segment === 'hot' ? '#fef2f2' : lead.segment === 'warm' ? '#fef3c7' : '#f0fdf4',
                  color: lead.segment === 'hot' ? '#ef4444' : lead.segment === 'warm' ? '#f59e0b' : '#10b981',
                }}>
                  {lead.segment?.toUpperCase() || 'UNKNOWN'}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {lead.score || 0}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    Score
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
};

const ProfessionalDashboardWithPerformance = (props) => {
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const showTeam = ['Super Admin', 'Manager', 'Team Leader'].includes(user.role);
  return (
    <>
      <ProfessionalDashboard {...props} />
      {showTeam && (
        <div style={{ padding: '0 24px 24px' }}>
          <CounselorPerformanceWidget />
        </div>
      )}
    </>
  );
};

export default ProfessionalDashboardWithPerformance;
