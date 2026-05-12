/**
 * @deprecated Use RoleBasedDashboard (via App.js routing) instead.
 * TODO: `git rm` this file.
 */
export { default } from './RoleBasedDashboard';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Statistic, Table, Progress, Tag, Spin } from 'antd';
import {
  UserOutlined,
  FireOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  RiseOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardAPI, analyticsAPI, leadsAPI } from '../api/api';
import dayjs from 'dayjs';

const COLORS = ['#ff4d4f', '#faad14', '#52c41a', '#8c8c8c'];

const Dashboard = () => {
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
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  const segmentData = [
    { name: 'Hot', value: stats?.hot_leads || 0, color: '#ff4d4f' },
    { name: 'Warm', value: stats?.warm_leads || 0, color: '#faad14' },
    { name: 'Cold', value: stats?.cold_leads || 0, color: '#52c41a' },
    { name: 'Junk', value: stats?.junk_leads || 0, color: '#8c8c8c' },
  ];

  const recentLeadsColumns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
    },
    {
      title: 'Course',
      dataIndex: 'course_interested',
      key: 'course_interested',
      ellipsis: true,
    },
    {
      title: 'AI Score',
      dataIndex: 'ai_score',
      key: 'ai_score',
      render: (score) => (
        <span>
          <Progress
            percent={score}
            size="small"
            strokeColor={
              score >= 75 ? '#ff4d4f' :
              score >= 50 ? '#faad14' :
              score >= 25 ? '#52c41a' : '#8c8c8c'
            }
            format={(percent) => `${percent.toFixed(0)}`}
          />
        </span>
      ),
    },
    {
      title: 'Segment',
      dataIndex: 'ai_segment',
      key: 'ai_segment',
      render: (segment) => (
        <Tag color={
          segment === 'Hot' ? 'red' :
          segment === 'Warm' ? 'orange' :
          segment === 'Cold' ? 'green' : 'default'
        }>
          {segment}
        </Tag>
      ),
    },
    {
      title: 'Expected Revenue',
      dataIndex: 'expected_revenue',
      key: 'expected_revenue',
      render: (revenue) => `₹${(revenue / 1000).toFixed(0)}K`,
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: 600 }}>
        📊 Dashboard
      </h1>

      {/* Key Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Leads"
              value={stats?.total_leads || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
              +{stats?.leads_today || 0} today
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Hot Leads"
              value={stats?.hot_leads || 0}
              prefix={<FireOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
              High priority
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Conversion Rate"
              value={stats?.conversion_rate || 0}
              precision={2}
              suffix="%"
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
              {stats?.total_conversions || 0} converted
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={(stats?.total_revenue || 0) / 100000}
              precision={2}
              suffix="L"
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
              Expected: ₹{((stats?.expected_revenue || 0) / 100000).toFixed(2)}L
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title="Lead Segments Distribution" variant="borderless">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={segmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Conversion Funnel" variant="borderless">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conversionFunnel?.stages || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Revenue by Country */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title="Revenue by Country" variant="borderless">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByCountry || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataIndex="country" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                <Legend />
                <Bar dataKey="total_revenue" fill="#52c41a" name="Actual Revenue" />
                <Bar dataKey="expected_revenue" fill="#faad14" name="Expected Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Recent Leads" variant="borderless">
            <Table
              dataSource={recentLeads || []}
              columns={recentLeadsColumns}
              pagination={false}
              size="small"
              rowKey="id"
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Stats */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Leads This Week"
              value={stats?.leads_this_week || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Leads This Month"
              value={stats?.leads_this_month || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Average AI Score"
              value={stats?.avg_ai_score || 0}
              precision={1}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
