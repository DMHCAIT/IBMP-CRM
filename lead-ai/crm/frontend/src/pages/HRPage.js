import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Card, Row, Col, Tag, Button, Input, Select, Modal,
  Form, Switch, Statistic, Tabs, Spin, message, Badge,
} from 'antd';
import { Users, UserPlus, UserCheck, UserX, Award, Search, TrendingUp } from 'lucide-react';
import { usersAPI, leadsAPI } from '../api/api';
import { ROLES, getDepartment, DEPT_META } from '../config/rbac';

const { Option } = Select;

// ── Helpers ────────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  'CEO',
  'Marketing Manager', 'Marketing Executive',
  'Sales Manager', 'Counselor', 'Team Leader',
  'Academic Admin', 'Academic Executive',
  'Accounts Manager', 'Finance Executive',
  'HR Manager', 'HR Executive',
  'Super Admin',
];

function deptTag(role) {
  const dept = getDepartment(role);
  const meta = DEPT_META[dept] || { color: '#374151', bg: '#f3f4f6', label: dept };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      color: meta.color, background: meta.bg,
    }}>{meta.label}</span>
  );
}

// ── Employee Form Modal ─────────────────────────────────────────────────────
const EmployeeModal = ({ open, onClose, onSaved, editUser }) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (editUser) return usersAPI.update(editUser.id, values);
      return usersAPI.create(values);
    },
    onSuccess: () => {
      message.success(editUser ? 'Employee updated' : 'Employee created');
      queryClient.invalidateQueries(['users-hr-page']);
      onSaved?.();
      onClose();
    },
    onError: (e) => message.error(e?.response?.data?.detail || 'Failed to save employee'),
  });

  React.useEffect(() => {
    if (open) {
      form.setFieldsValue(editUser
        ? { full_name: editUser.full_name, email: editUser.email, phone: editUser.phone, role: editUser.role, is_active: editUser.is_active !== false }
        : { is_active: true }
      );
    }
  }, [open, editUser, form]);

  return (
    <Modal
      title={editUser ? 'Edit Employee' : 'Add New Employee'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
              <Input placeholder="Employee full name" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="email@company.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="Phone">
              <Input placeholder="+91 XXXXX XXXXX" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="role" label="Role" rules={[{ required: true }]}>
              <Select placeholder="Select role" showSearch>
                {ROLE_OPTIONS.map(r => (
                  <Option key={r} value={r}>{r}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          {!editUser && (
            <Col span={12}>
              <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
                <Input.Password placeholder="Min 6 characters" />
              </Form.Item>
            </Col>
          )}
          <Col span={12}>
            <Form.Item name="is_active" label="Status" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
            {editUser ? 'Save Changes' : 'Add Employee'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

// ── Main HR Page ────────────────────────────────────────────────────────────
const HRPage = () => {
  const [search, setSearch]         = useState('');
  const [deptFilter, setDeptFilter] = useState(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editUser, setEditUser]     = useState(null);
  const queryClient = useQueryClient();

  const { data: usersResp, isLoading } = useQuery({
    queryKey: ['users-hr-page'],
    queryFn: () => usersAPI.getAll().then(r => r.data),
  });

  const { data: leadsResp } = useQuery({
    queryKey: ['leads-hr-perf'],
    queryFn: () => leadsAPI.getAll({ limit: 2000 }).then(r => r.data),
  });

  const users = usersResp?.users || usersResp || [];
  const leads = leadsResp?.leads || [];

  // Performance map
  const perfMap = {};
  leads.forEach(l => {
    if (l.assigned_to) {
      perfMap[l.assigned_to] = perfMap[l.assigned_to] || { leads: 0, enrolled: 0 };
      perfMap[l.assigned_to].leads++;
      if (l.status === 'Enrolled') perfMap[l.assigned_to].enrolled++;
    }
  });

  // Filtered users
  const allDepts = [...new Set(users.map(u => getDepartment(u.role)))];
  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchDept   = !deptFilter || getDepartment(u.role) === deptFilter;
    return matchSearch && matchDept;
  });

  const active   = users.filter(u => u.is_active !== false).length;
  const inactive = users.length - active;

  const openAdd  = () => { setEditUser(null); setModalOpen(true); };
  const openEdit = (u) => { setEditUser(u); setModalOpen(true); };

  const columns = [
    {
      title: 'Employee', key: 'emp',
      render: (_, u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `${DEPT_META[getDepartment(u.role)]?.color || '#374151'}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13,
            color: DEPT_META[getDepartment(u.role)]?.color || '#374151',
          }}>
            {u.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.email}</div>
          </div>
        </div>
      ),
    },
    { title: 'Role', dataIndex: 'role', key: 'role', render: r => <Tag color="purple">{r}</Tag> },
    { title: 'Department', key: 'dept', render: (_, u) => deptTag(u.role) },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: t => t || '—' },
    {
      title: 'Status', key: 'status',
      render: (_, u) => u.is_active !== false
        ? <Badge status="success" text={<span style={{ color: '#059669', fontWeight: 500 }}>Active</span>} />
        : <Badge status="error" text={<span style={{ color: '#dc2626', fontWeight: 500 }}>Inactive</span>} />,
    },
    {
      title: 'Leads / Enrolled', key: 'perf',
      render: (_, u) => {
        const p = perfMap[u.full_name];
        if (!p) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
        return <span>{p.leads} / <strong style={{ color: '#059669' }}>{p.enrolled}</strong></span>;
      },
    },
    {
      title: 'Action', key: 'action',
      render: (_, u) => (
        <Button size="small" onClick={() => openEdit(u)}>Edit</Button>
      ),
    },
  ];

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👥</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>HR — Employee Management</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manage all staff, roles and departments</div>
          </div>
        </div>
        <Button type="primary" icon={<UserPlus size={16} />} onClick={openAdd}
          style={{ background: '#db2777', borderColor: '#db2777' }}>
          Add Employee
        </Button>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]}>
        {[
          { title: 'Total Employees', value: users.length, color: '#db2777', icon: Users },
          { title: 'Active',          value: active,       color: '#059669', icon: UserCheck },
          { title: 'Inactive',        value: inactive,     color: '#dc2626', icon: UserX },
          { title: 'Departments',     value: allDepts.length, color: '#7c3aed', icon: Award },
        ].map(s => (
          <Col key={s.title} xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, borderTop: `3px solid ${s.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Statistic title={s.title} value={s.value} valueStyle={{ color: s.color, fontWeight: 700 }} />
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={20} color={s.color} />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card style={{ borderRadius: 12, padding: '12px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search by name or email..."
            prefix={<Search size={14} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Select placeholder="All Departments" allowClear value={deptFilter} onChange={setDeptFilter} style={{ width: 180 }}>
            {allDepts.map(d => <Option key={d} value={d}>{DEPT_META[d]?.label || d}</Option>)}
          </Select>
        </div>
      </Card>

      {/* Employee Table */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={filtered}
          rowKey="id"
          columns={columns}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          size="middle"
        />
      </Card>

      {/* Department summary */}
      <Card title="Department Summary" style={{ borderRadius: 12 }}>
        <Row gutter={[12, 12]}>
          {allDepts.map(dept => {
            const meta  = DEPT_META[dept] || { color: '#374151', bg: '#f3f4f6', label: dept };
            const count = users.filter(u => getDepartment(u.role) === dept).length;
            return (
              <Col key={dept} xs={12} sm={8} lg={6}>
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: meta.bg, border: `1px solid ${meta.color}30`,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: meta.color }}>{count}</div>
                  <div style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>{meta.label}</div>
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>

      <EmployeeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editUser={editUser}
        onSaved={() => queryClient.invalidateQueries(['users-hr-page'])}
      />
    </div>
  );
};

export default HRPage;
