import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Card, Row, Col, Tag, Button, Input, Select, Tabs,
  Statistic, Spin, Modal, Form, Steps, message, Badge,
} from 'antd';
import {
  GraduationCap, FileText, Globe, CheckCircle, Clock,
  AlertCircle, Search, Edit2, Eye,
} from 'lucide-react';
import { leadsAPI } from '../api/api';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

// Academic pipeline statuses in workflow order
const PIPELINE = [
  { status: 'Enrolled',               label: 'Enrolled',               color: '#7c3aed', desc: 'Payment confirmed, seat secured' },
  { status: 'Document Submitted',     label: 'Docs Submitted',         color: '#d97706', desc: 'Student documents received' },
  { status: 'University Applied',     label: 'University Applied',     color: '#2563eb', desc: 'Application sent to university' },
  { status: 'Offer Letter Received',  label: 'Offer Letter',           color: '#059669', desc: 'University acceptance received' },
  { status: 'Visa Applied',           label: 'Visa Applied',           color: '#db2777', desc: 'Visa application submitted' },
  { status: 'Visa Approved',          label: 'Visa Approved',          color: '#10b981', desc: 'Visa granted' },
  { status: 'Enrolled Complete',      label: 'Enrollment Complete',    color: '#374151', desc: 'Student departed / enrolled' },
];

const REQUIRED_DOCS = [
  'Passport Copy', '10th Marksheet', '12th Marksheet',
  'NEET Score Card', 'Photographs', 'Bank Statement',
  'Medical Certificate', 'Police Clearance',
];

