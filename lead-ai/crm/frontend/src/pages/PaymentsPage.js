import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Row, Col, Input, Select, DatePicker, Spin, Empty, Tag } from 'antd';
import { DollarSign, Users, TrendingUp } from 'lucide-react';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { leadsAPI } from '../api/api';

dayjs.extend(isBetween);

const PaymentsPage = () => {
  const [searchText, setSearchText] = useState('');
  const [filterCounselor, setFilterCounselor] = useState(null);
  const [filterCourse, setFilterCourse] = useState(null);
  const [dateRange, setDateRange] = useState([null, null]);

  // Fetch enrolled leads — API returns { leads: [], total, ... }
  const { data: leadsResponse, isLoading } = useQuery({
    queryKey: ['enrolled-leads'],
    queryFn: () => leadsAPI.getAll({ status: 'Enrolled', limit: 1000 }).then(res => res.data),
  });

  const leads = leadsResponse?.leads || (Array.isArray(leadsResponse) ? leadsResponse : []);

  // Filter logic
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.full_name?.toLowerCase().includes(searchText.toLowerCase());
    const matchesCounselor = !filterCounselor || lead.assigned_to === filterCounselor;
    const matchesCourse = !filterCourse || lead.course_interested === filterCourse;

    let matchesDate = true;
    if (dateRange[0] && dateRange[1]) {
      const enrollDate = dayjs(lead.updated_at || lead.created_at);
      matchesDate = enrollDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
    }
    
    return matchesSearch && matchesCounselor && matchesCourse && matchesDate;
  });

  // Calculate summary
  const totalRevenue = filteredLeads.reduce((sum, lead) => sum + (lead.potential_revenue || 0), 0);
  const totalEnrolled = filteredLeads.length;
  const avgRevenue = totalEnrolled > 0 ? totalRevenue / totalEnrolled : 0;

  // Unique counselors and courses for filter dropdowns
  const counselors = [...new Set(leads.map(l => l.assigned_to).filter(Boolean))];
  const courses = [...new Set(leads.map(l => l.course_interested).filter(Boolean))];

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: 'Course',
      dataIndex: 'course_interested',
      key: 'course_interested',
      render: (text) => <Tag color="blue">{text || '—'}</Tag>,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
    },
    {
      title: 'Revenue (₹)',
      dataIndex: 'potential_revenue',
      key: 'revenue',
      render: (value) => (
        <span style={{ color: '#10b981', fontWeight: 600 }}>
          ₹{(value || 0).toLocaleString()}
        </span>
      ),
      sorter: (a, b) => (a.potential_revenue || 0) - (b.potential_revenue || 0),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Enrolled Date',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '—',
      sorter: (a, b) => dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
    },
    {
      title: 'Counselor',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      render: (text) => text || 'Unassigned',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>
          Payments & Revenue
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Track enrollment payments and revenue
        </p>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card 
            style={{ 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              borderRadius: '12px',
              border: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '8px' }}>
                  Total Revenue
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700' }}>
                  ₹{(totalRevenue / 100000).toFixed(1)}L
                </div>
              </div>
              <DollarSign size={32} opacity={0.3} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              borderRadius: '12px',
              border: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '8px' }}>
                  Total Enrolled
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700' }}>
                  {totalEnrolled}
                </div>
              </div>
              <Users size={32} opacity={0.3} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              borderRadius: '12px',
              border: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '8px' }}>
                  Avg Revenue/Enrollment
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700' }}>
                  ₹{avgRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <TrendingUp size={32} opacity={0.3} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: '24px', borderRadius: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Input
            placeholder="Search by name..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ borderRadius: '8px' }}
          />
          <Select
            placeholder="Filter by counselor"
            value={filterCounselor}
            onChange={setFilterCounselor}
            allowClear
            style={{ borderRadius: '8px' }}
            options={counselors.map(c => ({ label: c, value: c }))}
          />
          <Select
            placeholder="Filter by course"
            value={filterCourse}
            onChange={setFilterCourse}
            allowClear
            style={{ borderRadius: '8px' }}
            options={courses.map(c => ({ label: c, value: c }))}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            style={{ borderRadius: '8px' }}
          />
        </div>
      </Card>

      {/* Table */}
      <Card style={{ borderRadius: '12px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <Spin />
          </div>
        ) : filteredLeads.length === 0 ? (
          <Empty description="No enrolled leads found" />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredLeads.map(lead => ({ ...lead, key: lead.id }))}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 800 }}
            style={{ borderRadius: '8px' }}
          />
        )}
      </Card>
    </div>
  );
};

export default PaymentsPage;
