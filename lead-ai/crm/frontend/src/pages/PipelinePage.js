import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Avatar, Typography, Select, DatePicker, Button, Space, Badge, Tooltip, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { leadsAPI } from '../api/api';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  WhatsAppOutlined,
  DollarOutlined,
  CalendarOutlined,
  RightOutlined,
  FilterOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const PipelinePage = () => {
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [selectedUser, setSelectedUser] = useState('all');

  const { data: leadsData, isLoading, refetch } = useQuery({
    queryKey: ['leads-pipeline'],
    queryFn: () => leadsAPI.getAll({ limit: 70000, skip: 0 }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  // Pipeline stages configuration
  const pipelineStages = [
    { 
      key: 'Fresh', 
      label: 'Fresh', 
      color: '#13c2c2',
      bgColor: '#e6fffb',
      icon: <CalendarOutlined />
    },
    { 
      key: 'Follow Up', 
      label: 'Follow Up', 
      color: '#1890ff',
      bgColor: '#e6f7ff',
      icon: <CalendarOutlined />
    },
    { 
      key: 'Warm', 
      label: 'Warm', 
      color: '#faad14',
      bgColor: '#fffbe6',
      icon: <PhoneOutlined />
    },
    { 
      key: 'Hot', 
      label: 'Hot', 
      color: '#ff4d4f',
      bgColor: '#fff1f0',
      icon: <DollarOutlined />
    },
    { 
      key: 'Enrolled', 
      label: 'Enrolled', 
      color: '#52c41a',
      bgColor: '#f6ffed',
      icon: <DollarOutlined />
    },
  ];

  const lostStages = [
    { 
      key: 'Not Interested', 
      label: 'Not Interested', 
      color: '#8c8c8c',
      bgColor: '#f5f5f5'
    },
    { 
      key: 'Not Answering', 
      label: 'Not Answering', 
      color: '#8c8c8c',
      bgColor: '#f5f5f5'
    },
    { 
      key: 'Junk', 
      label: 'Junk', 
      color: '#d9d9d9',
      bgColor: '#fafafa'
    },
  ];

  // Filter leads by date range and user
  const filterLeads = (leads) => {
    if (!leads) return [];
    
    return leads.filter(lead => {
      const leadDate = dayjs(lead.created_at);
      const inDateRange = leadDate.isAfter(dateRange[0]) && leadDate.isBefore(dateRange[1].add(1, 'day'));
      const matchesUser = selectedUser === 'all' || lead.assigned_to === selectedUser;
      return inDateRange && matchesUser;
    });
  };

  const filteredLeads = filterLeads(leadsData?.leads || []);

  // Group leads by stage
  const getLeadsByStage = (stage) => {
    return filteredLeads.filter(lead => lead.status === stage);
  };

  // Calculate metrics
  const getTotalRevenue = (stage) => {
    const leads = getLeadsByStage(stage);
    if (stage === 'Enrolled') {
      return leads.reduce((sum, lead) => sum + (lead.actual_revenue || 0), 0);
    }
    return leads.reduce((sum, lead) => sum + (lead.expected_revenue || 0), 0);
  };

  const getConversionRate = () => {
    const total = filteredLeads.length;
    const enrolled = getLeadsByStage('Enrolled').length;
    return total > 0 ? ((enrolled / total) * 100).toFixed(1) : 0;
  };

  // Get unique users
  const uniqueUsers = [...new Set(leadsData?.leads?.map(l => l.assigned_to).filter(Boolean) || [])];

  const LeadCard = ({ lead }) => (
    <Card
      size="small"
      style={{ 
        marginBottom: 8, 
        cursor: 'pointer',
        transition: 'all 0.3s',
        border: '1px solid #f0f0f0'
      }}
      hoverable
      styles={{ body: { padding: '12px' }}}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong ellipsis style={{ fontSize: '13px', maxWidth: '70%' }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {lead.full_name}
          </Text>
          {lead.ai_score && (
            <Tag color={lead.ai_score > 70 ? 'green' : lead.ai_score > 40 ? 'orange' : 'default'}>
              {lead.ai_score}
            </Tag>
          )}
        </div>
        
        <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
          {lead.course_interested}
        </Text>
        
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {lead.phone && (
            <Tooltip title={lead.phone}>
              <PhoneOutlined style={{ fontSize: '11px', color: '#1890ff' }} />
            </Tooltip>
          )}
          {lead.email && (
            <Tooltip title={lead.email}>
              <MailOutlined style={{ fontSize: '11px', color: '#52c41a' }} />
            </Tooltip>
          )}
          {lead.whatsapp && (
            <Tooltip title="WhatsApp">
              <WhatsAppOutlined style={{ fontSize: '11px', color: '#25D366' }} />
            </Tooltip>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ fontSize: '11px', fontWeight: 600, color: '#52c41a' }}>
            ₹{(lead.expected_revenue || 0).toLocaleString()}
          </Text>
          {lead.assigned_to && (
            <Avatar size={16} style={{ fontSize: '10px', backgroundColor: '#1890ff' }}>
              {lead.assigned_to[0]}
            </Avatar>
          )}
        </div>
      </Space>
    </Card>
  );

  const StageColumn = ({ stage, leads, isLost = false }) => (
    <Card
      style={{ 
        height: '100%',
        backgroundColor: stage.bgColor,
        border: `2px solid ${stage.color}`
      }}
      styles={{ body: { padding: '16px' }}}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ 
            fontSize: '18px', 
            color: stage.color,
            display: 'flex',
            alignItems: 'center'
          }}>
            {stage.icon}
          </div>
          <Title level={5} style={{ margin: 0, color: stage.color }}>
            {stage.label}
          </Title>
        </div>
        
        <Row gutter={8}>
          <Col span={12}>
            <Statistic 
              title="Count" 
              value={leads.length} 
              valueStyle={{ fontSize: '18px', color: stage.color }}
            />
          </Col>
          <Col span={12}>
            <Statistic 
              title="Revenue" 
              value={getTotalRevenue(stage.key)}
              prefix="₹"
              precision={0}
              valueStyle={{ fontSize: '14px', color: stage.color }}
            />
          </Col>
        </Row>
      </div>

      <div style={{ 
        maxHeight: isLost ? '200px' : '500px', 
        overflowY: 'auto',
        paddingRight: 8
      }}>
        {leads.length > 0 ? (
          leads.map(lead => <LeadCard key={lead.id} lead={lead} />)
        ) : (
          <Empty 
            description="No leads" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ margin: '40px 0' }}
          />
        )}
      </div>
    </Card>
  );

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          Sales Pipeline
        </Title>
        <Text type="secondary">
          Visual pipeline view of your leads across different stages
        </Text>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="middle" wrap>
          <div>
            <Text strong style={{ marginRight: 8 }}>Date Range:</Text>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD MMM YYYY"
              style={{ width: 280 }}
            />
          </div>
          
          <div>
            <Text strong style={{ marginRight: 8 }}>Assigned To:</Text>
            <Select
              value={selectedUser}
              onChange={setSelectedUser}
              style={{ width: 200 }}
              placeholder="Select user"
            >
              <Select.Option value="all">All Users</Select.Option>
              {uniqueUsers.map(user => (
                <Select.Option key={user} value={user}>{user}</Select.Option>
              ))}
            </Select>
          </div>

          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Pipeline Metrics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Total Leads" 
              value={filteredLeads.length}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Total Pipeline Value" 
              value={filteredLeads.reduce((sum, l) => sum + (l.expected_revenue || 0), 0)}
              prefix="₹"
              precision={0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Enrolled Revenue" 
              value={getTotalRevenue('Enrolled')}
              prefix="₹"
              precision={0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Conversion Rate" 
              value={getConversionRate()}
              suffix="%"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Pipeline Stages */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {pipelineStages.map((stage, index) => (
          <React.Fragment key={stage.key}>
            <Col span={6}>
              <StageColumn 
                stage={stage} 
                leads={getLeadsByStage(stage.key)}
              />
            </Col>
            {index < pipelineStages.length - 1 && (
              <Col span={0} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginTop: 60
              }}>
                <RightOutlined style={{ fontSize: '24px', color: '#d9d9d9' }} />
              </Col>
            )}
          </React.Fragment>
        ))}
      </Row>

      {/* Lost/Inactive Leads */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong>Lost / Inactive Leads</Text>
            <Badge count={lostStages.reduce((sum, s) => sum + getLeadsByStage(s.key).length, 0)} />
          </div>
        }
        style={{ backgroundColor: '#fafafa' }}
      >
        <Row gutter={16}>
          {lostStages.map(stage => (
            <Col span={8} key={stage.key}>
              <StageColumn 
                stage={stage} 
                leads={getLeadsByStage(stage.key)}
                isLost={true}
              />
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default PipelinePage;