// ── Student detail modal ──────────────────────────────────────────────────
const StudentDetailModal = ({ lead, open, onClose }) => {
  const navigate = useNavigate();
  if (!lead) return null;

  const currentStep = PIPELINE.findIndex(p => p.status === lead.status);
  const meta = PIPELINE.find(p => p.status === lead.status) || PIPELINE[0];

  return (
    <Modal title="Student Academic File" open={open} onCancel={onClose} width={700} footer={
      <Button type="primary" onClick={() => { onClose(); navigate(`/leads/${lead.id}`); }}>
        Open Full Profile
      </Button>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Student info */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>🎓</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{lead.full_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lead.email} · {lead.phone}</div>
            <Tag color={meta.color} style={{ marginTop: 4 }}>{lead.status}</Tag>
          </div>
        </div>

        {/* Pipeline progress */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 12 }}>ACADEMIC PIPELINE</div>
          <Steps
            size="small"
            current={currentStep}
            items={PIPELINE.map(p => ({ title: p.label, description: '' }))}
            style={{ fontSize: 11 }}
          />
        </div>

        {/* Details grid */}
        <Row gutter={[12, 12]}>
          {[
            { label: 'Course', value: lead.course_interested },
            { label: 'Country', value: lead.country },
            { label: 'University', value: lead.hospital_name || lead.university || '—' },
            { label: 'Counselor', value: lead.assigned_to || '—' },
          ].map(f => (
            <Col key={f.label} span={12}>
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{f.value || '—'}</div>
              </div>
            </Col>
          ))}
        </Row>

        {/* Required documents */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>REQUIRED DOCUMENTS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REQUIRED_DOCS.map(doc => (
              <Tag key={doc} icon={<CheckCircle size={10} />} color="green" style={{ fontSize: 11 }}>{doc}</Tag>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Main Academic Page ────────────────────────────────────────────────────
const AcademicPage = () => {
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState(null);
  const [countryFilter, setCountry] = useState(null);
  const [selectedLead, setSelected] = useState(null);
  const [modalOpen, setModal]       = useState(false);
  const navigate = useNavigate();

  const { data: leadsResp, isLoading } = useQuery({
    queryKey: ['leads-academic-page'],
    queryFn: () => leadsAPI.getAll({ limit: 2000 }).then(r => r.data),
  });

  const leads = leadsResp?.leads || [];
  const academicStatuses = PIPELINE.map(p => p.status);

  // Include enrolled leads (payment confirmed = start of academic journey)
  const allAcademic = leads.filter(l => academicStatuses.includes(l.status) || l.status === 'Enrolled');

  const filtered = allAcademic.filter(l => {
    const ms = !search || l.full_name?.toLowerCase().includes(search.toLowerCase())
      || l.email?.toLowerCase().includes(search.toLowerCase());
    const mst = !statusFilter || l.status === statusFilter;
    const mc  = !countryFilter || l.country === countryFilter;
    return ms && mst && mc;
  });

  const countries = [...new Set(allAcademic.map(l => l.country).filter(Boolean))];

  const openDetail = (lead) => { setSelected(lead); setModal(true); };

  const statusCounts = PIPELINE.reduce((acc, p) => {
    acc[p.status] = allAcademic.filter(l => l.status === p.status).length;
    return acc;
  }, {});

  const columns = [
    {
      title: 'Student', key: 'student',
      render: (_, l) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{l.full_name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{l.email}</div>
        </div>
      ),
    },
    { title: 'Course', dataIndex: 'course_interested', key: 'course', render: t => <Tag color="blue">{t || '—'}</Tag> },
    { title: 'Country', dataIndex: 'country', key: 'country', render: t => t || '—' },
    {
      title: 'University', key: 'uni',
      render: (_, l) => l.hospital_name || l.university || <span style={{ color: 'var(--text-tertiary)' }}>Not assigned</span>,
    },
    {
      title: 'Academic Status', dataIndex: 'status', key: 'status',
      render: s => {
        const meta = PIPELINE.find(p => p.status === s);
        return <Tag color={meta?.color || 'default'}>{s}</Tag>;
      },
    },
    {
      title: 'Counselor', dataIndex: 'assigned_to', key: 'counselor',
      render: t => t || '—',
    },
    {
      title: 'Action', key: 'action',
      render: (_, l) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="small" icon={<Eye size={13} />} onClick={() => openDetail(l)}>View</Button>
          <Button size="small" icon={<Edit2 size={13} />} onClick={() => navigate(`/leads/${l.id}`)}>Edit</Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎓</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Academic — Student Management</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            University applications, documentation & enrollment tracking
          </div>
        </div>
      </div>

      {/* Pipeline status cards */}
      <Row gutter={[10, 10]}>
        {PIPELINE.map(p => (
          <Col key={p.status} xs={12} sm={8} lg={24 / PIPELINE.length}>
            <Card
              onClick={() => setStatus(p.status === statusFilter ? null : p.status)}
              style={{
                borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                borderTop: `3px solid ${p.color}`,
                boxShadow: statusFilter === p.status ? `0 0 0 2px ${p.color}` : 'none',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: p.color }}>{statusCounts[p.status] || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{p.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search student by name or email..."
            prefix={<Search size={14} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select placeholder="All Statuses" allowClear value={statusFilter} onChange={setStatus} style={{ width: 200 }}>
            {PIPELINE.map(p => <Option key={p.status} value={p.status}>{p.label}</Option>)}
          </Select>
          <Select placeholder="All Countries" allowClear value={countryFilter} onChange={setCountry} style={{ width: 160 }}>
            {countries.map(c => <Option key={c} value={c}>{c}</Option>)}
          </Select>
          {(search || statusFilter || countryFilter) && (
            <Button onClick={() => { setSearch(''); setStatus(null); setCountry(null); }}>Clear</Button>
          )}
          <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            {filtered.length} students
          </div>
        </div>
      </Card>

      {/* Student table */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={filtered}
          rowKey="id"
          columns={columns}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          size="middle"
          onRow={r => ({ style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* Required docs checklist */}
      <Card title="Required Documents Checklist" style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {REQUIRED_DOCS.map((doc, i) => (
            <div key={doc} style={{
              padding: '8px 16px', borderRadius: 8,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
            }}>
              <CheckCircle size={14} color="#059669" />
              {doc}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
          All documents must be collected before university application. Update student status in their profile.
        </div>
      </Card>

      <StudentDetailModal lead={selectedLead} open={modalOpen} onClose={() => setModal(false)} />
    </div>
  );
};

export default AcademicPage;
