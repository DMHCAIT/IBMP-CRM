import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Tag, Space, Card, Form, Input, Select, Drawer, message, Popconfirm } from 'antd';
import { PlusOutlined, MedicineBoxOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { hospitalsAPI, coursesAPI } from '../api/api';

const { Option } = Select;

const HospitalsPage = () => {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingHospital, setEditingHospital] = useState(null);
  const [form] = Form.useForm();

  const { data: hospitals, isLoading } = useQuery({
    queryKey: ['hospitals'],
    queryFn: () => hospitalsAPI.getAll().then(res => res.data)
  });

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesAPI.getAll().then(res => res.data)
  });

  const createHospitalMutation = useMutation({
    mutationFn: (data) => hospitalsAPI.create(data),
    onSuccess: () => {
      message.success('Hospital added successfully!');
      setDrawerVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
    },
    onError: () => message.error('Failed to add hospital'),
  });

  const updateHospitalMutation = useMutation({
    mutationFn: ({ id, data }) => hospitalsAPI.update(id, data),
    onSuccess: () => {
      message.success('Hospital updated successfully!');
      setDrawerVisible(false);
      setEditingHospital(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
    },
    onError: () => message.error('Failed to update hospital'),
  });

  const deleteHospitalMutation = useMutation({
    mutationFn: (id) => hospitalsAPI.delete(id),
    onSuccess: () => {
      message.success('Hospital deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
    },
    onError: () => message.error('Failed to delete hospital'),
  });

  const openAddDrawer = () => {
    setEditingHospital(null);
    form.resetFields();
    setDrawerVisible(true);
  };

  const openEditDrawer = (hospital) => {
    setEditingHospital(hospital);
    form.setFieldsValue(hospital);
    setDrawerVisible(true);
  };

  const handleSubmit = (values) => {
    if (editingHospital) {
      updateHospitalMutation.mutate({ id: editingHospital.id, data: values });
    } else {
      createHospitalMutation.mutate(values);
    }
  };

  const columns = [
    {
      title: 'Hospital Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      render: (country) => <Tag color="blue">{country}</Tag>,
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
    },
    {
      title: 'Contact Person',
      dataIndex: 'contact_person',
      key: 'contact_person',
    },
    {
      title: 'Contact Email',
      dataIndex: 'contact_email',
      key: 'contact_email',
    },
    {
      title: 'Phone',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
    },
    {
      title: 'Status',
      dataIndex: 'collaboration_status',
      key: 'collaboration_status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      ),
    },
    {
      title: 'Courses',
      dataIndex: 'courses_offered',
      key: 'courses_offered',
      render: (courseIds) => courseIds?.length || 0,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditDrawer(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this hospital?"
            description="This action cannot be undone."
            onConfirm={() => deleteHospitalMutation.mutate(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleteHospitalMutation.isPending}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0 }}>
          <MedicineBoxOutlined /> Collaborated Hospitals
        </h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddDrawer}>
          Add Hospital
        </Button>
      </div>

      <Card>
        <Table
          dataSource={hospitals}
          columns={columns}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Drawer
        title={editingHospital ? 'Edit Hospital' : 'Add New Hospital'}
        width={600}
        onClose={() => { setDrawerVisible(false); setEditingHospital(null); form.resetFields(); }}
        open={drawerVisible}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Hospital Name" rules={[{ required: true }]}>
            <Input placeholder="Apollo Hospitals" />
          </Form.Item>
          <Form.Item name="country" label="Country" rules={[{ required: true }]}>
            <Select placeholder="Select country">
              <Option value="India">India</Option>
              <Option value="UAE">UAE</Option>
              <Option value="Saudi Arabia">Saudi Arabia</Option>
              <Option value="Kuwait">Kuwait</Option>
              <Option value="UK">UK</Option>
              <Option value="USA">USA</Option>
            </Select>
          </Form.Item>
          <Form.Item name="city" label="City" rules={[{ required: true }]}>
            <Input placeholder="Chennai" />
          </Form.Item>
          <Form.Item name="contact_person" label="Contact Person">
            <Input placeholder="Dr. John Doe" />
          </Form.Item>
          <Form.Item name="contact_email" label="Contact Email">
            <Input placeholder="contact@hospital.com" />
          </Form.Item>
          <Form.Item name="contact_phone" label="Contact Phone">
            <Input placeholder="+91-9876543210" />
          </Form.Item>
          <Form.Item name="collaboration_status" label="Status">
            <Select placeholder="Select status" defaultValue="Active">
              <Option value="Active">Active</Option>
              <Option value="Inactive">Inactive</Option>
              <Option value="Pending">Pending</Option>
            </Select>
          </Form.Item>
          <Form.Item name="courses_offered" label="Courses Offered">
            <Select mode="multiple" placeholder="Select courses">
              {courses?.map(course => (
                <Option key={course.id} value={course.id}>
                  {course.course_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={createHospitalMutation.isPending || updateHospitalMutation.isPending}
          >
            {editingHospital ? 'Update Hospital' : 'Add Hospital'}
          </Button>
        </Form>
      </Drawer>
    </div>
  );
};

export default HospitalsPage;
