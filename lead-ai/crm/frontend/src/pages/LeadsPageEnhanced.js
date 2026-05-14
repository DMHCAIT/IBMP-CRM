import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Tag, Progress, Space, Input, Select, DatePicker,
  Drawer, Form, message, Row, Col, Card, Statistic, Avatar, Tooltip,
  Dropdown, Segmented, Empty, Typography, Divider, Checkbox,
  Radio, InputNumber, Alert, Modal, Upload, Steps, Badge, AutoComplete,
  Switch,
} from 'antd';
import { COUNTRIES } from '../config/countries';
import {
  PlusOutlined, SearchOutlined, FilterOutlined, WhatsAppOutlined,
  MailOutlined, EyeOutlined, DeleteOutlined, ReloadOutlined,
  DownloadOutlined, UserOutlined, PhoneOutlined, GlobalOutlined,
  BookOutlined, CalendarOutlined, EditOutlined, MoreOutlined,
  StarOutlined, FireOutlined, ThunderboltOutlined, TeamOutlined,
  ClockCircleOutlined, SyncOutlined, ExportOutlined, ImportOutlined,
  CheckCircleOutlined, CloseCircleOutlined, UploadOutlined,
  WarningOutlined, FunnelPlotOutlined, MessageOutlined,
} from '@ant-design/icons';
import ChatDrawer from '../components/ChatDrawer';
import DuplicateDetectionModal from '../components/leads/DuplicateDetectionModal';
import FieldMappingModal from '../components/leads/FieldMappingModal';
import WhatsAppTemplateDrawer from '../components/whatsapp/WhatsAppTemplateDrawer';
import { leadsAPI, coursesAPI, counselorsAPI, usersAPI, duplicatesAPI, decayAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isBetween from 'dayjs/plugin/isBetween';
import * as XLSX from 'xlsx';

dayjs.extend(relativeTime);
dayjs.extend(isBetween);

// Safely parse a date string from the server.
// Supabase may return timestamps without a timezone indicator, e.g.
// "2026-04-30T07:00:00" instead of "2026-04-30T07:00:00Z".
// Without the Z, dayjs treats it as LOCAL time, which would be wrong
// for a UTC-stored value. This helper always appends Z when no offset present.
const parseDate = (s) => {
  if (!s) return null;
  const str = String(s);
  const hasOffset = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str);
  return dayjs(hasOffset ? str : str + 'Z');
};

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text, Title } = Typography;
const { Dragger } = Upload;

