import React, { useState, useMemo, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Avatar, Typography,
  Select, DatePicker, Button, Space, Progress, Tooltip,
  Badge, Tabs, Empty, Spin,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { leadsAPI, usersAPI } from '../api/api';
import {
  UserOutlined, RiseOutlined, FallOutlined, DollarOutlined,
  PhoneOutlined, CheckCircleOutlined, ClockCircleOutlined,
  FireOutlined, TrophyOutlined, TeamOutlined, LineChartOutlined,
  ReloadOutlined, FilterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

dayjs.extend(utc);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Parse a timestamp that may lack a 'Z' suffix correctly as UTC
const parseUTC = (ts) => {
  if (!ts) return null;
  const safe = ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z';
  return dayjs(safe);
};

const PRESETS = [
  { label: 'Today',      value: [dayjs(), dayjs()] },
  { label: 'Yesterday',  value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
  { label: 'Last 7 Days',  value: [dayjs().subtract(6, 'days'), dayjs()] },
  { label: 'Last 30 Days', value: [dayjs().subtract(29, 'days'), dayjs()] },
  { label: 'This Month',   value: [dayjs().startOf('month'), dayjs()] },
  { label: 'Last Month',   value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
];

export default function UserActivityPage() {
  const [selectedUser, setSelectedUser] = useState('all');
  const [dateRange, setDateRange]       = useState([dayjs().subtract(29, 'days'), dayjs()]);
  const [activeTab, setActiveTab]       = useState('overview');

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: leadsResp, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['user-activity-leads'],
    queryFn: () => leadsAPI.getAll({ limit: 5000 }).then(r => r.data),
    staleTime: 60_000,
  });

  const { data: usersResp, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAll().then(r => r.data),
    staleTime: 120_000,
  });

  // /api/leads  → { leads: [...], total: N }
  // /api/users  → [ {...}, {...} ]  (plain array)
  const allLeads = leadsResp?.leads || [];
  const allUsers = Array.isArray(usersResp) ? usersResp : (usersResp?.users || []);

  // ── Filter leads by the selected date range (updated_at, UTC-aware) ────────
  const filteredLeads = useMemo(() => {
    if (!dateRange?.[0] || !dateRange?.[1] || !allLeads.length) return [];
    const from = dateRange[0].startOf('day');
    const to   = dateRange[1].endOf('day');
    return allLeads.filter(lead => {
      const updated = parseUTC(lead.updated_at || lead.created_at);
      return updated && updated.isAfter(from) && updated.isBefore(to);
    });
  }, [allLeads, dateRange]);

  // ── Metrics calculator ─────────────────────────────────────────────────────
  const calcMetrics = useCallback((nameOrAll) => {
    // "Total leads assigned to user" — from ALL leads (not date-filtered)
    const assigned = nameOrAll === 'all'
      ? allLeads
      : allLeads.filter(l => l.assigned_to === nameOrAll);

    // "Updated in period" — leads where updated_at falls in date range
    const updatedInPeriod = nameOrAll === 'all'
      ? filteredLeads
      : filteredLeads.filter(l => l.assigned_to === nameOrAll);

    const total      = assigned.length;
    const enrolled   = assigned.filter(l => l.status === 'Enrolled').length;
    const hot        = assigned.filter(l => l.status === 'Hot').length;
    const warm       = assigned.filter(l => l.status === 'Warm').length;
    const followUp   = assigned.filter(l => l.status === 'Follow Up').length;
    const lost       = assigned.filter(l => ['Not Interested', 'Not Answering', 'Junk'].includes(l.status)).length;
    const potential  = hot + warm;

    const totalRevenue   = assigned.filter(l => l.status === 'Enrolled')
                                   .reduce((s, l) => s + (l.actual_revenue || 0), 0);
    const expectedRevenue = assigned.filter(l => ['Hot', 'Warm'].includes(l.status))
                                    .reduce((s, l) => s + (l.expected_revenue || 0), 0);

    const conversionRate = total > 0 ? ((enrolled / total) * 100).toFixed(1) : '0.0';
    const avgScore       = assigned.length > 0
      ? (assigned.reduce((s, l) => s + (l.ai_score || 0), 0) / assigned.length).toFixed(1)
      : '0.0';

    return {
      total, enrolled, hot, warm, followUp, lost, potential,
      updatedInPeriod: updatedInPeriod.length,
      totalRevenue, expectedRevenue,
      conversionRate, avgScore,
      leads: assigned,
    };
  }, [allLeads, filteredLeads]);

  const metrics = useMemo(() => calcMetrics(selectedUser), [calcMetrics, selectedUser]);

  // ── Users with metrics for leaderboard ────────────────────────────────────
  const usersWithMetrics = useMemo(() => {
    if (!allUsers.length) return [];
    return allUsers
      .map(u => ({ ...u, ...calcMetrics(u.full_name) }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [allUsers, calcMetrics]);

  // ── Status distribution for pie chart ─────────────────────────────────────
  const statusDist = [
    { name: 'Enrolled',  value: metrics.enrolled,  color: '#52c41a' },
    { name: 'Hot',       value: metrics.hot,        color: '#ff4d4f' },
    { name: 'Warm',      value: metrics.warm,       color: '#faad14' },
    { name: 'Follow Up', value: metrics.followUp,   color: '#1890ff' },
    { name: 'Lost',      value: metrics.lost,       color: '#8c8c8c' },
  ].filter(d => d.value > 0);

  // ── Daily activity trend ───────────────────────────────────────────────────
  const dailyActivity = useMemo(() => {
    if (!dateRange?.[0] || !dateRange?.[1]) return [];
    const days = [];
    let d = dateRange[0].startOf('day');
    const end = dateRange[1].startOf('day');
    // Limit to 60 days to keep the chart readable
    let count = 0;
    while ((d.isBefore(end) || d.isSame(end, 'day')) && count < 60) {
      const dayStr = d.format('YYYY-MM-DD');
      const dayLeads = metrics.leads.filter(l => {
        const ts = parseUTC(l.updated_at || l.created_at);
        return ts && ts.format('YYYY-MM-DD') === dayStr;
      });
      days.push({
        date:     d.format('DD MMM'),
        updated:  dayLeads.length,
        enrolled: dayLeads.filter(l => l.status === 'Enrolled').length,
        potential: dayLeads.filter(l => ['Hot', 'Warm'].includes(l.status)).length,
      });
      d = d.add(1, 'day');
      count++;
    }
    return days;
  }, [metrics.leads, dateRange]);

  const isLoading = leadsLoading || usersLoading;

  // ── Leaderboard columns ────────────────────────────────────────────────────
  const leaderboardColumns = [
    {
      title: '#',
      key: 'rank',
      width: 56,
      render: (_, __, i) => (
        <Avatar
          size="small"
          style={{ background: i === 0 ? '#faad14' : i === 1 ? '#bfbfbf' : i === 2 ? '#d48806' : '#1890ff' }}
        >
          {i + 1}
        </Avatar>
      ),
    },
    {
      title: 'User',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name, rec) => (
        <Space>
          <Avatar style={{ background: '#6366f1' }}>{(name || '?')[0].toUpperCase()}</Avatar>
          <div>
            <div><Text strong>{name || '—'}</Text></div>
            <Text type="secondary" style={{ fontSize: 11 }}>{rec.role || '—'}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Total Leads',
      dataIndex: 'total',
      key: 'total',
      sorter: (a, b) => a.total - b.total,
      render: v => <Badge count={v} showZero style={{ background: '#1890ff' }} overflowCount={9999} />,
    },
    {
      title: 'Updated (period)',
      dataIndex: 'updatedInPeriod',
      key: 'updatedInPeriod',
      sorter: (a, b) => a.updatedInPeriod - b.updatedInPeriod,
      render: v => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Hot+Warm',
      dataIndex: 'potential',
      key: 'potential',
      sorter: (a, b) => a.potential - b.potential,
      render: v => <Tag color="orange">{v}</Tag>,
    },
    {
      title: 'Enrolled',
      dataIndex: 'enrolled',
      key: 'enrolled',
      sorter: (a, b) => a.enrolled - b.enrolled,
      render: v => <Tag color="green">{v}</Tag>,
    },
    {
      title: 'Revenue',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
      render: v => <Text strong style={{ color: '#52c41a' }}>₹{(v || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Conv %',
      dataIndex: 'conversionRate',
      key: 'conversionRate',
      sorter: (a, b) => parseFloat(a.conversionRate) - parseFloat(b.conversionRate),
      render: v => (
        <Progress
          percent={parseFloat(v)}
          size="small"
          status={parseFloat(v) > 20 ? 'success' : parseFloat(v) > 10 ? 'normal' : 'exception'}
          style={{ minWidth: 80 }}
        />
      ),
    },
    {
      title: 'Avg AI Score',
      dataIndex: 'avgScore',
      key: 'avgScore',
      sorter: (a, b) => parseFloat(a.avgScore) - parseFloat(b.avgScore),
      render: v => (
        <Tag color={parseFloat(v) > 70 ? 'green' : parseFloat(v) > 40 ? 'orange' : 'default'}>
          {v}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 4 }}>
          <TeamOutlined /> User Activity Dashboard
        </Title>
        <Text type="secondary">
          Performance metrics and lead activity for all counsellors
        </Text>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="middle" wrap>
          <div>
            <Text strong style={{ marginRight: 8 }}><FilterOutlined /> Date Range:</Text>
            <RangePicker
              value={dateRange}
              onChange={v => setDateRange(v || [dayjs().subtract(29, 'days'), dayjs()])}
              format="DD MMM YYYY"
              style={{ width: 280 }}
              presets={PRESETS}
            />
          </div>

          <div>
            <Text strong style={{ marginRight: 8 }}><UserOutlined /> User:</Text>
            <Select
              value={selectedUser}
              onChange={setSelectedUser}
              style={{ width: 220 }}
              showSearch
              placeholder="Select user"
              optionFilterProp="label"
            >
              <Select.Option value="all" label="All Users">
                <TeamOutlined /> All Users
              </Select.Option>
              {allUsers.map(u => (
                <Select.Option key={u.id} value={u.full_name} label={u.full_name}>
                  <Avatar size="small" style={{ marginRight: 8, background: '#6366f1' }}>
                    {(u.full_name || '?')[0].toUpperCase()}
                  </Avatar>
                  {u.full_name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <Button
            icon={<ReloadOutlined />}
            type="primary"
            loading={isLoading}
            onClick={() => { refetchLeads(); refetchUsers(); }}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" tip="Loading activity data…" />
        </div>
      ) : (
        <>
          {/* ── Summary stats ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {[
              { title: 'Total Leads Assigned',  value: metrics.total,            prefix: <UserOutlined />,         color: '#1890ff' },
              { title: `Updated in Period`,      value: metrics.updatedInPeriod,  prefix: <ClockCircleOutlined />,  color: '#faad14' },
              { title: 'Hot + Warm Leads',       value: metrics.potential,        prefix: <FireOutlined />,         color: '#ff4d4f' },
              { title: 'Enrolled',               value: metrics.enrolled,         prefix: <CheckCircleOutlined />,  color: '#52c41a',
                suffix: <Text type="secondary" style={{ fontSize: 14 }}>({metrics.conversionRate}%)</Text> },
            ].map(s => (
              <Col xs={24} sm={12} lg={6} key={s.title}>
                <Card>
                  <Statistic
                    title={s.title}
                    value={s.value}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    valueStyle={{ color: s.color }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Revenue */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12}>
              <Card>
                <Statistic
                  title="Total Revenue (Enrolled)"
                  value={metrics.totalRevenue}
                  prefix="₹"
                  precision={0}
                  valueStyle={{ color: '#52c41a', fontSize: 26 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card>
                <Statistic
                  title="Expected Revenue (Hot + Warm)"
                  value={metrics.expectedRevenue}
                  prefix="₹"
                  precision={0}
                  valueStyle={{ color: '#faad14', fontSize: 26 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'overview',
                label: <span><LineChartOutlined /> Overview</span>,
                children: (
                  <>
                    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                      {/* Daily trend */}
                      <Col xs={24} lg={16}>
                        <Card title="Daily Activity Trend" variant="borderless">
                          {dailyActivity.length === 0 ? (
                            <Empty description="No activity in this period" />
                          ) : (
                            <ResponsiveContainer width="100%" height={300}>
                              <LineChart data={dailyActivity}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} />
                                <RechartsTooltip />
                                <Legend />
                                <Line type="monotone" dataKey="updated"  stroke="#1890ff" strokeWidth={2} name="Leads Touched" />
                                <Line type="monotone" dataKey="potential" stroke="#faad14" strokeWidth={2} name="Hot / Warm" />
                                <Line type="monotone" dataKey="enrolled" stroke="#52c41a" strokeWidth={2} name="Enrolled" />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </Card>
                      </Col>

                      {/* Status pie */}
                      <Col xs={24} lg={8}>
                        <Card title="Status Distribution" variant="borderless">
                          {statusDist.length === 0 ? (
                            <Empty description="No leads found" />
                          ) : (
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={statusDist}
                                  cx="50%" cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                  outerRadius={80}
                                  dataKey="value"
                                >
                                  {statusDist.map((e, i) => (
                                    <Cell key={i} fill={e.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          )}
                        </Card>
                      </Col>
                    </Row>

                    {/* Status breakdown cards */}
                    <Card title="Performance Breakdown" variant="borderless">
                      <Row gutter={[16, 16]}>
                        {[
                          { label: 'Enrolled',  val: metrics.enrolled,  color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', prefix: <CheckCircleOutlined /> },
                          { label: 'Hot',       val: metrics.hot,       color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7', prefix: <FireOutlined /> },
                          { label: 'Warm',      val: metrics.warm,      color: '#faad14', bg: '#fffbe6', border: '#ffe58f', prefix: <RiseOutlined /> },
                          { label: 'Lost',      val: metrics.lost,      color: '#8c8c8c', bg: '#f5f5f5', border: '#d9d9d9', prefix: <FallOutlined /> },
                        ].map(s => (
                          <Col xs={24} sm={12} md={6} key={s.label}>
                            <Card size="small" style={{ background: s.bg, borderColor: s.border }}>
                              <Statistic
                                title={s.label}
                                value={s.val}
                                valueStyle={{ color: s.color }}
                                prefix={s.prefix}
                              />
                              <Progress
                                percent={metrics.total > 0 ? parseFloat((s.val / metrics.total * 100).toFixed(1)) : 0}
                                strokeColor={s.color}
                                size="small"
                                style={{ marginTop: 8 }}
                              />
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  </>
                ),
              },
              {
                key: 'leaderboard',
                label: <span><TrophyOutlined /> Leaderboard</span>,
                children: (
                  <Card title="User Performance Leaderboard" variant="borderless">
                    {usersWithMetrics.length === 0 ? (
                      <Empty description="No users found" />
                    ) : (
                      <Table
                        columns={leaderboardColumns}
                        dataSource={usersWithMetrics}
                        rowKey="id"
                        pagination={{ pageSize: 15, showTotal: t => `${t} users` }}
                        scroll={{ x: 900 }}
                        size="middle"
                      />
                    )}
                  </Card>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
