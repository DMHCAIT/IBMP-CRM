/**
 * Academic Page
 * Manages enrolled students — course tracking, document collection,
 * seat confirmation and LMS credential creation. No university / visa flow.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Card, Row, Col, Tag, Button, Input, Select,
  Statistic, Spin, Badge, Modal, Form, message, Tooltip,
} from 'antd';
import {
  GraduationCap, FileText, CheckCircle, Search, Eye,
  BookOpen, TrendingUp, ClipboardList, Monitor, Lock, Globe,
} from 'lucide-react';
import { leadsAPI } from '../api/api';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

// ── Documents that Academic dept collects from each enrolled student ──────
const REQUIRED_DOCS = [
  '10th Marksheet',
  '12th Marksheet',
  'NEET Score Card',
  'Passport / Aadhaar Copy',
  'Photographs (passport size)',
  'Medical Fitness Certificate',
  'Transfer Certificate',
  'Character Certificate',
  'Bank Challan / Fee Receipt',
];

// ── Parse LMS note from lead.notes ─────────────────────────────────────────
const getLmsData = (lead) => {
  const note = (lead.notes || []).find(n => n.channel === 'lms');
  if (!note) return null;
  try { return JSON.parse(note.content); } catch { return null; }
};

// ── Student Detail Modal ────────────────────────────────────────────────────
const StudentModal = ({ lead, open, onClose }) => {
  const navigate = useNavigate();
  if (!lead) return null;
  const lms = getLmsData(lead);

  return (
    <Modal
      title="Student Academic File"
      open={open}
      onCancel={onClose}
      width={640}
      footer={
        <Button type="primary" onClick={() => { onClose(); navigate(`/leads/${lead.id}`); }}>
          Open Full Profile
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Student info */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 50, height: 50, borderRadius: 12,
            background: '#ede9fe', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>🎓</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{lead.full_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {lead.email} {lead.phone && `· ${lead.phone}`}
            </div>
          </div>
        </div>

        {/* Course details */}
        <Row gutter={[12, 12]}>
          {[
            { label: 'Course', value: lead.course_interested },
            { label: 'Country', value: lead.country },
            { label: 'Counselor', value: lead.assigned_to },
            { label: 'Revenue', value: lead.potential_revenue ? `₹${lead.potential_revenue.toLocaleString()}` : '—' },
          ].map(f => (
            <Col key={f.label} span={12}>
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{f.value || '—'}</div>
              </div>
            </Col>
          ))}
        </Row>

        {/* LMS credentials (if created) */}
        {lms && (
          <div style={{
            padding: '12px 16px', background: '#f0fdf4', borderRadius: 10,
            border: '1px solid #86efac',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>
              ✅ LMS Credentials Created
            </div>
            <Row gutter={[12, 8]}>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#166534' }}>Username</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{lms.username}</div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#166534' }}>Password</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{'•'.repeat(8)}</div>
              </Col>
              {lms.portal && (
                <Col span={24}>
                  <div style={{ fontSize: 11, color: '#166534' }}>Portal</div>
                  <div style={{ fontSize: 13 }}>{lms.portal}</div>
                </Col>
              )}
            </Row>
          </div>
        )}

        {/* Document checklist */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>
            REQUIRED DOCUMENTS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REQUIRED_DOCS.map(doc => (
              <Tag key={doc} icon={<CheckCircle size={10} />} color="green" style={{ fontSize: 11 }}>
                {doc}
              </Tag>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── LMS Credential Modal ────────────────────────────────────────────────────
const LmsModal = ({ lead, open, onClose }) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const lmsMutation = useMutation({
    mutationFn: ({ leadId, content }) =>
      leadsAPI.addNote(leadId, { content, channel: 'lms' }),
    onSuccess: () => {
      message.success('LMS credentials saved!');
      queryClient.invalidateQueries({ queryKey: ['leads-academic-page'] });
      onClose();
      form.resetFields();
    },
    onError: () => message.error('Failed to save LMS credentials'),
  });

  const handleSubmit = (vals) => {
    const content = JSON.stringify({
      __type: 'lms',
      username: vals.username,
      password: vals.password,
      portal: vals.portal || '',
      created_at: new Date().toISOString(),
    });
    lmsMutation.mutate({ leadId: lead.id, content });
  };

  if (!lead) return null;
  const existing = getLmsData(lead);

  return (
    <Modal
      title={`LMS Credentials — ${lead.full_name}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
    >
      {existing && (
        <div style={{
          padding: '10px 14px', background: '#fef9c3', borderRadius: 8,
          marginBottom: 16, fontSize: 13, border: '1px solid #fde68a',
        }}>
          ⚠️ LMS credentials already exist. Saving will add new credentials (old entry kept as history).
        </div>
      )}
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="username"
          label="LMS Username"
          rules={[{ required: true, message: 'Enter username' }]}
          initialValue={existing ? `${lead.full_name?.toLowerCase().replace(/\s+/g, '.')}` : undefined}
        >
          <Input prefix={<Monitor size={14} />} placeholder="student.username" />
        </Form.Item>
        <Form.Item
          name="password"
          label="LMS Password"
          rules={[{ required: true, message: 'Enter password' }]}
        >
          <Input.Password prefix={<Lock size={14} />} placeholder="Temporary password" />
        </Form.Item>
        <Form.Item name="portal" label="Portal URL (optional)">
          <Input prefix={<Globe size={14} />} placeholder="https://lms.example.com" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={lmsMutation.isPending}>
            Save & Activate LMS
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────
const AcademicPage = () => {
  const [search, setSearch]         = useState('');
  const [courseFilter, setCourse]   = useState(null);
  const [countryFilter, setCountry] = useState(null);
  const [selected, setSelected]     = useState(null);
  const [modalOpen, setModal]       = useState(false);
  const [lmsTarget, setLmsTarget]   = useState(null);
  const navigate = useNavigate();

  const { data: leadsResp, isLoading } = useQuery({
    queryKey: ['leads-academic-page'],
    queryFn: () => leadsAPI.getAll({ status: 'Enrolled', limit: 2000 }).then(r => r.data),
  });

  const students = leadsResp?.leads || (Array.isArray(leadsResp) ? leadsResp : []);

  // Filter options
  const courses   = [...new Set(students.map(s => s.course_interested).filter(Boolean))].sort();
  const countries = [...new Set(students.map(s => s.country).filter(Boolean))].sort();

  // Filtered list
  const filtered = students.filter(s => {
    const ms = !search || s.full_name?.toLowerCase().includes(search.toLowerCase())
      || s.email?.toLowerCase().includes(search.toLowerCase());
    const mc = !courseFilter  || s.course_interested === courseFilter;
    const mct = !countryFilter || s.country === countryFilter;
    return ms && mc && mct;
  });

  // Course breakdown
  const courseMap = {};
  students.forEach(s => {
    const c = s.course_interested || 'Not specified';
    courseMap[c] = (courseMap[c] || 0) + 1;
  });
  const topCourses = Object.entries(courseMap).sort((a, b) => b[1] - a[1]);

  // Revenue totals
  const totalRevenue = students.reduce((sum, s) => sum + (s.potential_revenue || 0), 0);
  const avgRevenue   = students.length ? totalRevenue / students.length : 0;

  // Country breakdown
  const countryMap = {};
  students.forEach(s => { if (s.country) countryMap[s.country] = (countryMap[s.country] || 0) + 1; });
  const topCountries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lmsCount = students.filter(s => getLmsData(s)).length;

  const openDetail = (s) => { setSelected(s); setModal(true); };

  const columns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: '#ede9fe', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: '#7c3aed',
          }}>
            {s.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Course',
      dataIndex: 'course_interested',
      key: 'course',
      render: t => <Tag color="purple">{t || '—'}</Tag>,
      filters: courses.map(c => ({ text: c, value: c })),
      onFilter: (val, r) => r.course_interested === val,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      render: t => t || '—',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: t => t || '—',
    },
    {
      title: 'Revenue',
      dataIndex: 'potential_revenue',
      key: 'revenue',
      render: v => v ? <span style={{ color: '#059669', fontWeight: 600 }}>₹{v.toLocaleString()}</span> : '—',
      sorter: (a, b) => (a.potential_revenue || 0) - (b.potential_revenue || 0),
      defaultSortOrder: 'descend',
    },
    {
      title: 'LMS',
      key: 'lms',
      render: (_, s) => {
        const lms = getLmsData(s);
        return lms ? (
          <Tooltip title={`Username: ${lms.username}`}>
            <Tag color="green" style={{ cursor: 'default' }}>
              <CheckCircle size={10} style={{ marginRight: 4 }} />
              Active
            </Tag>
          </Tooltip>
        ) : (
          <Tag color="default" style={{ color: '#9ca3af' }}>Not set</Tag>
        );
      },
    },
    {
      title: 'Counselor',
      dataIndex: 'assigned_to',
      key: 'counselor',
      render: t => t || '—',
    },
    {
      title: 'Enrolled On',
      key: 'date',
      render: (_, s) => {
        const d = new Date(s.updated_at || s.created_at);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
      },
      sorter: (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, s) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="small" icon={<Eye size={13} />} onClick={() => openDetail(s)}>
            File
          </Button>
          <Button
            size="small"
            icon={<Monitor size={13} />}
            type={getLmsData(s) ? 'default' : 'primary'}
            onClick={() => setLmsTarget(s)}
          >
            LMS
          </Button>
          <Button size="small" onClick={() => navigate(`/leads/${s.id}`)}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#d1fae5', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>🎓</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Academic — Enrolled Students</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Course enrollment, documentation & LMS management
          </div>
        </div>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]}>
        {[
          { title: 'Total Enrolled', value: students.length,                       color: '#7c3aed', icon: GraduationCap },
          { title: 'Courses',        value: Object.keys(courseMap).length,         color: '#2563eb', icon: BookOpen },
          { title: 'Total Revenue',  value: `₹${(totalRevenue / 100000).toFixed(1)}L`, color: '#059669', icon: TrendingUp },
          { title: 'LMS Created',    value: `${lmsCount}/${students.length}`,      color: '#d97706', icon: Monitor },
        ].map(s => (
          <Col key={s.title} xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, borderTop: `3px solid ${s.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Statistic title={s.title} value={s.value} valueStyle={{ color: s.color, fontWeight: 700 }} />
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${s.color}15`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <s.icon size={20} color={s.color} />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* LMS alert if not all created */}
      {lmsCount < students.length && students.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderRadius: 10,
          background: '#fffbeb', border: '1px solid #fde68a', fontSize: 13,
        }}>
          <Monitor size={16} color="#d97706" />
          <span style={{ color: '#d97706', fontWeight: 500 }}>
            {students.length - lmsCount} students don't have LMS credentials yet.
            Click the LMS button on each student row to create.
          </span>
        </div>
      )}

      {/* Course breakdown cards */}
      <Card title="📚 Enrollment by Course" style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {topCourses.map(([course, count]) => (
            <div
              key={course}
              onClick={() => setCourse(courseFilter === course ? null : course)}
              style={{
                padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                background: courseFilter === course ? '#ede9fe' : '#f8fafc',
                border: `1px solid ${courseFilter === course ? '#7c3aed' : '#e5e7eb'}`,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed' }}>{count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 130, lineHeight: 1.3 }}>
                {course}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        {/* Student table */}
        <Col xs={24} lg={16}>
          <Card style={{ borderRadius: 12 }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <Input
                placeholder="Search student..."
                prefix={<Search size={14} />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 220 }}
              />
              <Select placeholder="All Courses" allowClear value={courseFilter} onChange={setCourse} style={{ width: 180 }}>
                {courses.map(c => <Option key={c} value={c}>{c}</Option>)}
              </Select>
              <Select placeholder="All Countries" allowClear value={countryFilter} onChange={setCountry} style={{ width: 150 }}>
                {countries.map(c => <Option key={c} value={c}>{c}</Option>)}
              </Select>
              {(search || courseFilter || countryFilter) && (
                <Button onClick={() => { setSearch(''); setCourse(null); setCountry(null); }}>
                  Clear
                </Button>
              )}
              <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                {filtered.length} students
              </div>
            </div>

            <Table
              dataSource={filtered}
              rowKey="id"
              columns={columns}
              pagination={{ pageSize: 12, showSizeChanger: true }}
              size="middle"
              scroll={{ x: 900 }}
            />
          </Card>
        </Col>

        {/* Side panels */}
        <Col xs={24} lg={8}>
          {/* Country breakdown */}
          <Card title="🌍 Students by Country" style={{ borderRadius: 12, marginBottom: 16 }}>
            {topCountries.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No data</div>
            ) : topCountries.map(([country, count]) => (
              <div key={country} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13 }}>{country}</span>
                <Tag color="purple">{count}</Tag>
              </div>
            ))}
          </Card>

          {/* Required documents checklist */}
          <Card title="📋 Document Checklist" style={{ borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
              Collect from every enrolled student
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REQUIRED_DOCS.map(doc => (
                <div key={doc} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 6,
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  fontSize: 12,
                }}>
                  <CheckCircle size={12} color="#059669" />
                  {doc}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <StudentModal lead={selected} open={modalOpen} onClose={() => setModal(false)} />
      <LmsModal lead={lmsTarget} open={!!lmsTarget} onClose={() => setLmsTarget(null)} />
    </div>
  );
};

export default AcademicPage;
