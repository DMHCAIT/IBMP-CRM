import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag, Progress, Avatar, Tooltip, Badge, Space, Typography } from 'antd';
import {
  TrophyOutlined, FireOutlined, WarningOutlined,
  CalendarOutlined, DollarOutlined, RiseOutlined,
} from '@ant-design/icons';
import { counselorsAPI } from '../api/api';

const { Text } = Typography;

const medalColor = ['#ffd700', '#c0c0c0', '#cd7f32']; // gold, silver, bronze

export default function CounselorPerformanceWidget() {
  const { data: perf = [], isLoading } = useQuery({
    queryKey: ['counselor-performance'],
    queryFn: () => counselorsAPI.getPerformance().then(r => r.data || []),
    refetchInterval: 120000, // refresh every 2 minutes
  });

  const columns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 52,
      render: (_, __, idx) => (
        idx < 3
          ? <div style={{ width: 28, height: 28, borderRadius: '50%', background: medalColor[idx],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: idx === 0 ? '#7d5a00' : idx === 1 ? '#555' : '#6b3a1f' }}>
              {idx + 1}
            </div>
          : <Text type="secondary" style={{ paddingLeft: 8 }}>{idx + 1}</Text>
      ),
    },
    {
      title: 'Counselor',
      dataIndex: 'name',
      key: 'name',
      render: (name, r) => (
        <Space>
          <Avatar size={30} style={{ background: '#1890ff', fontSize: 12, flexShrink: 0 }}>
            {name?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{r.total_leads} leads</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Conversion',
      key: 'conversion',
      width: 130,
      render: (_, r) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontSize: 11 }}>{r.enrolled} enrolled</Text>
            <Text strong style={{ fontSize: 12, color: r.conversion_rate >= 20 ? '#52c41a' : r.conversion_rate >= 10 ? '#fa8c16' : '#f5222d' }}>
              {r.conversion_rate}%
            </Text>
          </div>
          <Progress
            percent={r.conversion_rate}
            showInfo={false}
            size="small"
            strokeColor={r.conversion_rate >= 20 ? '#52c41a' : r.conversion_rate >= 10 ? '#fa8c16' : '#f5222d'}
          />
        </div>
      ),
    },
    {
      title: 'Hot',
      dataIndex: 'hot_leads',
      key: 'hot',
      width: 60,
      render: v => (
        <Tag color="red" icon={<FireOutlined />} style={{ margin: 0 }}>{v}</Tag>
      ),
    },
    {
      title: 'Today',
      dataIndex: 'followups_today',
      key: 'today',
      width: 65,
      render: v => (
        <Badge count={v} color={v > 0 ? '#1890ff' : '#d9d9d9'}
          style={{ fontSize: 11 }} showZero />
      ),
    },
    {
      title: 'Overdue',
      dataIndex: 'overdue',
      key: 'overdue',
      width: 72,
      render: v => (
        v > 0
          ? <Tag color="red" icon={<WarningOutlined />} style={{ margin: 0 }}>{v}</Tag>
          : <Text type="secondary">—</Text>
      ),
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 90,
      render: v => (
        <Text strong style={{ color: '#52c41a', fontSize: 12 }}>
          ₹{v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
        </Text>
      ),
    },
    {
      title: 'AI Avg',
      dataIndex: 'avg_ai_score',
      key: 'avg_ai_score',
      width: 70,
      render: v => (
        <Text style={{ color: v >= 60 ? '#52c41a' : v >= 40 ? '#fa8c16' : '#f5222d', fontWeight: 600, fontSize: 12 }}>
          {v}
        </Text>
      ),
    },
  ];

  // Summary totals
  const totalLeads    = perf.reduce((s, r) => s + r.total_leads, 0);
  const totalEnrolled = perf.reduce((s, r) => s + r.enrolled, 0);
  const totalOverdue  = perf.reduce((s, r) => s + r.overdue, 0);
  const totalRevenue  = perf.reduce((s, r) => s + r.revenue, 0);

  return (
    <Card
      title={
        <Space>
          <TrophyOutlined style={{ color: '#ffd700' }} />
          <span>Counselor Performance</span>
        </Space>
      }
      extra={
        <Space style={{ fontSize: 12, color: '#666' }}>
          <span><RiseOutlined /> {totalEnrolled} enrolled</span>
          <span><WarningOutlined style={{ color: '#f5222d' }} /> {totalOverdue} overdue</span>
          <span><DollarOutlined style={{ color: '#52c41a' }} />
            ₹{totalRevenue >= 100000 ? `${(totalRevenue / 100000).toFixed(1)}L` : `${(totalRevenue / 1000).toFixed(0)}K`}
          </span>
        </Space>
      }
      style={{ marginBottom: 24 }}
    >
      <Table
        dataSource={perf}
        columns={columns}
        rowKey="name"
        loading={isLoading}
        pagination={false}
        size="small"
        scroll={{ x: 600 }}
        rowClassName={(_, idx) => idx === 0 ? 'top-performer-row' : ''}
      />
      <style>{`
        .top-performer-row { background: #fffbe6 !important; }
        .top-performer-row:hover td { background: #fff7cc !important; }
      `}</style>
    </Card>
  );
}
