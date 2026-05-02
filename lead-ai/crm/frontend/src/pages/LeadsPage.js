import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Tag,
  Progress,
  Space,
  Input,
  Select,
  DatePicker,
  Drawer,
  Form,
  message,
  Popconfirm,
  Row,
  Col,
  Card,
  Badge,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  WhatsAppOutlined,
  MailOutlined,
  EyeOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { leadsAPI, coursesAPI, counselorsAPI } from '../api/api';
import ChatInterface from '../components/ChatInterface';
import CallInterface from '../components/CallInterface';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const LeadsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [filters, setFilters] = useState({});
  const [form] = Form.useForm();

  // Date filter states
  const [createdDateType, setCreatedDateType] = useState('between');
  const [updatedDateType, setUpdatedDateType] = useState('between');
  
  // Communication modals
  const [chatVisible, setChatVisible] = useState(false);
  const [callVisible, setCallVisible] = useState(false);
  const [emailVisible, setEmailVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [communicationType, setCommunicationType] = useState('whatsapp');

  // Fetch data
  const { data: leadsResponse, isLoading, refetch } = useQuery({
    queryKey: ['leads', filters],
    queryFn: () => leadsAPI.getAll(filters),
    keepPreviousData: true
  });

  // Ensure leads is always an array
  const leads = Array.isArray(leadsResponse?.data?.leads) ? leadsResponse.data.leads : 
                Array.isArray(leadsResponse?.data) ? leadsResponse.data : [];

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesAPI.getAll().then(res => Array.isArray(res.data) ? res.data : [])
  });

  const { data: counselors } = useQuery({
    queryKey: ['counselors'],
    queryFn: () => counselorsAPI.getAll().then(res => Array.isArray(res.data) ? res.data : [])
  });

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: (data) => leadsAPI.create(data),
    onSuccess: () => {
      message.success('Lead created successfully!');
      setDrawerVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      console.error('Create lead error:', error);
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        const msgs = detail.map(d => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join('; ');
        message.error(`Validation error: ${msgs}`);
      } else {
        message.error(`Failed to create lead: ${detail || error.message}`);
      }
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: (leadId) => leadsAPI.delete(leadId),
    onSuccess: () => {
      message.success('Lead deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      message.error(`Failed to delete lead: ${error.message}`);
    },
  });

  const handleCreateLead = (values) => {
    const leadData = {
      full_name: values.full_name,
      email: values.email || null,
      phone: values.phone,
      whatsapp: values.whatsapp || values.phone,
      country: values.country,
      source: values.source,
      course_interested: values.course_interested,
      assigned_to: values.assigned_to || null,
    };
    createLeadMutation.mutate(leadData);
  };

  const handleFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setCreatedDateType('between');
    setUpdatedDateType('between');
  };

  // Get unique countries from leads
  const countries = [...new Set((leads || []).map(lead => lead.country))];

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: 'lead_id',
      key: 'lead_id',
      fixed: 'left',
      width: 120,
      render: (text, record) => (
        <a onClick={() => navigate(`/leads/${text}`)} style={{ fontWeight: 600 }}>
          {text}
        </a>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 180,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Search name"
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Button
            type="primary"
            onClick={() => confirm()}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90, marginRight: 8 }}
          >
            Search
          </Button>
        </div>
      ),
      filterIcon: filtered => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
      onFilter: (value, record) => record.full_name.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      width: 120,
      filters: countries.map(c => ({ text: c, value: c })),
      onFilter: (value, record) => record.country === value,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
    },
    {
      title: 'Course',
      dataIndex: 'course_interested',
      key: 'course_interested',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      filters: [
        { text: 'Fresh', value: 'Fresh' },
        { text: 'Follow Up', value: 'Follow Up' },
        { text: 'Warm', value: 'Warm' },
        { text: 'Hot', value: 'Hot' },
        { text: 'Not Interested', value: 'Not Interested' },
        { text: 'Junk', value: 'Junk' },
        { text: 'Not Answering', value: 'Not Answering' },
        { text: 'Enrolled', value: 'Enrolled' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const colors = {
          'Fresh': 'cyan',
          'Follow Up': 'blue',
          'Warm': 'orange',
          'Hot': 'red',
          'Not Interested': 'default',
          'Junk': 'default',
          'Not Answering': 'purple',
          'Enrolled': 'green',
        };
        return <Tag color={colors[status]}>{status}</Tag>;
      },
    },
    {
      title: 'AI Score',
      dataIndex: 'ai_score',
      key: 'ai_score',
      width: 120,
      sorter: (a, b) => a.ai_score - b.ai_score,
      render: (score) => (
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
      ),
    },
    {
      title: 'Segment',
      dataIndex: 'ai_segment',
      key: 'ai_segment',
      width: 100,
      filters: [
        { text: 'Hot', value: 'Hot' },
        { text: 'Warm', value: 'Warm' },
        { text: 'Cold', value: 'Cold' },
        { text: 'Junk', value: 'Junk' },
      ],
      onFilter: (value, record) => record.ai_segment === value,
      render: (segment) => (
        <Badge
          color={
            segment === 'Hot' ? 'red' :
            segment === 'Warm' ? 'orange' :
            segment === 'Cold' ? 'green' : 'default'
          }
          text={segment}
        />
      ),
    },
    {
      title: 'Revenue',
      key: 'revenue',
      width: 150,
      render: (_, record) => (
        <div>
          {record.status === 'Enrolled' ? (
            <div>
              <div style={{ color: '#52c41a', fontWeight: 600 }}>
                ₹{((record.actual_revenue || 0) / 1000).toFixed(0)}K
              </div>
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Total Revenue</div>
            </div>
          ) : (
            <div>
              <div style={{ color: '#faad14', fontWeight: 600 }}>
                ₹{((record.expected_revenue || 0) / 1000).toFixed(0)}K
              </div>
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Expected</div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Follow Up',
      dataIndex: 'follow_up_date',
      key: 'follow_up_date',
      width: 150,
      sorter: (a, b) => new Date(a.follow_up_date) - new Date(b.follow_up_date),
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : '-',
    },
    {
      title: 'Assigned To',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      width: 140,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 240,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/leads/${record.lead_id}`)}
            />
          </Tooltip>
          <Tooltip title="Call">
            <Button
              type="text"
              icon={<PhoneOutlined />}
              style={{ color: '#1890ff' }}
              onClick={() => {
                setSelectedLead(record);
                setCallVisible(true);
              }}
              disabled={!record.phone}
            />
          </Tooltip>
          <Tooltip title="WhatsApp">
            <Button
              type="text"
              icon={<WhatsAppOutlined />}
              style={{ color: '#25D366' }}
              onClick={() => {
                setSelectedLead(record);
                setCommunicationType('whatsapp');
                setChatVisible(true);
              }}
              disabled={!record.whatsapp}
            />
          </Tooltip>
          <Tooltip title="Email">
            <Button
              type="text"
              icon={<MailOutlined />}
              style={{ color: '#fa8c16' }}
              onClick={() => {
                setSelectedLead(record);
                setCommunicationType('email');
                setChatVisible(true);
              }}
              disabled={!record.email}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this lead?"
            onConfirm={() => deleteLeadMutation.mutate(record.lead_id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0 }}>
          👥 Leads Management
        </h1>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            icon={<FilterOutlined />}
            onClick={() => setFilterDrawerVisible(true)}
          >
            Filters
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setDrawerVisible(true)}
          >
            Create Lead
          </Button>
        </Space>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: '14px', color: '#8c8c8c' }}>Total Leads</div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>{leads?.length || 0}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: '14px', color: '#8c8c8c' }}>Hot Leads</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#ff4d4f' }}>
              {leads?.filter(l => l.ai_segment === 'Hot').length || 0}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: '14px', color: '#8c8c8c' }}>Enrolled</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#52c41a' }}>
              {leads?.filter(l => l.status === 'Enrolled').length || 0}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: '14px', color: '#8c8c8c' }}>Total Revenue</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#faad14' }}>
              ₹{((leads?.reduce((sum, l) => sum + l.actual_revenue, 0) || 0) / 100000).toFixed(2)}L
            </div>
          </Card>
        </Col>
      </Row>

      {/* Leads Table */}
      <Table
        dataSource={leads}
        columns={columns}
        loading={isLoading}
        rowKey="lead_id"
        scroll={{ x: 1800 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} leads`,
        }}
      />

      {/* Create Lead Drawer */}
      <Drawer
        title="Create New Lead"
        width={600}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        bodyStyle={{ paddingBottom: 80 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateLead}
        >
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder="Dr. John Doe" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', message: 'Please enter valid email' }]}
          >
            <Input placeholder="john@example.com" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone"
            rules={[{ required: true, message: 'Please enter phone number' }]}
          >
            <Input placeholder="+91-9876543210" />
          </Form.Item>

          <Form.Item
            name="whatsapp"
            label="WhatsApp"
          >
            <Input placeholder="+91-9876543210" />
          </Form.Item>

          <Form.Item
            name="country"
            label="Country"
            rules={[{ required: true, message: 'Please select country' }]}
          >
            <Select placeholder="Select country" showSearch filterOption={(input, option) => 
              option.children.toLowerCase().includes(input.toLowerCase())
            }>
              {[
                'India', 'USA', 'UK', 'Canada', 'Australia', 'UAE', 'Singapore', 'Germany', 'France', 'Italy',
                'Spain', 'Netherlands', 'Belgium', 'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Finland',
                'Poland', 'Austria', 'Ireland', 'Portugal', 'Greece', 'Czech Republic', 'Romania', 'Hungary',
                'Japan', 'South Korea', 'China', 'Hong Kong', 'Taiwan', 'Thailand', 'Malaysia', 'Indonesia',
                'Philippines', 'Vietnam', 'Bangladesh', 'Pakistan', 'Nepal', 'Sri Lanka', 'Myanmar', 'Cambodia',
                'New Zealand', 'Fiji', 'Papua New Guinea', 'Solomon Islands', 'Vanuatu',
                'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Lebanon', 'Israel', 'Turkey',
                'Egypt', 'South Africa', 'Nigeria', 'Kenya', 'Ghana', 'Ethiopia', 'Morocco', 'Algeria', 'Tunisia',
                'Tanzania', 'Uganda', 'Zambia', 'Zimbabwe', 'Botswana', 'Namibia', 'Mauritius', 'Seychelles',
                'Brazil', 'Mexico', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia',
                'Paraguay', 'Uruguay', 'Costa Rica', 'Panama', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua',
                'Russia', 'Ukraine', 'Belarus', 'Kazakhstan', 'Uzbekistan', 'Azerbaijan', 'Georgia', 'Armenia'
              ].sort().map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item
            name="source"
            label="Source"
            rules={[{ required: true, message: 'Please select source' }]}
          >
            <Select placeholder="Select source">
              <Option value="Facebook">Facebook</Option>
              <Option value="Instagram">Instagram</Option>
              <Option value="Google Ads">Google Ads</Option>
              <Option value="Website">Website</Option>
              <Option value="Referral">Referral</Option>
              <Option value="WhatsApp">WhatsApp</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="course_interested"
            label="Course Interested"
            rules={[{ required: true, message: 'Please select course' }]}
          >
            <Select placeholder="Select course">
              {courses?.map(course => (
                <Option key={course.id} value={course.course_name}>
                  {course.course_name} - ₹{(course.price / 1000).toFixed(0)}K
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="assigned_to"
            label="Assign To"
          >
            <Select placeholder="Select counselor" allowClear>
              {counselors?.map(counselor => (
                <Option key={counselor.id} value={counselor.name}>
                  {counselor.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createLeadMutation.isPending}>
                Create Lead
              </Button>
              <Button onClick={() => setDrawerVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Filter Drawer */}
      <Drawer
        title="Advanced Filters"
        width={400}
        onClose={() => setFilterDrawerVisible(false)}
        open={filterDrawerVisible}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Status</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Select status"
              allowClear
              onChange={(value) => handleFilter('status', value)}
              value={filters.status}
            >
              <Option value="Fresh">Fresh</Option>
              <Option value="Follow Up">Follow Up</Option>
              <Option value="Warm">Warm</Option>
              <Option value="Hot">Hot</Option>
              <Option value="Not Interested">Not Interested</Option>
              <Option value="Junk">Junk</Option>
              <Option value="Not Answering">Not Answering</Option>
              <Option value="Enrolled">Enrolled</Option>
            </Select>
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Country</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Select country"
              allowClear
              onChange={(value) => handleFilter('country', value)}
              value={filters.country}
            >
              {countries.map(country => (
                <Option key={country} value={country}>{country}</Option>
              ))}
            </Select>
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Segment</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Select segment"
              allowClear
              onChange={(value) => handleFilter('segment', value)}
              value={filters.segment}
            >
              <Option value="Hot">Hot</Option>
              <Option value="Warm">Warm</Option>
              <Option value="Cold">Cold</Option>
              <Option value="Junk">Junk</Option>
            </Select>
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Assigned To</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Select counselor"
              allowClear
              onChange={(value) => handleFilter('assigned_to', value)}
              value={filters.assigned_to}
            >
              {counselors?.map(counselor => (
                <Option key={counselor.id} value={counselor.name}>
                  {counselor.name}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Follow-up Date Range</div>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(dates) => {
                if (dates) {
                  handleFilter('follow_up_from', dates[0].toISOString());
                  handleFilter('follow_up_to', dates[1].toISOString());
                } else {
                  handleFilter('follow_up_from', undefined);
                  handleFilter('follow_up_to', undefined);
                }
              }}
            />
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Created Date</div>
            <Select
              style={{ width: '100%', marginBottom: '8px' }}
              placeholder="Select filter type"
              value={createdDateType}
              onChange={(value) => {
                setCreatedDateType(value);
                // Clear filters when type changes
                handleFilter('created_on', undefined);
                handleFilter('created_after', undefined);
                handleFilter('created_before', undefined);
                handleFilter('created_from', undefined);
                handleFilter('created_to', undefined);
              }}
            >
              <Option value="on">On</Option>
              <Option value="after">After</Option>
              <Option value="before">Before</Option>
              <Option value="between">Between</Option>
            </Select>

            {createdDateType === 'between' ? (
              <RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => {
                  if (dates) {
                    handleFilter('created_from', dates[0].toISOString());
                    handleFilter('created_to', dates[1].toISOString());
                  } else {
                    handleFilter('created_from', undefined);
                    handleFilter('created_to', undefined);
                  }
                }}
              />
            ) : (
              <DatePicker
                style={{ width: '100%' }}
                onChange={(date) => {
                  if (date) {
                    if (createdDateType === 'on') {
                      handleFilter('created_on', date.format('YYYY-MM-DD'));
                    } else if (createdDateType === 'after') {
                      handleFilter('created_after', date.toISOString());
                    } else if (createdDateType === 'before') {
                      handleFilter('created_before', date.toISOString());
                    }
                  } else {
                    handleFilter(`created_${createdDateType}`, undefined);
                  }
                }}
              />
            )}
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Updated Date</div>
            <Select
              style={{ width: '100%', marginBottom: '8px' }}
              placeholder="Select filter type"
              value={updatedDateType}
              onChange={(value) => {
                setUpdatedDateType(value);
                // Clear filters when type changes
                handleFilter('updated_on', undefined);
                handleFilter('updated_after', undefined);
                handleFilter('updated_before', undefined);
                handleFilter('updated_from', undefined);
                handleFilter('updated_to', undefined);
              }}
            >
              <Option value="on">On</Option>
              <Option value="after">After</Option>
              <Option value="before">Before</Option>
              <Option value="between">Between</Option>
            </Select>

            {updatedDateType === 'between' ? (
              <RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => {
                  if (dates) {
                    handleFilter('updated_from', dates[0].toISOString());
                    handleFilter('updated_to', dates[1].toISOString());
                  } else {
                    handleFilter('updated_from', undefined);
                    handleFilter('updated_to', undefined);
                  }
                }}
              />
            ) : (
              <DatePicker
                style={{ width: '100%' }}
                onChange={(date) => {
                  if (date) {
                    if (updatedDateType === 'on') {
                      handleFilter('updated_on', date.format('YYYY-MM-DD'));
                    } else if (updatedDateType === 'after') {
                      handleFilter('updated_after', date.toISOString());
                    } else if (updatedDateType === 'before') {
                      handleFilter('updated_before', date.toISOString());
                    }
                  } else {
                    handleFilter(`updated_${updatedDateType}`, undefined);
                  }
                }}
              />
            )}
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Search</div>
            <Input
              placeholder="Search by name, phone, email..."
              onChange={(e) => handleFilter('search', e.target.value)}
              value={filters.search}
              prefix={<SearchOutlined />}
            />
          </div>

          <Button onClick={clearFilters} block>
            Clear All Filters
          </Button>
        </Space>
      </Drawer>
      
      {/* Chat Interface for WhatsApp and Email */}
      <ChatInterface
        visible={chatVisible}
        onClose={() => {
          setChatVisible(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
        type={communicationType}
      />
      
      {/* Call Interface */}
      <CallInterface
        visible={callVisible}
        onClose={() => {
          setCallVisible(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
      />
    </div>
  );
};

export default LeadsPage;
