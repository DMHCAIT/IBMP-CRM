/**
 * @deprecated Use CoursesPageEnhanced instead.
 * TODO: `git rm` this file.
 */
export { default } from './CoursesPageEnhanced';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Tag, Card, Form, Input, Select, Drawer, message, InputNumber } from 'antd';
import { PlusOutlined, BookOutlined } from '@ant-design/icons';
import { coursesAPI } from '../api/api';

const { Option } = Select;
const { TextArea } = Input;

const CoursesPage = () => {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [form] = Form.useForm();

  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesAPI.getAll().then(res => res.data)
  });

  const createCourseMutation = useMutation({
    mutationFn: (data) => coursesAPI.create(data),
    onSuccess: () => {
      message.success('Course added successfully!');
      setDrawerVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const columns = [
    {
      title: 'Course Name',
      dataIndex: 'course_name',
      key: 'course_name',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag color="purple">{category}</Tag>,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price, record) => (
        <span style={{ fontWeight: 600, fontSize: '16px' }}>
          {record.currency === 'INR' ? '₹' : '$'}
          {(price / 1000).toFixed(0)}K
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0 }}>
          <BookOutlined /> Courses & Price List
        </h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setDrawerVisible(true)}
        >
          Add Course
        </Button>
      </div>

      <Card>
        <Table
          dataSource={courses}
          columns={columns}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Drawer
        title="Add New Course"
        width={600}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createCourseMutation.mutate(values)}
        >
          <Form.Item
            name="course_name"
            label="Course Name"
            rules={[{ required: true }]}
          >
            <Input placeholder="Emergency Medicine Fellowship" />
          </Form.Item>

          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select placeholder="Select category" showSearch>
              <Option value="Anesthesiology">Anesthesiology</Option>
              <Option value="Cardiology">Cardiology</Option>
              <Option value="Critical Care">Critical Care</Option>
              <Option value="Dental & Oral Surgery">Dental & Oral Surgery</Option>
              <Option value="Dermatology & Aesthetics">Dermatology & Aesthetics</Option>
              <Option value="Emergency Medicine">Emergency Medicine</Option>
              <Option value="Endocrinology">Endocrinology</Option>
              <Option value="Family Medicine">Family Medicine</Option>
              <Option value="Gastroenterology">Gastroenterology</Option>
              <Option value="Gynecology & Obstetrics">Gynecology & Obstetrics</Option>
              <Option value="Haematology">Haematology</Option>
              <Option value="Internal Medicine">Internal Medicine</Option>
              <Option value="Nephrology">Nephrology</Option>
              <Option value="Neurology">Neurology</Option>
              <Option value="Oncology">Oncology</Option>
              <Option value="Orthopedics">Orthopedics</Option>
              <Option value="Pediatrics">Pediatrics</Option>
              <Option value="Psychiatry">Psychiatry</Option>
              <Option value="Pulmonology">Pulmonology</Option>
              <Option value="Radiology">Radiology</Option>
              <Option value="Rheumatology">Rheumatology</Option>
              <Option value="Surgery">Surgery</Option>
              <Option value="Urology">Urology</Option>
            </Select>
          </Form.Item>

          <Form.Item name="duration" label="Duration" rules={[{ required: true }]}>
            <Select placeholder="Select duration">
              <Option value="1 Month">1 Month</Option>
              <Option value="2 Months">2 Months</Option>
              <Option value="3 Months">3 Months</Option>
              <Option value="6 Months">6 Months</Option>
              <Option value="1 Year">1 Year</Option>
            </Select>
          </Form.Item>

          <Form.Item name="price" label="Price (₹)" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }}
              placeholder="450000"
              min={0}
              formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/₹\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item name="currency" label="Currency" initialValue="INR">
            <Select>
              <Option value="INR">INR</Option>
              <Option value="USD">USD</Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={4} placeholder="Course description..." />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>
            Add Course
          </Button>
        </Form>
      </Drawer>
    </div>
  );
};

export default CoursesPage;
