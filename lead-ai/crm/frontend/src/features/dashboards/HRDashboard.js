import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Statistic, Table, Tag, Spin, Progress, Badge } from 'antd';
import { Users, UserCheck, UserX, TrendingUp, Award, Clock } from 'lucide-react';
import { usersAPI, leadsAPI } from '../../api/api';
import { getDepartment, DEPT_META } from '../../config/rbac';

const HRDashboard = () => {
  const { data: usersResp, isLoading: usersLoading } = useQuery({
    queryKey: ['users-hr'],
    queryFn: () => usersAPI.getAll().then(r => r.data),
  });

  const { data: leadsResp } = useQuery({
    queryKey: ['leads-hr'],
    queryFn: () => leadsAPI.getAll({ limit: 70000, skip: 0 }).then(r => r.data),
  });

  const users  = usersResp?.users || usersResp || [];
  const leads  = leadsResp?.leads || [];

  const active   = users.filter(u => u.is_active !== false).length;
  const inactive = users.filter(u => u.is_active === false).length;

  // Role distribution
  const roleMap = {};
  users.forEach(u => { roleMap[u.role] = (roleMap[u.role] || 0) + 1; });
  const roles = Object.entries(roleMap).sort((a,b) => b[1]-a[1]);

  // Department distribution
  const deptMap = {};
  users.forEach(u => {
    const dept = getDepartment(u.role);
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  });
  const depts = Object.entries(deptMap).sort((a,b) => b[1]-a[1]);

  // Performance: leads per counselor
  const counselorPerf = {};
  leads.forEach(l => {
    if (l.assigned_to) {
      counselorPerf[l.assigned_to] = counselorPerf[l.assigned_to] || { name: l.assigned_to, leads: 0, enrolled: 0 };
      counselorPerf[l.assigned_to].leads++;
      if (l.status === 'Enrolled') counselorPerf[l.assigned_to].enrolled++;
    }
  });
  const perfData = Object.values(counselorPerf).sort((a,b) => b.leads - a.leads);

  if (usersLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👥</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>HR Dashboard</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Employee management, department strength & performance</div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, borderTop: '3px solid #db2777' }}>
            <Statistic title="Total Employees" value={users.length} valueStyle={{ color: '#db2777', fontWeight: 700 }} prefix={<Users size={18} />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, borderTop: '3px solid #059669' }}>
            <Statistic title="Active" value={active} valueStyle={{ color: '#059669', fontWeight: 700 }} prefix={<UserCheck size={18} />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, borderTop: '3px solid #dc2626' }}>
            <Statistic title="Inactive" value={inactive} valueStyle={{ color: '#dc2626', fontWeight: 700 }} prefix={<UserX size={18} />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Department strength */}
        <Col xs={24} lg={10}>
          <Card title="Department Strength" style={{ borderRadius: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {depts.map(([dept, count]) => {
                const meta = DEPT_META[dept] || { color: '#374151', bg: '#f3f4f6', label: dept };
                return (
                  <div key={dept}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{meta.label || dept}</span>
                      </div>
                      <span style={{ fontSize: 13 }}>{count} staff</span>
                    </div>
                    <Progress percent={users.length ? Math.round((count/users.length)*100) : 0}
                      strokeColor={meta.color} trailColor={meta.bg} showInfo={false} size="small" />
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>

        {/* Role breakdown */}
        <Col xs={24} lg={14}>
          <Card title="Role Distribution" style={{ borderRadius: 12 }}>
            <Table
              dataSource={roles.map(([role, count]) => ({ role, count }))}
              rowKey="role"
              pagination={false}
              size="small"
              columns={[
                { title: 'Role', dataIndex: 'role', key: 'role', render: t => <Tag color="purple">{t}</Tag> },
                { title: 'Department', key: 'dept', render: (_, r) => {
                  const dept = getDepartment(r.role);
                  const meta = DEPT_META[dept];
                  return <span style={{ color: meta?.color }}>{meta?.label || dept}</span>;
                }},
                { title: 'Count', dataIndex: 'count', key: 'count', render: v => <strong>{v}</strong> },
                { title: '% of Team', key: 'pct', render: (_, r) =>
                  `${users.length ? Math.round((r.count/users.length)*100) : 0}%` },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Performance */}
      <Card title="Employee Performance — Leads Handled" style={{ borderRadius: 12 }}>
        <Table
          dataSource={perfData}
          rowKey="name"
          pagination={{ pageSize: 8 }}
          size="small"
          columns={[
            { title: 'Employee', dataIndex: 'name', key: 'name', render: t => <span style={{ fontWeight: 500 }}>{t}</span> },
            { title: 'Leads Assigned', dataIndex: 'leads', key: 'leads' },
            { title: 'Enrolled', dataIndex: 'enrolled', key: 'enrolled', render: v => <Tag color="green">{v}</Tag> },
            {
              title: 'Performance',
              key: 'perf',
              render: (_, r) => {
                const pct = r.leads ? Math.round((r.enrolled/r.leads)*100) : 0;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Progress percent={pct} size="small" strokeColor={pct > 20 ? '#059669' : pct > 10 ? '#d97706' : '#dc2626'} style={{ width: 80, margin: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pct}%</span>
                  </div>
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default HRDashboard;
