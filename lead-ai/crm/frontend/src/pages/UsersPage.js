import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Drawer,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Avatar,
  Typography,
  Row,
  Col,
  Statistic,
  Tree,
  Tabs,
  Badge,
  Tooltip,
  Divider,
  Modal,
  Alert,
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  CrownOutlined,
  SafetyCertificateOutlined,
  PhoneOutlined,
  MailOutlined,
  LockOutlined,
  EyeOutlined,
  UsergroupAddOutlined,
  ApartmentOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { leadsAPI, usersAPI } from '../api/api';
import { getDepartment, DEPT_META } from '../config/rbac';

// Roles grouped by department — used in the Create/Edit user form
const ROLES_BY_DEPT = [
  {
    dept: 'Admin / Top Level',
    color: '#7c3aed',
    roles: ['CEO', 'Super Admin'],
  },
  {
    dept: 'Marketing',
    color: '#2563eb',
    roles: ['Marketing Manager', 'Marketing Executive'],
  },
  {
    dept: 'Sales',
    color: '#059669',
    roles: ['Sales Manager', 'Team Leader', 'Counselor'],
  },
  {
    dept: 'Academic',
    color: '#0891b2',
    roles: ['Academic Admin', 'Academic Executive'],
  },
  {
    dept: 'Accounts',
    color: '#d97706',
    roles: ['Accounts Manager', 'Finance Executive'],
  },
  {
    dept: 'HR',
    color: '#dc2626',
    roles: ['HR Manager', 'HR Executive'],
  },
];

const { Title, Text } = Typography;
const { Option } = Select;

