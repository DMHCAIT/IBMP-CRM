import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Table, Spin, Tag, Select, Button, Input, Space, Statistic, Tabs, notification } from 'antd';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import {
  RocketOutlined, DollarOutlined, FireOutlined,
  RiseOutlined, PhoneOutlined, TeamOutlined, FileTextOutlined, SyncOutlined
} from '@ant-design/icons';
import api from '../api/api';

const { Option } = Select;
const { Search } = Input;

// API calls for campaign analytics — uses the central api instance (correct base URL + auth header)
const campaignAPI = {
  getOverview:     () => api.get('/api/analytics/campaigns/overview'),
  getCampaignList: (medium, group) => {
    const params = new URLSearchParams();
    if (medium) params.append('medium', medium);
    if (group)  params.append('group', group);
    return api.get(`/api/analytics/campaigns/list?${params.toString()}`);
  },
  getCampaignLeads: (campaignName, medium) => {
    const params = new URLSearchParams();
    if (campaignName) params.append('campaign_name', campaignName);
    if (medium)       params.append('medium', medium);
    params.append('limit', '70000');
    return api.get(`/api/analytics/campaigns/leads?${params.toString()}`);
  },
  getCampaignDetail: (campaignName) => api.get(`/api/analytics/campaigns/${encodeURIComponent(campaignName)}`),
  fetchFromSheet:   () => api.get('/api/analytics/campaigns/leads?limit=70000'),
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

const STATUS_COLOR = {
  Fresh: 'blue', Contacted: 'cyan', Interested: 'geekblue',
  'Follow Up': 'orange', Converted: 'green', Enrolled: 'success',
  Lost: 'red', Junk: 'default', 'Not Interested': 'volcano',
};

const CampaignAnalyticsPage = () => {
  const [selectedMedium, setSelectedMedium]     = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [activeTab, setActiveTab]               = useState('analytics');
  const [leadsSearch, setLeadsSearch]           = useState('');
  const [sheetFetching, setSheetFetching]       = useState(false);
  const [sheetFetchedLeads, setSheetFetchedLeads] = useState(null); // null = not fetched yet
  const [syncMessage, setSyncMessage]           = useState(''); // Show sync instructions

  const handleFetchFromSheet = async () => {
    setSheetFetching(true);
    try {
      const res = await campaignAPI.fetchFromSheet();
      const leads = Array.isArray(res.data) ? res.data : (res.data?.leads || []);
      
      setSheetFetchedLeads(leads);
      setActiveTab('sheet');
      setSyncMessage('Showing all leads from database. To import new leads from Google Sheet and detect duplicates, run "IBMP CRM → Sync New Leads" in your sheet.');
      
      notification.success({ 
        message: `Loaded ${leads.length} leads from database`,
        description: 'To sync new leads and detect duplicates, use Google Apps Script in your sheet',
        duration: 5
      });
    } catch (err) {
      notification.error({ message: 'Failed to fetch from sheet', description: err?.response?.data?.detail || err.message });
    } finally {
      setSheetFetching(false);
    }
  };

  // Fetch overview data
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['campaignOverview'],
    queryFn: () => campaignAPI.getOverview().then(res => res.data),
    staleTime: 2 * 60 * 1000,     // 2 minutes - overview doesn't change frequently
    gcTime: 10 * 60 * 1000,       // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,  // Don't refetch on tab focus
  });

  // Fetch campaign list
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaignList', selectedMedium],
    queryFn: () => campaignAPI.getCampaignList(selectedMedium, null).then(res => res.data),
    staleTime: 2 * 60 * 1000,     // 2 minutes cache
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch all sheet leads (for Sheet Leads tab) - only when tab is active
  const { data: sheetLeads = [], isLoading: sheetLeadsLoading } = useQuery({
    queryKey: ['campaignLeads', selectedCampaign, selectedMedium],
    queryFn: () => campaignAPI.getCampaignLeads(selectedCampaign, selectedMedium).then(res => res.data),
    enabled: activeTab === 'leads', // Only fetch when Sheet Leads (DB) tab is active
    staleTime: 1 * 60 * 1000,       // 1 minute cache
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Filtered sheet leads for search
  const filteredLeads = leadsSearch
    ? sheetLeads.filter(l =>
        [l.full_name, l.phone, l.email, l.campaign_name, l.ad_name, l.adset_name]
          .some(v => v && String(v).toLowerCase().includes(leadsSearch.toLowerCase()))
      )
    : sheetLeads;

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

  // Sheet leads table columns
  const sheetLeadColumns = [
    { title: '#', key: 'idx', width: 50, render: (_, __, i) => i + 1 },
    {
      title: 'Name', dataIndex: 'full_name', key: 'full_name', width: 160,
      render: (v, r) => (
        <a href={`/leads/${r.lead_id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{v}</a>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 180 },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: v => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'Course Interest', dataIndex: 'course_interested', key: 'course_interested', width: 150,
      render: v => v ? <Tag color="cyan">{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    { 
      title: 'Qualification', dataIndex: 'qualification', key: 'qualification', width: 140,
      render: v => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Campaign Name', dataIndex: 'campaign_name', key: 'campaign_name', width: 200,
      render: v => v ? <Tag color="purple">{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Campaign ID', dataIndex: 'campaign_id', key: 'campaign_id', width: 150,
      render: v => v ? <span style={{ fontSize: '12px', color: '#666' }}>{v}</span> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Platform', dataIndex: 'campaign_medium', key: 'campaign_medium', width: 110,
      render: v => v ? <Tag color="blue">{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Is Organic', dataIndex: 'is_organic', key: 'is_organic', width: 100,
      render: v => v ? <Tag color="green">Yes</Tag> : <Tag color="orange">Paid</Tag>,
    },
    {
      title: 'Ad Name', dataIndex: 'ad_name', key: 'ad_name', width: 180,
      render: v => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Ad ID', dataIndex: 'ad_id', key: 'ad_id', width: 140,
      render: v => v ? <span style={{ fontSize: '12px', color: '#666' }}>{v}</span> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Adset', dataIndex: 'adset_name', key: 'adset_name', width: 160,
      render: v => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Adset ID', dataIndex: 'adset_id', key: 'adset_id', width: 140,
      render: v => v ? <span style={{ fontSize: '12px', color: '#666' }}>{v}</span> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Form', dataIndex: 'form_name', key: 'form_name', width: 160,
      render: v => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Form ID', dataIndex: 'form_id', key: 'form_id', width: 140,
      render: v => v ? <span style={{ fontSize: '12px', color: '#666' }}>{v}</span> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Quality', dataIndex: 'lead_quality', key: 'lead_quality', width: 90,
      render: v => v ? <Tag color={v === 'High' ? 'green' : v === 'Low' ? 'red' : 'orange'}>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    { title: 'Country', dataIndex: 'country', key: 'country', width: 100 },
    { title: 'Assigned To', dataIndex: 'assigned_to', key: 'assigned_to', width: 130 },
    {
      title: 'External ID', dataIndex: 'external_id', key: 'external_id', width: 120,
      render: v => v ? <span style={{ fontSize: '12px', color: '#666' }}>{v}</span> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            <RocketOutlined style={{ marginRight: 12, color: '#6366f1' }} />
            Campaign Performance Analytics
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15 }}>
            Track and analyze all your marketing campaigns · Google Sheet synced leads
          </p>
        </div>
        <Button
          type="primary"
          icon={<SyncOutlined spin={sheetFetching} />}
          loading={sheetFetching}
          onClick={handleFetchFromSheet}
          style={{ background: '#10b981', borderColor: '#10b981', height: 40, fontWeight: 600 }}
        >
          Fetch from Sheet
        </Button>
      </div>

      {/* KPI cards — always visible */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Total Campaigns', value: overview?.total_campaigns || 0, icon: <RocketOutlined />, color: '#6366f1' },
          { title: 'Sheet Leads',     value: sheetLeads.length,             icon: <FileTextOutlined />, color: '#10b981' },
          { title: 'Total Revenue',   value: `₹${Number(overview?.total_revenue||0).toLocaleString('en-IN')}`, icon: null, color: '#f59e0b' },
          { title: 'Conversion Rate', value: `${overview?.conversion_rate || 0}%`, icon: <RiseOutlined />, color: '#ef4444' },
        ].map(k => (
          <Col xs={24} sm={12} lg={6} key={k.title}>
            <Card>
              <Statistic title={k.title} value={k.value} prefix={k.icon} valueStyle={{ color: k.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Shared filter bar */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ fontWeight: 600 }}>Filter:</span>
          <Select placeholder="Platform / Medium" style={{ width: 180 }} allowClear
            value={selectedMedium} onChange={v => { setSelectedMedium(v); setSelectedCampaign(null); }}>
            {overview?.by_medium?.map(m => <Option key={m.medium} value={m.medium}>{m.medium}</Option>)}
          </Select>
          <Select placeholder="Campaign" style={{ width: 220 }} allowClear showSearch
            value={selectedCampaign} onChange={setSelectedCampaign}>
            {[...new Set((campaigns||[]).map(c => c.campaign_name))].map(n => <Option key={n} value={n}>{n}</Option>)}
          </Select>
          <Button onClick={() => { setSelectedMedium(null); setSelectedCampaign(null); setLeadsSearch(''); }}>
            Reset
          </Button>
        </Space>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'analytics',
            label: <span><RocketOutlined /> Campaign Analytics</span>,
            children: (
              <>
                {/* Charts */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} lg={14}>
                    <Card title="Performance by Platform" variant="borderless">
                      {overview?.by_medium?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
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
                      ) : <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No data</div>}
                    </Card>
                  </Col>
                  <Col xs={24} lg={10}>
                    <Card title="Conv. Rate by Platform" variant="borderless">
                      {overview?.by_medium?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Pie data={overview.by_medium} dataKey="conversion_rate" nameKey="medium"
                              cx="50%" cy="50%" outerRadius={90}
                              label={e => `${e.medium}: ${e.conversion_rate}%`}>
                              {overview.by_medium.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No data</div>}
                    </Card>
                  </Col>
                </Row>

                {/* Campaign summary table */}
                <Card title="All Campaigns" variant="borderless">
                  <Table columns={columns} dataSource={campaigns || []} rowKey="campaign_name"
                    loading={campaignsLoading} pagination={{ pageSize: 20 }} scroll={{ x: 1400 }} />
                </Card>
              </>
            ),
          },
          {
            key: 'sheet',
            label: (
              <span>
                <SyncOutlined /> From Sheet
                {sheetFetchedLeads !== null && <Tag color="green" style={{ marginLeft: 8 }}>{sheetFetchedLeads.length}</Tag>}
              </span>
            ),
            children: (
              <Card
                title={
                  <Space>
                    <span>Live Google Sheet Leads</span>
                    {sheetFetchedLeads !== null && <Tag color="green">{sheetFetchedLeads.length} rows</Tag>}
                  </Space>
                }
                extra={
                  <Button icon={<SyncOutlined spin={sheetFetching} />} loading={sheetFetching} onClick={handleFetchFromSheet}>
                    Refresh
                  </Button>
                }
                variant="borderless"
              >
                {sheetFetchedLeads === null ? (
                  <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                    <SyncOutlined style={{ fontSize: 40, marginBottom: 16, color: '#10b981' }} />
                    <div style={{ fontSize: 16, fontWeight: 600 }}>Load leads from Google Sheet sync</div>
                    <div style={{ marginTop: 8, fontSize: 13, maxWidth: 500, margin: '8px auto' }}>
                      <strong>How duplicate detection works:</strong><br/>
                      1. Open your Google Sheet → IBMP CRM menu → "Sync New Leads"<br/>
                      2. System checks phone numbers for duplicates<br/>
                      3. New leads are created, duplicates are skipped<br/>
                      4. Execution log shows: "Already exists as LEAD-XXX (Owner: Name, Status: Fresh)"<br/>
                      5. Click button below to view synced leads
                    </div>
                    <Button type="primary" icon={<SyncOutlined />} style={{ marginTop: 20, background: '#10b981', borderColor: '#10b981' }}
                      loading={sheetFetching} onClick={handleFetchFromSheet}>
                      Fetch from Sheet
                    </Button>
                  </div>
                ) : (
                  <>
                    {syncMessage && (
                      <div style={{ 
                        marginBottom: 16, padding: 12, background: '#eff6ff', 
                        borderRadius: 8, border: '1px solid #bfdbfe',
                        display: 'flex', alignItems: 'center', gap: 8 
                      }}>
                        <SyncOutlined style={{ color: '#3b82f6', fontSize: 16 }} />
                        <span style={{ fontSize: 13, color: '#1e40af' }}>{syncMessage}</span>
                      </div>
                    )}
                    <Table
                      columns={sheetLeadColumns}
                      dataSource={sheetFetchedLeads}
                      rowKey={(r, i) => r.meta_lead_id || r.phone || i}
                      pagination={{ 
                        pageSize: 100, 
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} leads`,
                        showSizeChanger: true,
                        pageSizeOptions: ['50', '100', '200', '500', '1000'],
                      }}
                      scroll={{ x: 1600 }}
                      size="small"
                    />
                  </>
                )}
              </Card>
            ),
          },
          {
            key: 'leads',
            label: (
              <span>
                <FileTextOutlined /> Sheet Leads (DB)
                <Tag color="blue" style={{ marginLeft: 8 }}>{sheetLeads.length}</Tag>
              </span>
            ),
            children: (
              <Card
                title={
                  <Space>
                    <span>All Google Sheet Leads</span>
                    {selectedCampaign && <Tag color="purple">{selectedCampaign}</Tag>}
                    {selectedMedium  && <Tag color="blue">{selectedMedium}</Tag>}
                  </Space>
                }
                extra={
                  <Input.Search placeholder="Search name / phone / campaign…" allowClear
                    style={{ width: 280 }} onSearch={setLeadsSearch}
                    onChange={e => !e.target.value && setLeadsSearch('')} />
                }
                variant="borderless"
              >
                <Table
                  columns={sheetLeadColumns}
                  dataSource={filteredLeads}
                  rowKey="lead_id"
                  loading={sheetLeadsLoading}
                  pagination={{ 
                    pageSize: 100, 
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} leads`,
                    showSizeChanger: true,
                    pageSizeOptions: ['50', '100', '200', '500', '1000'],
                  }}
                  scroll={{ x: 1600 }}
                  size="small"
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default CampaignAnalyticsPage;
