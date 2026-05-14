import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Statistic, Table, Tag, Spin, Progress } from 'antd';
import { Megaphone, TrendingUp, Users, Target, DollarSign } from 'lucide-react';
import { leadsAPI, dashboardAPI } from '../../api/api';

const StatCard = ({ title, value, color, icon: Icon, sub }) => (
  <Card style={{ borderRadius: 12, border: '1px solid var(--border)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>{title}</div>
        <Statistic value={value} valueStyle={{ fontSize: 26, fontWeight: 700, color }} />
        {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
      </div>
      {Icon && (
        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={color} />
        </div>
      )}
    </div>
  </Card>
);

const MarketingDashboard = () => {
  const { data: leadsResp, isLoading } = useQuery({
    queryKey: ['leads-marketing'],
    queryFn: () => leadsAPI.getAll({ limit: 70000, skip: 0 }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const leads = leadsResp?.leads || [];

  // Lead source breakdown — field is `source`, not `lead_source`
  const sourceMap = {};
  leads.forEach(l => {
    const src = l.source || 'Unknown';
    sourceMap[src] = (sourceMap[src] || 0) + 1;
  });
  const sources = Object.entries(sourceMap)
    .map(([src, count]) => ({ src, count, conv: leads.filter(l => l.source === src && l.status === 'Enrolled').length }))
    .sort((a, b) => b.count - a.count);

  const totalLeads  = leads.length;
  const enrolled    = leads.filter(l => l.status === 'Enrolled').length;
  const newToday    = leads.filter(l => {
    const d = new Date(l.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const totalRev    = leads.filter(l => l.status === 'Enrolled').reduce((s, l) => s + (l.expected_revenue || 0), 0);
  const cpl         = totalLeads > 0 ? Math.round(50000 / totalLeads) : 0; // placeholder budget

  // Course popularity
  const courseMap = {};
  leads.forEach(l => { if (l.course_interested) courseMap[l.course_interested] = (courseMap[l.course_interested] || 0) + 1; });
  const topCourses = Object.entries(courseMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📣</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Marketing Dashboard</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Lead generation, campaigns & source performance</div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><StatCard title="Total Leads Generated" value={totalLeads} color="#d97706" icon={Users} sub="All time" /></Col>
        <Col xs={24} sm={12} lg={6}><StatCard title="New Leads Today" value={newToday} color="#2563eb" icon={TrendingUp} /></Col>
        <Col xs={24} sm={12} lg={6}><StatCard title="Conversions" value={enrolled} color="#059669" icon={Target} sub={`${totalLeads ? ((enrolled/totalLeads)*100).toFixed(1) : 0}% rate`} /></Col>
        <Col xs={24} sm={12} lg={6}><StatCard title="Revenue from Leads" value={`₹${(totalRev/100000).toFixed(1)}L`} color="#dc2626" icon={DollarSign} /></Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Lead Source Performance */}
        <Col xs={24} lg={14}>
          <Card title="Lead Source Performance" style={{ borderRadius: 12 }}>
            <Table
              dataSource={sources}
              rowKey="src"
              pagination={{ pageSize: 8 }}
              size="small"
              columns={[
                { title: 'Source', dataIndex: 'src', key: 'src', render: t => <Tag color="orange">{t}</Tag> },
                { title: 'Leads', dataIndex: 'count', key: 'count', sorter: (a,b) => b.count - a.count },
                { title: 'Enrolled', dataIndex: 'conv', key: 'conv', render: v => <span style={{ color: '#059669', fontWeight: 600 }}>{v}</span> },
                {
                  title: 'Conv %', key: 'pct',
                  render: (_, r) => {
                    const pct = r.count ? Math.round((r.conv/r.count)*100) : 0;
                    return <Progress percent={pct} size="small" strokeColor="#d97706" style={{ width: 80 }} />;
                  },
                },
              ]}
            />
          </Card>
        </Col>

        {/* Course popularity */}
        <Col xs={24} lg={10}>
          <Card title="Most Enquired Courses" style={{ borderRadius: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {topCourses.map(([course, count], i) => (
                <div key={course}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>#{i+1} {course}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{count}</span>
                  </div>
                  <Progress percent={totalLeads ? Math.round((count/totalLeads)*100) : 0}
                    strokeColor="#d97706" trailColor="#fef3c7" showInfo={false} size="small" />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* CPL & ROAS */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card title="Cost Per Lead (CPL)" style={{ borderRadius: 12 }}>
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: '#d97706' }}>₹{cpl}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
                Based on estimated marketing budget
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
                Industry benchmark: ₹500–₹2,000
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="ROAS (Return on Ad Spend)" style={{ borderRadius: 12 }}>
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: '#059669' }}>
                {totalRev > 0 ? `${(totalRev / 50000).toFixed(1)}x` : '—'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
                Revenue / Budget
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
                Target ROAS: 5x+
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MarketingDashboard;
