/**
 * Academic Dashboard
 * Shows enrolled students, course breakdown, revenue and country stats.
 * No university or visa workflow — courses only.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Statistic, Table, Tag, Spin, Progress } from 'antd';
import { GraduationCap, BookOpen, TrendingUp, Users, DollarSign, ClipboardList } from 'lucide-react';
import { leadsAPI } from '../../api/api';

const AcademicDashboard = () => {
  const { data: leadsResp, isLoading } = useQuery({
    queryKey: ['leads-academic-dash'],
    queryFn: () => leadsAPI.getAll({ status: 'Enrolled', limit: 2000 }).then(r => r.data),
  });

  const { data: allLeadsResp } = useQuery({
    queryKey: ['leads-all-for-academic'],
    queryFn: () => leadsAPI.getAll({ limit: 2000 }).then(r => r.data),
  });

  const students = leadsResp?.leads || (Array.isArray(leadsResp) ? leadsResp : []);
  const allLeads = allLeadsResp?.leads || [];

  // Course breakdown
  const courseMap = {};
  students.forEach(s => {
    const c = s.course_interested || 'Not specified';
    courseMap[c] = courseMap[c] || { count: 0, revenue: 0 };
    courseMap[c].count++;
    courseMap[c].revenue += s.potential_revenue || 0;
  });
  const topCourses = Object.entries(courseMap)
    .map(([course, data]) => ({ course, ...data }))
    .sort((a, b) => b.count - a.count);

  // Country breakdown
  const countryMap = {};
  students.forEach(s => { if (s.country) countryMap[s.country] = (countryMap[s.country] || 0) + 1; });
  const topCountries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const totalRevenue = students.reduce((s, l) => s + (l.potential_revenue || 0), 0);
  const avgRevenue   = students.length ? totalRevenue / students.length : 0;

  // Counselor who enrolled the most
  const counselorMap = {};
  students.forEach(s => {
    if (s.assigned_to) {
      counselorMap[s.assigned_to] = counselorMap[s.assigned_to] || { name: s.assigned_to, enrolled: 0, revenue: 0 };
      counselorMap[s.assigned_to].enrolled++;
      counselorMap[s.assigned_to].revenue += s.potential_revenue || 0;
    }
  });
  const topCounselors = Object.values(counselorMap).sort((a, b) => b.enrolled - a.enrolled).slice(0, 5);

  // Recent enrollments (last 30 days)
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentEnrollments = students.filter(s => new Date(s.updated_at || s.created_at) >= thirtyDaysAgo).length;

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎓</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Academic Dashboard</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Course enrollments, student management & revenue</div>
        </div>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]}>
        {[
          { title: 'Total Enrolled',    value: students.length,                    color: '#7c3aed', icon: GraduationCap, sub: `+${recentEnrollments} last 30 days` },
          { title: 'Courses Offered',   value: Object.keys(courseMap).length,      color: '#2563eb', icon: BookOpen },
          { title: 'Total Revenue',     value: `₹${(totalRevenue/100000).toFixed(1)}L`, color: '#059669', icon: DollarSign },
          { title: 'Avg per Student',   value: `₹${Math.round(avgRevenue/1000)}K`, color: '#d97706', icon: TrendingUp },
        ].map(s => (
          <Col key={s.title} xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, borderTop: `3px solid ${s.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Statistic title={s.title} value={s.value} valueStyle={{ color: s.color, fontWeight: 700 }} />
                  {s.sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.sub}</div>}
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={20} color={s.color} />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* Course breakdown */}
        <Col xs={24} lg={14}>
          <Card title="📚 Enrollments by Course" style={{ borderRadius: 12 }}>
            <Table
              dataSource={topCourses}
              rowKey="course"
              pagination={{ pageSize: 8 }}
              size="small"
              columns={[
                {
                  title: 'Course', dataIndex: 'course', key: 'course',
                  render: t => <Tag color="purple">{t}</Tag>,
                },
                {
                  title: 'Students', dataIndex: 'count', key: 'count',
                  render: v => <strong style={{ color: '#7c3aed' }}>{v}</strong>,
                  sorter: (a, b) => b.count - a.count,
                  defaultSortOrder: 'descend',
                },
                {
                  title: '% Share', key: 'pct',
                  render: (_, r) => {
                    const pct = students.length ? Math.round((r.count / students.length) * 100) : 0;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Progress percent={pct} size="small" strokeColor="#7c3aed" style={{ width: 70, margin: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pct}%</span>
                      </div>
                    );
                  },
                },
                {
                  title: 'Revenue', dataIndex: 'revenue', key: 'revenue',
                  render: v => <span style={{ color: '#059669', fontWeight: 600 }}>₹{(v / 100000).toFixed(1)}L</span>,
                  sorter: (a, b) => b.revenue - a.revenue,
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          {/* Country breakdown */}
          <Card title="🌍 Students by Country" style={{ borderRadius: 12, marginBottom: 16 }}>
            {topCountries.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No country data</div>
            ) : topCountries.map(([country, count]) => (
              <div key={country} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 13 }}>
                  <span>{country}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{count}</span>
                </div>
                <Progress
                  percent={students.length ? Math.round((count / students.length) * 100) : 0}
                  strokeColor="#7c3aed" trailColor="#ede9fe" showInfo={false} size="small"
                />
              </div>
            ))}
          </Card>

          {/* Top counselors by enrollments */}
          <Card title="⭐ Top Enrolment Counselors" style={{ borderRadius: 12 }}>
            {topCounselors.map((c, i) => (
              <div key={c.name} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontWeight: 700, color: i === 0 ? '#d97706' : 'var(--text-tertiary)', width: 18 }}>
                  #{i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    ₹{(c.revenue / 100000).toFixed(1)}L revenue
                  </div>
                </div>
                <Tag color="green">{c.enrolled} enrolled</Tag>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Recent enrolled students */}
      <Card title="📋 Recently Enrolled Students" style={{ borderRadius: 12 }}>
        <Table
          dataSource={students.slice(0, 10)}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: 'Student', dataIndex: 'full_name', key: 'name', render: t => <span style={{ fontWeight: 500 }}>{t}</span> },
            { title: 'Course', dataIndex: 'course_interested', key: 'course', render: t => <Tag color="purple">{t || '—'}</Tag> },
            { title: 'Country', dataIndex: 'country', key: 'country', render: t => t || '—' },
            { title: 'Revenue', dataIndex: 'potential_revenue', key: 'rev', render: v => v ? <span style={{ color: '#059669', fontWeight: 600 }}>₹{v.toLocaleString()}</span> : '—' },
            { title: 'Counselor', dataIndex: 'assigned_to', key: 'counselor', render: t => t || '—' },
          ]}
        />
      </Card>
    </div>
  );
};

export default AcademicDashboard;