const UsersPage = () => {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // table | hierarchy
  const [selectedUser, setSelectedUser] = useState(null);
  const [leadsModalVisible, setLeadsModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState(null);
  const [form] = Form.useForm();
  const [passwordResetForm] = Form.useForm();

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAll().then(res => res.data)
  });
  
  // /api/users returns a plain array (not {users:[...]})
  const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);

  // Fetch leads
  const { data: leadsData } = useQuery({
    queryKey: ['leads-users-page'],
    queryFn: () => leadsAPI.getAll({ limit: 70000, skip: 0 }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });
  
  const leads = leadsData?.leads || [];

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data) => usersAPI.create(data),
    onSuccess: () => {
      message.success('User created successfully! 🎉');
      setDrawerVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        const msgs = detail.map(d => `${d.loc?.slice(-1)[0] ?? 'field'}: ${d.msg}`).join('; ');
        message.error(`Validation error — ${msgs}`);
      } else {
        message.error(detail || error.message || 'Failed to create user');
      }
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => usersAPI.update(id, data),
    onSuccess: () => {
      message.success('User updated successfully!');
      setDrawerVisible(false);
      setEditingUser(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        const msgs = detail.map(d => `${d.loc?.slice(-1)[0] ?? 'field'}: ${d.msg}`).join('; ');
        message.error(`Validation error — ${msgs}`);
      } else {
        message.error(detail || error.message || 'Failed to update user');
      }
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => usersAPI.delete(id),
    onSuccess: () => {
      message.success('User deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      message.error(`Failed to delete user: ${error.message}`);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }) => usersAPI.resetPassword(id, newPassword),
    onSuccess: () => {
      message.success('Password reset successfully!');
      setPasswordModalVisible(false);
      setPasswordTargetUser(null);
      passwordResetForm.resetFields();
    },
    onError: (error) => {
      const detail = error.response?.data?.detail;
      message.error(detail || 'Failed to reset password');
    },
  });

  // Calculate stats — department wise
  const stats = {
    total:    users.length,
    active:   users.filter(u => u.is_active !== false).length,
    // department counts
    byDept: ROLES_BY_DEPT.reduce((acc, g) => {
      acc[g.dept] = users.filter(u => g.roles.includes(u.role)).length;
      return acc;
    }, {}),
  };

  // Role → color (all 13 roles)
  const getRoleColor = (role) => {
    const group = ROLES_BY_DEPT.find(g => g.roles.includes(role));
    return group ? group.color : '#6b7280';
  };

  // Role → icon
  const getRoleIcon = (role) => {
    if (['CEO', 'Super Admin'].includes(role))        return <CrownOutlined />;
    if (role.includes('Manager'))                      return <SafetyCertificateOutlined />;
    if (role.includes('Leader'))                       return <TeamOutlined />;
    if (role.includes('Executive') || role.includes('Exec')) return <StarOutlined />;
    return <UserOutlined />;
  };

  // Get role hierarchy level (for tree/org chart)
  const getRoleLevel = (role) => {
    if (['CEO', 'Super Admin'].includes(role)) return 4;
    if (role.includes('Manager'))              return 3;
    if (role.includes('Leader'))               return 2;
    return 1;
  };

  // Get subordinate roles
  const getSubordinateRoles = (role) => {
    if (['CEO', 'Super Admin'].includes(role))
      return ROLES_BY_DEPT.flatMap(g => g.roles).filter(r => !['CEO', 'Super Admin'].includes(r));
    const group = ROLES_BY_DEPT.find(g => g.roles.includes(role));
    if (!group) return [];
    if (role.includes('Manager') || role.includes('Leader'))
      return group.roles.filter(r => r !== role);
    return [];
  };

  // Build hierarchy tree
  const buildHierarchyTree = () => {
    const tree = [];
    const userMap = {};

    // Create user map
    users.forEach(user => {
      userMap[user.id] = {
        ...user,
        children: [],
      };
    });

    // Build tree structure
    users.forEach(user => {
      if (user.reports_to) {
        const parent = userMap[user.reports_to];
        if (parent) {
          parent.children.push(userMap[user.id]);
        }
      } else {
        tree.push(userMap[user.id]);
      }
    });

    return tree;
  };

  // Convert to Ant Design Tree format
  const convertToTreeData = (nodes) => {
    return nodes.map(node => {
      const assignedLeads = leads.filter(l => l.assigned_to === node.full_name);
      return {
        title: (
          <div style={{ padding: '8px 0' }}>
            <Space>
              <Avatar 
                style={{ backgroundColor: getRoleColor(node.role) }}
                icon={getRoleIcon(node.role)}
              />
              <div>
                <div>
                  <Text strong>{node.full_name}</Text>
                  <Tag 
                    color={getRoleColor(node.role)} 
                    style={{ marginLeft: 8 }}
                  >
                    {node.role}
                  </Tag>
                  <Badge 
                    count={assignedLeads.length} 
                    style={{ marginLeft: 8 }}
                    title="Assigned Leads"
                  />
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {node.email} • {node.phone}
                </Text>
              </div>
            </Space>
          </div>
        ),
        key: node.id.toString(),
        children: node.children && node.children.length > 0 
          ? convertToTreeData(node.children) 
          : undefined,
      };
    });
  };

  // Get user's assigned leads
  const getUserLeads = (userName) => {
    return leads.filter(lead => lead.assigned_to === userName);
  };

  // Show leads modal
  const showUserLeads = (user) => {
    setSelectedUser(user);
    setLeadsModalVisible(true);
  };

  // Handle form submit
  const handleSubmit = (values) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data: values });
    } else {
      createUserMutation.mutate(values);
    }
  };

  // Handle edit
  const handleEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setDrawerVisible(true);
  };

  // Handle delete
  const handleDelete = (id) => {
    deleteUserMutation.mutate(id);
  };

  // Table columns
  const columns = [
    {
      title: 'User',
      key: 'user',
      width: 250,
      fixed: 'left',
      render: (_, record) => (
        <Space>
          <Avatar 
            size={40}
            style={{ backgroundColor: getRoleColor(record.role) }}
            icon={getRoleIcon(record.role)}
          />
          <div>
            <div>
              <Text strong style={{ fontSize: 14 }}>{record.full_name}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {record.id}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Department',
      key: 'department',
      width: 130,
      filters: [
        'CEO', 'Marketing', 'Sales', 'Academic', 'Accounts', 'HR', 'Admin',
      ].map(d => ({ text: d, value: d })),
      onFilter: (value, record) => getDepartment(record.role) === value,
      render: (_, record) => {
        const dept = getDepartment(record.role);
        const meta = DEPT_META[dept] || { color: '#6b7280', bg: '#f3f4f6', label: dept };
        return (
          <Tag style={{ color: meta.color, background: meta.bg, border: 'none', fontWeight: 600 }}>
            {dept}
          </Tag>
        );
      },
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      filters: ROLES_BY_DEPT.flatMap(g => g.roles).map(r => ({ text: r, value: r })),
      onFilter: (value, record) => record.role === value,
      render: (role) => (
        <Tag color={getRoleColor(role)} icon={getRoleIcon(role)}>
          {role}
        </Tag>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 220,
      render: (_, record) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <MailOutlined style={{ marginRight: 6, color: '#1890ff' }} />
            <Text>{record.email}</Text>
          </div>
          <div>
            <PhoneOutlined style={{ marginRight: 6, color: '#52c41a' }} />
            <Text>{record.phone}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Reports To',
      dataIndex: 'reports_to',
      key: 'reports_to',
      width: 180,
      render: (reportsTo) => {
        if (!reportsTo) return <Text type="secondary">Top Level</Text>;
        const manager = users.find(u => u.id === reportsTo);
        return manager ? (
          <div>
            <Avatar 
              size="small" 
              style={{ backgroundColor: getRoleColor(manager.role), marginRight: 8 }}
              icon={getRoleIcon(manager.role)}
            />
            <Text>{manager.full_name}</Text>
          </div>
        ) : <Text type="secondary">-</Text>;
      },
    },
    {
      title: 'Team Members',
      key: 'team_members',
      width: 120,
      render: (_, record) => {
        const subordinates = users.filter(u => u.reports_to === record.id);
        return (
          <div style={{ textAlign: 'center' }}>
            <Badge 
              count={subordinates.length} 
              showZero 
              style={{ backgroundColor: '#722ed1' }}
            />
          </div>
        );
      },
    },
    {
      title: 'Assigned Leads',
      key: 'assigned_leads',
      width: 140,
      sorter: (a, b) => {
        const aLeads = getUserLeads(a.full_name).length;
        const bLeads = getUserLeads(b.full_name).length;
        return aLeads - bLeads;
      },
      render: (_, record) => {
        const userLeads = getUserLeads(record.full_name);
        return (
          <div 
            style={{ cursor: 'pointer', textAlign: 'center' }}
            onClick={() => showUserLeads(record)}
          >
            <Badge 
              count={userLeads.length} 
              showZero
              style={{ backgroundColor: '#52c41a' }}
            />
            <div>
              <Button 
                type="link" 
                size="small" 
                icon={<EyeOutlined />}
              >
                View Leads
              </Button>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      filters: [
        { text: 'All', value: 'all' },
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => value === 'all' || record.is_active === value,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 220,
      render: (_, record) => (
        <Space wrap>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button
            size="small"
            icon={<LockOutlined />}
            style={{ borderColor: '#faad14', color: '#faad14' }}
            onClick={() => {
              setPasswordTargetUser(record);
              setPasswordModalVisible(true);
            }}
          >
            Change Pwd
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this user?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const hierarchyTree = buildHierarchyTree();
  const treeData = convertToTreeData(hierarchyTree);

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* Stats — department wise */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ borderTop: '3px solid #2563eb' }}>
            <Statistic
              title="Total Users"
              value={stats.total}
              prefix={<UsergroupAddOutlined />}
              valueStyle={{ color: '#2563eb', fontSize: 22 }}
            />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              {stats.active} active
            </div>
          </Card>
        </Col>
        {ROLES_BY_DEPT.map(group => (
          <Col xs={12} sm={8} md={4} key={group.dept}>
            <Card size="small" style={{ borderTop: `3px solid ${group.color}` }}>
              <Statistic
                title={group.dept}
                value={stats.byDept[group.dept] || 0}
                valueStyle={{ color: group.color, fontSize: 22 }}
              />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {group.roles.join(' · ')}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Title level={4} style={{ margin: 0 }}>
              <UsergroupAddOutlined /> User Management
            </Title>
            <Space>
              <Button
                type={viewMode === 'table' ? 'primary' : 'default'}
                icon={<TeamOutlined />}
                onClick={() => setViewMode('table')}
              >
                Table View
              </Button>
              <Button
                type={viewMode === 'hierarchy' ? 'primary' : 'default'}
                icon={<ApartmentOutlined />}
                onClick={() => setViewMode('hierarchy')}
              >
                Hierarchy
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingUser(null);
                  form.resetFields();
                  setDrawerVisible(true);
                }}
              >
                Add User
              </Button>
            </Space>
          </div>
        }
      >
        {viewMode === 'table' ? (
          <Table
            columns={columns}
            dataSource={users}
            loading={isLoading}
            rowKey="id"
            scroll={{ x: 1400 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} users`,
            }}
          />
        ) : (
          <div style={{ padding: '20px 0' }}>
            <Alert
              message="Organization Hierarchy"
              description="This tree view shows the reporting structure of your organization. Click to expand/collapse teams."
              type="info"
              showIcon
              icon={<ApartmentOutlined />}
              style={{ marginBottom: 20 }}
            />
            {treeData.length > 0 ? (
              <Tree
                showLine={{ showLeafIcon: false }}
                defaultExpandAll
                treeData={treeData}
                style={{ background: 'white', padding: 20 }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">No users to display in hierarchy</Text>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Add/Edit User Drawer */}
      <Drawer
        title={editingUser ? 'Edit User' : 'Add New User'}
        width={500}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        extra={
          <Space>
            <Button onClick={() => {
              setDrawerVisible(false);
              setEditingUser(null);
              form.resetFields();
            }}>
              Cancel
            </Button>
            <Button type="primary" onClick={() => form.submit()}>
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ is_active: true }}
        >
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input size="large" prefix={<UserOutlined />} placeholder="John Doe" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter valid email' }
            ]}
          >
            <Input size="large" prefix={<MailOutlined />} placeholder="john@example.com" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone (Optional)"
          >
            <Input size="large" prefix={<PhoneOutlined />} placeholder="+1 234 567 8900" />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Please enter password' },
                { min: 6, message: 'Password must be at least 6 characters' }
              ]}
            >
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••" />
            </Form.Item>
          )}

          <Form.Item
            name="role"
            label="Role — select by department"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select
              size="large"
              placeholder="Choose department → role"
              showSearch
              optionFilterProp="label"
            >
              {ROLES_BY_DEPT.map(group => (
                <Select.OptGroup
                  key={group.dept}
                  label={
                    <span style={{ color: group.color, fontWeight: 700, fontSize: 12 }}>
                      {group.dept.toUpperCase()}
                    </span>
                  }
                >
                  {group.roles.map(role => (
                    <Option key={role} value={role} label={role}>
                      <span style={{
                        display: 'inline-block', width: 10, height: 10,
                        borderRadius: '50%', background: group.color,
                        marginRight: 8, verticalAlign: 'middle',
                      }} />
                      {role}
                    </Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="reports_to"
            label="Reports To"
            help="Select the manager this user reports to"
          >
            <Select 
              size="large" 
              placeholder="Select manager" 
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {users
                .filter(u => u.id !== editingUser?.id) // Don't allow self-reporting
                .map(user => (
                  <Option key={user.id} value={user.id} label={`${user.full_name} (${user.role})`}>
                    <Avatar 
                      size="small" 
                      style={{ backgroundColor: getRoleColor(user.role), marginRight: 8 }}
                      icon={getRoleIcon(user.role)}
                    />
                    {user.full_name} ({user.role})
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Status"
            rules={[{ required: true }]}
          >
            <Select size="large">
              <Option value={true}>Active</Option>
              <Option value={false}>Inactive</Option>
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* User Leads Modal */}
      <Modal
        title={
          selectedUser ? (
            <Space>
              <Avatar 
                style={{ backgroundColor: getRoleColor(selectedUser.role) }}
                icon={getRoleIcon(selectedUser.role)}
              />
              <span>Leads assigned to {selectedUser.full_name}</span>
            </Space>
          ) : 'Assigned Leads'
        }
        open={leadsModalVisible}
        onCancel={() => setLeadsModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedUser && (
          <Table
            dataSource={getUserLeads(selectedUser.full_name)}
            rowKey="lead_id"
            columns={[
              {
                title: 'Lead ID',
                dataIndex: 'lead_id',
                key: 'lead_id',
                width: 100,
              },
              {
                title: 'Name',
                dataIndex: 'full_name',
                key: 'full_name',
              },
              {
                title: 'Course',
                dataIndex: 'course_interested',
                key: 'course_interested',
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (status) => (
                  <Tag color={
                    status === 'Enrolled' ? 'green' :
                    status === 'Hot' ? 'red' :
                    status === 'Warm' ? 'orange' : 'blue'
                  }>
                    {status}
                  </Tag>
                ),
              },
              {
                title: 'AI Score',
                dataIndex: 'ai_score',
                key: 'ai_score',
                render: (score) => (
                  <Tag color={score > 70 ? 'green' : score > 40 ? 'orange' : 'red'}>
                    {score?.toFixed(0)}%
                  </Tag>
                ),
              },
            ]}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Modal>
      {/* Change Password Modal */}
      <Modal
        title={
          passwordTargetUser ? (
            <Space>
              <LockOutlined />
              <span>Change Password — {passwordTargetUser.full_name}</span>
            </Space>
          ) : 'Change Password'
        }
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false);
          setPasswordTargetUser(null);
          passwordResetForm.resetFields();
        }}
        onOk={() => passwordResetForm.submit()}
        okText="Reset Password"
        confirmLoading={resetPasswordMutation.isPending}
      >
        <Form
          form={passwordResetForm}
          layout="vertical"
          onFinish={(values) => {
            if (values.new_password !== values.confirm_password) {
              message.error('Passwords do not match');
              return;
            }
            resetPasswordMutation.mutate({ id: passwordTargetUser.id, newPassword: values.new_password });
          }}
        >
          <Form.Item
            name="new_password"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter new password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="New password" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Confirm Password"
            rules={[{ required: true, message: 'Please confirm new password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};

export default UsersPage;
