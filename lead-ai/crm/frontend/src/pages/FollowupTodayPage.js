import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Statistic, Tag, Button, Table, Avatar, Tooltip,
  Select, Space, Typography, Badge, Tabs, DatePicker, Modal, Input,
  message, Empty, Progress, Spin,
} from 'antd';
import {
  PhoneOutlined, WhatsAppOutlined, EyeOutlined, CalendarOutlined,
  FireOutlined, ClockCircleOutlined, WarningOutlined, CheckCircleOutlined,
  UserOutlined, BookOutlined, GlobalOutlined, ReloadOutlined,
  ExclamationCircleOutlined, MessageOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { dashboardAPI, leadsAPI, usersAPI } from '../api/api';
import ChatDrawer from '../components/ChatDrawer';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ── Segment colours ──────────────────────────────────────────────────────────
const segmentColor = { Hot: '#f5222d', Warm: '#fa8c16', Cold: '#1890ff', Junk: '#8c8c8c' };
const statusColor  = {
  Fresh: 'blue', 'Follow Up': 'orange', Warm: 'volcano', Hot: 'red',
  Enrolled: 'green', 'Not Interested': 'default', Junk: 'default', 'Not Answering': 'warning',
};

// ── Quick-action modal ────────────────────────────────────────────────────────
function QuickActionModal({ lead, open, onClose, onDone }) {
  const [nextDate, setNextDate] = useState(null);
  const [note, setNote]         = useState('');
  const [status, setStatus]     = useState(lead?.status || '');
  const queryClient             = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ leadId, data }) => leadsAPI.update(leadId, data),
    onSuccess: () => {
      message.success('Lead updated!');
      queryClient.invalidateQueries({ queryKey: ['followups-today'] });
      onDone();
      onClose();
    },
    onError: () => message.error('Update failed'),
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ leadId, content }) =>
      leadsAPI.addNote(leadId, { content, channel: 'call', created_by: JSON.parse(localStorage.getItem('crm_user') || '{}').full_name || 'CRM' }),
  });

  const handleSave = async () => {
    if (!lead) return;
    const updates = { status };
    if (nextDate) updates.follow_up_date = nextDate.toISOString();
    updateMutation.mutate({ leadId: lead.lead_id, data: updates });
    if (note.trim()) {
      await addNoteMutation.mutateAsync({ leadId: lead.id, content: note });
    }
  };

  if (!lead) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save & Close"
      confirmLoading={updateMutation.isPending}
      title={
        <Space>
          <Avatar style={{ background: segmentColor[lead.ai_segment] || '#1890ff' }}>
            {lead.full_name?.charAt(0)}
          </Avatar>
          <span>{lead.full_name}</span>
          <Tag color={segmentColor[lead.ai_segment]}>{lead.ai_segment}</Tag>
        </Space>
      }
      width={520}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={14}>
        {/* Contact info */}
        <Row gutter={8}>
          <Col span={12}>
            <Text type="secondary">Phone</Text>
            <div><Text strong>{lead.phone || '—'}</Text></div>
          </Col>
          <Col span={12}>
            <Text type="secondary">Course</Text>
            <div><Text strong style={{ fontSize: 12 }}>{lead.course_interested || '—'}</Text></div>
          </Col>
        </Row>

        {/* AI insight bar */}
        {lead.ai_score > 0 && (
          <div>
            <Text type="secondary">AI Score</Text>
            <Progress
              percent={lead.ai_score}
              strokeColor={lead.ai_score >= 70 ? '#52c41a' : lead.ai_score >= 40 ? '#fa8c16' : '#f5222d'}
              size="small"
              style={{ marginTop: 4 }}
            />
          </div>
        )}

        {lead.primary_objection && (
          <div style={{ background: '#fff7e6', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #fa8c16' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Known Objection</Text>
            <div><Text strong>{lead.primary_objection}</Text></div>
          </div>
        )}

        {lead.next_action && (
          <div style={{ background: '#f6ffed', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #52c41a' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Recommended Action</Text>
            <div><Text>{lead.next_action}</Text></div>
          </div>
        )}

        {/* Update status */}
        <div>
          <Text type="secondary">Update Status</Text>
          <Select value={status} onChange={setStatus} style={{ width: '100%', marginTop: 4 }}>
            {['Fresh','Follow Up','Warm','Hot','Not Answering','Not Interested','Enrolled','Junk'].map(s => (
              <Option key={s} value={s}>{s}</Option>
            ))}
          </Select>
        </div>

        {/* Next follow-up */}
        <div>
          <Text type="secondary">Set Next Follow-up Date</Text>
          <DatePicker
            showTime
            style={{ width: '100%', marginTop: 4 }}
            value={nextDate}
            onChange={setNextDate}
            disabledDate={d => d && d < dayjs().startOf('day')}
            placeholder="Pick next follow-up date & time"
          />
        </div>

        {/* Call note */}
        <div>
          <Text type="secondary">Call Note (optional)</Text>
          <TextArea
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What happened on this call?"
            style={{ marginTop: 4 }}
          />
        </div>
      </Space>
    </Modal>
  );
}

// ── Lead row card (mobile-friendly) ─────────────────────────────────────────
function LeadRow({ lead, isOverdue, onQuickAction, onChat }) {
  const navigate = useNavigate();
  const daysOverdue = isOverdue && lead.follow_up_date
    ? dayjs().diff(dayjs(lead.follow_up_date), 'day')
    : 0;

  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        borderLeft: `4px solid ${isOverdue ? '#f5222d' : segmentColor[lead.ai_segment] || '#1890ff'}`,
        background: isOverdue ? '#fff2f0' : '#fff',
      }}
      bodyStyle={{ padding: '10px 14px' }}
    >
      <Row align="middle" gutter={8} wrap={false}>
        {/* Avatar */}
        <Col flex="none">
          <Avatar
            size={38}
            style={{ background: segmentColor[lead.ai_segment] || '#1890ff', flexShrink: 0 }}
          >
            {lead.full_name?.charAt(0)}
          </Avatar>
        </Col>

        {/* Main info */}
        <Col flex="auto" style={{ minWidth: 0 }}>
          <Space size={6} wrap>
            <Text strong style={{ fontSize: 14 }}>{lead.full_name}</Text>
            <Tag color={segmentColor[lead.ai_segment]} style={{ margin: 0 }}>{lead.ai_segment}</Tag>
            <Tag color={statusColor[lead.status] || 'default'} style={{ margin: 0 }}>{lead.status}</Tag>
            {isOverdue && (
              <Tag color="red" icon={<WarningOutlined />} style={{ margin: 0 }}>
                {daysOverdue}d overdue
              </Tag>
            )}
          </Space>
          <div style={{ marginTop: 3, fontSize: 12, color: '#666' }}>
            <Space size={12} wrap>
              {lead.phone && <span><PhoneOutlined /> {lead.phone}</span>}
              {lead.country && <span><GlobalOutlined /> {lead.country}</span>}
              {lead.course_interested && (
                <span><BookOutlined /> <Text style={{ fontSize: 12 }} ellipsis>{lead.course_interested}</Text></span>
              )}
            </Space>
          </div>
          {lead.next_action && (
            <div style={{ marginTop: 3, fontSize: 11, color: '#389e0d', fontStyle: 'italic' }}>
              → {lead.next_action}
            </div>
          )}
          {lead.primary_objection && (
            <div style={{ marginTop: 2, fontSize: 11, color: '#d46b08' }}>
              ⚠ {lead.primary_objection}
            </div>
          )}
        </Col>

        {/* AI Score */}
        <Col flex="none" style={{ textAlign: 'center', minWidth: 44 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
            background: lead.ai_score >= 70 ? '#f6ffed' : lead.ai_score >= 40 ? '#fff7e6' : '#fff2f0',
            color: lead.ai_score >= 70 ? '#52c41a' : lead.ai_score >= 40 ? '#fa8c16' : '#f5222d',
            border: `2px solid ${lead.ai_score >= 70 ? '#52c41a' : lead.ai_score >= 40 ? '#fa8c16' : '#f5222d'}`,
          }}>
            {Math.round(lead.ai_score || 0)}
          </div>
          <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>AI</div>
        </Col>

        {/* Actions */}
        <Col flex="none">
          <Space direction="vertical" size={4}>
            <Space size={4}>
              <Tooltip title="Call">
                <Button size="small" icon={<PhoneOutlined />}
                  onClick={() => window.open(`tel:${lead.phone}`)} />
              </Tooltip>
              <Tooltip title="WhatsApp Chat">
                <Button size="small" icon={<MessageOutlined />}
                  style={{ background: '#25d366', borderColor: '#25d366', color: '#fff' }}
                  onClick={() => onChat(lead)} />
              </Tooltip>
              <Tooltip title="View Lead">
                <Button size="small" type="primary" icon={<EyeOutlined />}
                  onClick={() => navigate(`/leads/${lead.lead_id}`)} />
              </Tooltip>
            </Space>
            <Button size="small" block icon={<CheckCircleOutlined />}
              style={{ fontSize: 11 }}
              onClick={() => onQuickAction(lead)}>
              Log Call
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FollowupTodayPage() {
  const [filterUser, setFilterUser]     = useState('');
  const [activeTab, setActiveTab]       = useState('overdue');
  const [actionLead, setActionLead]     = useState(null);
  const [chatLead, setChatLead]         = useState(null);
  const queryClient                     = useQueryClient();

  const currentUser = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const isAdmin     = ['Super Admin', 'Manager', 'Team Leader'].includes(currentUser.role);

  const { data: usersData = {} } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAll().then(r => r.data),
    staleTime: 60000,
  });

  const users = usersData?.users || [];
  const counselors = users.filter(u => u.role === 'Counselor' || u.role === 'Team Leader');

  const assignedToFilter = isAdmin ? filterUser : currentUser.full_name;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['followups-today', assignedToFilter],
    queryFn: () => dashboardAPI.getFollowupsToday(assignedToFilter).then(r => r.data),
    refetchInterval: 60000, // refresh every minute
  });

  const overdue  = data?.overdue  || [];
  const today    = data?.today    || [];
  const total    = overdue.length + today.length;

  const tabItems = [
    {
      key: 'overdue',
      label: (
        <span>
          <WarningOutlined style={{ color: '#f5222d' }} />
          Overdue
          {overdue.length > 0 && (
            <Badge count={overdue.length} style={{ marginLeft: 6, background: '#f5222d' }} />
          )}
        </span>
      ),
      children: (
        <div>
          {overdue.length === 0 ? (
            <Empty description="No overdue follow-ups 🎉" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            overdue.map(l => (
              <LeadRow key={l.id} lead={l} isOverdue
                onQuickAction={setActionLead}
                onChat={setChatLead}
              />
            ))
          )}
        </div>
      ),
    },
    {
      key: 'today',
      label: (
        <span>
          <CalendarOutlined style={{ color: '#1890ff' }} />
          Due Today
          {today.length > 0 && (
            <Badge count={today.length} style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div>
          {today.length === 0 ? (
            <Empty description="No follow-ups scheduled for today" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            today.map(l => (
              <LeadRow key={l.id} lead={l} isOverdue={false}
                onQuickAction={setActionLead}
                onChat={setChatLead}
              />
            ))
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <CalendarOutlined style={{ color: '#1890ff', marginRight: 8 }} />
            Today's Follow-ups
          </Title>
          <Text type="secondary">{dayjs().format('dddd, D MMMM YYYY')}</Text>
        </div>
        <Space wrap>
          {isAdmin && (
            <Select
              allowClear
              showSearch
              placeholder="Filter by counselor"
              style={{ width: 200 }}
              value={filterUser || undefined}
              onChange={v => setFilterUser(v || '')}
            >
              {counselors.map(u => (
                <Option key={u.id} value={u.full_name}>{u.full_name}</Option>
              ))}
            </Select>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
        </Space>
      </div>

      {/* Stat cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderTop: '3px solid #f5222d' }}>
            <Statistic
              title="Overdue"
              value={overdue.length}
              prefix={<WarningOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: overdue.length > 0 ? '#f5222d' : '#595959' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderTop: '3px solid #1890ff' }}>
            <Statistic
              title="Due Today"
              value={today.length}
              prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderTop: '3px solid #722ed1' }}>
            <Statistic
              title="Total Pending"
              value={total}
              prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderTop: '3px solid #52c41a' }}>
            <Statistic
              title="Hot Leads"
              value={[...overdue, ...today].filter(l => l.ai_segment === 'Hot').length}
              prefix={<FireOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Lead list */}
      <Card bodyStyle={{ padding: 0 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: '#666' }}>Loading today's follow-ups…</div>
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            style={{ padding: '0 16px' }}
          />
        )}
      </Card>

      {/* Quick action modal */}
      <QuickActionModal
        lead={actionLead}
        open={!!actionLead}
        onClose={() => setActionLead(null)}
        onDone={() => queryClient.invalidateQueries({ queryKey: ['followups-today'] })}
      />

      {/* WhatsApp Chat Drawer */}
      <ChatDrawer lead={chatLead} onClose={() => setChatLead(null)} />
    </div>
  );
}
