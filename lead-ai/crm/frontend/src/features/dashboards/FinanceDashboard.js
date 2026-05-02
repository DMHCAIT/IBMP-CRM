import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Row, Col, Table, Spin, Empty, Tag } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, Users, TrendingUp, Award } from 'lucide-react';
import dayjs from 'dayjs';
import { adminAPI, leadsAPI } from '../../api/api';

const FinanceDashboard = () => {
  // Fetch admin stats
  const { data: stats } = useQuery({
    queryKey: ['finance-stats'],
    queryFn: () => adminAPI.getStats().then(res => res.data),
  });

  // Fetch revenue trend
  const { data: revenueTrend = [] } = useQuery({
    queryKey: ['finance-revenue-trend'],
    queryFn: () => adminAPI.getRevenueTrend(30).then(res => Array.isArray(res.data) ? res.data : []),
  });

  // Fetch recent enrolled leads
  const { data: recentLeads = [] } = useQuery({
    queryKey: ['finance-recent-leads'],
    queryFn: () => leadsAPI.getAll({ status: 'Enrolled', limit: 10 }).then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      return data.slice(0, 10);
    }),
  });

  const statCards = [
    {
      title: 'Total Revenue',
      value: `₹${((stats?.total_revenue || 0) / 100000).toFixed(1)}L`,
      icon: DollarSign,
      color: '#10b981',
      subtitle: 'This month',
    },
    {
      title: 'Enrolled Count',
      value: stats?.enrolled_count || 0,
      icon: Users,
      color: '#3b82f6',
      subtitle: 'Active enrollments',
    },
    {
      title: 'Avg Revenue per Lead',
      value: `₹${((stats?.avg_revenue_per_lead || 0) / 1000).toFixed(1)}K`,
      icon: TrendingUp,
      color: '#8b5cf6',
      subtitle: 'Per conversion',
    },
    {
      title: 'Revenue Growth',
      value: `${stats?.revenue_trend || 0}%`,
      icon: Award,
      color: '#f59e0b',
      subtitle: 'vs last month',
    },
  ];

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: 'Course',
      dataIndex: 'course',
      key: 'course',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
    },
    {
      title: 'Revenue',
      dataIndex: 'potential_revenue',
      key: 'revenue',
      render: (value) => (
        <span style={{ color: '#10b981', fontWeight: 500 }}>
          ₹{value?.toLocaleString() || 0}
        </span>
      ),
    },
    {
      title: 'Enrolled Date',
      dataIndex: 'enrolled_date',
      key: 'enrolled_date',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
    {
      title: 'Counselor',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      render: (text) => text || 'Unassigned',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>
          Finance Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Revenue and enrollment tracking
        </p>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {statCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <Card
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {stat.title}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
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
            </Card>
          </Col>
        ))}
      </Row>

      {/* Revenue Trend Chart */}
      <Card
        style={{
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Revenue Trend (Last 30 Days)
        </h3>
        {revenueTrend && revenueTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueTrend}>
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
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Empty description="No revenue data available" />
        )}
      </Card>

      {/* Recent Enrolled Leads */}
      <Card
        style={{
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Recent Enrolled Leads
        </h3>
        {recentLeads.length === 0 ? (
          <Empty description="No enrolled leads found" />
        ) : (
          <Table
            columns={columns}
            dataSource={recentLeads.map(lead => ({ ...lead, key: lead.id }))}
            pagination={false}
            scroll={{ x: 800 }}
          />
        )}
      </Card>
    </div>
  );
};

export default FinanceDashboard;
