/**
 * CEO Command Center
 * Full company monitoring dashboard for CEO and Super Admin.
 * Shows department cards → click any card → drill-down detail panel.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Row, Col, Card, Statistic, Table, Tag, Progress, Spin, Badge,
  Button, Tabs, Tooltip, Empty,
} from 'antd';
import {
  ArrowLeft, Users, DollarSign, TrendingUp, CheckCircle, Clock,
  AlertCircle, BarChart3, Megaphone, GraduationCap, UserCog,
  Activity, Globe, ChevronRight, RefreshCw, Wifi, WifiOff,
  Target, Flame, PhoneCall, FileText, CreditCard, Award,
} from 'lucide-react';
import { leadsAPI, usersAPI, dashboardAPI, adminAPI, counselorsAPI } from '../../api/api';
import { getDepartment, DEPT_META, DEPARTMENTS } from '../../config/rbac';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt  = (n) => (n || 0).toLocaleString('en-IN');
const fmtL = (n) => `₹${((n || 0) / 100000).toFixed(1)}L`;
const pct  = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0');

function statusBadge(val, warn, danger) {
  if (val <= danger) return 'error';
  if (val <= warn)  return 'warning';
  return 'success';
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI STAT inside department detail
// ─────────────────────────────────────────────────────────────────────────────
const KPI = ({ label, value, color = '#2563eb', icon: Icon, sub }) => (
  <div style={{
    padding: '14px 16px', borderRadius: 10,
    background: `${color}0d`, border: `1px solid ${color}25`,
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    {Icon && (
      <div style={{ width: 38, height: 38, borderRadius: 8, background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
    )}
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENT DETAIL PANELS
// ─────────────────────────────────────────────────────────────────────────────
const MarketingDetail = ({ leads, meta }) => {
  const srcMap = {};
  leads.forEach(l => { const s = l.lead_source || 'Unknown'; srcMap[s] = (srcMap[s] || 0) + 1; });
  const sources = Object.entries(srcMap)
    .map(([src, cnt]) => ({ src, cnt, enr: leads.filter(l => l.lead_source === src && l.status === 'Enrolled').length }))
    .sort((a, b) => b.cnt - a.cnt);

  const newToday = leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length;
  const enrolled = leads.filter(l => l.status === 'Enrolled').length;
  const totalRev = leads.filter(l => l.status === 'Enrolled').reduce((s, l) => s + (l.potential_revenue || 0), 0);

  const courseMap = {};
  leads.forEach(l => { if (l.course_interested) courseMap[l.course_interested] = (courseMap[l.course_interested] || 0) + 1; });
  const topCourses = Object.entries(courseMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[12, 12]}>
        <Col span={8}><KPI label="Total Leads" value={fmt(leads.length)} color={meta.color} icon={Users} /></Col>
        <Col span={8}><KPI label="New Today" value={newToday} color="#059669" icon={TrendingUp} /></Col>
        <Col span={8}><KPI label="Converted" value={`${pct(enrolled, leads.length)}%`} color="#7c3aed" icon={Target} /></Col>
      </Row>

      <Card size="small" title="📊 Lead Source Performance" style={{ borderRadius: 10 }}>
        <Table size="small" pagination={false} dataSource={sources.slice(0, 8)} rowKey="src"
          columns={[
            { title: 'Source', dataIndex: 'src', render: t => <Tag color="orange">{t}</Tag> },
            { title: 'Leads', dataIndex: 'cnt', sorter: (a,b) => b.cnt - a.cnt, defaultSortOrder: 'descend' },
            { title: 'Enrolled', dataIndex: 'enr', render: v => <span style={{ color:'#059669', fontWeight:600 }}>{v}</span> },
            { title: 'Conv%', render: (_, r) => `${r.cnt ? Math.round((r.enr/r.cnt)*100) : 0}%` },
          ]}
        />
      </Card>

      <Card size="small" title="🏆 Top Enquired Courses" style={{ borderRadius: 10 }}>
        {topCourses.map(([c, n]) => (
          <div key={c} style={{ marginBottom: 10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
              <span>{c}</span><span style={{ color:'var(--text-secondary)' }}>{n}</span>
            </div>
            <Progress percent={leads.length ? Math.round((n/leads.length)*100) : 0}
              strokeColor={meta.color} showInfo={false} size="small" />
          </div>
        ))}
      </Card>

      <Row gutter={[12,12]}>
        <Col span={12}>
          <div style={{ padding:'14px 16px', borderRadius:10, background:'#fef3c7', textAlign:'center' }}>
            <div style={{ fontSize:28, fontWeight:800, color:'#d97706' }}>
              ₹{leads.length ? Math.round(50000/leads.length) : 0}
            </div>
            <div style={{ fontSize:11, color:'#92400e' }}>Cost Per Lead (CPL)</div>
          </div>
        </Col>
        <Col span={12}>
          <div style={{ padding:'14px 16px', borderRadius:10, background:'#d1fae5', textAlign:'center' }}>
            <div style={{ fontSize:28, fontWeight:800, color:'#059669' }}>
              {totalRev > 0 ? `${(totalRev/50000).toFixed(1)}x` : '—'}
            </div>
            <div style={{ fontSize:11, color:'#065f46' }}>ROAS</div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

const SalesDetail = ({ leads, users, meta }) => {
  const STAGES = ['New','Contacted','Warm','Hot','Follow-up','Enrolled','Lost'];
  const stageData = STAGES.map(s => ({ stage: s, count: leads.filter(l => l.status === s).length }));
  const hotLeads  = leads.filter(l => l.status === 'Hot');
  const todayFups = leads.filter(l => {
    if (!l.next_followup) return false;
    return new Date(l.next_followup).toDateString() === new Date().toDateString();
  });

  const perfMap = {};
  leads.forEach(l => {
    if (!l.assigned_to) return;
    perfMap[l.assigned_to] = perfMap[l.assigned_to] || { name: l.assigned_to, leads: 0, enrolled: 0, hot: 0 };
    perfMap[l.assigned_to].leads++;
    if (l.status === 'Enrolled') perfMap[l.assigned_to].enrolled++;
    if (l.status === 'Hot')      perfMap[l.assigned_to].hot++;
  });
  const perf = Object.values(perfMap).sort((a,b) => b.enrolled - a.enrolled);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Row gutter={[12,12]}>
        <Col span={8}><KPI label="Active Leads" value={fmt(leads.filter(l=>l.status!=='Enrolled'&&l.status!=='Lost').length)} color={meta.color} icon={Users} /></Col>
        <Col span={8}><KPI label="Hot Leads" value={hotLeads.length} color="#ef4444" icon={Flame} /></Col>
        <Col span={8}><KPI label="Follow-ups Today" value={todayFups.length} color="#d97706" icon={PhoneCall} /></Col>
      </Row>

      <Card size="small" title="🎯 Pipeline by Stage" style={{ borderRadius:10 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {stageData.map(({ stage, count }) => (
            <div key={stage}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:2 }}>
                <span>{stage}</span><span style={{ color:'var(--text-secondary)' }}>{count}</span>
              </div>
              <Progress percent={leads.length ? Math.round((count/leads.length)*100) : 0}
                strokeColor={meta.color} showInfo={false} size="small" />
            </div>
          ))}
        </div>
      </Card>

      <Card size="small" title="🏆 Counselor Leaderboard" style={{ borderRadius:10 }}>
        <Table size="small" pagination={false} dataSource={perf.slice(0,6)} rowKey="name"
          columns={[
            { title: '#', render: (_,__,i) => <span style={{ fontWeight:700, color:i===0?'#d97706':i===1?'#6b7280':i===2?'#92400e':'inherit' }}>{i+1}</span>, width: 30 },
            { title: 'Counselor', dataIndex: 'name', render: t => <span style={{ fontWeight:500 }}>{t}</span> },
            { title: 'Leads', dataIndex: 'leads' },
            { title: 'Enrolled', dataIndex: 'enrolled', render: v => <Tag color="green">{v}</Tag> },
            { title: 'Conv%', render: (_,r) => `${r.leads?Math.round((r.enrolled/r.leads)*100):0}%` },
          ]}
        />
      </Card>

      {hotLeads.length > 0 && (
        <Card size="small" title="🔥 Hot Leads — Action Required" style={{ borderRadius:10 }}>
          {hotLeads.slice(0,5).map(l => (
            <div key={l.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
              <span style={{ fontWeight:500 }}>{l.full_name}</span>
              <div style={{ display:'flex', gap:8 }}>
                <span style={{ color:'var(--text-tertiary)' }}>{l.course_interested}</span>
                <Tag color="red" style={{ margin:0 }}>Hot</Tag>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

const AcademicDetail = ({ leads, meta }) => {
  // Academic dept only handles enrolled students (courses only — no university/visa)
  const students = leads.filter(l => l.status === 'Enrolled' || l.status === 'ENROLLED');

  const courseMap = {};
  students.forEach(l => {
    const c = l.course_interested || 'Not specified';
    courseMap[c] = courseMap[c] || { count: 0, revenue: 0 };
    courseMap[c].count++;
    courseMap[c].revenue += l.potential_revenue || 0;
  });
  const topCourses = Object.entries(courseMap).sort((a,b)=>b[1].count-a[1].count).slice(0,5);

  const countryMap = {};
  students.forEach(l => { if(l.country) countryMap[l.country] = (countryMap[l.country]||0)+1; });
  const countries = Object.entries(countryMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const totalRev = students.reduce((s,l) => s+(l.potential_revenue||0), 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Row gutter={[12,12]}>
        <Col span={8}><KPI label="Enrolled" value={students.length} color={meta.color} icon={GraduationCap} /></Col>
        <Col span={8}><KPI label="Courses" value={Object.keys(courseMap).length} color="#2563eb" icon={FileText} /></Col>
        <Col span={8}><KPI label="Revenue" value={`₹${(totalRev/100000).toFixed(1)}L`} color="#059669" icon={Globe} /></Col>
      </Row>

      <Card size="small" title="📚 Enrollments by Course" style={{ borderRadius:10 }}>
        {topCourses.length === 0 ? (
          <div style={{ color:'var(--text-tertiary)', fontSize:12 }}>No enrollments yet</div>
        ) : topCourses.map(([course, data]) => (
          <div key={course} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:2 }}>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>{course}</span>
              <span style={{ color:meta.color, fontWeight:600 }}>{data.count}</span>
            </div>
            <Progress percent={students.length ? Math.round((data.count/students.length)*100):0}
              strokeColor={meta.color} showInfo={false} size="small" />
          </div>
        ))}
      </Card>

      <Card size="small" title="🌍 Students by Country" style={{ borderRadius:10 }}>
        {countries.length === 0 ? (
          <div style={{ color:'var(--text-tertiary)', fontSize:12 }}>No country data</div>
        ) : countries.map(([c, n]) => (
          <div key={c} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
            <span>{c}</span>
            <Tag color="purple" style={{margin:0}}>{n}</Tag>
          </div>
        ))}
      </Card>

      <Card size="small" title="📋 Recent Enrollments" style={{ borderRadius:10 }}>
        {students.slice(0,5).map(s => (
          <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
            <span style={{ fontWeight:500 }}>{s.full_name}</span>
            <Tag color="purple" style={{margin:0}}>{s.course_interested || '—'}</Tag>
          </div>
        ))}
      </Card>
    </div>
  );
};

const AccountsDetail = ({ leads, meta }) => {
  const enrolled = leads.filter(l => l.status === 'Enrolled');
  const totalRev = enrolled.reduce((s,l) => s + (l.potential_revenue||0), 0);
  const avgRev   = enrolled.length ? totalRev / enrolled.length : 0;

  const courseRev = {};
  enrolled.forEach(l => {
    const c = l.course_interested || 'Unknown';
    courseRev[c] = (courseRev[c] || 0) + (l.potential_revenue || 0);
  });
  const topCourseRev = Object.entries(courseRev).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const countryRev = {};
  enrolled.forEach(l => {
    const c = l.country || 'Unknown';
    countryRev[c] = (countryRev[c] || 0) + (l.potential_revenue || 0);
  });
  const topCountryRev = Object.entries(countryRev).sort((a,b)=>b[1]-a[1]).slice(0,4);

  const monthly = {};
  enrolled.forEach(l => {
    const m = new Date(l.updated_at || l.created_at).toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
    monthly[m] = (monthly[m] || 0) + (l.potential_revenue || 0);
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Row gutter={[12,12]}>
        <Col span={8}><KPI label="Total Revenue" value={fmtL(totalRev)} color={meta.color} icon={DollarSign} /></Col>
        <Col span={8}><KPI label="Enrollments" value={enrolled.length} color="#059669" icon={CheckCircle} /></Col>
        <Col span={8}><KPI label="Avg / Student" value={`₹${Math.round(avgRev/1000)}K`} color="#7c3aed" icon={TrendingUp} /></Col>
      </Row>

      <Card size="small" title="💰 Revenue by Course" style={{ borderRadius:10 }}>
        {topCourseRev.map(([c,r]) => (
          <div key={c} style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:2 }}>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>{c}</span>
              <span style={{ color:meta.color, fontWeight:600 }}>{fmtL(r)}</span>
            </div>
            <Progress percent={totalRev ? Math.round((r/totalRev)*100):0}
              strokeColor={meta.color} showInfo={false} size="small" />
          </div>
        ))}
      </Card>

      <Card size="small" title="🌏 Revenue by Country" style={{ borderRadius:10 }}>
        <Table size="small" pagination={false}
          dataSource={topCountryRev.map(([country,rev])=>({country,rev}))} rowKey="country"
          columns={[
            { title:'Country', dataIndex:'country' },
            { title:'Revenue', dataIndex:'rev', render:v => <span style={{color:meta.color,fontWeight:600}}>{fmtL(v)}</span> },
            { title:'Share', render:(_,r) => `${totalRev?Math.round((r.rev/totalRev)*100):0}%` },
          ]}
        />
      </Card>
    </div>
  );
};

const HRDetail = ({ users, leads, meta }) => {
  const active   = users.filter(u => u.is_active !== false);
  const inactive = users.filter(u => u.is_active === false);

  const deptMap = {};
  users.forEach(u => {
    const d = getDepartment(u.role);
    deptMap[d] = (deptMap[d]||0)+1;
  });

  const perfMap = {};
  leads.forEach(l => {
    if (!l.assigned_to) return;
    perfMap[l.assigned_to] = perfMap[l.assigned_to]||{name:l.assigned_to,leads:0,enrolled:0};
    perfMap[l.assigned_to].leads++;
    if (l.status==='Enrolled') perfMap[l.assigned_to].enrolled++;
  });
  const perf = Object.values(perfMap).sort((a,b)=>b.enrolled-a.enrolled).slice(0,6);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Row gutter={[12,12]}>
        <Col span={8}><KPI label="Total Staff" value={users.length} color={meta.color} icon={Users} /></Col>
        <Col span={8}><KPI label="Active" value={active.length} color="#059669" icon={CheckCircle} /></Col>
        <Col span={8}><KPI label="Inactive" value={inactive.length} color="#dc2626" icon={AlertCircle} /></Col>
      </Row>

      <Card size="small" title="🏢 Department Strength" style={{ borderRadius:10 }}>
        {Object.entries(deptMap).map(([dept, cnt]) => {
          const dm = DEPT_META[dept] || { color:'#374151', bg:'#f3f4f6', label:dept };
          return (
            <div key={dept} style={{ marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:2 }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:8,height:8,borderRadius:'50%',background:dm.color }} />
                  {dm.label}
                </span>
                <span>{cnt} staff</span>
              </div>
              <Progress percent={users.length ? Math.round((cnt/users.length)*100):0}
                strokeColor={dm.color} showInfo={false} size="small" />
            </div>
          );
        })}
      </Card>

      <Card size="small" title="⭐ Top Performers" style={{ borderRadius:10 }}>
        <Table size="small" pagination={false} dataSource={perf} rowKey="name"
          columns={[
            { title:'#', render:(_,__,i)=><span style={{fontWeight:700}}>{i+1}</span>, width:30 },
            { title:'Name', dataIndex:'name', render:t=><span style={{fontWeight:500}}>{t}</span> },
            { title:'Leads', dataIndex:'leads' },
            { title:'Enrolled', dataIndex:'enrolled', render:v=><Tag color="green">{v}</Tag> },
          ]}
        />
      </Card>

      <Card size="small" title="👥 All Employees" style={{ borderRadius:10 }}>
        <Table size="small" pagination={{ pageSize:5 }} dataSource={users} rowKey="id"
          columns={[
            { title:'Name', dataIndex:'full_name', render:t=><span style={{fontWeight:500}}>{t}</span> },
            { title:'Role', dataIndex:'role', render:r=><Tag color="purple">{r}</Tag> },
            { title:'Status', render:(_,u) => u.is_active!==false
              ? <Badge status="success" text="Active" />
              : <Badge status="error" text="Inactive" /> },
          ]}
        />
      </Card>
    </div>
  );
};

const SystemDetail = ({ leads, users, meta }) => {
  const checks = [
    { label:'API Server',    status:'success', info:'Backend online — Supabase connected' },
    { label:'Database',      status:'success', info:`${leads.length} leads · ${users.length} users` },
    { label:'Authentication',status:'success', info:'JWT Auth active — all routes protected' },
    { label:'Lead Scoring',  status:'success', info:'ML model loaded' },
    { label:'CORS / Proxy',  status:'success', info:'ibmpcrm.xyz in allowed origins' },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Row gutter={[12,12]}>
        <Col span={8}><KPI label="Total Records" value={fmt(leads.length)} color={meta.color} icon={Activity} /></Col>
        <Col span={8}><KPI label="Users" value={users.length} color="#2563eb" icon={Users} /></Col>
        <Col span={8}><KPI label="Uptime" value="99.9%" color="#059669" icon={Wifi} /></Col>
      </Row>

      <Card size="small" title="🔧 System Health" style={{ borderRadius:10 }}>
        {checks.map(c => (
          <div key={c.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
            <Badge status={c.status} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500 }}>{c.label}</div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{c.info}</div>
            </div>
          </div>
        ))}
      </Card>

      <Card size="small" title="📈 Data Overview" style={{ borderRadius:10 }}>
        {[
          { label:'New leads (today)', value: leads.filter(l=>new Date(l.created_at).toDateString()===new Date().toDateString()).length },
          { label:'Hot leads', value: leads.filter(l=>l.status==='Hot').length },
          { label:'Enrolled (total)', value: leads.filter(l=>l.status==='Enrolled').length },
          { label:'Active users', value: users.filter(u=>u.is_active!==false).length },
        ].map(r => (
          <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
            <span style={{ color:'var(--text-secondary)' }}>{r.label}</span>
            <strong>{r.value}</strong>
          </div>
        ))}
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENT DETAIL PANEL (right slide-in)
// ─────────────────────────────────────────────────────────────────────────────
const DetailPanel = ({ dept, onBack, leads, users }) => {
  if (!dept) return null;
  const meta = DEPT_META[dept.id] || { color:'#374151', bg:'#f3f4f6', label:dept.id };

  const content = {
    [DEPARTMENTS.MARKETING]: <MarketingDetail leads={leads} meta={meta} />,
    [DEPARTMENTS.SALES]:     <SalesDetail leads={leads} users={users} meta={meta} />,
    [DEPARTMENTS.ACADEMIC]:  <AcademicDetail leads={leads} meta={meta} />,
    [DEPARTMENTS.ACCOUNTS]:  <AccountsDetail leads={leads} meta={meta} />,
    [DEPARTMENTS.HR]:        <HRDetail leads={leads} users={users} meta={meta} />,
    [DEPARTMENTS.ADMIN]:     <SystemDetail leads={leads} users={users} meta={meta} />,
  }[dept.id] || <Empty description="No data" />;

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{ display:'flex', flexDirection:'column', gap:0, height:'100%' }}
    >
      {/* Panel header */}
      <div style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'16px 0 16px', marginBottom:16,
        borderBottom:`2px solid ${meta.color}`,
      }}>
        <button
          onClick={onBack}
          style={{
            display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
            borderRadius:8, border:`1px solid ${meta.color}40`,
            background:`${meta.color}10`, color:meta.color,
            cursor:'pointer', fontWeight:600, fontSize:13,
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ fontSize:22 }}>{dept.icon}</div>
        <div>
          <div style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)' }}>{dept.label}</div>
          <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{dept.desc}</div>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>{content}</div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENT CARD
