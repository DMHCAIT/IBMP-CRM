import React, { useState, useMemo } from 'react';
import {
  Table, Card, DatePicker, Select, Button, Tag, Badge, Drawer,
  Typography, Space, Statistic, Row, Col, Timeline, Empty, Tooltip,
  Input,
} from 'antd';
import {
  CalendarOutlined, UserOutlined, EditOutlined, FileTextOutlined,
  PhoneOutlined, TeamOutlined, EyeOutlined, ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const { Title, Text } = Typography;

// ── Colour palette for activity types ────────────────────────────────────────
const TYPE_COLOR = {
  status_change:    '#6366f1',
  field_update:     '#06b6d4',
  lead_created:     '#10b981',
  note:             '#f59e0b',
  note_call:        '#ef4444',
  note_whatsapp:    '#25d366',
  note_email:       '#3b82f6',
  note_note:        '#f59e0b',
  note_manual:      '#f59e0b',
  note_1st_call:    '#ef4444',
  note_2nd_call:    '#f97316',
  whatsapp:         '#25d366',
  call:             '#ef4444',
  reassignment:     '#8b5cf6',
  update:           '#06b6d4',
};
const TYPE_LABEL = {
  status_change:    'Status Change',
  field_update:     'Fields Updated',
  lead_created:     'Lead Created',
  note:             'Note',
  note_call:        'Call Note',
  note_whatsapp:    'WhatsApp Note',
  note_email:       'Email Note',
  note_note:        'Note',
  note_manual:      'Manual Note',
  note_1st_call:    '1st Call Note',
  note_2nd_call:    '2nd Call Note',
  whatsapp:         'WhatsApp',
  call:             'Call',
  reassignment:     'Reassigned',
  update:           'Field Update',
};

function typeTag(type) {
  const color = TYPE_COLOR[type] || '#64748b';
  const label = TYPE_LABEL[type] || type;
  return (
    <Tag style={{ background: `${color}20`, color, border: `1px solid ${color}50`, borderRadius: 6 }}>
      {label}
    </Tag>
  );
}

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function fetchActivity({ date, days }) {
  const params = { days };
  if (date) params.date = date;
  const res = await api.get('/api/admin/lead-update-activity', { params });
  return res.data;
}

export default function LeadUpdateActivityPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(null);   // dayjs or null
  const [userFilter, setUserFilter]     = useState('');
  const [days, setDays]                 = useState(7);
  const [drawerRow, setDrawerRow]       = useState(null);   // the row being viewed
  const [leadSearch, setLeadSearch]     = useState('');

  // ── Query ──────────────────────────────────────────────────────────────────
  const queryKey = ['lead-update-activity', selectedDate?.format('YYYY-MM-DD') || null, days];
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchActivity({ date: selectedDate?.format('YYYY-MM-DD') || null, days }),
    staleTime: 30_000,
  });

  const rows = data?.rows || [];

  // ── Derived: all users for filter dropdown ─────────────────────────────────
  const allUsers = useMemo(() => {
    const s = new Set(rows.map(r => r.user));
    return [...s].filter(Boolean).sort();
  }, [rows]);

  // ── Apply user filter ──────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!userFilter) return rows;
    return rows.filter(r => r.user === userFilter);
  }, [rows, userFilter]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalLeads  = filteredRows.reduce((s, r) => s + r.leads_updated, 0);
  const totalEvents = filteredRows.reduce((s, r) => s + r.total_events, 0);
  const uniqueUsers = new Set(filteredRows.map(r => r.user)).size;

  // ── Leads filtered by search inside drawer ────────────────────────────────
  const drawerLeads = useMemo(() => {
    if (!drawerRow) return [];
    const q = leadSearch.toLowerCase();
    return drawerRow.leads.filter(l =>
      !q ||
      (l.full_name || '').toLowerCase().includes(q) ||
      (l.lead_id || '').toLowerCase().includes(q) ||
      (l.status || '').toLowerCase().includes(q) ||
      (l.course_interested || '').toLowerCase().includes(q)
    );
  }, [drawerRow, leadSearch]);

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      sorter: (a, b) => a.date.localeCompare(b.date),
      defaultSortOrder: 'descend',
      render: d => (
        <Text strong style={{ color: '#6366f1' }}>
          <CalendarOutlined style={{ marginRight: 4 }} />
          {dayjs(d).format('DD MMM YYYY')}
        </Text>
      ),
    },
    {
      title: 'User / Counsellor',
      dataIndex: 'user',
      key: 'user',
      render: u => (
        <Space>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#6366f120', display: 'flex', alignItems: 'center',
            justifyContent: 'center', border: '1px solid #6366f140',
          }}>
            <UserOutlined style={{ color: '#6366f1', fontSize: 14 }} />
          </div>
          <Text strong>{u || 'Unknown'}</Text>
        </Space>
      ),
    },
    {
      title: 'Leads Updated',
      dataIndex: 'leads_updated',
      key: 'leads_updated',
      width: 140,
      sorter: (a, b) => a.leads_updated - b.leads_updated,
      render: n => (
        <Badge
          count={n}
          style={{ background: '#10b981', fontWeight: 700, fontSize: 13 }}
          overflowCount={9999}
        />
      ),
    },
    {
      title: 'Total Events',
      dataIndex: 'total_events',
      key: 'total_events',
      width: 130,
      sorter: (a, b) => a.total_events - b.total_events,
      render: n => <Tag color="blue">{n} events</Tag>,
    },
    {
      title: 'Activity Breakdown',
      dataIndex: 'action_summary',
      key: 'action_summary',
      render: summary => (
        <Space wrap size={4}>
          {(summary || []).slice(0, 4).map(s => (
            <Tooltip key={s.type} title={`${TYPE_LABEL[s.type] || s.type}: ${s.count}`}>
              {typeTag(s.type)}
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}>×{s.count}</Text>
            </Tooltip>
          ))}
          {summary.length > 4 && (
            <Text type="secondary" style={{ fontSize: 11 }}>+{summary.length - 4} more</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_, row) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => { setDrawerRow(row); setLeadSearch(''); }}
          style={{ background: '#6366f1', border: 'none', borderRadius: 6 }}
        >
          View
        </Button>
      ),
    },
  ];

  // ── Drawer: lead events timeline ──────────────────────────────────────────
  const leadColumns = [
    {
      title: 'Lead ID',
      dataIndex: 'lead_id',
      key: 'lid',
      width: 110,
      render: id => (
        <Text code style={{ fontSize: 11, cursor: 'pointer', color: '#6366f1' }}
          onClick={() => navigate(`/leads/${id}`)}>
          {id}
        </Text>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name, rec) => (
        <div
          style={{ cursor: 'pointer', color: '#1a1a1a', fontWeight: 600 }}
          onClick={() => navigate(`/leads/${rec.lead_id}`)}
        >
          {name || rec.lead_id}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: s => s ? <Tag color="processing">{s}</Tag> : '—',
    },
    {
      title: 'Course',
      dataIndex: 'course_interested',
      key: 'course',
      ellipsis: true,
      render: c => c || '—',
    },
    {
      title: 'Events',
      dataIndex: 'events',
      key: 'events',
      width: 80,
      render: evs => <Tag color="purple">{evs?.length || 0}</Tag>,
    },
    {
      title: 'View',
      key: 'view',
      width: 60,
      render: (_, rec) => (
        <Button
          type="link" size="small" icon={<EyeOutlined />}
          onClick={() => navigate(`/leads/${rec.lead_id}`)}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f8f9ff', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#1e1b4b' }}>
          <EditOutlined style={{ color: '#6366f1', marginRight: 8 }} />
          Lead Update Activity
        </Title>
        <Text type="secondary">
          See how many leads each user updated, on which day, and what changed.
        </Text>
      </div>

      {/* ── Filters bar ── */}
      <Card
        style={{ marginBottom: 20, borderRadius: 12, border: '1px solid #e8e8f0' }}
        styles={{ body: { padding: '16px 20px' }}}
      >
        <Space wrap size={12}>
          <DatePicker
            value={selectedDate}
            onChange={v => setSelectedDate(v)}
            placeholder="Select specific day"
            format="DD MMM YYYY"
            allowClear
            suffixIcon={<CalendarOutlined />}
            style={{ width: 190 }}
          />
          {!selectedDate && (
            <Select
              value={days}
              onChange={setDays}
              style={{ width: 150 }}
              options={[
                { label: 'Last 7 days',  value: 7  },
                { label: 'Last 14 days', value: 14 },
                { label: 'Last 30 days', value: 30 },
              ]}
            />
          )}
          <Select
            value={userFilter}
            onChange={setUserFilter}
            placeholder="All users"
            allowClear
            style={{ width: 200 }}
            showSearch
            options={[
              { label: 'All users', value: '' },
              ...allUsers.map(u => ({ label: u, value: u })),
            ]}
            suffixIcon={<UserOutlined />}
          />
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* ── Summary stat cards ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Unique Users Active',  value: uniqueUsers,  icon: <TeamOutlined />,     color: '#6366f1' },
          { title: 'Leads Updated',        value: totalLeads,   icon: <EditOutlined />,      color: '#10b981' },
          { title: 'Total Events Logged',  value: totalEvents,  icon: <FileTextOutlined />,  color: '#f59e0b' },
          { title: 'Days in Window',
            value: selectedDate ? 1 : days,
            icon: <CalendarOutlined />,  color: '#06b6d4' },
        ].map(s => (
          <Col xs={24} sm={12} md={6} key={s.title}>
            <Card
              style={{ borderRadius: 12, border: `1px solid ${s.color}30`, background: '#fff' }}
              styles={{ body: { padding: '16px 20px' }}}
            >
              <Statistic
                title={<span style={{ color: '#64748b', fontSize: 13 }}>{s.title}</span>}
                value={s.value}
                prefix={React.cloneElement(s.icon, { style: { color: s.color } })}
                valueStyle={{ color: s.color, fontWeight: 700, fontSize: 28 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Main table ── */}
      <Card
        style={{ borderRadius: 12, border: '1px solid #e8e8f0' }}
        styles={{ body: { padding: 0 }}}
      >
        <Table
          dataSource={filteredRows}
          columns={columns}
          rowKey={r => `${r.user}_${r.date}`}
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} rows` }}
          scroll={{ x: 800 }}
          locale={{ emptyText: <Empty description="No activity found for this period" /> }}
          rowClassName={() => 'activity-row'}
        />
      </Card>

      {/* ── Drill-down drawer ── */}
      <Drawer
        open={!!drawerRow}
        onClose={() => setDrawerRow(null)}
        width={780}
        title={
          drawerRow ? (
            <Space>
              <UserOutlined style={{ color: '#6366f1' }} />
              <span style={{ fontWeight: 700, color: '#1e1b4b' }}>{drawerRow.user}</span>
              <Tag color="purple">{dayjs(drawerRow.date).format('DD MMM YYYY')}</Tag>
              <Tag color="green">{drawerRow.leads_updated} leads</Tag>
              <Tag color="blue">{drawerRow.total_events} events</Tag>
            </Space>
          ) : null
        }
        extra={
          <Button
            type="primary"
            size="small"
            style={{ background: '#6366f1', border: 'none' }}
            onClick={() => drawerRow && navigate(`/leads?assigned_to=${encodeURIComponent(drawerRow.user)}`)}
          >
            View All Leads of {drawerRow?.user}
          </Button>
        }
      >
        {drawerRow && (
          <>
            {/* ── Activity type breakdown ── */}
            <Card
              size="small"
              title={<Text strong>Activity Breakdown</Text>}
              style={{ marginBottom: 16, borderRadius: 10 }}
            >
              <Space wrap size={8}>
                {drawerRow.action_summary.map(s => (
                  <div key={s.type} style={{
                    background: `${TYPE_COLOR[s.type] || '#64748b'}15`,
                    border: `1px solid ${TYPE_COLOR[s.type] || '#64748b'}40`,
                    borderRadius: 8, padding: '6px 12px',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    {typeTag(s.type)}
                    <Text strong style={{ color: TYPE_COLOR[s.type] || '#64748b', fontSize: 16 }}>
                      {s.count}
                    </Text>
                  </div>
                ))}
              </Space>
            </Card>

            {/* ── Lead search ── */}
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search leads by name, ID, status…"
              value={leadSearch}
              onChange={e => setLeadSearch(e.target.value)}
              allowClear
              style={{ marginBottom: 12, borderRadius: 8 }}
            />

            {/* ── Leads table ── */}
            <Card
              size="small"
              title={<Text strong>Leads Updated ({drawerLeads.length})</Text>}
              style={{ marginBottom: 16, borderRadius: 10 }}
              styles={{ body: { padding: 0 }}}
            >
              <Table
                dataSource={drawerLeads}
                columns={leadColumns}
                rowKey="lead_id"
                size="small"
                pagination={{ pageSize: 10, size: 'small' }}
                expandable={{
                  expandedRowRender: rec => (
                    <div style={{ padding: '8px 24px', background: '#f8f9ff', borderRadius: 8 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Events on this lead:
                      </Text>
                      <Timeline
                        items={(rec.events || []).map(ev => ({
                          color: TYPE_COLOR[ev.type] || 'blue',
                          children: (
                            <div>
                              <Space size={6}>
                                {typeTag(ev.type)}
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {ev.ts ? dayjs(ev.ts.endsWith('Z') ? ev.ts : ev.ts + 'Z').format('HH:mm:ss') : ''}
                                </Text>
                              </Space>
                              {ev.description && (
                                <div style={{
                                  marginTop: 4, background: '#fff', borderRadius: 6,
                                  padding: '6px 10px', fontSize: 12,
                                  border: '1px solid #e8e8f0', color: '#374151',
                                }}>
                                  {ev.description}
                                </div>
                              )}
                            </div>
                          ),
                        }))}
                      />
                    </div>
                  ),
                  rowExpandable: rec => (rec.events || []).length > 0,
                }}
              />
            </Card>

            {/* ── Full timeline of all events ── */}
            <Card
              size="small"
              title={<Text strong>Full Activity Timeline ({drawerRow.total_events} events)</Text>}
              style={{ borderRadius: 10 }}
            >
              <Timeline
                items={[...(drawerRow.leads || [])]
                  .flatMap(l => l.events.map(ev => ({ ...ev, _lead: l })))
                  .sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
                  .slice(0, 50)
                  .map(ev => ({
                    color: TYPE_COLOR[ev.type] || 'blue',
                    dot: ev.type?.startsWith('note') ? <FileTextOutlined /> :
                          ev.type === 'status_change' ? <EditOutlined /> :
                          ev.type === 'field_update' ? <EditOutlined /> :
                          ev.type === 'reassignment' ? <TeamOutlined /> :
                          <PhoneOutlined />,
                    children: (
                      <div style={{ marginBottom: 4 }}>
                        <Space wrap size={6}>
                          {typeTag(ev.type)}
                          <Text
                            style={{ cursor: 'pointer', color: '#6366f1', fontWeight: 600, fontSize: 12 }}
                            onClick={() => navigate(`/leads/${ev.lead_id}`)}
                          >
                            {ev._lead?.full_name || ev.lead_id}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {ev.ts ? dayjs(ev.ts.endsWith('Z') ? ev.ts : ev.ts + 'Z').format('h:mm A') : ''}
                          </Text>
                        </Space>
                        {ev.description && (
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, paddingLeft: 4 }}>
                            {ev.description.length > 100 ? ev.description.slice(0, 100) + '…' : ev.description}
                          </div>
                        )}
                      </div>
                    ),
                  }))}
              />
              {drawerRow.total_events > 50 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Showing latest 50 of {drawerRow.total_events} events
                </Text>
              )}
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
}
