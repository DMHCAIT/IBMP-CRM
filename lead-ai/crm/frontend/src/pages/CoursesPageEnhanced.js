import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Table,
  Tag,
  Input,
  Select,
  Space,
  Button,
  Typography,
  Row,
  Col,
  Statistic,
  Tabs,
  Badge,
  Divider,
  Empty,
  Modal,
  Timeline,
  List,
  Drawer,
  Form,
  InputNumber,
  Popconfirm,
  message,
} from 'antd';
import {
  BookOutlined,
  SearchOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  MedicineBoxOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { coursesAPI } from '../api/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const CoursesPageEnhanced = () => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [form] = Form.useForm();

  // Fetch courses
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesAPI.getAll().then(res => res.data || [])
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => coursesAPI.create(data),
    onSuccess: () => {
      message.success('Course created!');
      setDrawerVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: () => message.error('Failed to create course'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => coursesAPI.update(id, data),
    onSuccess: () => {
      message.success('Course updated!');
      setDrawerVisible(false);
      setEditingCourse(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: () => message.error('Failed to update course'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => coursesAPI.delete(id),
    onSuccess: () => {
      message.success('Course deleted!');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: () => message.error('Failed to delete course'),
  });

  const openAdd = () => { setEditingCourse(null); form.resetFields(); setDrawerVisible(true); };
  const openEdit = (course) => { setEditingCourse(course); form.setFieldsValue(course); setDrawerVisible(true); };
  const handleFormSubmit = (values) => {
    if (editingCourse) updateMutation.mutate({ id: editingCourse.id, data: values });
    else createMutation.mutate(values);
  };

  // Calculate statistics
  const stats = {
    total: courses.length,
    categories: [...new Set(courses.map(c => c.category))].length,
    avgPrice: courses.length ? Math.round(courses.reduce((sum, c) => sum + (c.price || 0), 0) / courses.length) : 0,
    totalValue: courses.reduce((sum, c) => sum + (c.price || 0), 0),
  };

  // Get all unique categories
  const categories = [...new Set(courses.map(c => c.category))].sort();
  
  // Count courses by category
  const categoryCounts = courses.reduce((acc, course) => {
    acc[course.category] = (acc[course.category] || 0) + 1;
    return acc;
  }, {});

  // Filter courses
  const filteredCourses = courses.filter(course => {
    const matchesSearch = searchText === '' || 
      course.course_name.toLowerCase().includes(searchText.toLowerCase()) ||
      course.category.toLowerCase().includes(searchText.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Get category color
  const getCategoryColor = (category) => {
    const colors = {
      'Pediatrics': '#ff85c0',
      'Orthopaedics': '#95de64',
      'Radiology': '#5cdbd3',
      'Dermatology': '#ffc069',
      'Obs & Gynae': '#ff7875',
      'Cardiology': '#ff4d4f',
      'Oncology': '#722ed1',
      'Endocrinology': '#13c2c2',
      'Surgery': '#2f54eb',
      'Medicine': '#52c41a',
      'Urology': '#1890ff',
      'Gastroenterology': '#faad14',
      'Dental': '#eb2f96',
      'Reproductive': '#f759ab',
    };
    return colors[category] || '#1890ff';
  };

  // Open course details modal
  const showCourseDetails = (course) => {
    setSelectedCourse(course);
    setModalVisible(true);
  };

  // Table columns
  const columns = [
    {
      title: 'Course Name',
      dataIndex: 'course_name',
      key: 'course_name',
      width: 300,
      fixed: 'left',
      render: (text, record) => (
        <div 
          style={{ cursor: 'pointer' }}
          onClick={() => showCourseDetails(record)}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#1890ff' }}>
            <BookOutlined style={{ marginRight: 8, color: getCategoryColor(record.category) }} />
            {text}
            <EyeOutlined style={{ marginLeft: 8, fontSize: 12 }} />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description}
          </Text>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      filters: [
        { text: 'All Categories', value: 'all' },
        ...categories.map(cat => ({ text: cat, value: cat }))
      ],
      onFilter: (value, record) => value === 'all' || record.category === value,
      render: (category) => (
        <Tag color={getCategoryColor(category)} style={{ fontWeight: 500 }}>
          {category}
        </Tag>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      render: (duration) => (
        <div>
          <ClockCircleOutlined style={{ marginRight: 6, color: '#1890ff' }} />
          <Text>{duration}</Text>
        </div>
      ),
    },
    {
      title: 'Eligibility',
      dataIndex: 'eligibility',
      key: 'eligibility',
      width: 200,
      render: (eligibility) => eligibility ? (
        <div>
          <SafetyCertificateOutlined style={{ marginRight: 6, color: '#52c41a' }} />
          <Text style={{ fontSize: 12 }}>{eligibility}</Text>
        </div>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 150,
      sorter: (a, b) => a.price - b.price,
      render: (price, record) => (
        <div style={{ fontWeight: 600, color: '#52c41a', fontSize: 16 }}>
          ₹{(price / 1000).toFixed(0)}K
          <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 400 }}>
            {record.currency}
          </div>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>Edit</Button>
          <Popconfirm
            title="Delete this course?"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Delete" okButtonProps={{ danger: true }} cancelText="Cancel"
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>Del</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Course Card Component
  const CourseCard = ({ course }) => (
    <Card
      hoverable
      style={{ 
        height: '100%',
        borderTop: `4px solid ${getCategoryColor(course.category)}`,
        cursor: 'pointer',
        position: 'relative',
      }}
      bodyStyle={{ padding: 20 }}
      onClick={() => showCourseDetails(course)}
    >
      <div style={{ marginBottom: 12 }}>
        <Tag color={getCategoryColor(course.category)} style={{ marginBottom: 8 }}>
          {course.category}
        </Tag>
        <Title level={5} style={{ marginBottom: 8, minHeight: 48 }}>
          {course.course_name}
        </Title>
      </div>

      <Paragraph 
        ellipsis={{ rows: 2 }} 
        type="secondary" 
        style={{ minHeight: 44, fontSize: 13 }}
      >
        {course.description || 'No description available'}
      </Paragraph>

      <Divider style={{ margin: '12px 0' }} />

      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined /> Duration
          </Text>
          <Text strong>{course.duration}</Text>
        </div>

        {course.eligibility && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <SafetyCertificateOutlined /> Eligibility
            </Text>
            <Text style={{ fontSize: 11, textAlign: 'right', maxWidth: 150 }}>
              {course.eligibility}
            </Text>
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: 8,
          paddingTop: 12,
          borderTop: '1px solid #f0f0f0'
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Price</Text>
          <Text strong style={{ fontSize: 18, color: '#52c41a' }}>
            ₹{(course.price / 1000).toFixed(0)}K
          </Text>
        </div>
      </Space>

      <div style={{ 
        position: 'absolute', 
        top: 16, 
        right: 16, 
        background: 'rgba(24, 144, 255, 0.1)',
        borderRadius: '50%',
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <EyeOutlined style={{ color: '#1890ff' }} />
      </div>
    </Card>
  );

  // Course Details Modal
  const CourseDetailsModal = () => {
    if (!selectedCourse) return null;

    const highlights = [
      'Comprehensive curriculum designed by industry experts',
      'Hands-on practical training with real cases',
      'Internationally recognized certification',
      'Flexible learning schedule with online & offline options',
      'Career support and placement assistance',
      'Access to exclusive medical resources and journals',
    ];

    const curriculum = [
      { title: 'Foundation Module', duration: '2 Months', topics: ['Basic concepts', 'Fundamental principles', 'Introduction to advanced techniques'] },
      { title: 'Advanced Training', duration: '6 Months', topics: ['Specialized procedures', 'Clinical applications', 'Research methodology'] },
      { title: 'Practical Experience', duration: '3 Months', topics: ['Supervised practice', 'Case studies', 'Patient interaction'] },
      { title: 'Final Assessment', duration: '1 Month', topics: ['Comprehensive evaluation', 'Thesis/Project', 'Certification exam'] },
    ];

    return (
      <Modal
        title={null}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ 
          background: `linear-gradient(135deg, ${getCategoryColor(selectedCourse.category)} 0%, ${getCategoryColor(selectedCourse.category)}dd 100%)`,
          padding: '32px 32px 24px',
          color: 'white'
        }}>
          <Tag color="white" style={{ 
            color: getCategoryColor(selectedCourse.category),
            fontWeight: 600,
            marginBottom: 12,
            border: 'none'
          }}>
            {selectedCourse.category}
          </Tag>
          <Title level={3} style={{ color: 'white', marginBottom: 8 }}>
            {selectedCourse.course_name}
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, marginBottom: 0 }}>
            {selectedCourse.description || 'Comprehensive fellowship program designed for medical professionals'}
          </Paragraph>
        </div>

        <div style={{ padding: 32 }}>
          <Row gutter={16} style={{ marginBottom: 32 }}>
            <Col span={8}>
              <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                <Statistic
                  title="Duration"
                  value={selectedCourse.duration}
                  prefix={<ClockCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
                <Statistic
                  title="Course Fee"
                  value={`₹${(selectedCourse.price / 100000).toFixed(2)}L`}
                  prefix={<DollarOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ background: '#fff7e6', border: '1px solid #ffd591' }}>
                <Statistic
                  title="Specialization"
                  value={selectedCourse.category}
                  prefix={<MedicineBoxOutlined style={{ color: '#fa8c16' }} />}
                  valueStyle={{ color: '#fa8c16', fontSize: 16 }}
                />
              </Card>
            </Col>
          </Row>

          <Divider orientation="left">
            <SafetyCertificateOutlined /> Eligibility Criteria
          </Divider>
          <Card size="small" style={{ background: '#fafafa', marginBottom: 24 }}>
            <Text strong style={{ fontSize: 16 }}>
              {selectedCourse.eligibility || 'MBBS or equivalent degree from recognized university'}
            </Text>
          </Card>

          <Divider orientation="left">
            <CheckCircleOutlined /> Program Highlights
          </Divider>
          <List
            dataSource={highlights}
            renderItem={(item) => (
              <List.Item style={{ padding: '8px 0', border: 'none' }}>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 12 }} />
                <Text>{item}</Text>
              </List.Item>
            )}
            style={{ marginBottom: 24 }}
          />

          <Divider orientation="left">
            <FileTextOutlined /> Curriculum Overview
          </Divider>
          <Timeline
            items={curriculum.map((module) => ({
              color: getCategoryColor(selectedCourse.category),
              children: (
                <div>
                  <Title level={5}>{module.title}</Title>
                  <Text type="secondary">Duration: {module.duration}</Text>
                  <ul style={{ marginTop: 8 }}>
                    {module.topics.map((topic, i) => (
                      <li key={i}><Text>{topic}</Text></li>
                    ))}
                  </ul>
                </div>
              ),
            }))}
          />

          <Divider />

          <div style={{ 
            background: '#f0f2f5', 
            padding: 20, 
            borderRadius: 8,
            marginTop: 24 
          }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">Course Code:</Text>
                <br />
                <Text strong>FC-{selectedCourse.id.toString().padStart(4, '0')}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">Currency:</Text>
                <br />
                <Text strong>{selectedCourse.currency || 'INR'}</Text>
              </Col>
            </Row>
          </div>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button type="primary" size="large" icon={<InfoCircleOutlined />}>
              Request More Information
            </Button>
            <Button size="large" style={{ marginLeft: 12 }}>
              Download Brochure
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Total Courses"
              value={stats.total}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Categories"
              value={stats.categories}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#722ed1', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Average Price"
              value={`₹${(stats.avgPrice / 1000).toFixed(0)}K`}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Total Portfolio"
              value={`₹${(stats.totalValue / 1000000).toFixed(1)}M`}
              prefix={<MedicineBoxOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Title level={4} style={{ margin: 0 }}>
              Fellowship Programs Catalog
            </Title>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                Add Course
              </Button>
              <Button
                type={viewMode === 'grid' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button
                type={viewMode === 'table' ? 'primary' : 'default'}
                icon={<UnorderedListOutlined />}
                onClick={() => setViewMode('table')}
              >
                Table
              </Button>
            </Space>
          </div>
        }
        extra={
          <Space>
            <Input.Search
              placeholder="Search courses..."
              allowClear
              style={{ width: 300 }}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
            <Select
              style={{ width: 200 }}
              placeholder="Filter by category"
              value={selectedCategory}
              onChange={setSelectedCategory}
            >
              <Option value="all">All Categories ({courses.length})</Option>
              {categories.map(cat => (
                <Option key={cat} value={cat}>
                  <Badge 
                    color={getCategoryColor(cat)} 
                    text={`${cat} (${categoryCounts[cat]})`}
                  />
                </Option>
              ))}
            </Select>
          </Space>
        }
      >
        <Tabs activeKey={selectedCategory} onChange={setSelectedCategory} type="card">
          <TabPane 
            tab={
              <span>
                <AppstoreOutlined />
                All ({courses.length})
              </span>
            } 
            key="all"
          />
          {categories.map(category => (
            <TabPane
              tab={
                <span>
                  <Badge color={getCategoryColor(category)} />
                  {category} ({categoryCounts[category]})
                </span>
              }
              key={category}
            />
          ))}
        </Tabs>

        <Divider style={{ margin: '16px 0' }} />

        {viewMode === 'grid' ? (
          filteredCourses.length > 0 ? (
            <Row gutter={[16, 16]}>
              {filteredCourses.map(course => (
                <Col xs={24} sm={12} md={8} lg={6} key={course.id}>
                  <CourseCard course={course} />
                </Col>
              ))}
            </Row>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No courses found"
            />
          )
        ) : (
          <Table
            columns={columns}
            dataSource={filteredCourses}
            loading={isLoading}
            rowKey="id"
            scroll={{ x: 1200 }}
            pagination={{
              total: filteredCourses.length,
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} courses`,
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No courses found"
                />
              ),
            }}
          />
        )}
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={5}>
          <FileTextOutlined /> Course Statistics by Category
        </Title>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {categories.map(category => (
            <Col xs={12} sm={8} md={6} lg={4} key={category}>
              <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                <Statistic
                  title={category}
                  value={categoryCounts[category]}
                  valueStyle={{ color: getCategoryColor(category), fontSize: 20 }}
                  suffix="courses"
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <CourseDetailsModal />

      {/* Add / Edit Course Drawer */}
      <Drawer
        title={editingCourse ? 'Edit Course' : 'Add New Course'}
        width={520}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setEditingCourse(null); form.resetFields(); }}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
          <Form.Item name="course_name" label="Course Name" rules={[{ required: true }]}>
            <Input placeholder="Fellowship in Cardiology" />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select placeholder="Select category">
              {['Pediatrics','Orthopaedics','Radiology','Dermatology','Obs & Gynae',
                'Cardiology','Oncology','Endocrinology','Surgery','Medicine',
                'Urology','Gastroenterology','Dental','Reproductive'].map(c => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="duration" label="Duration" rules={[{ required: true }]}>
            <Input placeholder="12 Months" />
          </Form.Item>
          <Form.Item name="price" label="Price (₹)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="500000" />
          </Form.Item>
          <Form.Item name="currency" label="Currency" initialValue="INR">
            <Select>
              <Select.Option value="INR">INR</Select.Option>
              <Select.Option value="USD">USD</Select.Option>
              <Select.Option value="AED">AED</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="eligibility" label="Eligibility">
            <Input placeholder="MBBS or equivalent" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Brief description..." />
          </Form.Item>
          <Button
            type="primary" htmlType="submit" block
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {editingCourse ? 'Update Course' : 'Add Course'}
          </Button>
        </Form>
      </Drawer>
    </div>
  );
};

export default CoursesPageEnhanced;