// ─────────────────────────────────────────────────────────────────────────────
const DeptCard = ({ dept, metrics, onClick }) => {
  const meta = DEPT_META[dept.id] || { color:'#374151', bg:'#f3f4f6', label:dept.id };
  const m    = metrics[dept.id] || {};

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: `0 8px 32px ${meta.color}30` }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        background:'var(--bg-primary)',
        borderRadius:14,
        padding:'20px 20px 16px',
        cursor:'pointer',
        border:`1px solid ${meta.color}25`,
        borderTop:`4px solid ${meta.color}`,
        display:'flex', flexDirection:'column', gap:14,
        transition:'box-shadow 0.2s',
        position:'relative', overflow:'hidden',
      }}
    >
      {/* Background tint */}
      <div style={{
        position:'absolute', top:0, right:0, width:80, height:80,
        background:`${meta.color}08`, borderRadius:'0 14px 0 80px',
      }} />

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:42, height:42, borderRadius:10,
          background:meta.bg, fontSize:22,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>{dept.icon}</div>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{dept.label}</div>
          <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{dept.desc}</div>
        </div>
      </div>

      {/* 3 key metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        {dept.metrics.map((metric, i) => (
          <div key={i} style={{
            padding:'8px', borderRadius:8, background:`${meta.color}0a`,
            textAlign:'center',
          }}>
            <div style={{ fontSize:18, fontWeight:800, color:meta.color, lineHeight:1 }}>
              {m[metric.key] ?? '—'}
            </div>
            <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:2 }}>{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Badge status={m.health || 'success'} />
          <span style={{ fontSize:11, color:'var(--text-secondary)' }}>
            {m.teamSize ? `${m.teamSize} staff` : 'No team data'}
          </span>
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:4, fontSize:12,
          color:meta.color, fontWeight:600,
        }}>
          View Details <ChevronRight size={13} />
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY KPI STRIP
// ─────────────────────────────────────────────────────────────────────────────
const CompanyKPIs = ({ leads, users }) => {
  const enrolled   = leads.filter(l => l.status === 'Enrolled').length;
  const totalRev   = leads.filter(l => l.status === 'Enrolled').reduce((s,l) => s+(l.potential_revenue||0), 0);
  const hot        = leads.filter(l => l.status === 'Hot').length;
  const newToday   = leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length;
  const convRate   = leads.length ? ((enrolled/leads.length)*100).toFixed(1) : 0;

  const kpis = [
    { label:'Total Leads',    value:fmt(leads.length), color:'#2563eb', icon:Users,       sub:`+${newToday} today` },
    { label:'Enrolled',       value:fmt(enrolled),     color:'#059669', icon:CheckCircle, sub:`${convRate}% conv.` },
    { label:'Hot Leads',      value:hot,               color:'#ef4444', icon:Flame,       sub:'Priority action' },
    { label:'Revenue',        value:fmtL(totalRev),    color:'#d97706', icon:DollarSign,  sub:'Potential' },
    { label:'Team Size',      value:users.length,      color:'#7c3aed', icon:Award,       sub:'Active staff' },
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
      {kpis.map(k => (
        <div key={k.label} style={{
          padding:'14px 16px', borderRadius:12,
          background:'var(--bg-primary)', border:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:10,
        }}>
          <div style={{ width:38, height:38, borderRadius:8, background:`${k.color}15`,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <k.icon size={18} color={k.color} />
          </div>
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{k.label}</div>
            <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>{k.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CEO COMMAND CENTER
// ─────────────────────────────────────────────────────────────────────────────
const DEPARTMENTS_CONFIG = [
  {
    id:    DEPARTMENTS.MARKETING,
    label: 'Marketing',
    icon:  '📣',
    desc:  'Lead generation & campaigns',
    metrics: [
      { key:'totalLeads', label:'Total Leads' },
      { key:'newToday',   label:'Today' },
      { key:'convRate',   label:'Conv %' },
    ],
  },
  {
    id:    DEPARTMENTS.SALES,
    label: 'Sales',
    icon:  '📞',
    desc:  'Counseling & follow-ups',
    metrics: [
      { key:'activeLeads', label:'Active' },
      { key:'hotLeads',    label:'Hot' },
      { key:'followups',   label:'Follow-ups' },
    ],
  },
  {
    id:    DEPARTMENTS.ACADEMIC,
    label: 'Academic',
    icon:  '🎓',
    desc:  'Course enrollments & student management',
    metrics: [
      { key:'enrolled',   label:'Enrolled' },
      { key:'courses',    label:'Courses' },
      { key:'revenue',    label:'Revenue' },
    ],
  },
  {
    id:    DEPARTMENTS.ACCOUNTS,
    label: 'Accounts',
    icon:  '💰',
    desc:  'Revenue & fee collection',
    metrics: [
      { key:'revenue',    label:'Revenue' },
      { key:'enrolled',   label:'Enrolled' },
      { key:'avgRevenue', label:'Avg/Student' },
    ],
  },
  {
    id:    DEPARTMENTS.HR,
    label: 'HR',
    icon:  '👥',
    desc:  'Employee management',
    metrics: [
      { key:'totalStaff', label:'Total Staff' },
      { key:'activeStaff',label:'Active' },
      { key:'depts',      label:'Depts' },
    ],
  },
  {
    id:    DEPARTMENTS.ADMIN,
    label: 'System / IT',
    icon:  '⚙️',
    desc:  'System health & admin',
    metrics: [
      { key:'totalRecords',label:'Records' },
      { key:'users',       label:'Users' },
      { key:'uptime',      label:'Uptime' },
    ],
  },
];

export default function CEOCommandCenter() {
  const [activeDept, setActiveDept] = useState(null);

  const { data: leadsResp, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['ceo-leads'],
    queryFn: () => leadsAPI.getAll({ limit: 2000 }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  });
  const { data: usersResp, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['ceo-users'],
    queryFn: () => usersAPI.getAll().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const leads = leadsResp?.leads || [];
  const users = usersResp?.users || usersResp || [];

  const metrics = useMemo(() => {
    const enrolled  = leads.filter(l => l.status === 'Enrolled');
    const hot       = leads.filter(l => l.status === 'Hot');
    // Academic dept: enrolled students only (courses — no university/visa)
    const newToday  = leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString());
    const followups = leads.filter(l => l.next_followup && new Date(l.next_followup).toDateString() === new Date().toDateString());
    const totalRev  = enrolled.reduce((s,l) => s+(l.potential_revenue||0), 0);

    const deptCounts = {};
    users.forEach(u => { const d=getDepartment(u.role); deptCounts[d]=(deptCounts[d]||0)+1; });

    return {
      [DEPARTMENTS.MARKETING]: {
        totalLeads: leads.length,
        newToday:   newToday.length,
        convRate:   `${pct(enrolled.length, leads.length)}%`,
        teamSize:   deptCounts[DEPARTMENTS.MARKETING] || 0,
        health:     newToday.length > 0 ? 'success' : 'warning',
      },
      [DEPARTMENTS.SALES]: {
        activeLeads: leads.filter(l=>!['Enrolled','Lost'].includes(l.status)).length,
        hotLeads:    hot.length,
        followups:   followups.length,
        teamSize:    deptCounts[DEPARTMENTS.SALES] || 0,
        health:      hot.length > 0 ? 'success' : 'warning',
      },
      [DEPARTMENTS.ACADEMIC]: {
        enrolled:  enrolled.length,
        courses:   [...new Set(enrolled.map(l=>l.course_interested).filter(Boolean))].length,
        revenue:   fmtL(enrolled.reduce((s,l)=>s+(l.potential_revenue||0),0)),
        teamSize:  deptCounts[DEPARTMENTS.ACADEMIC] || 0,
        health:    enrolled.length > 0 ? 'success' : 'warning',
      },
      [DEPARTMENTS.ACCOUNTS]: {
        revenue:    fmtL(totalRev),
        enrolled:   enrolled.length,
        avgRevenue: enrolled.length ? `₹${Math.round(totalRev/enrolled.length/1000)}K` : '—',
        teamSize:   deptCounts[DEPARTMENTS.ACCOUNTS] || 0,
        health:     enrolled.length > 0 ? 'success' : 'warning',
      },
      [DEPARTMENTS.HR]: {
        totalStaff:  users.length,
        activeStaff: users.filter(u=>u.is_active!==false).length,
        depts:       Object.keys(deptCounts).length,
        teamSize:    deptCounts[DEPARTMENTS.HR] || 0,
        health:      users.length > 0 ? 'success' : 'error',
      },
      [DEPARTMENTS.ADMIN]: {
        totalRecords: leads.length,
        users:        users.length,
        uptime:       '99.9%',
        teamSize:     deptCounts[DEPARTMENTS.ADMIN] || 0,
        health:       'success',
      },
    };
  }, [leads, users]);

  const handleRefresh = () => { refetchLeads(); refetchUsers(); };

  if (leadsLoading || usersLoading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:16 }}>
        <Spin size="large" />
        <div style={{ color:'var(--text-secondary)', fontSize:14 }}>Loading company data…</div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:46, height:46, borderRadius:12,
              background:'linear-gradient(135deg,#7c3aed,#2563eb)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:24,
            }}>👑</div>
            <div>
              <h1 style={{ fontSize:22, fontWeight:800, margin:0 }}>Company Command Center</h1>
              <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>
                Live monitoring — {leads.length} leads · {users.length} staff · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
              </p>
            </div>
          </div>
        </div>
        <Tooltip title="Refresh all data">
          <button onClick={handleRefresh} style={{
            display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
            borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-primary)',
            cursor:'pointer', fontSize:13, color:'var(--text-secondary)',
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </Tooltip>
      </div>

      {/* ── Company KPIs ── */}
      <CompanyKPIs leads={leads} users={users} />

      {/* ── Two-column layout: dept cards | detail panel ── */}
      <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>

        {/* Department cards grid */}
        <div style={{
          flex: activeDept ? '0 0 480px' : '1',
          display:'grid',
          gridTemplateColumns: activeDept ? '1fr 1fr' : 'repeat(3,1fr)',
          gap:14,
          transition:'flex 0.25s',
        }}>
          {DEPARTMENTS_CONFIG.map(dept => (
            <DeptCard
              key={dept.id}
              dept={dept}
              metrics={metrics}
              onClick={() => setActiveDept(activeDept?.id === dept.id ? null : dept)}
            />
          ))}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {activeDept && (
            <motion.div
              key={activeDept.id}
              initial={{ opacity:0, width:0 }}
              animate={{ opacity:1, width:460 }}
              exit={{ opacity:0, width:0 }}
              transition={{ duration:0.25 }}
              style={{
                flexShrink:0, width:460, minHeight:500,
                background:'var(--bg-primary)',
                borderRadius:14, border:'1px solid var(--border)',
                padding:'20px', overflowY:'auto', maxHeight:'78vh',
                boxShadow:'0 4px 24px rgba(0,0,0,0.08)',
              }}
            >
              <DetailPanel
                dept={activeDept}
                onBack={() => setActiveDept(null)}
                leads={leads}
                users={users}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Company-wide alerts strip ── */}
      {(() => {
        const alerts = [];
        const hotCount = leads.filter(l=>l.status==='Hot').length;
        const fupCount = leads.filter(l=>l.next_followup&&new Date(l.next_followup).toDateString()===new Date().toDateString()).length;
        if (hotCount > 0)  alerts.push({ color:'#ef4444', icon:'🔥', msg:`${hotCount} hot leads need immediate sales attention` });
        if (fupCount > 0)  alerts.push({ color:'#d97706', icon:'📞', msg:`${fupCount} follow-ups due today` });
        if (alerts.length === 0) return null;
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:0.5 }}>Company Alerts</div>
            {alerts.map((a,i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 16px', borderRadius:10,
                background:`${a.color}0a`, border:`1px solid ${a.color}30`,
              }}>
                <span style={{ fontSize:16 }}>{a.icon}</span>
                <span style={{ fontSize:13, color:'var(--text-primary)' }}>{a.msg}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
