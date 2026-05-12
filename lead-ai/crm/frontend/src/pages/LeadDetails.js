import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Row,
  Col,
  Descriptions,
  Tag,
  Button,
  Input,
  Select,
  AutoComplete,
  Form,
  message,
  Timeline,
  Progress,
  Space,
  Modal,
  DatePicker,
  Divider,
  Alert,
  Badge,
  Statistic,
  InputNumber,
} from 'antd';
import {
  ArrowLeftOutlined,
  WhatsAppOutlined,
  MailOutlined,
  PhoneOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  WarningOutlined,
  FireOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { leadsAPI, coursesAPI, counselorsAPI, usersAPI } from '../api/api';
import { COUNTRIES } from '../config/countries';

const SOURCE_OPTIONS = ['Website', 'Instagram', 'Facebook', 'Referral', 'WhatsApp'];

// Call disposition map.  Keys are the "main" call status; values are arrays of
// sub-statuses for that main status, split by call number (1st vs 2nd call).
const CALL_DISPOSITIONS = {
  'Not Connected (No answer / Switched off / Not Reachable / Busy)': {
    first:  ['Need second call'],
    second: ['Ask me to call evening'],
  },
  'Call Back Requested': {
    first:  ['Time option', 'Need Details', 'Fee Discussion Pending', 'Demo Requested', 'Comparing Price', 'Family approval pending'],
    second: ['Ask me to call tomorrow', 'Spoke to student, details sent, need follow up', 'Fee is High will think and get back', 'Negotiation in progress', 'Comparing with competitors', 'Will discuss with family and get back'],
  },
  'Interested': {
    first:  ['Will Enroll Soon', 'Not Decided', 'After Exams', 'Just Inquiry', 'Financial Issue', 'Discuss with family', 'After Relocation'],
    second: ['Will enroll soon', 'Not yet decided', 'Will plan next year', 'Preparing for PG Neet', 'Busy in exams, will plan later', 'Interested will enroll shortly', 'Looking for different course, we do not have'],
  },
  'Future Prospect': {
    first:  ['After Job Switch', 'Not Relevant / Course Not Suitable', 'Wrong Expectation from Course', 'Other Academy'],
    second: ['Not Interested', 'Do not disturb', 'Looking for only clinical training', 'Looking for only online course'],
  },
  'Not Interested': {
    first:  ['Price Issue'],
    second: ['Waiting for funds'],
  },
  'Spam': {
    first:  ['Other Field / No Health Care / Invalid Number'],
    second: ['Dropped the plan'],
  },
};

import dayjs from 'dayjs';

// Safely parse a server date string as UTC.
// Supabase may return "2026-04-30T07:00:00" (no Z) which dayjs would wrongly
// treat as local time. Appending Z ensures correct UTC→local conversion.
const parseDate = (s) => {
  if (!s) return null;
  const str = String(s);
  const hasOffset = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str);
  return dayjs(hasOffset ? str : str + 'Z');
};

import ActivityTimeline from '../features/activity/ActivityTimeline';
import LeadTimeline from '../components/LeadTimeline';
import CallTimeWidget from '../components/leads/CallTimeWidget';
import WhatsAppTemplateDrawer from '../components/whatsapp/WhatsAppTemplateDrawer';
import { isFeatureEnabled } from '../config/featureFlags';

const { TextArea } = Input;
const { Option } = Select;

