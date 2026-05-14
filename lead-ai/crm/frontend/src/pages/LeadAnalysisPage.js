import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Select,
  DatePicker,
  Space,
  Tooltip,
  Avatar,
  Progress,
  Typography,
  Tabs,
  Empty,
  Badge,
  Button,
  Input
} from 'antd';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter
} from 'recharts';
import {
  ClockCircleOutlined,
  UserOutlined,
  GlobalOutlined,
  BookOutlined,
  FlagOutlined,
  RiseOutlined,
  FallOutlined,
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TeamOutlined,
  TrophyOutlined,
  WarningOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { leadsAPI, usersAPI, coursesAPI } from '../api/api';

dayjs.extend(duration);
dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const LeadAnalysisPage = () => {
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [dateRange, setDateRange] = useState([dayjs().subtract(90, 'days'), dayjs()]);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch data — use a dedicated query key so this doesn't clash with the
  // paginated leads table cache, and fetch up to 70k rows for analysis.
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['leads-analysis'],
    queryFn: () => leadsAPI.getAll({ limit: 70000, skip: 0 }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAll().then(res => res.data)
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesAPI.getAll().then(res => res.data)
  });

  const leads = leadsData?.leads || [];
  const users = usersData?.users || [];
  const courses = coursesData || [];

  // Calculate lead age in days
  const calculateLeadAge = (createdAt) => {
    if (!createdAt) return 0;
    return dayjs().diff(dayjs(createdAt), 'days');
  };

  // Calculate days since last update
  const calculateDaysSinceUpdate = (updatedAt) => {
    if (!updatedAt) return 0;
    return dayjs().diff(dayjs(updatedAt), 'days');
  };

  // Filter leads
  const filteredLeads = useMemo(() => {
    if (!leads || !dateRange || !dateRange[0] || !dateRange[1]) return [];

    return leads.filter(lead => {
      const leadDate = dayjs(lead.created_at);
      const matchesDate = leadDate.isAfter(dateRange[0]) && leadDate.isBefore(dateRange[1]);
      const matchesCountry = selectedCountry === 'all' || lead.country === selectedCountry;
      const matchesCourse = selectedCourse === 'all' || lead.course_interested === selectedCourse;
      const matchesStatus = selectedStatus === 'all' || lead.status === selectedStatus;
      const matchesUser = selectedUser === 'all' || lead.assigned_to === selectedUser;
      const matchesSearch = !searchText ||
        lead.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchText.toLowerCase()) ||
        lead.phone?.includes(searchText);

      return matchesDate && matchesCountry && matchesCourse && matchesStatus && matchesUser && matchesSearch;
    });
  }, [leads, dateRange, selectedCountry, selectedCourse, selectedStatus, selectedUser, searchText]);

  // Get unique values for filters
  const countries = useMemo(() => [...new Set(leads.map(l => l.country).filter(Boolean))], [leads]);
  const statuses = useMemo(() => [...new Set(leads.map(l => l.status).filter(Boolean))], [leads]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!filteredLeads.length) return {};

    const totalLeads = filteredLeads.length;
    const avgAge = filteredLeads.reduce((sum, lead) => sum + calculateLeadAge(lead.created_at), 0) / totalLeads;
    const avgDaysSinceUpdate = filteredLeads.reduce((sum, lead) => sum + calculateDaysSinceUpdate(lead.updated_at), 0) / totalLeads;
    
    const staleLeads = filteredLeads.filter(l => calculateDaysSinceUpdate(l.updated_at) > 7).length;
    const freshLeads = filteredLeads.filter(l => calculateDaysSinceUpdate(l.updated_at) <= 2).length;
    const activeLeads = filteredLeads.filter(l => ['Fresh', 'Follow Up', 'Warm', 'Hot'].includes(l.status)).length;
    const convertedLeads = filteredLeads.filter(l => l.status === 'Enrolled').length;
    const lostLeads = filteredLeads.filter(l => ['Not Interested', 'Not Answering', 'Junk'].includes(l.status)).length;

    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
    const lostRate = totalLeads > 0 ? (lostLeads / totalLeads) * 100 : 0;
    const staleRate = totalLeads > 0 ? (staleLeads / totalLeads) * 100 : 0;

    return {
      totalLeads,
      avgAge: avgAge.toFixed(1),
      avgDaysSinceUpdate: avgDaysSinceUpdate.toFixed(1),
      staleLeads,
      freshLeads,
      activeLeads,
      convertedLeads,
      lostLeads,
      conversionRate: conversionRate.toFixed(1),
      lostRate: lostRate.toFixed(1),
      staleRate: staleRate.toFixed(1)
    };
  }, [filteredLeads]);

  // Lead age distribution
  const ageDistribution = useMemo(() => {
    const ranges = [
      { name: '0-7 days', min: 0, max: 7, count: 0 },
      { name: '8-14 days', min: 8, max: 14, count: 0 },
      { name: '15-30 days', min: 15, max: 30, count: 0 },
      { name: '31-60 days', min: 31, max: 60, count: 0 },
      { name: '60+ days', min: 61, max: 999999, count: 0 }
    ];

    filteredLeads.forEach(lead => {
      const age = calculateLeadAge(lead.created_at);
      const range = ranges.find(r => age >= r.min && age <= r.max);
      if (range) range.count++;
    });

    return ranges;
  }, [filteredLeads]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const distribution = {};
    filteredLeads.forEach(lead => {
      distribution[lead.status] = (distribution[lead.status] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);

  // Country distribution
  const countryDistribution = useMemo(() => {
    const distribution = {};
    filteredLeads.forEach(lead => {
      if (lead.country) {
        distribution[lead.country] = (distribution[lead.country] || 0) + 1;
      }
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredLeads]);

  // Course distribution
  const courseDistribution = useMemo(() => {
    const distribution = {};
    filteredLeads.forEach(lead => {
      if (lead.course_interested) {
        distribution[lead.course_interested] = (distribution[lead.course_interested] || 0) + 1;
      }
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredLeads]);

  // User performance analysis
  const userPerformance = useMemo(() => {
    const performance = {};
    
    filteredLeads.forEach(lead => {
      if (!lead.assigned_to) return;
      
      if (!performance[lead.assigned_to]) {
        const user = users.find(u => u.full_name === lead.assigned_to);
        performance[lead.assigned_to] = {
          userId: lead.assigned_to,
          userName: user?.full_name || lead.assigned_to || 'Unknown',
          userRole: user?.role || 'Unknown',
          totalLeads: 0,
          convertedLeads: 0,
          lostLeads: 0,
          activeLeads: 0,
          staleLeads: 0,
          avgAge: 0,
          avgDaysSinceUpdate: 0,
          totalRevenue: 0,
          ages: [],
          updateDays: []
        };
      }

      const perf = performance[lead.assigned_to];
      perf.totalLeads++;
      perf.ages.push(calculateLeadAge(lead.created_at));
      perf.updateDays.push(calculateDaysSinceUpdate(lead.updated_at));

      if (lead.status === 'Enrolled') {
        perf.convertedLeads++;
        perf.totalRevenue += lead.expected_revenue || 0;
      }
      if (['Not Interested', 'Not Answering', 'Junk'].includes(lead.status)) {
        perf.lostLeads++;
      }
      if (['Fresh', 'Follow Up', 'Warm', 'Hot'].includes(lead.status)) {
        perf.activeLeads++;
      }
      if (calculateDaysSinceUpdate(lead.updated_at) > 7) {
        perf.staleLeads++;
      }
    });

    return Object.values(performance).map(perf => ({
      ...perf,
      avgAge: (perf.ages.reduce((a, b) => a + b, 0) / perf.ages.length).toFixed(1),
      avgDaysSinceUpdate: (perf.updateDays.reduce((a, b) => a + b, 0) / perf.updateDays.length).toFixed(1),
      conversionRate: perf.totalLeads > 0 ? ((perf.convertedLeads / perf.totalLeads) * 100).toFixed(1) : 0,
      lostRate: perf.totalLeads > 0 ? ((perf.lostLeads / perf.totalLeads) * 100).toFixed(1) : 0,
      staleRate: perf.totalLeads > 0 ? ((perf.staleLeads / perf.totalLeads) * 100).toFixed(1) : 0
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredLeads, users]);

  // Lead aging scatter plot data
  const agingScatterData = useMemo(() => {
    return filteredLeads.map(lead => ({
      age: calculateLeadAge(lead.created_at),
      daysSinceUpdate: calculateDaysSinceUpdate(lead.updated_at),
      name: lead.full_name,
      status: lead.status,
      aiScore: lead.ai_score || 0
    }));
  }, [filteredLeads]);

  // Status colors
  const statusColors = {
    'Fresh': '#13c2c2',
    'Follow Up': '#1890ff',
    'Warm': '#fa8c16',
    'Hot': '#f5222d',
    'Enrolled': '#52c41a',
    'Not Interested': '#8c8c8c',
    'Not Answering': '#8c8c8c',
    'Junk': '#8c8c8c'
  };

  // Chart colors
  const COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#faad14'];

  // Table columns
  const columns = [
    {
      title: 'Lead Name',
      dataIndex: 'full_name',
      key: 'full_name',
      fixed: 'left',
      width: 180,
      render: (text, record) => (
        <Space>
          <Avatar style={{ backgroundColor: '#1890ff' }}>
            {text?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Score: {record.ai_score || 'N/A'}
            </Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Lead Age',
      key: 'age',
      width: 120,
      sorter: (a, b) => calculateLeadAge(a.created_at) - calculateLeadAge(b.created_at),
      render: (_, record) => {
        const age = calculateLeadAge(record.created_at);
        const color = age > 60 ? 'red' : age > 30 ? 'orange' : 'green';
        return (
          <Tag color={color} icon={<ClockCircleOutlined />}>
            {age} days
          </Tag>
        );
      }
    },
    {
      title: 'Last Updated',
      key: 'lastUpdated',
      width: 140,
      sorter: (a, b) => calculateDaysSinceUpdate(a.updated_at) - calculateDaysSinceUpdate(b.updated_at),
      render: (_, record) => {
        const days = calculateDaysSinceUpdate(record.updated_at);
        const isStale = days > 7;
        return (
          <Space>
            {isStale && <WarningOutlined style={{ color: '#f5222d' }} />}
            <Text type={isStale ? 'danger' : 'secondary'}>
              {days === 0 ? 'Today' : `${days} days ago`}
            </Text>
          </Space>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      filters: statuses.map(s => ({ text: s, value: s })),
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={statusColors[status] || 'default'}>{status}</Tag>
      )
    },
    {
      title: 'Course',
      dataIndex: 'course_interested',
      key: 'course_interested',
      width: 200,
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text ellipsis><BookOutlined /> {text}</Text>
        </Tooltip>
      )
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      width: 120,
      filters: countries.map(c => ({ text: c, value: c })),
      onFilter: (value, record) => record.country === value,
      render: (text) => (
        <Tag icon={<GlobalOutlined />}>{text}</Tag>
      )
    },
    {
      title: 'Assigned To',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      width: 180,
      render: (assignedTo) => {
        if (!assignedTo) return <Text type="secondary">Unassigned</Text>;
        const user = users.find(u => u.full_name === assignedTo);
        return (
          <Space>
            <Avatar size="small" style={{ backgroundColor: '#722ed1' }}>
              {(user?.full_name || assignedTo)?.charAt(0)?.toUpperCase()}
            </Avatar>
            <div>
              <div style={{ fontWeight: 500 }}>{user?.full_name || assignedTo}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>{user?.role}</Text>
            </div>
          </Space>
        );
      }
    },
    {
      title: 'Revenue',
      dataIndex: 'expected_revenue',
      key: 'revenue',
      width: 120,
      sorter: (a, b) => (a.expected_revenue || 0) - (b.expected_revenue || 0),
      render: (value) => (
        <Text strong style={{ color: '#52c41a' }}>
          ₹{value?.toLocaleString() || '0'}
        </Text>
      )
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text ellipsis style={{ fontSize: 12 }}>{record.email}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.phone}</Text>
        </Space>
      )
    }
  ];

  // User performance columns
  const userColumns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 80,
      render: (_, __, index) => {
        if (index === 0) return <TrophyOutlined style={{ fontSize: 24, color: '#ffd700' }} />;
        if (index === 1) return <TrophyOutlined style={{ fontSize: 24, color: '#c0c0c0' }} />;
        if (index === 2) return <TrophyOutlined style={{ fontSize: 24, color: '#cd7f32' }} />;
        return <Text strong>#{index + 1}</Text>;
      }
    },
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <Space>
          <Avatar style={{ backgroundColor: '#722ed1' }}>
            {record.userName?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.userName}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.userRole}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Total Leads',
      dataIndex: 'totalLeads',
      key: 'totalLeads',
      width: 110,
      sorter: (a, b) => a.totalLeads - b.totalLeads,
      render: (value) => <Badge count={value} showZero style={{ backgroundColor: '#1890ff' }} />
    },
    {
      title: 'Converted',
      dataIndex: 'convertedLeads',
      key: 'convertedLeads',
      width: 110,
      sorter: (a, b) => a.convertedLeads - b.convertedLeads,
      render: (value) => <Badge count={value} showZero style={{ backgroundColor: '#52c41a' }} />
    },
    {
      title: 'Active',
      dataIndex: 'activeLeads',
      key: 'activeLeads',
      width: 100,
      sorter: (a, b) => a.activeLeads - b.activeLeads,
      render: (value) => <Badge count={value} showZero style={{ backgroundColor: '#fa8c16' }} />
    },
    {
      title: 'Lost',
      dataIndex: 'lostLeads',
      key: 'lostLeads',
      width: 90,
      sorter: (a, b) => a.lostLeads - b.lostLeads,
      render: (value) => <Badge count={value} showZero style={{ backgroundColor: '#8c8c8c' }} />
    },
    {
      title: 'Stale (>7d)',
      dataIndex: 'staleLeads',
      key: 'staleLeads',
      width: 110,
      sorter: (a, b) => a.staleLeads - b.staleLeads,
      render: (value, record) => (
        <Space>
          <Badge count={value} showZero style={{ backgroundColor: '#f5222d' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>({record.staleRate}%)</Text>
        </Space>
      )
    },
    {
      title: 'Avg Age',
      dataIndex: 'avgAge',
      key: 'avgAge',
      width: 100,
      sorter: (a, b) => parseFloat(a.avgAge) - parseFloat(b.avgAge),
      render: (value) => <Text>{value} days</Text>
    },
    {
      title: 'Avg Days Since Update',
      dataIndex: 'avgDaysSinceUpdate',
      key: 'avgDaysSinceUpdate',
      width: 180,
      sorter: (a, b) => parseFloat(a.avgDaysSinceUpdate) - parseFloat(b.avgDaysSinceUpdate),
      render: (value) => {
        const isHigh = parseFloat(value) > 5;
        return <Text type={isHigh ? 'danger' : 'success'}>{value} days</Text>;
      }
    },
    {
      title: 'Conversion',
      dataIndex: 'conversionRate',
      key: 'conversionRate',
      width: 130,
      sorter: (a, b) => parseFloat(a.conversionRate) - parseFloat(b.conversionRate),
      render: (value) => (
        <Space>
          <Progress percent={parseFloat(value)} size="small" style={{ width: 60 }} />
          <Text>{value}%</Text>
        </Space>
      )
    },
    {
      title: 'Revenue',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      width: 130,
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
      render: (value) => (
        <Text strong style={{ color: '#52c41a' }}>
          ₹{value?.toLocaleString() || '0'}
        </Text>
      )
    }
  ];

  if (leadsLoading || usersLoading || coursesLoading) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            <RiseOutlined /> Lead Analysis Dashboard
          </Title>
          <Text type="secondary">Comprehensive lead insights and performance metrics</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetchLeads()}>
              Refresh
            </Button>
            <Button type="primary" icon={<DownloadOutlined />}>
              Export Report
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Text strong>Date Range</Text>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%', marginTop: 8 }}
              presets={[
                { label: 'Last 7 Days', value: [dayjs().subtract(7, 'days'), dayjs()] },
                { label: 'Last 30 Days', value: [dayjs().subtract(30, 'days'), dayjs()] },
                { label: 'Last 90 Days', value: [dayjs().subtract(90, 'days'), dayjs()] },
                { label: 'Last 6 Months', value: [dayjs().subtract(6, 'months'), dayjs()] },
                { label: 'Last Year', value: [dayjs().subtract(1, 'year'), dayjs()] }
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Text strong>Country</Text>
            <Select
              value={selectedCountry}
              onChange={setSelectedCountry}
              style={{ width: '100%', marginTop: 8 }}
            >
              <Option value="all">All Countries</Option>
              {countries.map(country => (
                <Option key={country} value={country}>{country}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Text strong>Course</Text>
            <Select
              value={selectedCourse}
              onChange={setSelectedCourse}
              style={{ width: '100%', marginTop: 8 }}
              showSearch
            >
              <Option value="all">All Courses</Option>
              {courses.map(course => (
                <Option key={course.id} value={course.course_name}>{course.course_name}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Text strong>Status</Text>
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ width: '100%', marginTop: 8 }}
            >
              <Option value="all">All Statuses</Option>
              {statuses.map(status => (
                <Option key={status} value={status}>{status}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Text strong>Assigned To</Text>
            <Select
              value={selectedUser}
              onChange={setSelectedUser}
              style={{ width: '100%', marginTop: 8 }}
              showSearch
            >
              <Option value="all">All Users</Option>
              {users.map(user => (
                <Option key={user.id} value={user.full_name}>{user.full_name}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={2}>
            <Text strong>Search</Text>
            <Input
              placeholder="Search..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="Total Leads"
              value={metrics.totalLeads || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="Avg Lead Age"
              value={metrics.avgAge || 0}
              suffix="days"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="Avg Days Since Update"
              value={metrics.avgDaysSinceUpdate || 0}
              suffix="days"
              prefix={<ReloadOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="Fresh Leads"
              value={metrics.freshLeads || 0}
              prefix={<CheckCircleOutlined />}
              suffix={`/ ${metrics.totalLeads || 0}`}
              valueStyle={{ color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Updated in last 2 days</Text>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="Stale Leads"
              value={metrics.staleLeads || 0}
              prefix={<WarningOutlined />}
              suffix={`(${metrics.staleRate || 0}%)`}
              valueStyle={{ color: '#f5222d' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Not updated in 7+ days</Text>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="Conversion Rate"
              value={metrics.conversionRate || 0}
              prefix={metrics.conversionRate >= 10 ? <RiseOutlined /> : <FallOutlined />}
              suffix="%"
              valueStyle={{ color: metrics.conversionRate >= 10 ? '#52c41a' : '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: 'Overview Charts',
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card title="Lead Age Distribution">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={ageDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="count" fill="#1890ff" name="Number of Leads" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="Status Distribution">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={statusDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {statusDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={statusColors[entry.name] || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="Top 10 Countries">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={countryDistribution} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} />
                          <RechartsTooltip />
                          <Bar dataKey="value" fill="#52c41a" name="Leads" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="Top 10 Courses">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={courseDistribution} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={150} />
                          <RechartsTooltip />
                          <Bar dataKey="value" fill="#722ed1" name="Leads" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                  <Col xs={24}>
                    <Card title="Lead Aging Analysis (Age vs Days Since Update)">
                      <ResponsiveContainer width="100%" height={400}>
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="age" name="Lead Age (days)" />
                          <YAxis dataKey="daysSinceUpdate" name="Days Since Update" />
                          <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                          <Legend />
                          <Scatter name="Leads" data={agingScatterData} fill="#1890ff" />
                        </ScatterChart>
                      </ResponsiveContainer>
                      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        Dots in the upper right indicate old leads that haven't been updated recently (require attention)
                      </Text>
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'performance',
              label: 'User Performance',
              children: (
                <Table
                  columns={userColumns}
                  dataSource={userPerformance}
                  rowKey="userId"
                  scroll={{ x: 1500 }}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'details',
              label: 'Detailed Leads',
              children: (
                <Table
                  columns={columns}
                  dataSource={filteredLeads}
                  rowKey="id"
                  scroll={{ x: 1800 }}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Total ${total} leads` }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default LeadAnalysisPage;
