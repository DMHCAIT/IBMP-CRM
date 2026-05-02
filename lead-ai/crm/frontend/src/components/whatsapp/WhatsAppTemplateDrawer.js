/**
 * WhatsAppTemplateDrawer
 *
 * A right-side drawer with the full template library:
 *   • Tabs by category (All / Welcome / Follow-up / Fee Reminder / Enrollment / Custom)
 *   • Template cards with emoji, name, description, variable chip count
 *   • Click → expand into a "compose" panel:
 *       – Live preview of rendered message (auto-filled from lead)
 *       – Editable input per variable for overrides
 *       – One-click "Send via WhatsApp" button
 *   • "Manage Templates" section — inline create / edit / delete
 *
 * Props:
 *   open    {bool}
 *   onClose {fn}
 *   lead    {object}  — the lead whose data pre-fills variables
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Drawer, Tabs, Input, Button, Tag, Divider, message, Tooltip,
  Popconfirm, Select, Form, Modal, Empty, Spin,
} from 'antd';
import {
  SendOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  EyeOutlined, CheckOutlined, CopyOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { waTemplatesAPI } from '../../api/api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

/* ─── constants ────────────────────────────────────────────── */
const CATEGORIES = [
  { key: 'all',          label: 'All',        emoji: '📋' },
  { key: 'welcome',      label: 'Welcome',    emoji: '👋' },
  { key: 'follow_up',    label: 'Follow-up',  emoji: '🔔' },
  { key: 'fee_reminder', label: 'Fee',        emoji: '💰' },
  { key: 'enrollment',   label: 'Enrollment', emoji: '🎉' },
  { key: 'custom',       label: 'Custom',     emoji: '✏️' },
];

