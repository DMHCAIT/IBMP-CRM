import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Statistic, Table, Tag, Spin, Badge, Progress } from 'antd';
import { GraduationCap, FileText, Globe, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { leadsAPI } from '../../api/api';

const ACADEMIC_STATUSES = [
  'Document Submitted', 'University Applied', 'Offer Letter Received', 'Visa Applied', 'Enrolled',
];

const STATUS_COLOR = {
  'Document Submitted':    '#d97706',
  'University Applied':    '#2563eb',
  'Offer Letter Received': '#7c3aed',
  'Visa Applied':          '#db2777',
  'Enrolled':              '#059669',
};

const AcademicDashboard = () => {
  const { data: leadsResp, isLoading } = useQuery({
    queryKey: ['leads-academic'],
    queryFn: () => leadsAPI.getAll({ limit: 2000 }).then(r => r.data),
  });

  const leads = leadsResp?.leads || [];
  const academicLeads = leads.filter(l => ACADEMIC_STATUSES.includes(l.status));

  // Counts per status
  const statusCounts = ACADEMIC_STATUSES.reduce((acc, s) => {
    acc[s] = academicLeads.filter(l => l.status === s).length;
    return acc;
  }, {});

  // University breakdown
  const uniMap = {};
  academicLeads.forEach(l => {
    const uni = l.university || l.hospital_name || 'Not assigned';
    uniMap[uni] = (uniMap[uni] || 0) + 1;
  });
  const topUnis = Object.entries(uniMap).sort((a,b) => b[1]-a[1]).slice(0, 6);

  // Country breakdown
  const countryMap = {};
  academicLeads.forEach(l => { if (l.country) countryMap[l.country] = (countryMap[l.country] || 0) + 1; });
  const countries = Object.entries(countryMap).sort((a,b) => b[1]-a[1]).slice(0, 5);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎓</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Academic Dashboard</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Student documentation, university applications & visa tracking</div>
        </div>
      </div>

      {/* Status pipeline */}
      <Row gutter={[12, 12]}>
        {ACADEMIC_STATUSES.map(s => (
          <Col key={s} xs={24} sm={12} lg={Math.floor(24 / ACADEMIC_STATUSES.length)}>
            <Card style={{ borderRadius: 10, borderTop: `3px solid ${STATUS_COLOR[s]}` }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>{s}</span>}
                value={statusCounts[s]}
                valueStyle={{ fontSize: 26, fontWeight: 700, color: STATUS_COLOR[s] }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* Recent applications table */}
        <Col xs={24} lg={14}>
          <Card title="Recent Applications" style={{ borderRadius: 12 }}>
            <Table
              dataSource={academicLeads.slice(0, 10)}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Student', dataIndex: 'full_name', key: 'name',
                  render: t => <span style={{ fontWeight: 500 }}>{t}</span>,
                },
                {
                  title: 'Course', dataIndex: 'course_interested', key: 'course',
                  render: t => <Tag color="blue">{t || '—'}</Tag>,
                },
                {
                  title: 'Country', dataIndex: 'country', key: 'country',
                  render: t => <Tag>{t || '—'}</Tag>,
                },
                {
                  title: 'Status', dataIndex: 'status', key: 'status',
                  render: s => <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>,
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          {/* University breakdown */}
          <Card title="Top Universities" style={{ borderRadius: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topUnis.map(([uni, count]) => (
                <div key={uni} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uni}</span>
                  <Tag color="green">{count}</Tag>
                </div>
              ))}
            </div>
          </Card>

          {/* Country breakdown */}
          <Card title="Destination Countries" style={{ borderRadius: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {countries.map(([country, count]) => (
                <div key={country}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13 }}>{country}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{count}</span>
                  </div>
                  <Progress percent={academicLeads.length ? Math.round((count/academicLeads.length)*100) : 0}
                    strokeColor="#059669" trailColor="#d1fae5" showInfo={false} size="small" />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Summary */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#059669' }}>{statusCounts['Enrolled']}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Successfully Enrolled</div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#2563eb' }}>{statusCounts['University Applied']}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Awaiting University Response</div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#db2777' }}>{statusCounts['Visa Applied']}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Visa in Process</div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AcademicDashboard;
