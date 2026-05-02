import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Statistic, Spin, Tag } from 'antd';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Flame,
  DollarSign,
  Target,
  Activity,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardAPI, analyticsAPI, leadsAPI } from '../api/api';
import { useTheme } from '../context/ThemeContext';

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#6b7280'];

const Dashboard = () => {
  const { colors, isDark } = useTheme();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => dashboardAPI.getStats().then(res => res.data)
  });

  const { data: revenueByCountry } = useQuery({
    queryKey: ['revenueByCountry'],
    queryFn: () => analyticsAPI.getRevenueByCountry().then(res => res.data)
  });

  const { data: conversionFunnel } = useQuery({
    queryKey: ['conversionFunnel'],
    queryFn: () => analyticsAPI.getConversionFunnel().then(res => res.data)
  });

  const { data: recentLeads } = useQuery({
    queryKey: ['recentLeads'],
    queryFn: () => leadsAPI.getAll({ limit: 5 }).then(res => res.data?.leads || [])
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  const segmentData = [
    { name: 'Hot', value: stats?.hot_leads || 0, color: '#ef4444' },
    { name: 'Warm', value: stats?.warm_leads || 0, color: '#f59e0b' },
    { name: 'Cold', value: stats?.cold_leads || 0, color: '#10b981' },
    { name: 'Junk', value: stats?.junk_leads || 0, color: '#6b7280' },
  ];

  const statCards = [
    {
      title: 'Total Leads',
      value: stats?.total_leads || 0,
      icon: Users,
      color: colors.primary,
      trend: { value: 12.5, isUp: true },
    },
    {
      title: 'Hot Leads',
      value: stats?.hot_leads || 0,
      icon: Flame,
      color: '#ef4444',
      trend: { value: 8.3, isUp: true },
    },
    {
      title: 'Conversion Rate',
      value: `${stats?.conversion_rate || 0}%`,
      icon: Target,
      color: colors.success,
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div key={index} variants={itemVariants}>
              <div
                className="rounded-xl p-6 card-hover"
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>
                      {stat.title}
                    </p>
                    <h3 className="text-3xl font-bold mb-2" style={{ color: colors.text }}>
                      {stat.value}
                    </h3>
                    <div className="flex items-center gap-1">
                      {stat.trend.isUp ? (
                        <ArrowUp size={16} style={{ color: colors.success }} />
                      ) : (
                        <ArrowDown size={16} style={{ color: colors.error }} />
                      )}
                      <span
                        className="text-sm font-medium"
                        style={{ color: stat.trend.isUp ? colors.success : colors.error }}
                      >
                        {stat.trend.value}%
                      </span>
                      <span className="text-sm" style={{ color: colors.textTertiary }}>
                        vs last month
                      </span>
                    </div>
                  </div>
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{
                      background: `${stat.color}20`,
                      color: stat.color,
                    }}
                  >
                    <Icon size={24} />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Distribution */}
        <motion.div variants={itemVariants}>
          <div
            className="rounded-xl p-6"
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>
              Lead Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={segmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.text,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Conversion Funnel */}
        <motion.div variants={itemVariants}>
          <div
            className="rounded-xl p-6"
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>
              Conversion Funnel
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conversionFunnel}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                <XAxis dataKey="stage" stroke={colors.textSecondary} />
                <YAxis stroke={colors.textSecondary} />
                <Tooltip
                  contentStyle={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.text,
                  }}
                />
                <Bar dataKey="count" fill={colors.primary} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Recent Leads */}
      <motion.div variants={itemVariants}>
        <div
          className="rounded-xl p-6"
          style={{
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
              Recent Leads
            </h3>
            <button
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{
                color: colors.primary,
                background: `${colors.primary}20`,
              }}
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentLeads?.slice(0, 5).map((lead, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg transition-colors hover:bg-opacity-50"
                style={{
                  background: colors.backgroundSecondary,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                    }}
                  >
                    {lead.full_name?.charAt(0) || 'L'}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: colors.text }}>
                      {lead.full_name || 'Unknown'}
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {lead.email || 'No email'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Tag
                    color={
                      lead.segment === 'hot'
                        ? 'red'
                        : lead.segment === 'warm'
                        ? 'orange'
                        : lead.segment === 'cold'
                        ? 'green'
                        : 'default'
                    }
                  >
                    {lead.segment?.toUpperCase() || 'UNKNOWN'}
                  </Tag>
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: colors.text }}>
                      {lead.score || 0}
                    </p>
                    <p className="text-xs" style={{ color: colors.textTertiary }}>
                      Score
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