const CAT_COLORS = {
  welcome:      { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  follow_up:    { bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
  fee_reminder: { bg: '#fdf4ff', border: '#e9d5ff', text: '#6b21a8' },
  enrollment:   { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  custom:       { bg: '#f9fafb', border: '#e5e7eb', text: '#374151' },
};

/* ─── helpers ───────────────────────────────────────────────── */
const renderTemplate = (body, vars) => {
  let out = body;
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replaceAll(`{{${k}}}`, v ?? '');
  });
  return out;
};

const extractVars = (body) => {
  const found = [];
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
};

const leadDefaults = (lead) => {
  if (!lead) return {};
  return {
    lead_name:       lead.full_name || '',
    first_name:      (lead.full_name || '').split(' ')[0] || '',
    course:          lead.course_interested || '',
    counselor:       lead.assigned_to || '',
    phone:           lead.phone || '',
    country:         lead.country || '',
    expected_fee:    lead.expected_revenue ? String(Math.round(lead.expected_revenue)) : '',
    fee_amount:      lead.expected_revenue ? String(Math.round(lead.expected_revenue)) : '',
    follow_up_date:  lead.follow_up_date ? dayjs(lead.follow_up_date).format('DD MMM YYYY') : '',
    enrollment_date: dayjs().format('DD MMM YYYY'),
  };
};

/* ─── TemplateCard ──────────────────────────────────────────── */
const TemplateCard = ({ tpl, selected, onClick }) => {
  const c = CAT_COLORS[tpl.category] || CAT_COLORS.custom;
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        border: `2px solid ${selected ? '#25d366' : c.border}`,
        background: selected ? '#f0fdf4' : c.bg,
        cursor: 'pointer',
        transition: 'all 0.15s',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>{tpl.emoji}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', lineHeight: 1.3 }}>
              {tpl.name}
            </div>
            {tpl.description && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {tpl.description}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {tpl.is_builtin && (
            <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>Built-in</Tag>
          )}
          <Tag
            style={{
              margin: 0, fontSize: 10, fontWeight: 600,
              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
            }}
          >
            {tpl.variables.length} var{tpl.variables.length !== 1 ? 's' : ''}
          </Tag>
        </div>
      </div>
    </div>
  );
};

/* ─── ComposePanel ──────────────────────────────────────────── */
const ComposePanel = ({ tpl, lead, onSent, onBack }) => {
  const [varValues, setVarValues] = useState(() => leadDefaults(lead));
  const [copied, setCopied]       = useState(false);
  const queryClient = useQueryClient();

  const rendered = useMemo(
    () => renderTemplate(tpl.body, varValues),
    [tpl.body, varValues]
  );

  const sendMutation = useMutation({
    mutationFn: (payload) => waTemplatesAPI.send(lead.lead_id, payload),
    onSuccess: (res) => {
      message.success({
        content: `✅ Template "${tpl.name}" sent to ${res.data?.sent_to || lead.phone}`,
        duration: 4,
      });
      queryClient.invalidateQueries({ queryKey: ['lead', lead.lead_id] });
      onSent?.();
    },
    onError: (err) => {
      message.error(`Send failed: ${err.response?.data?.detail || err.message}`);
    },
  });

  const handleSend = () => {
    sendMutation.mutate({
      template_id:        tpl.id,
      variable_overrides: varValues,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rendered).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const unresolvedVars = extractVars(rendered); // still has {{ }} after substitution

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Button size="small" onClick={onBack}>← Back</Button>
        <div>
          <span style={{ fontSize: 20 }}>{tpl.emoji}</span>
          <span style={{ fontWeight: 700, fontSize: 14, marginLeft: 8 }}>{tpl.name}</span>
        </div>
      </div>

      {/* variable inputs */}
      {tpl.variables.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
          }}>
            Variables
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: tpl.variables.length > 3 ? '1fr 1fr' : '1fr',
            gap: 8,
          }}>
            {tpl.variables.map((varName) => (
              <div key={varName}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>
                  {`{{${varName}}}`}
                </div>
                <Input
                  size="small"
                  value={varValues[varName] ?? ''}
                  onChange={(e) =>
                    setVarValues((v) => ({ ...v, [varName]: e.target.value }))
                  }
                  placeholder={`Enter ${varName.replace(/_/g, ' ')}`}
                  style={{
                    borderColor: !varValues[varName] ? '#fbbf24' : undefined,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* live preview */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#6b7280',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>Preview</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {unresolvedVars.length > 0 && (
              <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>
                {unresolvedVars.length} unfilled
              </Tag>
            )}
            <Button
              size="small"
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={handleCopy}
              style={{ fontSize: 11, height: 22, padding: '0 6px' }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        {/* WhatsApp bubble mock */}
        <div style={{
          background: '#dcf8c6',
          borderRadius: '12px 12px 0 12px',
          padding: '10px 14px',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          border: '1px solid #b7eaa3',
          maxHeight: 260,
          overflowY: 'auto',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          {rendered}
        </div>
        <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right', marginTop: 4 }}>
          {rendered.length} chars · sending to {lead?.whatsapp || lead?.phone || '—'}
        </div>
      </div>

      {/* action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <a
          href={`https://wa.me/${(lead?.whatsapp || lead?.phone || '').replace(/[^\d+]/g, '')}?text=${encodeURIComponent(rendered)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: 1, textDecoration: 'none' }}
        >
          <Button
            block
            style={{ background: '#ecfdf5', borderColor: '#6ee7b7', color: '#059669', fontWeight: 600 }}
            icon={<span style={{ fontSize: 14 }}>💬</span>}
          >
            Open in WhatsApp
          </Button>
        </a>
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={sendMutation.isPending}
          onClick={handleSend}
          style={{ flex: 1, background: '#25d366', borderColor: '#25d366', fontWeight: 700 }}
        >
          Send via CRM
        </Button>
      </div>
    </div>
  );
};

/* ─── TemplateFormModal — create / edit ─────────────────────── */
const TemplateFormModal = ({ open, onClose, editing, onSaved }) => {
  const [form]     = Form.useForm();
  const queryClient = useQueryClient();
  const [bodyVal, setBodyVal] = useState(editing?.body || '');

  const detectedVars = useMemo(() => extractVars(bodyVal), [bodyVal]);

  React.useEffect(() => {
    if (open) {
      form.setFieldsValue(editing || { category: 'custom', emoji: '💬' });
      setBodyVal(editing?.body || '');
    }
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? waTemplatesAPI.update(editing.id, data)
        : waTemplatesAPI.create(data),
    onSuccess: () => {
      message.success(editing ? 'Template updated!' : 'Template created!');
      queryClient.invalidateQueries({ queryKey: ['wa-templates'] });
      onSaved?.();
      onClose();
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={editing ? '✏️ Edit Template' : '➕ New Template'}
      width={580}
      onOk={() => form.submit()}
      okText={editing ? 'Save Changes' : 'Create Template'}
      confirmLoading={saveMutation.isPending}
    >
      <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 12 }}>
          <Form.Item name="emoji" label="Icon">
            <Input maxLength={2} style={{ textAlign: 'center', fontSize: 20 }} />
          </Form.Item>
          <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Weekend Special Offer" />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="category" label="Category">
            <Select>
              {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                <Option key={c.key} value={c.key}>{c.emoji} {c.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description (optional)">
            <Input placeholder="When to use this template" />
          </Form.Item>
        </div>
        <Form.Item name="body" label="Message Body" rules={[{ required: true }]}>
          <TextArea
            rows={8}
            placeholder={`Hello {{lead_name}},\n\nThank you for your interest in {{course}}...`}
            onChange={(e) => setBodyVal(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        </Form.Item>
        {detectedVars.length > 0 && (
          <div style={{ marginTop: -12, marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Detected variables: </span>
            {detectedVars.map((v) => (
              <Tag key={v} color="blue" style={{ fontSize: 11 }}>{`{{${v}}}`}</Tag>
            ))}
          </div>
        )}
        <div style={{
          padding: '10px 14px', borderRadius: 8, background: '#f9fafb',
          border: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280',
        }}>
          💡 Use <code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>{'{{variable_name}}'}</code> for dynamic fields.
          Common: <code>lead_name</code>, <code>first_name</code>, <code>course</code>, <code>counselor</code>,
          <code>fee_amount</code>, <code>follow_up_date</code>
        </div>
      </Form>
    </Modal>
  );
};

/* ─── Main drawer ───────────────────────────────────────────── */
const WhatsAppTemplateDrawer = ({ open, onClose, lead }) => {
  const [activeTab,       setActiveTab]       = useState('all');
  const [selectedTpl,     setSelectedTpl]     = useState(null);
  const [formModalOpen,   setFormModalOpen]   = useState(false);
  const [editingTpl,      setEditingTpl]      = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['wa-templates'],
    queryFn: () => waTemplatesAPI.list().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => waTemplatesAPI.delete(id),
    onSuccess: () => {
      message.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['wa-templates'] });
    },
    onError: (e) => message.error(e.response?.data?.detail || e.message),
  });

  const filtered = useMemo(
    () => (activeTab === 'all' ? templates : templates.filter((t) => t.category === activeTab)),
    [templates, activeTab]
  );

  const handleClose = useCallback(() => {
    setSelectedTpl(null);
    onClose?.();
  }, [onClose]);

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: '#dcf8c6', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              💬
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>WhatsApp Templates</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>
                {lead?.full_name ? `Sending to ${lead.full_name}` : 'Template library'}
              </div>
            </div>
          </div>
        }
        open={open}
        onClose={handleClose}
        width={520}
        bodyStyle={{ padding: '0 0 24px' }}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={() => { setEditingTpl(null); setFormModalOpen(true); }}
            style={{ background: '#25d366', borderColor: '#25d366' }}
          >
            New Template
          </Button>
        }
      >
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin tip="Loading templates…" />
          </div>
        ) : selectedTpl ? (
          /* ── Compose panel ── */
          <div style={{ padding: '16px 20px' }}>
            <ComposePanel
              tpl={selectedTpl}
              lead={lead}
              onBack={() => setSelectedTpl(null)}
              onSent={() => { setSelectedTpl(null); handleClose(); }}
            />
          </div>
        ) : (
          /* ── Template list ── */
          <>
            {/* category tabs */}
            <div style={{
              padding: '0 20px',
              borderBottom: '1px solid #f0f0f0',
              position: 'sticky', top: 0,
              background: '#fff', zIndex: 1,
            }}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size="small"
                items={CATEGORIES.map((c) => ({
                  key: c.key,
                  label: (
                    <span>
                      {c.emoji}{' '}
                      <span style={{ fontWeight: 600 }}>{c.label}</span>
                      {c.key !== 'all' && (
                        <span style={{ marginLeft: 4, color: '#9ca3af', fontSize: 11 }}>
                          ({templates.filter((t) => t.category === c.key).length})
                        </span>
                      )}
                    </span>
                  ),
                }))}
              />
            </div>

            <div style={{ padding: '16px 20px' }}>
              {filtered.length === 0 ? (
                <Empty
                  description={`No ${activeTab === 'all' ? '' : activeTab.replace('_', '-')} templates yet`}
                  style={{ padding: '32px 0' }}
                >
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => { setEditingTpl(null); setFormModalOpen(true); }}
                  >
                    Create Template
                  </Button>
                </Empty>
              ) : (
                filtered.map((tpl) => (
                  <div key={tpl.id} style={{ position: 'relative' }}>
                    <TemplateCard
                      tpl={tpl}
                      selected={selectedTpl?.id === tpl.id}
                      onClick={() => setSelectedTpl(tpl)}
                    />
                    {/* edit / delete icons — appear on hover via parent hover */}
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      display: 'flex', gap: 4,
                      opacity: 0,
                    }}
                      className="tpl-actions"
                    >
                      <Tooltip title="Edit">
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTpl(tpl);
                            setFormModalOpen(true);
                          }}
                          style={{ borderRadius: 6, width: 26, height: 26, padding: 0 }}
                        />
                      </Tooltip>
                      {!tpl.is_builtin && (
                        <Popconfirm
                          title="Delete this template?"
                          onConfirm={(e) => { e?.stopPropagation(); deleteMutation.mutate(tpl.id); }}
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                            style={{ borderRadius: 6, width: 26, height: 26, padding: 0 }}
                          />
                        </Popconfirm>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* summary footer */}
            <div style={{
              margin: '0 20px', padding: '12px 14px',
              background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb',
            }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                <strong style={{ color: '#111827' }}>{templates.length}</strong> templates across{' '}
                <strong style={{ color: '#111827' }}>
                  {[...new Set(templates.map((t) => t.category))].length}
                </strong>{' '}
                categories. Click any template to preview and send.
              </div>
            </div>
          </>
        )}
      </Drawer>

      {/* hover-reveal CSS injected once */}
      <style>{`
        div:hover > .tpl-actions { opacity: 1 !important; transition: opacity 0.15s; }
        .tpl-actions { transition: opacity 0.15s; }
      `}</style>

      <TemplateFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        editing={editingTpl}
        onSaved={() => setFormModalOpen(false)}
      />
    </>
  );
};

export default WhatsAppTemplateDrawer;
