/**
 * Accounts / Payments Page
 * Shows enrolled students with fee collected, pending EMIs, and due dates.
 * Payment data is stored as a structured note (channel="payment") on each lead.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table, Card, Row, Col, Input, Select, Tag, Spin, Badge,
  Progress, Statistic, Button,
} from 'antd';
import {
  DollarSign, Users, AlertCircle, CheckCircle,
  Clock, Search, CreditCard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { leadsAPI } from '../api/api';

const { Option } = Select;

// Parse payment note from lead.notes array (channel="payment")
const getPaymentData = (lead) => {
  const note = (lead.notes || []).find(n => n.channel === 'payment');
  if (!note) return null;
  try { return JSON.parse(note.content); } catch { return null; }
};

const fmt = (n) => (n || 0).toLocaleString('en-IN');
const fmtL = (n) => `₹${((n || 0) / 100000).toFixed(1)}L`;

const EMI_STATUS_COLOR = {
  'On Time':  '#059669',
  'Due Today': '#d97706',
  'Overdue':   '#dc2626',
  'No EMI':    '#6b7280',
};

const getEmiStatus = (nextDue) => {
  if (!nextDue) return 'No EMI';
  const due = new Date(nextDue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due);
  dueDate.setHours(0, 0, 0, 0);
  const diff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return 'Overdue';
  if (diff === 0) return 'Due Today';
  return 'On Time';
};

const PaymentsPage = () => {
  const navigate = useNavigate();
  const [search, setSearch]       = useState('');
  const [courseFilter, setCourse] = useState(null);
  const [emiFilter, setEmiFilter] = useState(null);

  const { data: leadsResp, isLoading } = useQuery({
    queryKey: ['enrolled-leads-payments'],
    queryFn: () => leadsAPI.getAll({ status: 'Enrolled', limit: 70000, skip: 0 }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const students = leadsResp?.leads || (Array.isArray(leadsResp) ? leadsResp : []);

  // Enrich each student with parsed payment data
  const enriched = useMemo(() => students.map(s => {
    const pay = getPaymentData(s);
    const emiStatus = getEmiStatus(pay?.emi_next);
    return {
      ...s,
      pay,
      fee_total:    pay?.fee_total    || s.expected_revenue || 0,
      fee_collected:pay?.fee_collected || 0,
      emi_amount:   pay?.emi_amount   || 0,
      emi_count:    pay?.emi_count    || 0,
      emi_next:     pay?.emi_next     || null,
      emi_start:    pay?.emi_start    || null,
      balance_due:  (pay?.fee_total || s.expected_revenue || 0) - (pay?.fee_collected || 0),
      emiStatus,
    };
  }), [students]);

  const courses = [...new Set(students.map(s => s.course_interested).filter(Boolean))].sort();

  const filtered = enriched.filter(s => {
    const ms = !search || s.full_name?.toLowerCase().includes(search.toLowerCase())
      || s.email?.toLowerCase().includes(search.toLowerCase());
    const mc = !courseFilter || s.course_interested === courseFilter;
    const me = !emiFilter || s.emiStatus === emiFilter;
    return ms && mc && me;
  });

  // KPIs
  const totalFee       = enriched.reduce((s, e) => s + e.fee_total, 0);
  const totalCollected = enriched.reduce((s, e) => s + e.fee_collected, 0);
  const totalPending   = enriched.reduce((s, e) => s + e.balance_due, 0);
  const overdue        = enriched.filter(e => e.emiStatus === 'Overdue').length;
  const dueToday       = enriched.filter(e => e.emiStatus === 'Due Today').length;
  const noPayData      = enriched.filter(e => !e.pay).length;

  const collectionPct = totalFee ? Math.round((totalCollected / totalFee) * 100) : 0;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: 200,
      render: (_, s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: '#dbeafe', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#1d4ed8',
          }}>
            {s.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.phone}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Course',
      dataIndex: 'course_interested',
      key: 'course',
      width: 160,
      render: t => <Tag color="blue">{t || '—'}</Tag>,
      filters: courses.map(c => ({ text: c, value: c })),
      onFilter: (v, r) => r.course_interested === v,
    },
    {
      title: 'Total Fee',
      key: 'fee_total',
      width: 110,
      sorter: (a, b) => a.fee_total - b.fee_total,
      render: (_, s) => (
        <span style={{ fontWeight: 600, color: '#374151' }}>
          {s.fee_total ? `₹${fmt(s.fee_total)}` : <span style={{ color: '#9ca3af' }}>—</span>}
        </span>
      ),
    },
    {
      title: 'Collected',
      key: 'fee_collected',
      width: 120,
      sorter: (a, b) => a.fee_collected - b.fee_collected,
      render: (_, s) => (
        <div>
          <div style={{ fontWeight: 600, color: '#059669' }}>
            {s.fee_collected ? `₹${fmt(s.fee_collected)}` : <span style={{ color: '#9ca3af' }}>—</span>}
          </div>
          {s.fee_total > 0 && (
            <Progress
              percent={Math.round((s.fee_collected / s.fee_total) * 100)}
              size="small"
              strokeColor="#059669"
              showInfo={false}
              style={{ margin: '2px 0 0', width: 80 }}
            />
          )}
        </div>
      ),
    },
    {
      title: 'Balance Due',
      key: 'balance',
      width: 110,
      sorter: (a, b) => b.balance_due - a.balance_due,
      render: (_, s) => (
        <span style={{ fontWeight: 600, color: s.balance_due > 0 ? '#dc2626' : '#059669' }}>
          {s.balance_due > 0
            ? `₹${fmt(s.balance_due)}`
            : s.fee_total > 0 ? <Tag color="green" style={{ margin: 0 }}>Paid ✓</Tag> : '—'}
        </span>
      ),
    },
    {
      title: 'EMI',
      key: 'emi',
      width: 130,
      render: (_, s) => {
        if (!s.emi_amount || !s.emi_count) {
          return <span style={{ color: '#9ca3af', fontSize: 12 }}>No EMI plan</span>;
        }
        return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              ₹{fmt(s.emi_amount)} × {s.emi_count}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {s.emi_count} installments
            </div>
          </div>
        );
      },
    },
    {
      title: 'Next Due',
      key: 'emi_next',
      width: 130,
      sorter: (a, b) => {
        if (!a.emi_next) return 1;
        if (!b.emi_next) return -1;
        return new Date(a.emi_next) - new Date(b.emi_next);
      },
      render: (_, s) => {
        const status = s.emiStatus;
        if (status === 'No EMI') return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>;
        return (
          <div>
            <Tag color={
              status === 'Overdue' ? 'red' :
              status === 'Due Today' ? 'orange' : 'green'
            } style={{ margin: 0, fontSize: 11 }}>
              {status}
            </Tag>
            {s.emi_next && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {new Date(s.emi_next).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Counselor',
      dataIndex: 'assigned_to',
      key: 'counselor',
      width: 130,
      render: t => t || '—',
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_, s) => (
        <Button size="small" onClick={() => navigate(`/leads/${s.lead_id}`)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#fef9c3', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>💰</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Accounts — Fee & EMI Tracker</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Enrolled students · fee collection · EMI schedules
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <Row gutter={[14, 14]}>
        {[
          { title: 'Enrolled', value: students.length, color: '#2563eb', icon: Users },
          { title: 'Total Fee', value: fmtL(totalFee), color: '#374151', icon: DollarSign },
          { title: 'Collected', value: fmtL(totalCollected), color: '#059669', icon: CheckCircle, sub: `${collectionPct}% of total` },
          { title: 'Pending', value: fmtL(totalPending), color: '#d97706', icon: CreditCard },
          { title: 'Overdue EMI', value: overdue, color: '#dc2626', icon: AlertCircle, sub: dueToday > 0 ? `+${dueToday} due today` : '' },
        ].map(k => (
          <Col key={k.title} xs={24} sm={12} lg={5} xl={5}>
            <Card style={{ borderRadius: 12, borderTop: `3px solid ${k.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Statistic
                    title={k.title}
                    value={k.value}
                    valueStyle={{ color: k.color, fontWeight: 700, fontSize: 20 }}
                  />
                  {k.sub && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{k.sub}</div>
                  )}
                </div>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${k.color}15`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <k.icon size={18} color={k.color} />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Collection Progress */}
      <Card style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>Overall Fee Collection Progress</span>
          <span style={{ color: '#059669', fontWeight: 700 }}>{collectionPct}% collected</span>
        </div>
        <Progress
          percent={collectionPct}
          strokeColor={{ '0%': '#dc2626', '50%': '#d97706', '100%': '#059669' }}
          trailColor="#f3f4f6"
        />
        <Row gutter={[16, 0]} style={{ marginTop: 12 }}>
          <Col span={8} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>₹{fmt(totalFee)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Total Fee</div>
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>₹{fmt(totalCollected)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Collected</div>
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>₹{fmt(totalPending)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Pending</div>
          </Col>
        </Row>
      </Card>

      {/* Alerts */}
      {(overdue > 0 || dueToday > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {overdue > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 10,
              background: '#fef2f2', border: '1px solid #fecaca',
            }}>
              <AlertCircle size={16} color="#dc2626" />
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
                {overdue} student{overdue > 1 ? 's have' : ' has'} overdue EMI payments — immediate follow-up required
              </span>
            </div>
          )}
          {dueToday > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 10,
              background: '#fffbeb', border: '1px solid #fde68a',
            }}>
              <Clock size={16} color="#d97706" />
              <span style={{ fontSize: 13, color: '#d97706', fontWeight: 500 }}>
                {dueToday} EMI payment{dueToday > 1 ? 's are' : ' is'} due today
              </span>
            </div>
          )}
        </div>
      )}

      {/* No payment data info */}
      {noPayData > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderRadius: 10,
          background: '#f0f9ff', border: '1px solid #bae6fd',
        }}>
          <AlertCircle size={16} color="#0284c7" />
          <span style={{ fontSize: 13, color: '#0284c7' }}>
            {noPayData} enrolled student{noPayData > 1 ? 's have' : ' has'} no payment details recorded yet.
            Sales team must fill fee details at enrollment.
          </span>
        </div>
      )}

      {/* Main table */}
      <Card style={{ borderRadius: 12 }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <Input
            placeholder="Search student…"
            prefix={<Search size={14} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            placeholder="All Courses"
            allowClear
            value={courseFilter}
            onChange={setCourse}
            style={{ width: 200 }}
          >
            {courses.map(c => <Option key={c} value={c}>{c}</Option>)}
          </Select>
          <Select
            placeholder="EMI Status"
            allowClear
            value={emiFilter}
            onChange={setEmiFilter}
            style={{ width: 150 }}
          >
            {['On Time', 'Due Today', 'Overdue', 'No EMI'].map(s => (
              <Option key={s} value={s}>
                <Badge color={EMI_STATUS_COLOR[s]} text={s} />
              </Option>
            ))}
          </Select>
          {(search || courseFilter || emiFilter) && (
            <Button onClick={() => { setSearch(''); setCourse(null); setEmiFilter(null); }}>Clear</Button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>
            {filtered.length} students
          </div>
        </div>

        <Table
          dataSource={filtered}
          rowKey="id"
          columns={columns}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          size="middle"
          rowClassName={r => r.emiStatus === 'Overdue' ? 'row-overdue' : r.emiStatus === 'Due Today' ? 'row-due-today' : ''}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
};

export default PaymentsPage;
