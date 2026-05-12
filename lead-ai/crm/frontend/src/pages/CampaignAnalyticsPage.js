import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Table, Spin, Tag, Select, Button, Input, Space, Statistic } from 'antd';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { 
  RocketOutlined, DollarOutlined, FireOutlined, 
  RiseOutlined, PhoneOutlined, TeamOutlined 
} from '@ant-design/icons';
import api from '../api/api';

const { Option } = Select;
const { Search } = Input;

// API calls for campaign analytics — uses the central api instance (correct base URL + auth header)
const campaignAPI = {
  getOverview: () => api.get('/api/analytics/campaigns/overview'),
  getCampaignList: (medium, group) => {
    const params = new URLSearchParams();
    if (medium) params.append('medium', medium);
    if (group) params.append('group', group);
    return api.get(`/api/analytics/campaigns/list?${params.toString()}`);
  },
  getCampaignDetail: (campaignName) => api.get(`/api/analytics/campaigns/${encodeURIComponent(campaignName)}`),
  compareCampaigns: (names) => api.get(`/api/analytics/campaigns/compare?campaign_names=${names}`),
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

const CampaignAnalyticsPage = () => {
  const [selectedMedium, setSelectedMedium] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // Fetch overview data
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['campaignOverview'],
    queryFn: () => campaignAPI.getOverview().then(res => res.data),
  });

  // Fetch campaign list
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaignList', selectedMedium, selectedGroup],
    queryFn: () => campaignAPI.getCampaignList(selectedMedium, selectedGroup).then(res => res.data),
  });

  // Fetch campaign detail when selected
  const { data: campaignDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['campaignDetail', selectedCampaign],
    queryFn: () => selectedCampaign ? campaignAPI.getCampaignDetail(selectedCampaign).then(res => res.data) : null,
    enabled: !!selectedCampaign,
  });

  if (overviewLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Campaign table columns
  const columns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 60,
      render: (_, __, index) => (
        <Tag color={index < 3 ? 'gold' : 'default'}>#{index + 1}</Tag>
      ),
    },
    {
      title: 'Campaign Name',
      dataIndex: 'campaign_name',
      key: 'campaign_name',
      width: 250,
      render: (text) => (
        <a onClick={() => setSelectedCampaign(text)} style={{ fontWeight: 600 }}>
          {text}
        </a>
      ),
    },
    {
      title: 'Medium',
      dataIndex: 'campaign_medium',
      key: 'campaign_medium',
      width: 120,
      render: (text) => <Tag color="blue">{text || 'N/A'}</Tag>,
    },
    {
      title: 'Group',
      dataIndex: 'campaign_group',
      key: 'campaign_group',
      width: 150,
      render: (text) => <Tag color="purple">{text || 'N/A'}</Tag>,
    },
    {
      title: 'Total Leads',
      dataIndex: 'total_leads',
      key: 'total_leads',
      width: 100,
      sorter: (a, b) => a.total_leads - b.total_leads,
      render: (val) => <strong>{val}</strong>,
    },
    {
      title: 'Hot',
      dataIndex: 'hot_leads',
      key: 'hot_leads',
      width: 80,
      render: (val) => <Tag color="red">{val}</Tag>,
    },
    {
      title: 'Warm',
      dataIndex: 'warm_leads',
      key: 'warm_leads',
      width: 80,
      render: (val) => <Tag color="orange">{val}</Tag>,
    },
    {
      title: 'Cold',
      dataIndex: 'cold_leads',
      key: 'cold_leads',
      width: 80,
      render: (val) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'Conversions',
      dataIndex: 'converted',
      key: 'converted',
      width: 100,
      render: (val) => <Tag color="green">{val}</Tag>,
    },
    {
      title: 'Conv. Rate',
      dataIndex: 'conversion_rate',
      key: 'conversion_rate',
      width: 100,
      sorter: (a, b) => a.conversion_rate - b.conversion_rate,
      render: (val) => <strong>{val}%</strong>,
    },
    {
      title: 'Total Revenue',
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      width: 150,
      sorter: (a, b) => a.total_revenue - b.total_revenue,
      render: (val) => `₹${Number(val).toLocaleString('en-IN')}`,
    },
    {
      title: 'Avg/Lead',
      dataIndex: 'avg_revenue_per_lead',
      key: 'avg_revenue_per_lead',
      width: 120,
      sorter: (a, b) => a.avg_revenue_per_lead - b.avg_revenue_per_lead,
      render: (val) => `₹${Number(val).toLocaleString('en-IN')}`,
    },
    {
      title: 'Contact Rate',
      dataIndex: 'contact_rate',
      key: 'contact_rate',
      width: 110,
      render: (val) => `${val}%`,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          <RocketOutlined style={{ marginRight: 12, color: '#6366f1' }} />
          Campaign Performance Analytics
        </h1>
        <p style={{ color: '#6b7280', fontSize: 15 }}>
          Track and analyze all your marketing campaigns in one place
        </p>
      </div>

      {/* Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Campaigns"
              value={overview?.total_campaigns || 0}
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#6366f1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Leads"
              value={overview?.total_leads || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={overview?.total_revenue || 0}
              prefix="₹"
              precision={0}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Conversion Rate"
              value={overview?.conversion_rate || 0}
              suffix="%"
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#ef4444' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Performance by Medium Chart */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Performance by Medium" variant="borderless">
            {overview?.by_medium && overview.by_medium.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={overview.by_medium}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="medium" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="leads" fill="#6366f1" name="Leads" />
                  <Bar dataKey="conversions" fill="#10b981" name="Conversions" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                No campaign data available
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Conversion Rates by Medium" variant="borderless">
            {overview?.by_medium && overview.by_medium.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={overview.by_medium}
                    dataKey="conversion_rate"
                    nameKey="medium"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.medium}: ${entry.conversion_rate}%`}
                  >
                    {overview.by_medium.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                No campaign data available
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="middle">
          <span style={{ fontWeight: 600 }}>Filters:</span>
          <Select
            placeholder="Select Medium"
            style={{ width: 200 }}
            allowClear
            onChange={setSelectedMedium}
            value={selectedMedium}
          >
            {overview?.by_medium?.map(item => (
              <Option key={item.medium} value={item.medium}>{item.medium}</Option>
            ))}
          </Select>
          <Select
            placeholder="Select Group"
            style={{ width: 200 }}
            allowClear
            onChange={setSelectedGroup}
            value={selectedGroup}
          >
            {/* Add groups dynamically if available */}
          </Select>
          <Button type="primary" onClick={() => { setSelectedMedium(null); setSelectedGroup(null); }}>
            Reset Filters
          </Button>
        </Space>
      </Card>

      {/* Campaign List Table */}
      <Card title="All Campaigns" variant="borderless">
        <Table
          columns={columns}
          dataSource={campaigns || []}
          rowKey="campaign_name"
          loading={campaignsLoading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* Campaign Detail Modal/Section */}
      {selectedCampaign && campaignDetail && (
        <Card 
          title={`Campaign Details: ${selectedCampaign}`} 
          variant="borderless"
          style={{ marginTop: 24 }}
          extra={<Button onClick={() => setSelectedCampaign(null)}>Close</Button>}
        >
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Total Leads"
                  value={campaignDetail.summary?.total_leads || 0}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Conversions"
                  value={campaignDetail.summary?.converted || 0}
                  suffix={`(${campaignDetail.summary?.conversion_rate}%)`}
                  valueStyle={{ color: '#10b981' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Total Revenue"
                  value={campaignDetail.summary?.total_revenue || 0}
                  prefix="₹"
                  precision={0}
                  valueStyle={{ color: '#f59e0b' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={8}>
              <Card title="Lead Quality Distribution" size="small">
                <div style={{ marginBottom: 8 }}>
                  <Tag color="red">Hot: {campaignDetail.summary?.hot_leads || 0}</Tag>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Tag color="orange">Warm: {campaignDetail.summary?.warm_leads || 0}</Tag>
                </div>
                <div>
                  <Tag color="blue">Cold: {campaignDetail.summary?.cold_leads || 0}</Tag>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="Call Completion Rates" size="small">
                <div style={{ marginBottom: 8 }}>
                  1st Call: <strong>{campaignDetail.call_stats?.first_call_rate}%</strong>
                </div>
                <div style={{ marginBottom: 8 }}>
                  2nd Call: <strong>{campaignDetail.call_stats?.second_call_rate}%</strong>
                </div>
                <div>
                  3rd Call: <strong>{campaignDetail.call_stats?.third_call_rate}%</strong>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="Avg Revenue" size="small">
                <Statistic
                  value={campaignDetail.summary?.avg_revenue_per_lead || 0}
                  prefix="₹"
                  precision={2}
                  suffix="per lead"
                />
              </Card>
            </Col>
          </Row>

          {/* Status Breakdown */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="By Status" size="small">
                <Table
                  dataSource={campaignDetail.by_status || []}
                  columns={[
                    { title: 'Status', dataIndex: 'status', key: 'status' },
                    { title: 'Count', dataIndex: 'count', key: 'count' },
                    { title: 'Percentage', dataIndex: 'percentage', key: 'percentage', render: (val) => `${val}%` },
                  ]}
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="By Course" size="small">
                <Table
                  dataSource={campaignDetail.by_course || []}
                  columns={[
                    { title: 'Course', dataIndex: 'course', key: 'course' },
                    { title: 'Count', dataIndex: 'count', key: 'count' },
                    { title: 'Percentage', dataIndex: 'percentage', key: 'percentage', render: (val) => `${val}%` },
                  ]}
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default CampaignAnalyticsPage;