const LeadDetails = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteForm] = Form.useForm();
  const [leadForm] = Form.useForm();
  const [lossForm] = Form.useForm();
  const [emailModal, setEmailModal] = useState(false);
  const [whatsappModal, setWhatsappModal] = useState(false);
  const [templateDrawer, setTemplateDrawer] = useState(false);
  const [lossModal, setLossModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRevField, setEditingRevField] = useState(null); // 'expected' | 'actual' | null
  const [revInputVal, setRevInputVal]         = useState(null);

  // Call-note state
  const [noteType, setNoteType]             = useState('manual');  // 'manual' | 'call'
  const [callNumber, setCallNumber]         = useState(null);      // '1st' | '2nd' | '3rd' ...
  const [callMainStatus, setCallMainStatus] = useState(null);
  const [callSubStatus, setCallSubStatus]   = useState(null);

  // Fetch lead details
  const { data: lead, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => leadsAPI.getById(leadId).then(res => res.data),
    refetchOnMount: 'always', // Always fetch fresh data when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    staleTime: 0, // Consider data stale immediately
    retry: 1, // Only retry once on failure
  });

  // Update form when lead data changes
  React.useEffect(() => {
    if (lead) {
      leadForm.setFieldsValue({
        full_name:        lead.full_name,
        email:            lead.email || '',
        phone:            lead.phone,
        whatsapp:         lead.whatsapp || lead.phone,
        country:          lead.country,
        source:           lead.source,
        course_interested: lead.course_interested,
        qualification:    lead.qualification || null,
        company:          lead.company || null,
        status:           lead.status,
        follow_up_date:   lead.follow_up_date ? parseDate(lead.follow_up_date) : null,
        assigned_to:      lead.assigned_to,
        expected_revenue: lead.expected_revenue ?? null,
        actual_revenue:   lead.actual_revenue   ?? null,
        utm_source:       lead.utm_source   || null,
        utm_medium:       lead.utm_medium   || null,
        utm_campaign:     lead.utm_campaign || null,
      });
    }
  }, [lead, leadForm]);

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesAPI.getAll().then(res => Array.isArray(res.data) ? res.data : [])
  });

  const { data: counselors } = useQuery({
    queryKey: ['counselors'],
    queryFn: () => counselorsAPI.getAll().then(res => Array.isArray(res.data) ? res.data : [])
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { try { return (await usersAPI.getAll()).data; } catch { return { users: [] }; } },
    staleTime: 5 * 60 * 1000,
  });
  const allUsers = Array.isArray(usersData) ? usersData : (usersData?.users || []);

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: (data) => leadsAPI.update(leadId, data),
    onSuccess: () => {
      message.success('Lead updated successfully!');
      setIsEditing(false);
      // Invalidate and refetch to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] }); // Invalidate leads list
      refetch();
    },
    onError: (error) => {
      message.error(`Failed to update lead: ${error.message}`);
    },
  });

  // Handle form submission
  const handleSaveChanges = (values) => {
    // Check if status changed to loss status
    const statusChanged = values.status !== lead.status;
    const isLossStatus = values.status === 'Not Interested' || values.status === 'Junk';
    
    if (statusChanged && isLossStatus) {
      setPendingStatus(values.status);
      setLossModal(true);
      return;
    }
    
    // Convert DatePicker value to ISO string and numeric fields to numbers
    const updateData = {
      ...values,
      qualification:    values.qualification    || null,
      company:          values.company          || null,
      follow_up_date:   values.follow_up_date   ? values.follow_up_date.toISOString() : null,
      expected_revenue: values.expected_revenue != null ? Number(values.expected_revenue) : null,
      actual_revenue:   values.actual_revenue   != null ? Number(values.actual_revenue)   : null,
    };
    updateLeadMutation.mutate(updateData);
  };

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: (data) => leadsAPI.addNote(leadId, data),
    onSuccess: () => {
      message.success('Note added successfully!');
      noteForm.resetFields();
      setNoteType('manual');
      setCallNumber(null);
      setCallMainStatus(null);
      setCallSubStatus(null);
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      refetch();
    },
    onError: (error) => {
      message.error(`Failed to add note: ${error.message}`);
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: () => leadsAPI.delete(leadId),
    onSuccess: () => {
      message.success('Lead deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      navigate('/leads');
    },
    onError: (e) => {
      const detail = e.response?.data?.detail;
      message.error(`Delete failed: ${detail || e.message || 'Unknown error'}`);
    },
  });

  const handleDeleteLead = () => {
    Modal.confirm({
      title: 'Delete this lead?',
      content: `"${lead?.full_name}" and all associated notes, activities and chat history will be permanently removed. This cannot be undone.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => deleteLeadMutation.mutate(),
    });
  };

  const handleAddNote = (values) => {
    let content = values.content || '';
    let channel = values.channel || 'manual';

    if (noteType === 'call') {
      channel = 'call';
      const label = callNumber ? `${callNumber} Call` : 'Call';
      const parts = [`[${label}]`];
      if (callMainStatus) parts.push(callMainStatus);
      if (callSubStatus)  parts.push(`→ ${callSubStatus}`);
      const header = parts.join(' | ');
      content = content ? `${header}\n${content}` : header;
    }

    if (!content.trim()) {
      message.warning('Please fill in the call details or enter a note.');
      return;
    }

    addNoteMutation.mutate({ content, channel });
  };

  const handleLossSubmit = () => {
    lossForm.validateFields().then(values => {
      const formValues = leadForm.getFieldsValue();
      updateLeadMutation.mutate({
        status: pendingStatus,
        loss_reason: values.loss_reason,
        loss_note: values.loss_note || '',
        course_interested: formValues.course_interested,
        follow_up_date: formValues.follow_up_date ? formValues.follow_up_date.toISOString() : null,
        assigned_to: formValues.assigned_to,
      });
      setLossModal(false);
      lossForm.resetFields();
      setPendingStatus(null);
    });
  };

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading lead details...</div>;
  }

  if (isError || !lead) {
    const errMsg = error?.response?.status === 404
      ? 'Lead not found. It may have been deleted.'
      : `Failed to load lead: ${error?.message || 'Unknown error'}`;
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#ff4d4f', marginBottom: '16px' }}>{errMsg}</p>
        <button onClick={() => navigate('/leads')} style={{ marginRight: '8px' }}>← Back to Leads</button>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/leads')}
          >
            Back
          </Button>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
              {lead?.full_name}
            </h1>
            <div style={{ color: '#8c8c8c', marginTop: '4px' }}>
              {lead?.lead_id} • Created {parseDate(lead?.created_at)?.format('MMM DD, YYYY')}
            </div>
          </div>
        </div>

        <Space>
          <Button
            icon={<PhoneOutlined />}
            href={`tel:${lead?.phone}`}
          >
            Call
          </Button>
          <Button.Group>
            <Button
              icon={<WhatsAppOutlined />}
              style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
              onClick={() => setWhatsappModal(true)}
            >
              WhatsApp
            </Button>
            <Button
              style={{
                background: '#1ebe57', borderColor: '#1ebe57', color: '#fff',
                borderLeft: '1px solid rgba(255,255,255,0.35)',
              }}
              onClick={() => setTemplateDrawer(true)}
              title="Template library"
            >
              📋
            </Button>
          </Button.Group>
          <Button
            icon={<MailOutlined />}
            type="primary"
            onClick={() => setEmailModal(true)}
          >
            Email
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            loading={deleteLeadMutation.isPending}
            onClick={handleDeleteLead}
          >
            Delete
          </Button>
        </Space>
      </div>

      {/* AI Insights Alert */}
      {lead?.next_action && (
        <Alert
          message={<span><ThunderboltOutlined /> AI Recommendation</span>}
          description={
            <div>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>{lead.next_action}</div>
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                Priority: {lead.priority_level} • Follow up: {lead.follow_up_date ? parseDate(lead.follow_up_date).format('MMM DD, hh:mm A') : 'Not set'}
              </div>
            </div>
          }
          type={
            lead.ai_segment === 'Hot' ? 'error' :
            lead.ai_segment === 'Warm' ? 'warning' : 'info'
          }
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      <Row gutter={[24, 24]}>
        {/* Left Column */}
        <Col xs={24} lg={16}>
          {/* Lead Information */}
          <Card 
            title="Lead Information"
            extra={
              <Space>
                {!isEditing ? (
                  <Button type="primary" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => {
                      setIsEditing(false);
                      leadForm.setFieldsValue({
                        full_name:        lead.full_name,
                        email:            lead.email || '',
                        phone:            lead.phone,
                        whatsapp:         lead.whatsapp || lead.phone,
                        country:          lead.country,
                        source:           lead.source,
                        course_interested: lead.course_interested,
                        qualification:    lead.qualification || null,
                        company:          lead.company || null,
                        status:           lead.status,
                        follow_up_date:   lead.follow_up_date ? parseDate(lead.follow_up_date) : null,
                        assigned_to:      lead.assigned_to,
                        expected_revenue: lead.expected_revenue ?? null,
                        actual_revenue:   lead.actual_revenue   ?? null,
                        utm_source:       lead.utm_source   || null,
                        utm_medium:       lead.utm_medium   || null,
                        utm_campaign:     lead.utm_campaign || null,
                      });
                    }}>
                      Cancel
                    </Button>
                    <Button 
                      type="primary" 
                      icon={<SaveOutlined />}
                      loading={updateLeadMutation.isPending}
                      onClick={() => leadForm.submit()}
                    >
                      Save
                    </Button>
                  </>
                )}
              </Space>
            }
            style={{ marginBottom: '24px' }}
          >
            <Form form={leadForm} onFinish={handleSaveChanges} layout="vertical">
              <Descriptions column={2} bordered>
                <Descriptions.Item label="Full Name">
                  {!isEditing ? (
                    <span style={{ fontWeight: 500 }}>{lead?.full_name}</span>
                  ) : (
                    <Form.Item name="full_name" noStyle rules={[{ required: true, message: 'Name is required' }]}>
                      <Input placeholder="Full name" />
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {!isEditing ? (
                    <span>{lead?.email || '-'}</span>
                  ) : (
                    <Form.Item name="email" noStyle>
                      <Input placeholder="Email address" />
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Phone">
                  {!isEditing ? (
                    <span>{lead?.phone}</span>
                  ) : (
                    <Form.Item name="phone" noStyle rules={[{ required: true, message: 'Phone is required' }]}>
                      <Input placeholder="+91 9876543210" />
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="WhatsApp">
                  {!isEditing ? (
                    <span>{lead?.whatsapp || lead?.phone}</span>
                  ) : (
                    <Form.Item name="whatsapp" noStyle>
                      <Input placeholder="WhatsApp number" />
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Country">
                  {!isEditing ? (
                    <Tag color="blue">{lead?.country}</Tag>
                  ) : (
                    <Form.Item name="country" noStyle>
                      <AutoComplete
                        placeholder="Search country…"
                        allowClear
                        style={{ width: '100%' }}
                        filterOption={(input, option) =>
                          option.value.toLowerCase().includes(input.toLowerCase())
                        }
                        options={COUNTRIES.map(c => ({ value: c, label: c }))}
                      />
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Source">
                  {!isEditing ? (
                    <Tag>{lead?.source}</Tag>
                  ) : (
                    <Form.Item name="source" noStyle>
                      <Select style={{ width: '100%' }} allowClear placeholder="Select source">
                        {SOURCE_OPTIONS.map(s => <Option key={s} value={s}>{s}</Option>)}
                      </Select>
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Qualification">
                  {!isEditing ? (
                    lead?.qualification
                      ? <Tag color="geekblue">{lead.qualification}</Tag>
                      : <span style={{ color: '#8c8c8c' }}>—</span>
                  ) : (
                    <Form.Item name="qualification" noStyle>
                      <Select style={{ width: '100%' }} allowClear placeholder="Select qualification">
                        {[
                          'MBBS','MD','MS','DNB','MDS','BDS','BAMS','BHMS',
                          'BPT','MPT','BUMS','BNYS','BSc Nursing','MSc Nursing',
                          'B.Pharm','M.Pharm','Pharm.D','DMLT','BMLT',
                          'BOT','MOT','BSc MLT','MSc MLT','Other',
                        ].map(q => <Option key={q} value={q}>{q}</Option>)}
                      </Select>
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Company">
                  {!isEditing ? (
                    lead?.company
                      ? <Tag color={lead.company === 'IBMP' ? 'blue' : 'purple'}>{lead.company}</Tag>
                      : <span style={{ color: '#8c8c8c' }}>—</span>
                  ) : (
                    <Form.Item name="company" noStyle>
                      <Select style={{ width: '100%' }} allowClear placeholder="Select company">
                        <Option value="IBMP">IBMP</Option>
                        <Option value="DMHCA">DMHCA</Option>
                      </Select>
                    </Form.Item>
                  )}
                </Descriptions.Item>
                {/* Campaign Attribution — UTM fields */}
                <Descriptions.Item label="UTM Source">
                  {!isEditing ? (
                    lead?.utm_source ? <Tag color="geekblue">{lead.utm_source}</Tag> : <span style={{ color: '#8c8c8c' }}>—</span>
                  ) : (
                    <Form.Item name="utm_source" noStyle>
                      <Input placeholder="e.g. google, facebook" style={{ width: '100%' }} />
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="UTM Medium">
                  {!isEditing ? (
                    lead?.utm_medium ? <Tag>{lead.utm_medium}</Tag> : <span style={{ color: '#8c8c8c' }}>—</span>
                  ) : (
                    <Form.Item name="utm_medium" noStyle>
                      <Input placeholder="e.g. cpc, organic" style={{ width: '100%' }} />
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="UTM Campaign" span={2}>
                  {!isEditing ? (
                    lead?.utm_campaign ? <Tag color="purple">{lead.utm_campaign}</Tag> : <span style={{ color: '#8c8c8c' }}>—</span>
                  ) : (
                    <Form.Item name="utm_campaign" noStyle>
                      <Input placeholder="e.g. mbbs_jan26" style={{ width: '100%' }} />
                    </Form.Item>
                  )}
                </Descriptions.Item>

                <Descriptions.Item label="Course Interested" span={2}>
                  {!isEditing ? (
                    <span>{lead?.course_interested}</span>
                  ) : (
                    <Form.Item name="course_interested" noStyle>
                      <Select style={{ width: '100%' }}>
                        {courses?.map(course => (
                          <Option key={course.id} value={course.course_name}>
                            {course.course_name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  {!isEditing ? (
                    <Tag color={
                      lead?.status === 'Enrolled' ? 'green' :
                      lead?.status === 'Hot' ? 'red' :
                      lead?.status === 'Warm' ? 'orange' :
                      lead?.status === 'Not Interested' ? 'red' :
                      lead?.status === 'Junk' ? 'red' : 'blue'
                    }>
                      {lead?.status}
                    </Tag>
                  ) : (
                    <Form.Item name="status" noStyle>
                      <Select style={{ width: '100%' }}>
                        <Option value="Fresh">Fresh</Option>
                        <Option value="Follow Up">Follow Up</Option>
                        <Option value="Warm">Warm</Option>
                        <Option value="Hot">Hot</Option>
                        <Option value="Not Interested">Not Interested</Option>
                        <Option value="Junk">Junk</Option>
                        <Option value="Not Answering">Not Answering</Option>
                        <Option value="Enrolled">Enrolled</Option>
                      </Select>
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Follow-up Date">
                  {!isEditing ? (
                    <span>
                      {lead?.follow_up_date ? parseDate(lead.follow_up_date).format('MMM DD, YYYY hh:mm A') : '-'}
                    </span>
                  ) : (
                    <Form.Item name="follow_up_date" noStyle>
                      <DatePicker
                        showTime={{ format: 'hh:mm A', use12Hours: true }}
                        format="MMM DD, YYYY hh:mm A"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Assigned To" span={2}>
                  {!isEditing ? (
                    <span>{lead?.assigned_to || '-'}</span>
                  ) : (
                    <Form.Item name="assigned_to" noStyle>
                      <Select style={{ width: '100%' }} allowClear showSearch
                        filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                        options={allUsers.map(u => ({ label: `${u.full_name} (${u.role})`, value: u.full_name }))}
                        placeholder="Select counselor"
                      />
                    </Form.Item>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Form>
          </Card>

          {/* Notes Section */}
          <Card title="Notes & Communication History">
            <Form form={noteForm} onFinish={handleAddNote} layout="vertical">

              {/* ── Note type toggle ─────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { key: 'manual', label: '📝 Manual Note', color: '#1890ff' },
                  { key: 'call',   label: '📞 Call Note',   color: '#fa8c16' },
                ].map(({ key, label, color }) => (
                  <Button
                    key={key}
                    type={noteType === key ? 'primary' : 'default'}
                    style={noteType === key ? { background: color, borderColor: color } : {}}
                    onClick={() => {
                      setNoteType(key);
                      setCallNumber(null);
                      setCallMainStatus(null);
                      setCallSubStatus(null);
                      noteForm.resetFields(['content']);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {/* ── Call note flow (shown only when "Call Note" is selected) ── */}
              {noteType === 'call' && (
                <div style={{
                  background: '#fffbf0',
                  border: '1px solid #ffd591',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 14,
                }}>

                  {/* Step 1 — Which call? */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#874d00', marginBottom: 6 }}>
                      Step 1 — Which call is this?
                    </div>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Select call number (1st, 2nd, 3rd…)"
                      value={callNumber}
                      onChange={(v) => {
                        setCallNumber(v);
                        setCallMainStatus(null);
                        setCallSubStatus(null);
                      }}
                      options={[
                        '1st','2nd','3rd','4th','5th',
                        '6th','7th','8th','9th','10th',
                        '11th','12th','13th','14th','15th',
                      ].map(n => ({ label: `${n} Call`, value: n }))}
                    />
                  </div>

                  {/* Step 2 & 3 — Outcome + Sub-status (only for 1st and 2nd call) */}
                  {callNumber && (callNumber === '1st' || callNumber === '2nd') && (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#874d00', marginBottom: 6 }}>
                          Step 2 — Call outcome
                        </div>
                        <Select
                          style={{ width: '100%' }}
                          placeholder="Select call outcome…"
                          value={callMainStatus}
                          onChange={(v) => { setCallMainStatus(v); setCallSubStatus(null); }}
                          options={Object.keys(CALL_DISPOSITIONS).map(s => ({ label: s, value: s }))}
                        />
                      </div>

                      {callMainStatus && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#874d00', marginBottom: 6 }}>
                            Step 3 — Sub-status
                          </div>
                          <Select
                            style={{ width: '100%' }}
                            placeholder="Select sub-status…"
                            value={callSubStatus}
                            onChange={setCallSubStatus}
                            options={(
                              CALL_DISPOSITIONS[callMainStatus]?.[
                                callNumber === '1st' ? 'first' : 'second'
                              ] || []
                            ).map(s => ({ label: s, value: s }))}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Progress indicator */}
                  {callNumber && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                      {(callNumber === '1st' || callNumber === '2nd') ? (
                        // 3 steps for 1st and 2nd call
                        [
                          { done: !!callNumber,     label: 'Call #' },
                          { done: !!callMainStatus, label: 'Outcome' },
                          { done: !!callSubStatus,  label: 'Sub-status' },
                        ].map((s, i) => (
                          <span key={i} style={{
                            padding: '2px 10px', borderRadius: 12, fontSize: 11,
                            background: s.done ? '#52c41a20' : '#f0f0f0',
                            color:      s.done ? '#389e0d'   : '#8c8c8c',
                            border: `1px solid ${s.done ? '#b7eb8f' : '#d9d9d9'}`,
                            fontWeight: s.done ? 700 : 400,
                          }}>
                            {s.done ? '✓' : (i + 1)} {s.label}
                          </span>
                        ))
                      ) : (
                        // Only 1 step needed for 3rd call onwards
                        <span style={{
                          padding: '2px 10px', borderRadius: 12, fontSize: 11,
                          background: '#52c41a20', color: '#389e0d',
                          border: '1px solid #b7eb8f', fontWeight: 700,
                        }}>
                          ✓ {callNumber} Call selected — add your note below
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Free-text note ─────────────────────────────────────────── */}
              {/* 1st/2nd call: need outcome + sub-status first
                  3rd+ call: just call number is enough             */}
              {(noteType === 'manual' || (noteType === 'call' && callNumber && (
                (callNumber === '1st' || callNumber === '2nd')
                  ? (callMainStatus && callSubStatus)
                  : true
              ))) && (
                <>
                  <Form.Item
                    name="content"
                    rules={noteType === 'manual' ? [{ required: true, message: 'Please enter a note' }] : []}
                  >
                    <TextArea
                      rows={3}
                      placeholder={
                        noteType === 'manual'
                          ? 'Add note about conversation, objections, requirements…'
                          : 'Additional remarks about this call (optional)…'
                      }
                    />
                  </Form.Item>

                  {/* Channel (manual notes only) */}
                  {noteType === 'manual' && (
                    <Form.Item name="channel" style={{ marginBottom: 12 }}>
                      <Select placeholder="Channel" defaultValue="manual" style={{ width: '50%' }}>
                        <Option value="manual">Manual Note</Option>
                        <Option value="call">Phone Call</Option>
                        <Option value="whatsapp">WhatsApp</Option>
                        <Option value="email">Email</Option>
                      </Select>
                    </Form.Item>
                  )}

                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={addNoteMutation.isPending}
                    style={noteType === 'call' ? { background: '#fa8c16', borderColor: '#fa8c16' } : {}}
                  >
                    {noteType === 'manual'
                      ? 'Add Note'
                      : `Save ${callNumber} Call Note`}
                  </Button>
                </>
              )}

              {/* Prompt when call note not yet ready */}
              {noteType === 'call' && callNumber && (callNumber === '1st' || callNumber === '2nd') && (!callMainStatus || !callSubStatus) && (
                <div style={{
                  color: '#8c8c8c', fontSize: 13, marginTop: 4,
                  fontStyle: 'italic', padding: '4px 0',
                }}>
                  Complete outcome and sub-status to add your call note.
                </div>
              )}
              {noteType === 'call' && !callNumber && (
                <div style={{
                  color: '#8c8c8c', fontSize: 13, marginTop: 4,
                  fontStyle: 'italic', padding: '4px 0',
                }}>
                  Select which call number this is to continue.
                </div>
              )}
            </Form>

            <Divider />

            <Timeline style={{ marginTop: '24px' }}>
              {lead?.notes?.map((note) => {
                // Detect structured call notes: [Nth Call] | outcome | → sub
                const lines = (note.content || '').split('\n');
                const callMatch = lines[0]?.match(/^\[(\d*(?:1st|2nd|3rd|\d+th) Call)\]\s*\|?\s*(.*)/);
                const isCallNote = !!callMatch;
                const callLabel   = callMatch?.[1] || '';
                const callDetails = callMatch?.[2] || '';
                const extraText   = isCallNote ? lines.slice(1).join('\n').trim() : note.content;

                // Pick a colour per call number so each call looks distinct
                const CALL_COLORS = ['orange','green','purple','cyan','magenta','red','gold','lime','volcano','geekblue'];
                const callColorIdx = parseInt(callLabel) || (callLabel.startsWith('1') ? 0 : callLabel.startsWith('2') ? 1 : 2);
                const callTagColor = CALL_COLORS[(callColorIdx - 1) % CALL_COLORS.length] || 'orange';

                return (
                  <Timeline.Item
                    key={note.id}
                    color={
                      note.channel === 'whatsapp' ? 'green' :
                      note.channel === 'email'    ? 'blue'  :
                      note.channel === 'call'     ? 'orange': 'gray'
                    }
                  >
                    <div style={{ marginBottom: 6 }}>
                      {isCallNote ? (
                        <Tag color={callTagColor} style={{ fontWeight: 600 }}>
                          📞 {callLabel}
                        </Tag>
                      ) : (
                        <Tag color={
                          note.channel === 'whatsapp' ? 'green' :
                          note.channel === 'email'    ? 'blue'  :
                          note.channel === 'call'     ? 'orange': 'default'
                        }>
                          {note.channel}
                        </Tag>
                      )}
                      <span style={{ fontWeight: 600, marginLeft: 8 }}>{note.created_by}</span>
                      <span style={{ color: '#8c8c8c', marginLeft: 8, fontSize: 12 }}>
                        {parseDate(note.created_at)?.format('MMM DD, YYYY hh:mm A')}
                      </span>
                    </div>

                    {isCallNote && callDetails && (
                      <div style={{
                        background: callLabel === '1st Call' ? '#fff7e6' : '#f6ffed',
                        border: `1px solid ${callLabel === '1st Call' ? '#ffd591' : '#b7eb8f'}`,
                        borderRadius: 6,
                        padding: '6px 10px',
                        marginBottom: extraText ? 6 : 0,
                        fontSize: 13,
                        color: '#434343',
                      }}>
                        {callDetails}
                      </div>
                    )}
                    {extraText && (
                      <div style={{ whiteSpace: 'pre-wrap', color: '#595959' }}>{extraText}</div>
                    )}
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </Card>
        </Col>

        {/* Right Column - AI Insights */}
        <Col xs={24} lg={8}>
          {/* AI Score Card */}
          <Card
            title={<span><ThunderboltOutlined /> AI Lead Score</span>}
            style={{ marginBottom: '24px' }}
          >
            {/* Score circle + method badge */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Progress
                type="circle"
                percent={lead?.ai_score}
                strokeColor={
                  lead?.ai_score >= 75 ? '#ff4d4f' :
                  lead?.ai_score >= 50 ? '#faad14' :
                  lead?.ai_score >= 25 ? '#52c41a' : '#8c8c8c'
                }
                format={(percent) => (
                  <div>
                    <div style={{ fontSize: '32px', fontWeight: 600 }}>{percent?.toFixed(0)}</div>
                    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>AI Score</div>
                  </div>
                )}
              />
              {lead?.scoring_method && (
                <div style={{ marginTop: 8 }}>
                  <Tag color={lead.scoring_method === 'hybrid_ml' ? 'blue' : 'default'}>
                    {lead.scoring_method === 'hybrid_ml' ? '🤖 ML + Rules' : '📐 Rules Only'}
                  </Tag>
                  {lead?.confidence != null && (
                    <Tag color={lead.confidence >= 0.7 ? 'green' : lead.confidence >= 0.4 ? 'orange' : 'red'}>
                      {lead.confidence >= 0.7 ? 'High' : lead.confidence >= 0.4 ? 'Medium' : 'Low'} Confidence
                    </Tag>
                  )}
                </div>
              )}
            </div>

            {/* ML vs Rule score breakdown */}
            {(lead?.ml_score != null || lead?.rule_score != null) && (
              <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Score Breakdown</div>
                {lead?.ml_score != null && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span>ML Score (70%)</span><span style={{ fontWeight: 600 }}>{lead.ml_score?.toFixed(1)}</span>
                    </div>
                    <Progress percent={lead.ml_score} strokeColor="#1890ff" showInfo={false} size="small" />
                  </div>
                )}
                {lead?.rule_score != null && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span>Rule Score (30%)</span><span style={{ fontWeight: 600 }}>{lead.rule_score?.toFixed(1)}</span>
                    </div>
                    <Progress percent={lead.rule_score} strokeColor="#722ed1" showInfo={false} size="small" />
                  </div>
                )}
              </div>
            )}

            {/* Feature importance drivers */}
            {lead?.feature_importance && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Score Drivers</div>
                {Object.entries(lead.feature_importance)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, val]) => (
                    <div key={key} style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 1 }}>
                        <span style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                        <span style={{ fontWeight: 600 }}>{(val * 100).toFixed(0)}%</span>
                      </div>
                      <Progress percent={val * 100} strokeColor="#52c41a" showInfo={false} size="small" />
                    </div>
                  ))
                }
              </div>
            )}

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>Segment</div>
              <Badge
                color={
                  lead?.ai_segment === 'Hot' ? 'red' :
                  lead?.ai_segment === 'Warm' ? 'orange' :
                  lead?.ai_segment === 'Cold' ? 'green' : 'default'
                }
                text={<span style={{ fontSize: '16px', fontWeight: 600 }}>{lead?.ai_segment}</span>}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>Conversion Probability</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>
                {((lead?.conversion_probability || 0) * 100).toFixed(1)}%
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>Buying Signal Strength</div>
              <Progress
                percent={lead?.buying_signal_strength}
                strokeColor="#52c41a"
                format={(percent) => `${percent?.toFixed(0)}`}
              />
            </div>

            {lead?.primary_objection && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>Primary Objection</div>
                <Tag color="orange">{lead.primary_objection}</Tag>
              </div>
            )}

            {lead?.loss_reason && (
              <div style={{ marginBottom: '16px', background: '#fff2f0', padding: '10px 12px', borderRadius: 6, borderLeft: '3px solid #f5222d' }}>
                <div style={{ fontSize: '12px', color: '#f5222d', fontWeight: 600, marginBottom: 4 }}>Loss Reason</div>
                <Tag color="red">{lead.loss_reason}</Tag>
                {lead.loss_note && <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>{lead.loss_note}</div>}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>Churn Risk</div>
              <Progress
                percent={(lead?.churn_risk || 0) * 100}
                strokeColor="#ff4d4f"
                format={(percent) => `${percent?.toFixed(0)}%`}
              />
            </div>
          </Card>

          {/* Call Disposition Summary — shows latest note per call number */}
          {(() => {
            // Match any [Nth Call] format
            const CALL_RE = /^\[(\d*(?:1st|2nd|3rd|\d+th) Call)\]\s*\|?\s*(.*)/;
            const callNotes = (lead?.notes || []).filter(n => CALL_RE.test(n.content || ''));
            if (!callNotes.length) return null;

            // Group by call label, keep last note per group
            const byLabel = {};
            callNotes.forEach(n => {
              const m = n.content.match(CALL_RE);
              if (m) {
                byLabel[m[1]] = byLabel[m[1]] || [];
                byLabel[m[1]].push(n);
              }
            });

            const CALL_COLORS = ['orange','green','purple','cyan','magenta','red','gold','lime','volcano','geekblue'];
            const ordinalToNum = (label) => parseInt(label) || 1;

            // Sort call labels by call number
            const sortedLabels = Object.keys(byLabel).sort((a, b) => ordinalToNum(a) - ordinalToNum(b));

            return (
              <Card
                title={<span>📞 Call Summary ({callNotes.length} call note{callNotes.length !== 1 ? 's' : ''} recorded)</span>}
                size="small"
                style={{ marginBottom: 24 }}
              >
                {sortedLabels.map((label, idx) => {
                  const notes = byLabel[label];
                  const latest = notes[notes.length - 1];
                  const m = latest.content.match(CALL_RE);
                  if (!m) return null;
                  const rest = m[2] || '';
                  const parts = rest.split('→').map(s => s.replace(/^\s*\|\s*/, '').trim()).filter(Boolean);
                  const mainStatus = parts[0] || '';
                  const subStatus  = parts[1] || '';
                  const color = CALL_COLORS[idx % CALL_COLORS.length];
                  return (
                    <div key={label} style={{
                      marginBottom: 10, padding: '8px 10px',
                      background: '#fafafa', borderRadius: 8,
                      border: '1px solid #f0f0f0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Tag color={color} style={{ fontWeight: 700, margin: 0 }}>📞 {label}</Tag>
                        {notes.length > 1 && (
                          <span style={{ fontSize: 11, color: '#8c8c8c' }}>{notes.length} entries</span>
                        )}
                      </div>
                      {mainStatus && <div style={{ fontSize: 12, fontWeight: 600, color: '#262626' }}>{mainStatus}</div>}
                      {subStatus  && <div style={{ fontSize: 11, color: '#595959' }}>→ {subStatus}</div>}
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                        {parseDate(latest.created_at)?.format('MMM DD, hh:mm A')}
                        {latest.created_by && ` · ${latest.created_by}`}
                      </div>
                    </div>
                  );
                })}
              </Card>
            );
          })()}

          {/* Revenue Card — always inline-editable (click any value to edit) */}
          <Card
            title={<span><DollarOutlined /> Revenue</span>}
            style={{ marginBottom: '24px' }}
            extra={<span style={{ fontSize: 11, color: '#8c8c8c' }}>Click a value to edit</span>}
          >
            <Row gutter={[16, 16]}>
              {/* Expected Revenue */}
              <Col span={12}>
                <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>Expected Revenue</div>
                {editingRevField === 'expected' ? (
                  <InputNumber
                    autoFocus
                    style={{ width: '100%' }}
                    min={0}
                    step={1000}
                    value={revInputVal}
                    formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={v => v.replace(/₹\s?|(,*)/g, '')}
                    onChange={setRevInputVal}
                    onPressEnter={() => {
                      if (revInputVal != null) updateLeadMutation.mutate({ expected_revenue: Number(revInputVal) });
                      setEditingRevField(null);
                    }}
                    onBlur={() => {
                      if (revInputVal != null) updateLeadMutation.mutate({ expected_revenue: Number(revInputVal) });
                      setEditingRevField(null);
                    }}
                  />
                ) : (
                  <div
                    onClick={() => { setEditingRevField('expected'); setRevInputVal(lead?.expected_revenue || 0); }}
                    style={{
                      cursor: 'pointer', fontSize: 24, fontWeight: 700,
                      color: '#faad14', padding: '4px 0',
                      borderBottom: '1px dashed #faad14',
                      display: 'inline-block',
                    }}
                    title="Click to edit"
                  >
                    ₹{(lead?.expected_revenue || 0).toLocaleString('en-IN')}
                    <span style={{ fontSize: 12, marginLeft: 6, color: '#8c8c8c' }}>✏️</span>
                  </div>
                )}
              </Col>

              {/* Actual Revenue */}
              <Col span={12}>
                <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>
                  Actual Revenue{lead?.status !== 'Enrolled' && <span style={{ color: '#faad14', marginLeft: 4 }}>(fill when enrolled)</span>}
                </div>
                {editingRevField === 'actual' ? (
                  <InputNumber
                    autoFocus
                    style={{ width: '100%' }}
                    min={0}
                    step={1000}
                    value={revInputVal}
                    formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={v => v.replace(/₹\s?|(,*)/g, '')}
                    onChange={setRevInputVal}
                    onPressEnter={() => {
                      if (revInputVal != null) updateLeadMutation.mutate({ actual_revenue: Number(revInputVal) });
                      setEditingRevField(null);
                    }}
                    onBlur={() => {
                      if (revInputVal != null) updateLeadMutation.mutate({ actual_revenue: Number(revInputVal) });
                      setEditingRevField(null);
                    }}
                  />
                ) : (
                  <div
                    onClick={() => { setEditingRevField('actual'); setRevInputVal(lead?.actual_revenue || 0); }}
                    style={{
                      cursor: 'pointer', fontSize: 24, fontWeight: 700,
                      color: lead?.status === 'Enrolled' ? '#52c41a' : '#bfbfbf',
                      padding: '4px 0',
                      borderBottom: `1px dashed ${lead?.status === 'Enrolled' ? '#52c41a' : '#bfbfbf'}`,
                      display: 'inline-block',
                    }}
                    title="Click to edit"
                  >
                    ₹{(lead?.actual_revenue || 0).toLocaleString('en-IN')}
                    <span style={{ fontSize: 12, marginLeft: 6, color: '#8c8c8c' }}>✏️</span>
                  </div>
                )}
              </Col>
            </Row>
          </Card>

          {/* Lead Profile Quality */}
          {(() => {
            const fields = [
              { key: 'email',            label: 'Email',          val: lead?.email },
              { key: 'phone',            label: 'Phone',          val: lead?.phone },
              { key: 'whatsapp',         label: 'WhatsApp',       val: lead?.whatsapp },
              { key: 'country',          label: 'Country',        val: lead?.country },
              { key: 'source',           label: 'Source',         val: lead?.source },
              { key: 'course_interested',label: 'Course',         val: lead?.course_interested },
              { key: 'qualification',    label: 'Qualification',  val: lead?.qualification },
              { key: 'company',          label: 'Company',        val: lead?.company },
              { key: 'notes',            label: 'Notes',          val: lead?.notes?.length },
            ];
            const filled   = fields.filter(f => f.val);
            const missing  = fields.filter(f => !f.val);
            const pct      = Math.round((filled.length / fields.length) * 100);
            const color    = pct >= 80 ? '#52c41a' : pct >= 50 ? '#faad14' : '#ff4d4f';
            return (
              <Card title="📋 Profile Quality" size="small" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <Progress type="circle" percent={pct} strokeColor={color} width={64}
                    format={p => <span style={{ fontSize: 14, fontWeight: 700, color }}>{p}%</span>} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{filled.length}/{fields.length} fields filled</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                      {pct >= 80 ? 'Complete — high quality lead' : pct >= 50 ? 'Good — a few fields missing' : 'Incomplete — fill in more details'}
                    </div>
                  </div>
                </div>
                {missing.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Missing:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {missing.map(f => (
                        <Tag key={f.key} color="warning" style={{ cursor: 'pointer', fontSize: 11 }}
                          onClick={() => { setIsEditing(true); }}>
                          + {f.label}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })()}

          {/* Best Time to Call */}
          <Card
            title={
              <span>
                <PhoneOutlined style={{ marginRight: 8, color: '#10b981' }} />
                Best Time to Call
              </span>
            }
            style={{ marginBottom: '24px' }}
          >
            <CallTimeWidget country={lead?.country} />
          </Card>

          {/* Recommended Script */}
          {lead?.recommended_script && (
            <Card title="Recommended Script" style={{ marginBottom: '24px' }}>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.6' }}>
                {lead.recommended_script}
              </div>
            </Card>
          )}

          {/* Unified Lead Timeline — replaces legacy ActivityTimeline */}
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Activity &amp; Communications
                <span style={{
                  fontSize: 11, fontWeight: 400, color: '#64748b',
                  background: '#f1f5f9', padding: '1px 6px', borderRadius: 4,
                }}>
                  live
                </span>
              </span>
            }
            style={{ marginBottom: '24px' }}
            styles={{ body: { padding: '12px 20px' }}}
          >
            <LeadTimeline leadId={leadId} />
          </Card>
        </Col>
      </Row>

      {/* WhatsApp Modal */}
      <Modal
        title={<span><WhatsAppOutlined /> Send WhatsApp Message</span>}
        open={whatsappModal}
        onCancel={() => setWhatsappModal(false)}
        footer={null}
      >
        <Form
          onFinish={(values) => {
            leadsAPI.sendWhatsApp(leadId, values.message)
              .then(() => {
                message.success('WhatsApp message queued!');
                setWhatsappModal(false);
              })
              .catch(() => message.error('Failed to send WhatsApp'));
          }}
        >
          <Form.Item name="message" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="Type your message..." />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Send Message
          </Button>
        </Form>
      </Modal>

      {/* Email Modal */}
      <Modal
        title={<span><MailOutlined /> Send Email</span>}
        open={emailModal}
        onCancel={() => setEmailModal(false)}
        footer={null}
        width={600}
      >
        <Form
          onFinish={(values) => {
            leadsAPI.sendEmail(leadId, values.subject, values.body)
              .then(() => {
                message.success('Email queued!');
                setEmailModal(false);
              })
              .catch(() => message.error('Failed to send email'));
          }}
        >
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
            <Input placeholder="Email subject" />
          </Form.Item>
          <Form.Item name="body" label="Message" rules={[{ required: true }]}>
            <TextArea rows={8} placeholder="Email message..." />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Send Email
          </Button>
        </Form>
      </Modal>

      {/* WhatsApp Template Drawer */}
      <WhatsAppTemplateDrawer
        open={templateDrawer}
        onClose={() => setTemplateDrawer(false)}
        lead={lead}
      />

      {/* Loss Reason Modal */}
      <Modal
        open={lossModal}
        title={
          <span>
            <WarningOutlined style={{ color: '#f5222d', marginRight: 8 }} />
            Why is this lead {pendingStatus}?
          </span>
        }
        onCancel={() => { setLossModal(false); setPendingStatus(null); lossForm.resetFields(); }}
        onOk={handleLossSubmit}
        okText="Confirm & Save"
        okButtonProps={{ danger: true }}
        confirmLoading={updateLeadMutation.isPending}
        width={460}
      >
        <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>
          Recording a reason helps the team learn what's not working and improve future outreach.
        </div>
        <Form form={lossForm} layout="vertical">
          <Form.Item
            name="loss_reason"
            label="Reason"
            rules={[{ required: true, message: 'Please select a reason' }]}
          >
            <Select placeholder="Select the main reason">
              <Option value="Price too high">Price too high</Option>
              <Option value="Went with competitor">Went with a competitor</Option>
              <Option value="Not the right course">Not the right course</Option>
              <Option value="Cannot take time off work">Cannot take time off work</Option>
              <Option value="No response / Unreachable">No response / Unreachable</Option>
              <Option value="Not eligible">Not eligible for the course</Option>
              <Option value="Needs more time">Needs more time to decide</Option>
              <Option value="Financial constraints">Financial constraints</Option>
              <Option value="Already enrolled elsewhere">Already enrolled elsewhere</Option>
              <Option value="Other">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item name="loss_note" label="Additional Notes (optional)">
            <TextArea rows={3} placeholder="Any extra details about why this lead didn't convert..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LeadDetails;
