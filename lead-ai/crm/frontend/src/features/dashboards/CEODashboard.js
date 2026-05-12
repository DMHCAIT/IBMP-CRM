/**
 * @deprecated Use CEOCommandCenter instead (it is the canonical CEO dashboard).
 * TODO: `git rm` this file.
 */
export { default } from './CEOCommandCenter';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Statistic, Progress, Table, Tag, Spin } from 'antd';
import {
  TrendingUp, Users, DollarSign, BarChart3,
  Target, CheckCircle, Clock, AlertCircle,
} from 'lucide-react';
import { dashboardAPI, leadsAPI, usersAPI } from '../../api/api';

const StatCard = ({ title, value, prefix, suffix, color, icon: Icon, sub }) => (
  <Card style={{ borderRadius: 12, border: '1px solid var(--border)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>{title}</div>
        <Statistic
          value={value}
          prefix={prefix}
          suffix={suffix}
          valueStyle={{ fontSize: 28, fontWeight: 700, color }}
        />
        {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
      </div>
      {Icon && (
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} color={color} />
        </div>
      )}
    </div>
  </Card>
);

const CEODashboard = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardAPI.getStats().then(r => r.data),
  });

  const { data: leadsResp, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads-all-ceo'],
    queryFn: () => leadsAPI.getAll({ limit: 1000 }).then(r => r.data),
  });

  const { data: usersResp } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersAPI.getAll().then(r => r.data),
  });

  const leads  = leadsResp?.leads || [];
  const users  = usersResp?.users || usersResp || [];

  const enrolled    = leads.filter(l => l.status === 'Enrolled').length;
  const totalLeads  = leads.length;
  const convRate    = totalLeads ? ((enrolled / totalLeads) * 100).toFixed(1) : 0;
  const totalRev    = leads.reduce((s, l) => s + (l.potential_revenue || 0), 0);
  const hotLeads    = leads.filter(l => l.status === 'Hot').length;
  const pendingFups = leads.filter(l => l.status === 'Follow-up').length;

  // Department breakdown
  const deptBreakdown = [
    { dept: 'Marketing', leads: leads.filter(l => l.lead_source?.toLowerCase().includes('campaign') || l.lead_source?.toLowerCase().includes('social')).length, color: '#d97706' },
    { dept: 'Sales', leads: leads.filter(l => ['New', 'Contacted', 'Hot', 'Warm', 'Follow-up'].includes(l.status)).length, color: '#2563eb' },
    { dept: 'Academic', leads: leads.filter(l => ['Document Submitted', 'University Applied', 'Enrolled'].includes(l.status)).length, color: '#059669' },
    { dept: 'Accounts', leads: enrolled, color: '#dc2626' },
  ];

  // Top counselors
  const counselorMap = {};
  leads.forEach(l => {
    if (l.assigned_to) {
      counselorMap[l.assigned_to] = counselorMap[l.assigned_to] || { name: l.assigned_to, leads: 0, enrolled: 0 };
      counselorMap[l.assigned_to].leads++;
      if (l.status === 'Enrolled') counselorMap[l.assigned_to].enrolled++;
    }
  });
  const topCounselors = Object.values(counselorMap)
    .sort((a, b) => b.enrolled - a.enrolled)
    .slice(0, 5);

  if (statsLoading || leadsLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>👑</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>CEO Overview</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Complete organisational performance dashboard</div>
        </div>
      </div>

      {/* KPI row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Total Leads" value={totalLeads} color="#2563eb" icon={Users}
            sub={`${hotLeads} hot leads`} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Enrollments" value={enrolled} color="#059669" icon={CheckCircle}
            sub={`${convRate}% conversion`} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Revenue" value={`₹${(totalRev / 100000).toFixed(1)}L`} color="#d97706" icon={DollarSign}
            sub="Potential revenue" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Pending Follow-ups" value={pendingFups} color="#dc2626" icon={Clock}
            sub="Action required" />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Department pipeline */}
        <Col xs={24} lg={12}>
          <Card title="Department Pipeline" style={{ borderRadius: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {deptBreakdown.map(d => (
                <div key={d.dept}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{d.dept}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{d.leads} leads</span>
                  </div>
                  <Progress
                    percent={totalLeads ? Math.round((d.leads / totalLeads) * 100) : 0}
                    strokeColor={d.color}
                    trailColor="#f1f5f9"
                    showInfo={false}
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Top performers */}
        <Col xs={24} lg={12}>
          <Card title="Top Performers — Sales" style={{ borderRadius: 12 }}>
            <Table
              dataSource={topCounselors}
              rowKey="name"
              pagination={false}
              size="small"
              columns={[
                { title: 'Counselor', dataIndex: 'name', key: 'name', render: t => <span style={{ fontWeight: 500 }}>{t}</span> },
                { title: 'Leads', dataIndex: 'leads', key: 'leads' },
                { title: 'Enrolled', dataIndex: 'enrolled', key: 'enrolled', render: v => <Tag color="green">{v}</Tag> },
                {
                  title: 'Conv %', key: 'conv',
                  render: (_, r) => `${r.leads ? ((r.enrolled / r.leads) * 100).toFixed(0) : 0}%`,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Team size */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#2563eb' }}>{users.length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Total Team Members</div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#059669' }}>{convRate}%</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Overall Conversion Rate</div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#d97706' }}>
              ₹{enrolled ? Math.round(totalRev / enrolled / 1000) : 0}K
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Avg Revenue / Enrollment</div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CEODashboard;