// ── Date filter helper ──────────────────────────────────────────────────────
const makeDateFilter = (fieldKey) => ({
  filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => {
    const [mode, setMode] = useState(selectedKeys[0]?.mode || 'all');
    const [date, setDate] = useState(selectedKeys[0]?.date ? dayjs(selectedKeys[0].date) : null);
    const [range, setRange] = useState(
      selectedKeys[0]?.range ? [dayjs(selectedKeys[0].range[0]), dayjs(selectedKeys[0].range[1])] : null
    );

    const apply = (m, d, r) => {
      setSelectedKeys([{ mode: m, date: d?.format?.('YYYY-MM-DD'), range: r?.map(x => x.format('YYYY-MM-DD')) }]);
      confirm();
    };

    return (
      <div style={{ padding: 16, width: 280 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Filter by date</Text>
        <Radio.Group
          value={mode}
          onChange={e => { setMode(e.target.value); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}
        >
          <Radio value="all">All time</Radio>
          <Radio value="today">Today</Radio>
          <Radio value="week">This week</Radio>
          <Radio value="month">This month</Radio>
          <Radio value="on">On exact date</Radio>
          <Radio value="before">Before date</Radio>
          <Radio value="after">After date</Radio>
          <Radio value="between">Between dates</Radio>
        </Radio.Group>

        {['on', 'before', 'after'].includes(mode) && (
          <DatePicker
            style={{ width: '100%', marginBottom: 8 }}
            value={date}
            onChange={d => setDate(d)}
          />
        )}
        {mode === 'between' && (
          <RangePicker
            style={{ width: '100%', marginBottom: 8 }}
            value={range}
            onChange={r => setRange(r)}
          />
        )}

        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button size="small" onClick={() => { clearFilters(); setMode('all'); setDate(null); setRange(null); }}>
            Reset
          </Button>
          <Button type="primary" size="small" onClick={() => apply(mode, date, range)}>
            Apply
          </Button>
        </Space>
      </div>
    );
  },
  onFilter: (value, record) => {
    if (!value || value.mode === 'all') return true;
    const val = record[fieldKey];
    if (!val) return false;
    const d = dayjs(val);
    const now = dayjs();
    const { mode, date, range } = value;
    if (mode === 'today') return d.isSame(now, 'day');
    if (mode === 'week') return d.isAfter(now.subtract(7, 'day'));
    if (mode === 'month') return d.isAfter(now.subtract(1, 'month'));
    if (mode === 'on' && date) return d.isSame(dayjs(date), 'day');
    if (mode === 'before' && date) return d.isBefore(dayjs(date), 'day');
    if (mode === 'after' && date) return d.isAfter(dayjs(date), 'day');
    if (mode === 'between' && range?.length === 2) {
      return d.isBetween(dayjs(range[0]).startOf('day'), dayjs(range[1]).endOf('day'), null, '[]');
    }
    return true;
  },
  filterIcon: filtered => <CalendarOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
});

// ── File parser (CSV, Excel, ODS) ──────────────────────────────────────────
const parseSpreadsheet = (data, isBinary) => {
  const workbook = XLSX.read(data, { type: isBinary ? 'binary' : 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  // Normalize header keys: lowercase + spaces → underscores
  return rows.map(row => {
    const normalized = {};
    Object.keys(row).forEach(k => {
      normalized[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(row[k] ?? '');
    });
    return normalized;
  }).filter(r => r.full_name || r.name);
};

const REQUIRED_COLS = ['full_name', 'phone'];
const STATUS_OPTIONS = ['Fresh', 'Follow Up', 'Warm', 'Hot', 'Not Interested', 'Not Answering', 'Enrolled', 'Junk'];
const NOTE_CALL_STAGE_OPTIONS = ['2 Call', '3 Call', '4 Call'];

const LEAD_NOTE_PLAYBOOK = {
  'Not Connected (No answer / Switched off / Not Reachable / Busy)': {
    'Need second call': {
      '2 Call': 'Ask me to call evening',
      '3 Call': 'Busy in OPD, call later',
      '4 Call': 'No response after multiple follow-ups',
    },
    'Number Busy': {
      '2 Call': 'Call tomorrow',
      '3 Call': 'In surgery / duty',
      '4 Call': 'Mark as unresponsive',
    },
    'Switched Off': {
      '2 Call': 'Try later',
      '3 Call': 'Phone still switched off',
      '4 Call': 'Dead lead',
    },
    'Not Reachable': {
      '2 Call': 'Network issue',
      '3 Call': 'WhatsApp sent, no reply',
      '4 Call': 'Invalid number',
    },
  },
  'Call Back Requested': {
    'Time option': {
      '2 Call': 'Ask me to call tomorrow',
      '3 Call': 'Call after duty hours',
      '4 Call': 'Final callback attempted',
    },
    'Busy Schedule': {
      '2 Call': 'Busy with patients',
      '3 Call': 'Call on weekend',
      '4 Call': 'No further response',
    },
    'Parent Requested Call': {
      '2 Call': 'Discuss with family first',
      '3 Call': 'Family discussion pending',
      '4 Call': 'Final decision awaited',
    },
  },
  Interested: {
    'Need Details': {
      '2 Call': 'Spoke to Doctor, details sent, need follow up',
      '3 Call': 'Reviewed brochure, interested',
      '4 Call': 'Ready for admission discussion',
    },
    'Fee Discussion Pending': {
      '2 Call': 'Fee is high, will think and get back',
      '3 Call': 'Need EMI / discount',
      '4 Call': 'Payment discussion started',
    },
    'Demo Requested': {
      '2 Call': 'Negotiation in progress',
      '3 Call': 'Demo attended, interested',
      '4 Call': 'Wants admission process',
    },
    'Comparing Price': {
      '2 Call': 'Comparing with competitors',
      '3 Call': 'Asked about placement & USP',
      '4 Call': 'Final comparison stage',
    },
    'Family Approval Pending': {
      '2 Call': 'Will discuss with family and get back',
      '3 Call': 'Family interested but checking fees',
      '4 Call': 'Family approved/rejected',
    },
    'Will Enroll Soon': {
      '2 Call': 'Will enroll soon',
      '3 Call': 'Asked for payment link',
      '4 Call': 'Admission confirmed',
    },
  },
  'Future Prospect': {
    'Not Decided': {
      '2 Call': 'Not yet decided',
      '3 Call': 'Need more time',
      '4 Call': 'Shifted to nurturing',
    },
    'After Exams': {
      '2 Call': 'Will plan next year',
      '3 Call': 'Busy in PG preparation',
      '4 Call': 'Reconnect after exams',
    },
    'Just Inquiry': {
      '2 Call': 'Preparing for PG NEET',
      '3 Call': 'No immediate plan',
      '4 Call': 'Cold lead',
    },
    'Financial Issue': {
      '2 Call': 'Busy in exams, will plan later',
      '3 Call': 'Waiting for salary/funds',
      '4 Call': 'Budget not possible',
    },
    'Discuss with Family': {
      '2 Call': 'Interested, will enroll shortly',
      '3 Call': 'Family discussion ongoing',
      '4 Call': 'Waiting for final update',
    },
    'After Relocation': {
      '2 Call': 'Looking for different course',
      '3 Call': 'Relocating currently',
      '4 Call': 'Reconnect later',
    },
    'After Job Switch': {
      '2 Call': 'Not interested currently',
      '3 Call': 'Will reconnect after job change',
      '4 Call': 'No update received',
    },
  },
  'Not Interested': {
    'Not Relevant / Course Not Suitable': {
      '2 Call': 'Do not disturb',
      '3 Call': 'Course mismatch confirmed',
      '4 Call': 'Closed lost lead',
    },
    'Wrong Expectation from Course': {
      '2 Call': 'Looking for only clinical training',
      '3 Call': 'Wants government certification only',
      '4 Call': 'Not matching expectations',
    },
    'Other Academy': {
      '2 Call': 'Looking for only online course',
      '3 Call': 'Joined competitor institute',
      '4 Call': 'Lost to competitor',
    },
    'Price Issue': {
      '2 Call': 'Waiting for funds',
      '3 Call': 'Budget issue unresolved',
      '4 Call': 'Permanently lost',
    },
  },
  Spam: {
    'Other Field / No Health Care / Invalid Number': {
      '2 Call': 'Dropped the plan',
      '3 Call': 'Fake inquiry',
      '4 Call': 'Closed permanently',
    },
  },
};

// Auto-retry countdown shown when the server times out (cold-start)
const AutoRetryCountdown = ({ onRetry, seconds = 15 }) => {
  const [count, setCount] = React.useState(seconds);
  React.useEffect(() => {
    if (count <= 0) { onRetry(); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, onRetry]);
  return <span style={{ fontSize: 12, color: '#d97706' }}>Auto-retry in {count}s</span>;
};
const SOURCE_OPTIONS = ['Website', 'Instagram', 'Facebook', 'Referral', 'WhatsApp'];

// Map any import alias → canonical source name.
// Keys are lowercase patterns that appear in raw imported values.
const SOURCE_ALIAS_MAP = {
  // Website
  'website': 'Website', 'web': 'Website', 'site': 'Website', 'online': 'Website',
  'google': 'Website', 'google ads': 'Website', 'google ad': 'Website', 'seo': 'Website',
  'organic': 'Website', 'search': 'Website',
  // Instagram
  'instagram': 'Instagram', 'ig': 'Instagram', 'insta': 'Instagram',
  // Facebook
  'facebook': 'Facebook', 'fb': 'Facebook', 'fb ads': 'Facebook', 'facebook ads': 'Facebook',
  'meta': 'Facebook', 'meta ads': 'Facebook',
  // Referral
  'referral': 'Referral', 'refer': 'Referral', 'reference': 'Referral', 'ref': 'Referral',
  'word of mouth': 'Referral', 'wom': 'Referral', 'agent': 'Referral',
  'friend': 'Referral', 'recommendation': 'Referral',
  // WhatsApp
  'whatsapp': 'WhatsApp', 'whats app': 'WhatsApp', 'wa': 'WhatsApp',
  'wp': 'WhatsApp', 'wapp': 'WhatsApp',
};

/**
 * Normalise a raw source string from an import file to one of the 5 canonical
 * SOURCE_OPTIONS values. Falls back to 'Website' when no alias matches.
 */
const normalizeSource = (raw) => {
  if (!raw) return null;
  const lower = String(raw).toLowerCase().trim();
  // Exact alias match
  if (SOURCE_ALIAS_MAP[lower]) return SOURCE_ALIAS_MAP[lower];
  // Partial / contains match (e.g. "IG Story" → Instagram)
  for (const [alias, canonical] of Object.entries(SOURCE_ALIAS_MAP)) {
    if (lower.includes(alias) || alias.includes(lower)) return canonical;
  }
  // Already a valid canonical value (case-insensitive)
  const direct = SOURCE_OPTIONS.find(s => s.toLowerCase() === lower);
  if (direct) return direct;
  return null; // caller decides the fallback
};
const QUALIFICATION_OPTIONS = [
  'MBBS','MD','MS','DNB','MDS','BDS','BAMS','BHMS',
  'BPT','MPT','BUMS','BNYS','BSc Nursing','MSc Nursing',
  'B.Pharm','M.Pharm','Pharm.D','DMLT','BMLT',
  'BOT','MOT','BSc MLT','MSc MLT','Other',
];
const STATUS_COLOR_MAP = {
  Enrolled: 'green', Hot: 'red', Warm: 'orange',
  Fresh: 'blue', 'Follow Up': 'purple',
  'Not Interested': 'default', 'Not Answering': 'gray', Junk: 'volcano',
};
const COMPANY_OPTIONS = ['IBMP', 'DMHCA'];

// ════════════════════════════════════════════════════════════════════════════
const LeadsPageEnhanced = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const isCounselor = authUser?.role === 'Counselor';

  const [chatLead, setChatLead] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  // Enrollment payment gate — holds { leadId, lead } while modal is open
  const [enrollTarget, setEnrollTarget] = useState(null);
  const [enrollForm] = Form.useForm();
  const [bulkDrawerVisible, setBulkDrawerVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [importStep, setImportStep] = useState(0);
  const [importData, setImportData] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  
  // Field mapping state
  const [mappingVisible, setMappingVisible] = useState(false);
  const [rawFileData, setRawFileData] = useState({ columns: [], rows: [] });
  const [fieldMapping, setFieldMapping] = useState({});
  const [filters, setFilters] = useState({});
  const [columnFilters, setColumnFilters] = useState({});  // server-side column filter params
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const searchTimeoutRef = useRef(null);
  const [quickFilter, setQuickFilter] = useState('all');
  const [advFilters, setAdvFilters] = useState({});
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [form] = Form.useForm();
  const [bulkForm] = Form.useForm();
  const noteMainCategory = Form.useWatch('note_main_category', form);
  const noteSubStatus = Form.useWatch('note_sub_status', form);
  const noteCallStage = Form.useWatch('note_call_stage', form);
  const fileInputRef = useRef(null);

  // Duplicate detection
  const [dupModalOpen,    setDupModalOpen]    = useState(false);
  const [dupCandidates,   setDupCandidates]   = useState([]);
  const [pendingLeadData, setPendingLeadData] = useState(null);

  // WhatsApp template drawer (for quick-send from table row)
  const [templateLead,    setTemplateLead]    = useState(null);

  // Inline cell editing — tracks which cell (leadId + field) is actively being edited
  const [editingCell,  setEditingCell]  = useState({});   // { leadId, field }
  const [editingValue, setEditingValue] = useState(null);

  const commitEdit = (leadId, field, value) => {
    if (value !== null && value !== undefined && value !== '') {
      updateMutation.mutate({ leadId, data: { [field]: value } });
    }
    setEditingCell({});
    setEditingValue(null);
  };

  const noteMainCategoryOptions = useMemo(() => Object.keys(LEAD_NOTE_PLAYBOOK), []);
  const noteSubStatusOptions = useMemo(
    () => (noteMainCategory ? Object.keys(LEAD_NOTE_PLAYBOOK[noteMainCategory] || {}) : []),
    [noteMainCategory]
  );
  const selectedTemplateText = useMemo(() => {
    if (!noteMainCategory || !noteSubStatus || !noteCallStage) return '';
    return LEAD_NOTE_PLAYBOOK?.[noteMainCategory]?.[noteSubStatus]?.[noteCallStage] || '';
  }, [noteMainCategory, noteSubStatus, noteCallStage]);

  const insertSelectedTemplateIntoNotes = useCallback(() => {
    if (!noteMainCategory || !noteSubStatus || !noteCallStage || !selectedTemplateText) {
      message.warning('Select category, status and call stage first');
      return;
    }
    const line = `[${noteMainCategory} | ${noteSubStatus} | ${noteCallStage}] ${selectedTemplateText}`;
    const currentNotes = form.getFieldValue('notes') || '';
    const nextNotes = currentNotes ? `${currentNotes}\n${line}` : line;
    form.setFieldValue('notes', nextNotes);
    message.success('Template added to notes');
  }, [form, noteMainCategory, noteSubStatus, noteCallStage, selectedTemplateText]);

  // Debounce search text (500ms delay)
  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 500);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText]);

  // Reset to first page when filters or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters, columnFilters, debouncedSearch, quickFilter, advFilters]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const leadQueryParams = React.useMemo(() => {
    const params = {
      ...filters,
      ...columnFilters,   // column-level filters wired to server
      skip: (currentPage - 1) * pageSize,
      limit: pageSize,
    };

    if (quickFilter === 'fresh') params.status = 'Fresh';
    if (quickFilter === 'hot') params.status = 'Hot';
    if (quickFilter === 'warm') params.status = 'Warm';
    if (quickFilter === 'followup_today') {
      params.follow_up_from = dayjs().startOf('day').toISOString();
      params.follow_up_to   = dayjs().endOf('day').toISOString();
    }
    if (quickFilter === 'today') params.created_today = true;
    if (quickFilter === 'overdue') params.overdue = true;
    if (debouncedSearch) params.search = debouncedSearch;

    if (advFilters.status?.length) params.status_in = advFilters.status.join(',');
    if (advFilters.segment?.length) params.segment_in = advFilters.segment.join(',');
    if (advFilters.country?.length) params.country_in = advFilters.country.join(',');
    if (advFilters.assigned?.length) params.assigned_to_in = advFilters.assigned.join(',');
    if (advFilters.course?.length > 0) params.course_interested = advFilters.course.join(',');
    if (advFilters.source?.length > 0)   params.source   = advFilters.source.join(',');
    if (advFilters.company?.length > 0)  params.company  = advFilters.company.join(',');
    if (advFilters.minScore != null) params.min_score = advFilters.minScore;
    if (advFilters.maxScore != null) params.max_score = advFilters.maxScore;

    if (advFilters.followUp) {
      const { mode, date, range } = advFilters.followUp;
      if (mode === 'today') {
        params.follow_up_from = dayjs().startOf('day').toISOString();
        params.follow_up_to = dayjs().endOf('day').toISOString();
      } else if (mode === 'overdue') {
        params.overdue = true;
      } else if (mode === 'on' && date) {
        params.follow_up_from = dayjs(date).startOf('day').toISOString();
        params.follow_up_to = dayjs(date).endOf('day').toISOString();
      } else if (mode === 'before' && date) {
        params.follow_up_to = dayjs(date).endOf('day').toISOString();
      } else if (mode === 'after' && date) {
        params.follow_up_from = dayjs(date).startOf('day').toISOString();
      } else if (mode === 'between' && range?.length === 2) {
        params.follow_up_from = dayjs(range[0]).startOf('day').toISOString();
        params.follow_up_to = dayjs(range[1]).endOf('day').toISOString();
      }
    }

    return params;
  }, [filters, quickFilter, debouncedSearch, advFilters, columnFilters, currentPage, pageSize]);

  const { data: leadsResponse = { leads: [], total: 0 }, isLoading, isFetching, refetch, error, isError } = useQuery({
    queryKey: ['leads', leadQueryParams],
    queryFn: async () => {
      try {
        const response = await leadsAPI.getAll(leadQueryParams);
        return response.data || { leads: [], total: 0 };
      } catch (err) {
        console.error('Failed to fetch leads:', err);
        throw err; // Re-throw to trigger error state
      }
    },
    staleTime: 30 * 1000,          // 30 seconds - reduce unnecessary refetches
    gcTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,   // Don't refetch on tab focus - use manual refetch button instead
    retry: 2,                      // Reduce retries from 3 to 2 for faster failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Faster retry intervals
  });

  const leads = leadsResponse?.leads || [];
  const totalLeads = leadsResponse?.total || 0;

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => { try { return (await coursesAPI.getAll()).data || []; } catch { return []; } },
    staleTime: 10 * 60 * 1000, // 10 minutes - courses don't change often
    gcTime: 30 * 60 * 1000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { try { return (await usersAPI.getAll()).data; } catch (err) { console.error('Users fetch error:', err); return { users: [] }; } },
    staleTime: 5 * 60 * 1000, // 5 minutes - users don't change often
    gcTime: 15 * 60 * 1000,
  });

  const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);

  // Decay config — used to compute "at risk" badges in the table
  const { data: decayConfig } = useQuery({
    queryKey: ['decay-config'],
    queryFn: async () => { try { return (await decayAPI.getConfig()).data; } catch { return null; } },
    staleTime: 10 * 60 * 1000,
  });

  // ── Computed filter options (memoized for performance) ────────────────────
  const uniqueStatuses   = STATUS_OPTIONS;
  const uniqueCountries  = useMemo(() => 
    [...new Set(leads.map(l => l.country))].filter(Boolean).sort(),
    [leads]
  );
  const uniqueCourses    = useMemo(() => 
    [...new Set([
      ...courses.map(c => c.course_name),
      ...leads.map(l => l.course_interested),
    ])].filter(Boolean).sort(),
    [courses, leads]
  );
  const uniqueAssigned   = useMemo(() => 
    isCounselor
      ? (authUser?.full_name ? [authUser.full_name] : [])
      : [...new Set(leads.map(l => l.assigned_to))].filter(Boolean).sort(),
    [leads, isCounselor, authUser]
  );
  // Always show exactly the 5 canonical source options in filters —
  // don't derive from lead data (which may have legacy raw values).
  const uniqueSources = SOURCE_OPTIONS;
  const uniqueSegments   = ['Hot', 'Warm', 'Cold', 'Junk'];

  // Server-side filtering: table data is already filtered by API.
  const filteredLeads = leads;

  // ── Stats (memoized for performance) ──────────────────────────────────────
  const stats = useMemo(() => {
    const today = dayjs();
    return {
      total: totalLeads,
      hot: leads.filter(l => l.status === 'Hot').length,
      warm: leads.filter(l => l.status === 'Warm').length,
      enrolled: leads.filter(l => l.status === 'Enrolled').length,
      followUpToday: leads.filter(l => l.follow_up_date && parseDate(l.follow_up_date).isSame(today, 'day')).length,
      overdue: leads.filter(l => l.follow_up_date && parseDate(l.follow_up_date).isBefore(today, 'day')).length,
      avgScore: leads.length ? (leads.reduce((s, l) => s + (l.ai_score || 0), 0) / leads.length).toFixed(1) : 0,
      revenue: leads.filter(l => l.status === 'Enrolled').reduce((s, l) => s + (l.actual_revenue || 0), 0),
    };
  }, [leads, totalLeads]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d) => leadsAPI.create(d),
    onSuccess: () => { message.success('Lead created!'); setDrawerVisible(false); form.resetFields(); queryClient.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (e) => {
      console.error('Create lead error:', e);
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
        const msgs = detail.map(d => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join('; ');
        message.error(`Validation error: ${msgs}`);
      } else {
        message.error(`Failed to create lead: ${detail || e.message}`);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ leadId, data }) => leadsAPI.update(leadId, data),
    onSuccess: (updatedLead, { leadId, data: changedFields }) => {
      message.success('Lead updated!');
      // Immediately patch the cached row so "Last Updated" shows the correct
      // time right away — no waiting for the background refetch to complete.
      const now = new Date().toISOString();
      queryClient.setQueriesData(
        { queryKey: ['leads'], exact: false },
        (old) => {
          if (!old?.leads) return old;
          const patched = old.leads.map(l =>
            l.lead_id === leadId
              ? { ...l, ...changedFields, updated_at: now }
              : l
          );
          // Re-sort: most recently updated lead floats to the top
          patched.sort((a, b) =>
            new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
          );
          return { ...old, leads: patched };
        }
      );
      // Then trigger a full background refetch for accuracy
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
    onError: (e) => {
      console.error('Update lead error:', e, e.response);
      const detail = e.response?.data?.detail || e.message;
      message.error(`Failed to update: ${detail}`);
    },
  });

  // Debounced inline update — prevents rapid-fire API calls when user
  // clicks through dropdown options quickly. Reduced to 200ms for faster feedback.
  const _inlineTimer = useRef({});
  const inlineUpdate = useCallback((leadId, field, value) => {
    // Intercept: if setting status → Enrolled, show payment details modal first
    if (field === 'status' && value === 'Enrolled') {
      setEnrollTarget({ leadId });
      return;
    }
    const key = `${leadId}:${field}`;
    if (_inlineTimer.current[key]) clearTimeout(_inlineTimer.current[key]);
    _inlineTimer.current[key] = setTimeout(() => {
      delete _inlineTimer.current[key];
      updateMutation.mutate({ leadId, data: { [field]: value } });
    }, 200); // Reduced from 400ms to 200ms for faster response
  }, [updateMutation]);

  // Cancel all pending inline timers on unmount
  useEffect(() => {
    const timers = _inlineTimer.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  // Handle Table onChange — extracts Ant Design column filter values and maps
  // them to server-side query params. This makes ALL column filters accurate
  // across pages, not just the current page.
  const handleTableChange = useCallback((_pagination, tableFilters) => {
    const cf = {};
    if (tableFilters.country?.length)     cf.country_in        = tableFilters.country.join(',');
    if (tableFilters.course?.length)      cf.course_interested = tableFilters.course.join(',');
    if (tableFilters.source?.length)      cf.source            = tableFilters.source.join(',');
    if (tableFilters.company?.length)     cf.company           = tableFilters.company.join(',');
    if (tableFilters.status?.length)      cf.status_in         = tableFilters.status.join(',');
    if (tableFilters.assigned_to?.length) cf.assigned_to_in    = tableFilters.assigned_to.join(',');
    // Date column filters emit a JSON-serialised object as selectedKeys[0]
    const parseColDate = (val, fromKey, toKey, altKey) => {
      if (!val?.[0]) return;
      const v = typeof val[0] === 'string' ? JSON.parse(val[0]) : val[0];
      const { mode, date, range } = v;
      if (mode === 'today') {
        cf[fromKey] = dayjs().startOf('day').toISOString();
        cf[toKey]   = dayjs().endOf('day').toISOString();
      } else if (mode === 'week') {
        cf[fromKey] = dayjs().subtract(7, 'day').startOf('day').toISOString();
        cf[toKey]   = dayjs().endOf('day').toISOString();
      } else if (mode === 'month') {
        cf[fromKey] = dayjs().subtract(1, 'month').startOf('day').toISOString();
        cf[toKey]   = dayjs().endOf('day').toISOString();
      } else if (mode === 'exact' && date) {
        cf[fromKey] = dayjs(date).startOf('day').toISOString();
        cf[toKey]   = dayjs(date).endOf('day').toISOString();
      } else if (mode === 'range' && range?.length === 2) {
        cf[fromKey] = dayjs(range[0]).startOf('day').toISOString();
        cf[toKey]   = dayjs(range[1]).endOf('day').toISOString();
      }
    };
    parseColDate(tableFilters.follow_up,   'follow_up_from',  'follow_up_to');
    parseColDate(tableFilters.created_at,  'created_from',    'created_to');
    parseColDate(tableFilters.updated_at,  'updated_from',    'updated_to');
    setColumnFilters(cf);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (id) => leadsAPI.delete(id),
    onSuccess: () => { message.success('Lead deleted!'); queryClient.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (e) => {
      const detail = e.response?.data?.detail;
      message.error(`Delete failed: ${detail || e.message || 'Unknown error'}`);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ leadIds, updates }) => leadsAPI.bulkUpdate(leadIds, updates),
    onSuccess: (_, { leadIds }) => { 
      message.success(`${selectedRows.length} leads updated!`); 
      setSelectedRows([]); 
      setBulkDrawerVisible(false); 
      bulkForm.resetFields(); 
      queryClient.invalidateQueries({ queryKey: ['leads'] }); 
      // Invalidate each individual lead cache
      leadIds.forEach(leadId => queryClient.invalidateQueries({ queryKey: ['lead', leadId] }));
    },
    onError: (e) => {
      console.error('Bulk update error:', e);
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
        const msgs = detail.map(d => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join('; ');
        message.error(`Bulk update failed: ${msgs}`);
      } else {
        message.error(`Bulk update failed: ${detail || e.message}`);
      }
    },
  });

  // ── Bulk Import with Field Mapping ────────────────────────────────────────
  const handleFileRead = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const isCsv = ext === 'csv';
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseSpreadsheet(e.target.result, !isCsv);
        if (!rows || rows.length === 0) {
          message.warning('No data found in file');
          return;
        }
        
        // Extract columns and store raw data
        const columns = Object.keys(rows[0]);
        setRawFileData({ columns, rows });
        
        // Show field mapping modal
        setImportVisible(false);
        setMappingVisible(true);
        
      } catch (err) {
        console.error('File parse error:', err);
        message.error('Could not parse file. Please check the format and try again.');
      }
    };
    if (isCsv) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
    return false;
  };

  const handleMappingConfirm = (mapping) => {
    setFieldMapping(mapping);
    setMappingVisible(false);
    
    // Process rows with the user-confirmed mapping
    processImportRowsWithMapping(rawFileData.rows, mapping);
    
    // Show import modal with processed data
    setImportVisible(true);
  };

  const processImportRowsWithMapping = (rows, mapping) => {
    if (!rows || rows.length === 0) {
      message.warning('No data found in file');
      return;
    }
    
    const errors = [];
    const valid = [];
    
    rows.forEach((row, i) => {
      const mappedLead = {};
      
      // Apply user-defined mapping
      Object.entries(mapping).forEach(([excelCol, crmField]) => {
        if (crmField && row[excelCol] !== undefined) {
          const value = String(row[excelCol] ?? '').trim();
          if (value) {
            mappedLead[crmField] = value;
          }
        }
      });
      
      // Validate required fields
      const name = mappedLead.full_name || '';
      const phone = mappedLead.phone || '';
      
      if (!name || !phone) {
        errors.push({ 
          row: i + 2, 
          msg: `Missing required: ${!name ? 'Full Name ' : ''}${!phone ? 'Phone' : ''}`.trim() 
        });
        return;
      }
      
      // Ensure defaults and fallbacks
      // Only include fields accepted by LeadCreate schema
      const lead = {
        full_name:        mappedLead.full_name,
        phone:            mappedLead.phone,
        email:            mappedLead.email            || undefined,
        whatsapp:         mappedLead.whatsapp         || mappedLead.phone,
        country:          mappedLead.country          || 'India',
        source:           normalizeSource(mappedLead.source) || 'Website',
        course_interested: mappedLead.course_interested || 'Not Specified',
        qualification:    mappedLead.qualification    || undefined,
        company:          mappedLead.company          || undefined,
        // Use the value from the file; fall back to 'Fresh' only if not provided
        status:           mappedLead.status           || 'Fresh',
        expected_revenue: mappedLead.expected_revenue
          ? parseFloat(mappedLead.expected_revenue) || undefined
          : undefined,
        assigned_to: isCounselor
          ? (authUser?.full_name || undefined)
          : (mappedLead.assigned_to || undefined),
        notes: mappedLead.notes || undefined,
        utm_source:   mappedLead.utm_source   || undefined,
        utm_medium:   mappedLead.utm_medium   || undefined,
        utm_campaign: mappedLead.utm_campaign || undefined,
      };
      
      // Remove undefined/empty keys
      Object.keys(lead).forEach(k => { 
        if (lead[k] === undefined || lead[k] === '') delete lead[k]; 
      });
      
      valid.push(lead);
    });
    
    setImportData(valid);
    setImportErrors(errors);
    setImportStep(1);
  };

  const handleImportSubmit = async () => {
    if (!importData.length) return;
    setImportStep(2);
    setImportProgress(0);
    
    // Simulate progress while waiting for backend
    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) return prev; // Stop at 90% until real response
        return prev + 10;
      });
    }, 200);
    
    try {
      // Use bulk create endpoint for efficiency
      const response = await leadsAPI.bulkCreate(importData);
      clearInterval(progressInterval);
      
      const { results } = response.data;
      
      setImportProgress(100);
      setImportStep(3);
      
      // Update import errors with failed leads
      if (results.failed && results.failed.length > 0) {
        const failedErrors = results.failed.map(f => ({
          row: f.index + 2,
          name: f.name,
          msg: `${f.name}: ${f.error}`,
          duplicate: f.duplicate || false,
          existing_lead_id: f.existing_lead_id || '',
          existing_owner: f.existing_owner || '',
          existing_status: f.existing_status || '',
        }));
        setImportErrors(prev => [...prev, ...failedErrors]);
      }
      
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      
      if (results.failed.length === 0) {
        message.success(`All ${results.success.length} leads imported successfully!`);
      } else {
        message.warning(`${results.success.length} succeeded, ${results.failed.length} failed. Check errors below.`);
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Bulk import error:', error);
      setImportStep(1);
      
      // Handle validation errors properly
      let errorMsg = 'Import failed';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          // FastAPI validation errors
          errorMsg = detail.map(e => `${e.loc?.join('.') || 'field'}: ${e.msg}`).join('; ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        } else {
          errorMsg = JSON.stringify(detail);
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      message.error(`Import failed: ${errorMsg}`);
    }
  };

  const resetImport = () => { 
    setImportStep(0); 
    setImportData([]); 
    setImportErrors([]); 
    setImportProgress(0);
    setRawFileData({ columns: [], rows: [] });
    setFieldMapping({});
  };

  // ── Export helpers ──────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = React.useState(false);

  const buildCsv = (rows) => {
    if (!rows.length) return null;
    const mapped = rows.map(l => ({
      'Lead ID': l.lead_id, Name: l.full_name, Email: l.email, Phone: l.phone,
      Country: l.country, Qualification: l.qualification || '',
      Course: l.course_interested, Status: l.status,
      Segment: l.ai_segment, Score: l.ai_score, Source: l.source,
      'Assigned To': l.assigned_to, 'Follow Up': l.follow_up_date,
      Revenue: l.status === 'Enrolled' ? l.actual_revenue : l.expected_revenue,
      Created: l.created_at,
    }));
    return [
      Object.keys(mapped[0]).join(','),
      ...mapped.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
  };

  const triggerDownload = (csv, filename) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename;
    a.click();
  };

  // Export current page only
  const handleExport = () => {
    if (!filteredLeads.length) { message.warning('No leads to export'); return; }
    const csv = buildCsv(filteredLeads);
    if (csv) {
      triggerDownload(csv, `leads_page_${dayjs().format('YYYY-MM-DD')}.csv`);
      message.success(`Exported ${filteredLeads.length} leads (current page)`);
    }
  };

  // Export ALL leads matching current filters — fetches every page from the API
  const handleExportAll = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const hide = message.loading('Fetching all leads for export…', 0);
    try {
      const PAGE = 1000; // max per request
      let allLeads = [];
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const res = await leadsAPI.getAll({ ...leadQueryParams, skip, limit: PAGE });
        const batch = res.data?.leads || [];
        allLeads = [...allLeads, ...batch];
        const total = res.data?.total || 0;
        skip += PAGE;
        hasMore = skip < total;
      }
      hide();
      if (!allLeads.length) { message.warning('No leads to export'); return; }
      const csv = buildCsv(allLeads);
      if (csv) {
        triggerDownload(csv, `leads_all_${dayjs().format('YYYY-MM-DD')}.csv`);
        message.success(`Exported all ${allLeads.length} leads`);
      }
    } catch (err) {
      hide();
      message.error('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  // ── Download template ──────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const csv = 'full_name,email,phone,whatsapp,country,source,course_interested,qualification,company,status,assigned_to,expected_revenue\nJohn Doe,john@email.com,+919876543210,+919876543210,India,Website,MBBS MD,MBBS,MED,Fresh,,150000';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'leads_import_template.csv';
    a.click();
  };

  // ── Action menu (memoized with useCallback) ───────────────────────────────────────────────────────────
  const getActionMenu = useCallback((record) => ({
    items: [
      { key: 'view', icon: <EyeOutlined />, label: 'View Details', onClick: () => navigate(`/leads/${record.lead_id}`) },
      { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => { form.setFieldsValue({ lead_id: record.lead_id, ...record, qualification: record.qualification || null, company: record.company || null, utm_source: record.utm_source || null, utm_medium: record.utm_medium || null, utm_campaign: record.utm_campaign || null, follow_up_date: record.follow_up_date ? parseDate(record.follow_up_date) : null, campaign_id: record.campaign_id || null, ad_id: record.ad_id || null, adset_id: record.adset_id || null, form_id: record.form_id || null, campaign_name: record.campaign_name || null, ad_name: record.ad_name || null, adset_name: record.adset_name || null, form_name: record.form_name || null, is_organic: record.is_organic || false, external_id: record.external_id || null }); setDrawerVisible(true); } },
      { key: 'whatsapp', icon: <WhatsAppOutlined />, label: 'WhatsApp', onClick: () => window.open(`https://wa.me/${record.phone?.replace(/[^0-9]/g, '')}`) },
      { key: 'wa-template', icon: <span>📋</span>, label: 'Send Template', onClick: () => setTemplateLead(record) },
      { key: 'email', icon: <MailOutlined />, label: 'Email', onClick: () => { window.location.href = `mailto:${record.email}`; } },
      { type: 'divider' },
      { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: () => deleteMutation.mutate(record.lead_id) },
    ],
  }), [navigate, form, deleteMutation]);

  // ── Table columns (memoized to prevent recreation) ────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      title: 'Lead',
      key: 'lead_info',
      fixed: 'left',
      width: 240,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input placeholder="Search name / phone" value={selectedKeys[0]} onChange={e => setSelectedKeys([e.target.value])}
            onPressEnter={() => confirm()} style={{ marginBottom: 8, display: 'block' }} />
          <Space>
            <Button type="primary" size="small" onClick={() => confirm()}>Search</Button>
            <Button size="small" onClick={() => clearFilters()}>Reset</Button>
          </Space>
        </div>
      ),
      onFilter: (v, r) => (r.full_name + ' ' + r.phone).toLowerCase().includes(v.toLowerCase()),
      filterIcon: f => <SearchOutlined style={{ color: f ? '#1890ff' : undefined }} />,
      render: (_, r) => {
        // Compute decay risk badge
        let decayBadge = null;
        if (decayConfig?.enabled && r.last_contact_date) {
          const hoursSilent = (Date.now() - new Date(r.last_contact_date).getTime()) / 3600000;
          if (r.ai_segment === 'Hot') {
            const threshold = decayConfig.hot_to_warm_hours || 48;
            if (hoursSilent >= threshold) {
              decayBadge = <Tooltip title={`No contact for ${Math.round(hoursSilent)}h — will decay to Warm on next engine cycle`}><Tag color="red" style={{ margin: '0 0 0 4px', fontSize: 10, cursor: 'help' }}>🔻 Overdue</Tag></Tooltip>;
            } else if (hoursSilent >= threshold * 0.75) {
              decayBadge = <Tooltip title={`${Math.round(threshold - hoursSilent)}h left before decay to Warm`}><Tag color="orange" style={{ margin: '0 0 0 4px', fontSize: 10, cursor: 'help' }}>⚠️ At Risk</Tag></Tooltip>;
            }
          } else if (r.ai_segment === 'Warm') {
            const threshold = decayConfig.warm_to_stale_hours || 168;
            if (hoursSilent >= threshold) {
              decayBadge = <Tooltip title={`No contact for ${Math.round(hoursSilent / 24)}d — will decay to Follow Up`}><Tag color="orange" style={{ margin: '0 0 0 4px', fontSize: 10, cursor: 'help' }}>🔻 Overdue</Tag></Tooltip>;
            } else if (hoursSilent >= threshold * 0.75) {
              decayBadge = <Tooltip title={`${Math.round((threshold - hoursSilent) / 24)}d left before decay to Follow Up`}><Tag style={{ margin: '0 0 0 4px', fontSize: 10, cursor: 'help', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>⚠️ At Risk</Tag></Tooltip>;
            }
          }
        }
        const editingName  = editingCell.leadId === r.lead_id && editingCell.field === 'full_name';
        const editingPhone = editingCell.leadId === r.lead_id && editingCell.field === 'phone';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={42} style={{ backgroundColor: r.status === 'Hot' ? '#ff4d4f' : r.status === 'Warm' ? '#faad14' : '#52c41a', flexShrink: 0 }}>
              {r.full_name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                {editingName ? (
                  <Input
                    autoFocus size="small" defaultValue={r.full_name}
                    style={{ width: 140, fontWeight: 600 }}
                    onPressEnter={e => commitEdit(r.lead_id, 'full_name', e.target.value)}
                    onBlur={e => commitEdit(r.lead_id, 'full_name', e.target.value)}
                  />
                ) : (
                  <>
                    <a onClick={() => navigate(`/leads/${r.lead_id}`)} style={{ fontWeight: 600, fontSize: 13 }}>{r.full_name}</a>
                    <EditOutlined
                      style={{ fontSize: 10, color: '#bbb', cursor: 'pointer', marginLeft: 2 }}
                      onClick={() => setEditingCell({ leadId: r.lead_id, field: 'full_name' })}
                    />
                  </>
                )}
                {decayBadge}
              </div>
              {editingPhone ? (
                <Input
                  autoFocus size="small" defaultValue={r.phone}
                  prefix={<PhoneOutlined />}
                  style={{ marginTop: 2, width: 150, fontSize: 11 }}
                  onPressEnter={e => commitEdit(r.lead_id, 'phone', e.target.value)}
                  onBlur={e => commitEdit(r.lead_id, 'phone', e.target.value)}
                />
              ) : (
                <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PhoneOutlined /> {r.phone}
                  <EditOutlined
                    style={{ fontSize: 9, color: '#ccc', cursor: 'pointer' }}
                    onClick={() => setEditingCell({ leadId: r.lead_id, field: 'phone' })}
                  />
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      width: 150,
      filters: uniqueCountries.map(c => ({ text: c, value: c })),
      render: (c, r) => (
        <Select
          variant="borderless"
          value={c || undefined}
          placeholder={<Text type="secondary"><GlobalOutlined /> Country</Text>}
          size="small"
          style={{ width: '100%', minWidth: 120 }}
          showSearch
          allowClear
          filterOption={(input, opt) => opt.value.toLowerCase().includes(input.toLowerCase())}
          options={COUNTRIES.map(ct => ({ value: ct, label: ct }))}
          onChange={v => inlineUpdate(r.lead_id, 'country', v || null)}
        />
      ),
    },
    {
      title: 'Course',
      dataIndex: 'course_interested',
      key: 'course',
      width: 200,
      filters: uniqueCourses.map(c => ({ text: c, value: c })),
      render: (c, r) => (
        <Select
          variant="borderless"
          value={c || undefined}
          placeholder={<Text type="secondary"><BookOutlined /> Course</Text>}
          size="small"
          style={{ width: '100%', minWidth: 160 }}
          showSearch
          allowClear
          filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
          options={uniqueCourses.map(co => ({ value: co, label: co }))}
          onChange={v => inlineUpdate(r.lead_id, 'course_interested', v || null)}
        />
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 140,
      filters: uniqueSources.map(s => ({ text: s, value: s })),
      render: (s, r) => (
        <Select
          variant="borderless"
          value={s || undefined}
          placeholder={<Text type="secondary">Source</Text>}
          size="small"
          style={{ width: '100%', minWidth: 110 }}
          allowClear
          options={SOURCE_OPTIONS.map(o => ({ value: o, label: o }))}
          onChange={v => inlineUpdate(r.lead_id, 'source', v || null)}
        />
      ),
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      width: 120,
      filters: COMPANY_OPTIONS.map(c => ({ text: c, value: c })),
      render: (c, r) => (
        <Select
          variant="borderless"
          value={c || undefined}
          placeholder={<Text type="secondary">Company</Text>}
          size="small"
          style={{ width: '100%', minWidth: 90 }}
          allowClear
          options={COMPANY_OPTIONS.map(o => ({ value: o, label: o }))}
          onChange={v => inlineUpdate(r.lead_id, 'company', v || null)}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      filters: uniqueStatuses.map(s => ({ text: s, value: s })),
      render: (s, r) => (
        <Select
          variant="borderless"
          value={s || undefined}
          size="small"
          style={{ width: '100%', minWidth: 130 }}
          onChange={v => inlineUpdate(r.lead_id, 'status', v)}
          options={STATUS_OPTIONS.map(opt => ({
            value: opt,
            label: <Tag color={STATUS_COLOR_MAP[opt] || 'default'} style={{ marginRight: 0 }}>{opt}</Tag>,
          }))}
        />
      ),
    },
    {
      title: 'AI Score',
      dataIndex: 'ai_score',
      key: 'ai_score',
      width: 130,
      sorter: (a, b) => (a.ai_score || 0) - (b.ai_score || 0),
      render: (score) => (
        <div>
          <Progress percent={score || 0} size="small"
            strokeColor={{ '0%': '#108ee9', '50%': '#87d068', '100%': '#ff4d4f' }}
            format={p => `${p?.toFixed(0)}`} />
        </div>
      ),
    },
    {
      title: 'Assigned To',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      width: 160,
      filters: [{ text: 'Unassigned', value: '__none__' }, ...uniqueAssigned.map(u => ({ text: u, value: u }))],
      render: (val, r) => (
        <Select value={val || undefined} placeholder="Assign..." size="small" style={{ width: '100%' }} allowClear
          disabled={isCounselor}
          onChange={v => inlineUpdate(r.lead_id, 'assigned_to', v || null)}
          options={isCounselor
            ? (authUser?.full_name ? [{ label: authUser.full_name, value: authUser.full_name }] : [])
            : users.map(u => ({ label: u.full_name, value: u.full_name }))} />
      ),
    },
    {
      title: 'Revenue',
      key: 'revenue',
      width: 120,
      sorter: (a, b) => {
        const aR = a.status === 'Enrolled' ? a.actual_revenue : a.expected_revenue;
        const bR = b.status === 'Enrolled' ? b.actual_revenue : b.expected_revenue;
        return (aR || 0) - (bR || 0);
      },
      render: (_, r) => {
        const isEnrolled = r.status === 'Enrolled';
        const field = isEnrolled ? 'actual_revenue' : 'expected_revenue';
        const rev = isEnrolled ? r.actual_revenue : r.expected_revenue;
        const isEditingRev = editingCell.leadId === r.lead_id && editingCell.field === field;
        if (isEditingRev) {
          return (
            <InputNumber
              autoFocus
              size="small"
              defaultValue={rev || 0}
              style={{ width: 100 }}
              min={0}
              formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/₹\s?|(,*)/g, '')}
              onChange={v => setEditingValue(v)}
              onPressEnter={() => commitEdit(r.lead_id, field, editingValue ?? rev ?? 0)}
              onBlur={() => commitEdit(r.lead_id, field, editingValue ?? rev ?? 0)}
            />
          );
        }
        return (
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => { setEditingCell({ leadId: r.lead_id, field }); setEditingValue(rev || 0); }}
          >
            <div style={{ fontWeight: 600, color: isEnrolled ? '#52c41a' : '#faad14', display: 'flex', alignItems: 'center', gap: 4 }}>
              ₹{((rev || 0) / 1000).toFixed(0)}K
              <EditOutlined style={{ fontSize: 10, color: '#ccc' }} />
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>{isEnrolled ? 'Actual' : 'Expected'}</Text>
          </div>
        );
      },
    },
    {
      title: 'Follow Up',
      dataIndex: 'follow_up_date',
      key: 'follow_up_date',
      width: 140,
      sorter: (a, b) => new Date(a.follow_up_date || 0) - new Date(b.follow_up_date || 0),
      ...makeDateFilter('follow_up_date'),
      render: (date, r) => {
        const d = date ? parseDate(date) : null;
        const overdue = d && d.isBefore(dayjs(), 'day');
        const isToday  = d && d.isSame(dayjs(), 'day');
        return (
          <DatePicker
            variant="borderless"
            value={d}
            showTime={{ format: 'hh:mm A', use12Hours: true }}
            format="MMM DD hh:mm A"
            size="small"
            placeholder="Set follow-up"
            style={{
              width: '100%', minWidth: 150,
              color: overdue ? '#ff4d4f' : isToday ? '#faad14' : undefined,
            }}
            allowClear
            onChange={v => inlineUpdate(r.lead_id, 'follow_up_date', v ? v.toISOString() : null)}
            renderExtraFooter={() =>
              d ? (
                <div style={{ fontSize: 11, color: '#888', padding: '2px 4px' }}>
                  {d.fromNow()}
                  {overdue && <Tag color="red" style={{ marginLeft: 6, fontSize: 10 }}>Overdue</Tag>}
                  {isToday && <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>Today</Tag>}
                </div>
              ) : null
            }
          />
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      ...makeDateFilter('created_at'),
      render: (d) => {
        const parsed = parseDate(d);
        return (
          <Tooltip title={parsed ? parsed.format('DD MMM YYYY, hh:mm A') : '—'}>
            <Text type="secondary">{parsed ? parsed.fromNow() : '—'}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Last Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      sorter: (a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at),
      ...makeDateFilter('updated_at'),
      render: (d, r) => {
        const date = d || r.created_at;
        const parsed = parseDate(date);
        return (
          <Tooltip title={parsed ? parsed.format('DD MMM YYYY, hh:mm A') : '—'}>
            <Text type="secondary">{parsed ? parsed.fromNow() : '—'}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, r) => (
        <Space>
          <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/leads/${r.lead_id}`)} />
          <Tooltip title="WhatsApp Chat">
            <Button
              size="small"
              icon={<MessageOutlined />}
              style={{ background: '#25d366', borderColor: '#25d366', color: '#fff' }}
              onClick={() => setChatLead(r)}
            />
          </Tooltip>
          <Dropdown menu={getActionMenu(r)} trigger={['click']}>
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ], [uniqueCountries, uniqueCourses, uniqueSources, uniqueStatuses, uniqueAssigned, isCounselor, authUser, users, navigate, decayConfig, updateMutation, inlineUpdate, handleTableChange, getActionMenu, editingCell, setEditingCell, commitEdit, setEditingValue]);

  const activeAdvFilters = Object.values(advFilters).filter(v => v && (Array.isArray(v) ? v.length > 0 : true)).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          FIELD MAPPING MODAL (NEW)
      ══════════════════════════════════════════════════════════════════════ */}
      <FieldMappingModal
        visible={mappingVisible}
        onCancel={() => {
          setMappingVisible(false);
          setRawFileData({ columns: [], rows: [] });
        }}
        fileColumns={rawFileData.columns}
        previewData={rawFileData.rows}
        onConfirm={handleMappingConfirm}
      />

      {/* ── Stats Row ── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Leads', value: stats.total, icon: <TeamOutlined />, color: '#1890ff' },
          { label: 'Hot 🔥', value: stats.hot, icon: <FireOutlined />, color: '#ff4d4f' },
          { label: 'Warm ⚡', value: stats.warm, icon: <ThunderboltOutlined />, color: '#faad14' },
          { label: 'Enrolled ✅', value: stats.enrolled, icon: <StarOutlined />, color: '#52c41a' },
          { label: 'Follow-up Today', value: stats.followUpToday, icon: <CalendarOutlined />, color: '#722ed1' },
          { label: 'Overdue ⚠️', value: stats.overdue, icon: <ClockCircleOutlined />, color: stats.overdue > 0 ? '#ff4d4f' : '#8c8c8c' },
          { label: 'Avg Score', value: `${stats.avgScore}`, icon: null, color: '#13c2c2' },
          { label: 'Revenue', value: `₹${(stats.revenue / 1000).toFixed(0)}K`, icon: null, color: '#52c41a' },
        ].map(({ label, value, icon, color }) => (
          <Col xs={12} sm={8} md={6} lg={3} key={label}>
            <Card size="small" hoverable style={{ textAlign: 'center', cursor: 'pointer' }}>
              <Statistic title={<span style={{ fontSize: 11 }}>{label}</span>} value={value}
                prefix={icon} valueStyle={{ color, fontSize: 20 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Main Card ── */}
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>Lead Management</Title>
            <Badge count={totalLeads} style={{ backgroundColor: '#1890ff' }} />
            {isFetching && !isLoading && (
              <span style={{ fontSize: 12, color: '#1890ff', fontWeight: 400 }}>
                <SyncOutlined spin style={{ marginRight: 4 }} />refreshing…
              </span>
            )}
          </Space>
        }
        extra={
          <Space wrap>
            <Segmented value={quickFilter} onChange={setQuickFilter}
              options={[
                { label: 'All', value: 'all' },
                { label: '🆕 Fresh', value: 'fresh' },
                { label: '🔥 Hot', value: 'hot' },
                { label: '⚡ Warm', value: 'warm' },
                { label: '📅 Created Today', value: 'today' },
                { label: '📞 Follow-up Today', value: 'followup_today' },
                { label: '⚠️ Overdue', value: 'overdue' },
              ]} />
            <Input.Search 
              placeholder="Search name / email / phone..." 
              allowClear 
              style={{ width: 240 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)} 
              prefix={<SearchOutlined />}
              suffix={searchText !== debouncedSearch && <SyncOutlined spin style={{ color: '#1890ff' }} />}
            />
            <Tooltip title={activeAdvFilters ? `${activeAdvFilters} filters active` : 'Advanced Filters'}>
              <Badge count={activeAdvFilters} size="small">
                <Button icon={<FunnelPlotOutlined />} type={activeAdvFilters ? 'primary' : 'default'}
                  onClick={() => setFilterDrawerVisible(true)}>Filters</Button>
              </Badge>
            </Tooltip>
            <Button icon={<SyncOutlined />} onClick={() => { setAdvFilters({}); setFilters({}); setSearchText(''); setQuickFilter('all'); message.success('Filters cleared'); }}>Clear</Button>
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>Template</Button>
            <Button icon={<ImportOutlined />} onClick={() => { resetImport(); setImportVisible(true); }}>Import</Button>
            <Dropdown
              menu={{
                items: [
                  { key: 'page', label: `Export current page (${filteredLeads.length})`, icon: <ExportOutlined />, onClick: handleExport },
                  { key: 'all', label: `Export all ${totalLeads} leads`, icon: <DownloadOutlined />, onClick: handleExportAll },
                ],
              }}
            >
              <Button icon={<ExportOutlined />} loading={isExporting}>Export</Button>
            </Dropdown>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ assigned_to: authUser?.full_name || null }); setDrawerVisible(true); }}>Add Lead</Button>
          </Space>
        }
      >
        {/* Error Alert */}
        {isError && (
          <Alert
            style={{ marginBottom: 16 }}
            message={
              error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')
                ? '⏳ Server is waking up — please wait a moment'
                : 'Failed to load leads'
            }
            description={
              error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')
                ? 'The backend server on Render went to sleep due to inactivity. It takes about 30–60 seconds to restart. Click Retry or wait — it will auto-retry in 15 seconds.'
                : error?.message || 'An error occurred while fetching leads. Please try again.'
            }
            type={error?.code === 'ECONNABORTED' || error?.message?.includes('timeout') ? 'warning' : 'error'}
            showIcon
            action={
              <Space>
                <Button size="small" type="primary" onClick={() => refetch()}>
                  Retry Now
                </Button>
                {(error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) && (
                  <AutoRetryCountdown onRetry={refetch} seconds={15} />
                )}
              </Space>
            }
            closable
          />
        )}

        {/* Bulk bar */}
        {selectedRows.length > 0 && (
          <Alert style={{ marginBottom: 12 }}
            message={
              <Space wrap>
                <Text strong>{selectedRows.length} selected</Text>
                <Button size="small" onClick={() => setSelectedRows(filteredLeads.map(l => l.lead_id))}>Select All {filteredLeads.length}</Button>
                <Button size="small" onClick={() => setSelectedRows([])}>Clear</Button>
                <Select
                  size="small"
                  placeholder="Assign to user..."
                  showSearch
                  style={{ width: 200 }}
                  options={users.map(u => ({ label: `${u.full_name} (${u.role})`, value: u.full_name }))}
                  onChange={async (userName) => {
                    try {
                      await leadsAPI.bulkUpdate(selectedRows, { assigned_to: userName });
                      message.success(`${selectedRows.length} leads assigned to ${userName}`);
                      setSelectedRows([]);
                      queryClient.invalidateQueries({ queryKey: ['leads'] });
                    } catch {
                      message.error('Assignment failed');
                    }
                  }}
                />
                <Button size="small" type="primary" onClick={() => setBulkDrawerVisible(true)}>Bulk Update</Button>
                <Button size="small" danger onClick={() => {
                  Modal.confirm({
                    title: `Delete ${selectedRows.length} leads?`,
                    content: 'This action cannot be undone.',
                    onOk: async () => {
                      const total = selectedRows.length;
                      const results = await Promise.allSettled(
                        selectedRows.map(id => leadsAPI.delete(id))
                      );
                      const failed = results.filter(r => r.status === 'rejected').length;
                      setSelectedRows([]);
                      queryClient.invalidateQueries({ queryKey: ['leads'] });
                      if (failed === 0) {
                        message.success(`Successfully deleted ${total} leads!`);
                      } else {
                        message.warning(`Deleted ${total - failed} leads. ${failed} failed.`);
                      }
                    },
                  });
                }}>Bulk Delete</Button>
              </Space>
            } type="info" showIcon />
        )}

        <Table
          columns={columns}
          dataSource={filteredLeads}
          loading={{
            spinning: isLoading || isFetching,
            tip: isLoading ? '⏳ Loading leads… (if slow, server is waking up — takes ~30s)' : 'Refreshing…',
          }}
          rowKey="lead_id"
          scroll={{ x: 1800 }}
          size="middle"
          onChange={handleTableChange}
          rowSelection={{
            selectedRowKeys: selectedRows,
            onChange: (keys) => setSelectedRows(keys),
            preserveSelectedRowKeys: true,
          }}
          pagination={{
            total: totalLeads,
            pageSize: pageSize,
            current: currentPage,
            showSizeChanger: true,
            pageSizeOptions: ['25','50','100','250','500'],
            showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} leads`,
            position: ['bottomCenter'],
            onChange: (page, size) => {
              setCurrentPage(page);
              if (size !== pageSize) {
                setPageSize(size);
                setCurrentPage(1);
              }
            },
            showQuickJumper: true,
          }}
          locale={{ emptyText: <Empty description="No leads found"><Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ assigned_to: authUser?.full_name || null }); setDrawerVisible(true); }}>Add First Lead</Button></Empty> }}
          rowClassName={r => r.follow_up_date && parseDate(r.follow_up_date).isBefore(dayjs(), 'day') ? 'overdue-row' : ''}
        />
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          IMPORT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        title={<Space><ImportOutlined /> Bulk Import Leads</Space>}
        open={importVisible}
        onCancel={() => { setImportVisible(false); resetImport(); }}
        footer={null}
        width={700}
      >
        <Steps current={importStep} style={{ marginBottom: 24 }}
          items={[{ title: 'Upload' }, { title: 'Preview' }, { title: 'Importing' }, { title: 'Done' }]} />

        {/* Step 0: Upload */}
        {importStep === 0 && (
          <div>
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message="Supported Formats: CSV, Excel (.xlsx, .xls), ODS"
              description={
                <div>
                  Required columns: <Text code>full_name</Text>, <Text code>phone</Text><br />
                  Optional: email, country, source, course_interested, status, assigned_to, expected_revenue, whatsapp<br />
                  <Button size="small" type="link" icon={<DownloadOutlined />} onClick={downloadTemplate} style={{ padding: 0, marginTop: 4 }}>
                    Download template CSV
                  </Button>
                </div>
              }
            />
            <Dragger beforeUpload={handleFileRead} accept=".csv,.xlsx,.xls,.ods" showUploadList={false}>
              <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} /></p>
              <p className="ant-upload-text">Click or drag file here to upload</p>
              <p className="ant-upload-hint">Supports CSV, Excel (.xlsx, .xls), and ODS. Max 5,000 rows.</p>
            </Dragger>
          </div>
        )}

        {/* Step 1: Preview */}
        {importStep === 1 && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <Statistic title="Valid Rows" value={importData.length} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} valueStyle={{ color: '#52c41a' }} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#fff2f0', border: '1px solid #ffccc7' }}>
                  <Statistic title="Errors" value={importErrors.length} prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />} valueStyle={{ color: '#ff4d4f' }} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic title="Total Rows" value={importData.length + importErrors.length} />
                </Card>
              </Col>
            </Row>

            {importErrors.length > 0 && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message={`${importErrors.length} rows skipped`}
                description={<ul style={{ marginBottom: 0 }}>{importErrors.slice(0, 5).map((e, i) => <li key={i}>Row {e.row}: {e.msg}</li>)}{importErrors.length > 5 && <li>...and {importErrors.length - 5} more</li>}</ul>}
              />
            )}

            <Table
              size="small"
              scroll={{ x: 600, y: 300 }}
              dataSource={importData.slice(0, 10)}
              rowKey={(_, i) => i}
              pagination={false}
              columns={[
                { title: 'Name', dataIndex: 'full_name', width: 150 },
                { title: 'Phone', dataIndex: 'phone', width: 130 },
                { title: 'Email', dataIndex: 'email', width: 160, ellipsis: true },
                { title: 'Country', dataIndex: 'country', width: 100 },
                { title: 'Course', dataIndex: 'course_interested', width: 150, ellipsis: true },
                { title: 'Status', dataIndex: 'status', width: 100, render: s => <Tag>{s}</Tag> },
              ]}
            />
            {importData.length > 10 && <Text type="secondary" style={{ fontSize: 12 }}>Showing first 10 of {importData.length} rows</Text>}

            <Divider />
            <Space>
              <Button onClick={() => setImportStep(0)}>Back</Button>
              <Button type="primary" onClick={handleImportSubmit} disabled={!importData.length}
                icon={<UploadOutlined />}>
                Import {importData.length} Leads
              </Button>
            </Space>
          </div>
        )}

        {/* Step 2: Importing */}
        {importStep === 2 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Progress type="circle" percent={importProgress} status={importProgress < 100 ? 'active' : 'success'} />
            <p style={{ marginTop: 16, fontSize: 16 }}>
              {importProgress < 100 ? 'Processing bulk import...' : 'Import complete!'}
            </p>
            <p style={{ color: '#8c8c8c' }}>Importing {importData.length} leads with AI scoring</p>
          </div>
        )}

        {/* Step 3: Done */}
        {importStep === 3 && (
          <div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
              <Title level={3} style={{ marginTop: 16 }}>Import Complete!</Title>
              <p style={{ fontSize: 16, marginBottom: 24 }}>
                <Text strong>{importData.length - importErrors.filter(e => e.msg.includes(':')).length}</Text> leads imported successfully
                {importErrors.filter(e => e.msg.includes(':')).length > 0 && (
                  <span>, <Text type="danger" strong>{importErrors.filter(e => e.msg.includes(':')).length}</Text> failed</span>
                )}
              </p>
            </div>
            
            {importErrors.filter(e => e.msg.includes(':')).length > 0 && (
              <>
                <Divider />
                {/* Duplicates section */}
                {importErrors.filter(e => e.duplicate).length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    message={`${importErrors.filter(e => e.duplicate).length} duplicate lead(s) — already in CRM`}
                    description={
                      <div style={{ maxHeight: 250, overflow: 'auto', marginTop: 8 }}>
                        {importErrors.filter(e => e.duplicate).map((e, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', marginBottom: 6,
                            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                          }}>
                            <div>
                              <Text strong style={{ fontSize: 13 }}>{e.name}</Text>
                              <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>Row {e.row}</span>
                              {e.existing_lead_id && (
                                <Tag style={{ marginLeft: 8 }} color="blue">{e.existing_lead_id}</Tag>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 12, color: '#374151' }}>
                                <span style={{ fontWeight: 600 }}>Owner: </span>
                                <Tag color={e.existing_owner && e.existing_owner !== 'Unassigned' ? 'purple' : 'default'}>
                                  {e.existing_owner || 'Unassigned'}
                                </Tag>
                              </div>
                              {e.existing_status && (
                                <Tag color="green" style={{ marginTop: 4 }}>{e.existing_status}</Tag>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    }
                    style={{ marginBottom: 16, textAlign: 'left' }}
                  />
                )}
                {/* Other errors section */}
                {importErrors.filter(e => e.msg.includes(':') && !e.duplicate).length > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    message={`${importErrors.filter(e => e.msg.includes(':') && !e.duplicate).length} leads failed to import`}
                    description={
                      <div style={{ maxHeight: 200, overflow: 'auto' }}>
                        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                          {importErrors.filter(e => e.msg.includes(':') && !e.duplicate).map((e, i) => (
                            <li key={i} style={{ marginBottom: 4 }}>
                              <Text code>Row {e.row}</Text>: {e.msg.split(':').slice(1).join(':').trim()}
                            </li>
                          ))}
                        </ul>
                      </div>
                    }
                    style={{ marginBottom: 24, textAlign: 'left' }}
                  />
                )}
              </>
            )}
            
            <Space style={{ justifyContent: 'center', display: 'flex' }}>
              <Button onClick={() => { setImportVisible(false); resetImport(); }}>Close</Button>
              <Button type="primary" onClick={() => { setImportVisible(false); resetImport(); refetch(); }}>View Leads</Button>
            </Space>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          ADD / EDIT LEAD DRAWER
      ══════════════════════════════════════════════════════════════════════ */}
      <Drawer
        title={form.getFieldValue('lead_id') ? 'Edit Lead' : '➕ Add New Lead'}
        width={620}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); form.resetFields(); }}
        extra={
          <Space>
            <Button onClick={() => { setDrawerVisible(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" onClick={() => form.submit()} loading={createMutation.isPending}>Save</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical"
          onFinish={async v => {
            // Only check duplicates when creating (no lead_id on form = new record)
            const isNew = !v.lead_id;
            const leadData = {
              full_name: v.full_name,
              email: v.email || null,
              phone: v.phone,
              whatsapp: v.whatsapp || v.phone,
              country: v.country,
              source: v.source || 'Direct',
              course_interested: v.course_interested,
              // Always default to the logged-in user's name if not explicitly assigned
              assigned_to: v.assigned_to || authUser?.full_name || null,
              qualification: v.qualification || null,
              company: v.company || null,
              status: v.status || 'Fresh',
              follow_up_date: v.follow_up_date ? v.follow_up_date.toISOString() : null,
              notes: v.notes || null,
              expected_revenue: v.expected_revenue != null ? Number(v.expected_revenue) : null,
              actual_revenue:   v.actual_revenue   != null ? Number(v.actual_revenue)   : null,
              utm_source:   v.utm_source   || null,
              utm_medium:   v.utm_medium   || null,
              utm_campaign: v.utm_campaign || null,
            };

            if (isNew) {
              try {
                const res = await duplicatesAPI.check({
                  phone: leadData.phone,
                  email: leadData.email,
                  full_name: leadData.full_name,
                  country: leadData.country,
                });
                const dupes = res.data?.duplicates || [];
                if (dupes.length > 0) {
                  setPendingLeadData(leadData);
                  setDupCandidates(dupes);
                  setDupModalOpen(true);
                  return; // don't create yet — wait for user decision
                }
              } catch {
                // If duplicate-check fails, proceed with creation normally
              }
              createMutation.mutate(leadData);
            } else {
              // Update existing lead
              updateMutation.mutate({ leadId: v.lead_id, data: leadData });
              setDrawerVisible(false);
              form.resetFields();
            }
          }}>
          <Form.Item name="lead_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} placeholder="John Doe" size="large" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input prefix={<MailOutlined />} placeholder="john@email.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
                <Input prefix={<PhoneOutlined />} placeholder="+91 9876543210" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="country" label="Country" rules={[{ required: true, message: 'Please select or enter a country' }]}>
                <AutoComplete
                  placeholder="Search or type a country…"
                  allowClear
                  filterOption={(input, option) =>
                    option.value.toLowerCase().includes(input.toLowerCase())
                  }
                  options={COUNTRIES.map(c => ({ value: c, label: c }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="source" label="Source">
                <Select placeholder="Lead source">
                  {['Website','Facebook','Google Ads','Instagram','WhatsApp','Referral','Direct','LinkedIn','YouTube'].map(s => <Option key={s} value={s}>{s}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="course_interested" label="Course Interested" rules={[{ required: true }]}>
                <Select placeholder="Select course" showSearch
                  onChange={name => { const c = courses.find(c => c.course_name === name); if (c) { form.setFieldValue('expected_revenue', c.price); message.info(`Price ₹${(c.price/1000).toFixed(0)}K auto-filled`); } }}
                  filterOption={(i, o) => o.children.toLowerCase().includes(i.toLowerCase())}>
                  {courses.map(c => <Option key={c.id} value={c.course_name}>{c.course_name} — ₹{(c.price/1000).toFixed(0)}K</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="qualification" label="Qualification">
                <Select placeholder="Select" allowClear showSearch>
                  {[
                    'MBBS','MD','MS','DNB','MDS','BDS','BAMS','BHMS',
                    'BPT','MPT','BUMS','BNYS','BSc Nursing','MSc Nursing',
                    'B.Pharm','M.Pharm','Pharm.D','DMLT','BMLT',
                    'BOT','MOT','BSc MLT','MSc MLT','Other',
                  ].map(q => <Option key={q} value={q}>{q}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="company" label="Company">
                <Select placeholder="Select company" allowClear>
                  {COMPANY_OPTIONS.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status" initialValue="Fresh">
                <Select>{STATUS_OPTIONS.map(s => <Option key={s} value={s}>{s}</Option>)}</Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="follow_up_date" label="Follow-up Date & Time">
                <DatePicker
                  showTime={{ format: 'hh:mm A', use12Hours: true }}
                  format="MMM DD, YYYY hh:mm A"
                  style={{ width: '100%' }}
                  placeholder="Select date and time"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="expected_revenue" label="Expected Revenue (₹)">
                <InputNumber style={{ width: '100%' }} min={0} formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/₹\s?|(,*)/g, '')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actual_revenue" label="Actual Revenue (₹)">
                <InputNumber style={{ width: '100%' }} min={0} formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/₹\s?|(,*)/g, '')} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="assigned_to" label="Assign To">
            <Select placeholder="Select counselor" allowClear showSearch
              disabled={isCounselor}
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={isCounselor
                ? (authUser?.full_name ? [{ label: `${authUser.full_name} (Counselor)`, value: authUser.full_name }] : [])
                : users.map(u => ({ label: `${u.full_name} (${u.role})`, value: u.full_name }))} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Initial notes..." showCount maxLength={500} />
          </Form.Item>
          <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
            <Text strong>Follow-up Notes Template</Text>
            <Row gutter={8} style={{ marginTop: 8 }}>
              <Col span={24}>
                <Form.Item name="note_main_category" label="Main Category" style={{ marginBottom: 8 }}>
                  <Select
                    placeholder="Select main category"
                    allowClear
                    onChange={() => form.setFieldsValue({ note_sub_status: undefined, note_call_stage: '2 Call' })}
                    options={noteMainCategoryOptions.map(v => ({ label: v, value: v }))}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="note_sub_status" label="Status" style={{ marginBottom: 8 }}>
                  <Select
                    placeholder="Select status"
                    allowClear
                    disabled={!noteMainCategory}
                    onChange={() => form.setFieldValue('note_call_stage', '2 Call')}
                    options={noteSubStatusOptions.map(v => ({ label: v, value: v }))}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="note_call_stage" label="Call Stage" initialValue="2 Call" style={{ marginBottom: 8 }}>
                  <Select
                    placeholder="Select call stage"
                    allowClear
                    disabled={!noteSubStatus}
                    options={NOTE_CALL_STAGE_OPTIONS.map(v => ({ label: v, value: v }))}
                  />
                </Form.Item>
              </Col>
            </Row>
            {selectedTemplateText ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 8 }}
                message="Template Preview"
                description={selectedTemplateText}
              />
            ) : null}
            <Button icon={<MessageOutlined />} onClick={insertSelectedTemplateIntoNotes}>
              Insert Template in Notes
            </Button>
          </Card>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="utm_source" label="UTM Source">
                <Input placeholder="google, facebook…" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="utm_medium" label="UTM Medium">
                <Input placeholder="cpc, organic…" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="utm_campaign" label="UTM Campaign">
                <Input placeholder="mbbs_jan26…" />
              </Form.Item>
            </Col>
          </Row>
          
          {/* Meta Ads Fields */}
          <Divider orientation="left" style={{ margin: '8px 0' }}>Meta Ads Information</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="campaign_id" label="Campaign ID">
                <Input placeholder="Meta campaign ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="campaign_name" label="Campaign Name">
                <Input placeholder="Campaign name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ad_id" label="Ad ID">
                <Input placeholder="Meta ad ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ad_name" label="Ad Name">
                <Input placeholder="Ad name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="adset_id" label="Adset ID">
                <Input placeholder="Meta adset ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="adset_name" label="Adset Name">
                <Input placeholder="Adset name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="form_id" label="Form ID">
                <Input placeholder="Meta form ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="form_name" label="Form Name">
                <Input placeholder="Form name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="external_id" label="External ID">
                <Input placeholder="Sheet/external ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_organic" label="Is Organic" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>

      {/* ══════════════════════════════════════════════════════════════════════
          BULK UPDATE DRAWER
      ══════════════════════════════════════════════════════════════════════ */}
      <Drawer
        title={`✏️ Bulk Update — ${selectedRows.length} leads`}
        width={440}
        open={bulkDrawerVisible}
        onClose={() => setBulkDrawerVisible(false)}
        extra={
          <Space>
            <Button onClick={() => setBulkDrawerVisible(false)}>Cancel</Button>
            <Button type="primary" onClick={() => bulkForm.submit()}>Apply to All</Button>
          </Space>
        }
      >
        <Alert message="Only filled fields will be updated. Blank fields stay unchanged." type="warning" showIcon style={{ marginBottom: 16 }} />
        <Form form={bulkForm} layout="vertical"
          onFinish={v => {
            const updates = {};
            if (v.status) updates.status = v.status;
            if (v.assigned_to) updates.assigned_to = v.assigned_to;
            if (v.follow_up_date) updates.follow_up_date = v.follow_up_date.toISOString();
            if (v.source) updates.source = v.source;
            
            // Check if at least one field is filled
            if (Object.keys(updates).length === 0) {
              message.warning('Please fill at least one field to update');
              return;
            }
            
            bulkMutation.mutate({ leadIds: selectedRows, updates });
          }}>
          <Form.Item name="status" label="Status"><Select placeholder="Keep unchanged" allowClear>{STATUS_OPTIONS.map(s => <Option key={s} value={s}>{s}</Option>)}</Select></Form.Item>
          <Form.Item name="assigned_to" label="Assign To">
            <Select placeholder="Keep unchanged" allowClear showSearch
              options={users.map(u => ({ label: `${u.full_name} (${u.role})`, value: u.full_name }))} />
          </Form.Item>
          <Form.Item name="follow_up_date" label="Follow-up Date & Time">
            <DatePicker
              showTime={{ format: 'hh:mm A', use12Hours: true }}
              format="MMM DD, YYYY hh:mm A"
              style={{ width: '100%' }}
              placeholder="Select date and time"
            />
          </Form.Item>
          <Form.Item name="source" label="Source"><Select placeholder="Keep unchanged" allowClear>{['Website','Facebook','Google Ads','Instagram','Referral','Direct','LinkedIn','YouTube'].map(s => <Option key={s} value={s}>{s}</Option>)}</Select></Form.Item>
        </Form>
      </Drawer>

      {/* ══════════════════════════════════════════════════════════════════════
          ADVANCED FILTER DRAWER
      ══════════════════════════════════════════════════════════════════════ */}
      <Drawer
        title={<Space><FunnelPlotOutlined /> Advanced Filters</Space>}
        width={400}
        open={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        extra={
          <Button onClick={() => { setAdvFilters({}); setFilterDrawerVisible(false); message.success('Filters cleared'); }}>
            Clear All
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>

          <div>
            <Text strong>Status</Text>
            <Select mode="multiple" style={{ width: '100%', marginTop: 6 }} placeholder="Any status"
              value={advFilters.status || []} onChange={v => setAdvFilters(f => ({ ...f, status: v }))}>
              {STATUS_OPTIONS.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </div>

          <div>
            <Text strong>Segment</Text>
            <Select mode="multiple" style={{ width: '100%', marginTop: 6 }} placeholder="Any segment"
              value={advFilters.segment || []} onChange={v => setAdvFilters(f => ({ ...f, segment: v }))}>
              {uniqueSegments.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </div>

          <div>
            <Text strong>Country</Text>
            <Select mode="multiple" style={{ width: '100%', marginTop: 6 }} placeholder="Any country" showSearch
              value={advFilters.country || []} onChange={v => setAdvFilters(f => ({ ...f, country: v }))}>
              {uniqueCountries.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </div>

          <div>
            <Text strong>Course</Text>
            <Select mode="multiple" style={{ width: '100%', marginTop: 6 }} placeholder="Any course" showSearch
              value={advFilters.course || []} onChange={v => setAdvFilters(f => ({ ...f, course: v }))}>
              {uniqueCourses.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </div>

          <div>
            <Text strong>Source</Text>
            <Select mode="multiple" style={{ width: '100%', marginTop: 6 }} placeholder="Any source"
              value={advFilters.source || []} onChange={v => setAdvFilters(f => ({ ...f, source: v }))}>
              {uniqueSources.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </div>

          <div>
            <Text strong>Company</Text>
            <Select mode="multiple" style={{ width: '100%', marginTop: 6 }} placeholder="Any company"
              value={advFilters.company || []} onChange={v => setAdvFilters(f => ({ ...f, company: v }))}>
              {COMPANY_OPTIONS.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </div>

          <div>
            <Text strong>Assigned To</Text>
            <Select mode="multiple" style={{ width: '100%', marginTop: 6 }} placeholder="Any counselor" showSearch
              disabled={isCounselor}
              value={advFilters.assigned || []} onChange={v => setAdvFilters(f => ({ ...f, assigned: v }))}>
              {uniqueAssigned.map(u => <Option key={u} value={u}>{u}</Option>)}
            </Select>
          </div>

          <div>
            <Text strong>AI Score Range</Text>
            <Row gutter={8} style={{ marginTop: 6 }}>
              <Col span={12}><InputNumber placeholder="Min (0)" min={0} max={100} style={{ width: '100%' }} value={advFilters.minScore} onChange={v => setAdvFilters(f => ({ ...f, minScore: v }))} /></Col>
              <Col span={12}><InputNumber placeholder="Max (100)" min={0} max={100} style={{ width: '100%' }} value={advFilters.maxScore} onChange={v => setAdvFilters(f => ({ ...f, maxScore: v }))} /></Col>
            </Row>
          </div>

          <div>
            <Text strong>Follow-up Date</Text>
            <Select style={{ width: '100%', marginTop: 6 }} placeholder="Any time" allowClear
              value={advFilters.followUp?.mode}
              onChange={v => setAdvFilters(f => ({ ...f, followUp: v ? { mode: v } : null }))}>
              <Option value="today">Today</Option>
              <Option value="overdue">Overdue</Option>
              <Option value="on">On exact date</Option>
              <Option value="before">Before date</Option>
              <Option value="after">After date</Option>
              <Option value="between">Between dates</Option>
            </Select>
            {advFilters.followUp?.mode === 'between' && (
              <RangePicker style={{ width: '100%', marginTop: 6 }}
                onChange={r => setAdvFilters(f => ({ ...f, followUp: { ...f.followUp, range: r?.map(d => d.format('YYYY-MM-DD')) } }))} />
            )}
            {['on','before','after'].includes(advFilters.followUp?.mode) && (
              <DatePicker style={{ width: '100%', marginTop: 6 }}
                onChange={d => setAdvFilters(f => ({ ...f, followUp: { ...f.followUp, date: d?.format('YYYY-MM-DD') } }))} />
            )}
          </div>

          <Button type="primary" block onClick={() => setFilterDrawerVisible(false)}>
            Apply Filters ({activeAdvFilters} active)
          </Button>
        </Space>
      </Drawer>

      <style>{`.overdue-row { background: #fff2f0 !important; }`}</style>

      {/* ── Enrollment Payment Gate Modal ────────────────────────────────── */}
      <Modal
        title="📋 Enrollment Payment Details — Required"
        open={!!enrollTarget}
        onCancel={() => { setEnrollTarget(null); enrollForm.resetFields(); }}
        footer={null}
        width={520}
        destroyOnHidden
      >
        <div style={{
          padding: '10px 14px', background: '#eff6ff', borderRadius: 8,
          marginBottom: 16, fontSize: 13, color: '#1d4ed8', border: '1px solid #bfdbfe',
        }}>
          💡 Before marking this lead as <strong>Enrolled</strong>, please fill in the fee and EMI details.
          This data will be visible to the Accounts team.
        </div>
        <Form
          form={enrollForm}
          layout="vertical"
          onFinish={(vals) => {
            if (!enrollTarget) return;
            const payContent = JSON.stringify({
              __type: 'payment',
              fee_total:     vals.fee_total,
              fee_collected: vals.fee_collected,
              emi_amount:    vals.emi_amount || 0,
              emi_count:     vals.emi_count  || 0,
              emi_start:     vals.emi_start  ? vals.emi_start.toISOString()  : null,
              emi_next:      vals.emi_next   ? vals.emi_next.toISOString()   : null,
            });
            // 1. Update status to Enrolled + set potential_revenue = fee_total
            updateMutation.mutate({
              leadId: enrollTarget.leadId,
              data: { status: 'Enrolled', potential_revenue: vals.fee_total },
            });
            // 2. Save payment note
            leadsAPI.addNote(enrollTarget.leadId, { content: payContent, channel: 'payment' })
              .catch(() => {});
            setEnrollTarget(null);
            enrollForm.resetFields();
          }}
        >
          <Row gutter={[12, 0]}>
            <Col span={12}>
              <Form.Item
                name="fee_total"
                label="Total Course Fee (₹)"
                rules={[{ required: true, message: 'Enter total fee' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="e.g. 500000"
                  formatter={v => v ? `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                  parser={v => v.replace(/₹\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="fee_collected"
                label="Amount Collected (₹)"
                rules={[{ required: true, message: 'Enter collected amount' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="e.g. 100000"
                  formatter={v => v ? `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                  parser={v => v.replace(/₹\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="emi_amount" label="EMI Amount (₹) — if applicable">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="e.g. 50000"
                  formatter={v => v ? `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                  parser={v => v.replace(/₹\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="emi_count" label="Number of EMIs">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 8" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="emi_start" label="EMI Start Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="emi_next" label="Next EMI Due Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => { setEnrollTarget(null); enrollForm.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" style={{ background: '#059669' }}>
              ✅ Confirm Enrollment
            </Button>
          </div>
        </Form>
      </Modal>

      {/* WhatsApp Chat Drawer */}
      <ChatDrawer lead={chatLead} onClose={() => setChatLead(null)} />

      {/* WhatsApp Template Drawer (from table row action) */}
      <WhatsAppTemplateDrawer
        open={!!templateLead}
        onClose={() => setTemplateLead(null)}
        lead={templateLead}
      />

      {/* Duplicate Detection Modal */}
      <DuplicateDetectionModal
        open={dupModalOpen}
        onClose={() => { setDupModalOpen(false); setPendingLeadData(null); setDupCandidates([]); }}
        newLead={pendingLeadData}
        duplicates={dupCandidates}
        onCreateAnyway={(leadData) => {
          createMutation.mutate(leadData);
        }}
        onMerged={() => {
          setDrawerVisible(false);
          form.resetFields();
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }}
      />
    </div>
  );
};

export default LeadsPageEnhanced;
