/**
 * DuplicateDetectionModal
 *
 * Props:
 *   open          {bool}     — whether to show the modal
 *   onClose       {fn}       — called when user dismisses
 *   newLead       {object}   — the lead data the user just tried to create
 *   duplicates    {array}    — list of existing leads with match_types
 *   onCreateAnyway {fn}      — user wants to save anyway → (newLead) => void
 *   onMerged      {fn}       — merge completed → called with merged lead
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Tag, Radio, Space, Divider, message, Tooltip, Badge } from 'antd';
import { MergeCellsOutlined, PlusOutlined, WarningOutlined, CheckOutlined } from '@ant-design/icons';
import { duplicatesAPI } from '../../api/api';
import dayjs from 'dayjs';

/* ─── constants ─────────────────────────────────────────────── */
const MATCH_COLOR = {
  exact_phone: 'red',
  exact_email: 'orange',
  fuzzy_name:  'gold',
};
const MATCH_LABEL = {
  exact_phone: 'Same phone',
  exact_email: 'Same email',
  fuzzy_name:  'Similar name',
};

/* Fields shown in the conflict-resolution table */
const CONFLICT_FIELDS = [
  { key: 'full_name',        label: 'Full Name' },
  { key: 'phone',            label: 'Phone' },
  { key: 'email',            label: 'Email' },
  { key: 'whatsapp',         label: 'WhatsApp' },
  { key: 'country',          label: 'Country' },
  { key: 'source',           label: 'Source' },
  { key: 'course_interested',label: 'Course' },
  { key: 'assigned_to',      label: 'Assigned To' },
];

/* ─── helpers ───────────────────────────────────────────────── */
const segColor = (seg) =>
  seg === 'Hot' ? '#ef4444' : seg === 'Warm' ? '#f59e0b' : '#10b981';

/* ─── DuplicateCard — one matched lead in the list ─────────── */
const DuplicateCard = ({ lead, onSelect, selected }) => (
  <div
    onClick={() => onSelect(lead)}
    style={{
      padding: '14px 16px',
      borderRadius: 10,
      border: `2px solid ${selected ? '#3b82f6' : '#e5e7eb'}`,
      background: selected ? '#eff6ff' : '#fafafa',
      cursor: 'pointer',
      transition: 'all 0.15s',
      marginBottom: 10,
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      {/* left — avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: segColor(lead.ai_segment),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 16,
        }}>
          {lead.full_name?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{lead.full_name}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{lead.phone} · {lead.country}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {lead.course_interested} · Created {dayjs(lead.created_at).format('MMM D, YYYY')}
          </div>
        </div>
      </div>

      {/* right — match badges + score */}
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {lead.match_types.map((t) => (
            <Tag key={t} color={MATCH_COLOR[t]} style={{ margin: 0, fontSize: 11 }}>
              {MATCH_LABEL[t]}
            </Tag>
          ))}
        </div>
        {lead.ai_score !== undefined && (
          <span style={{ fontSize: 12, fontWeight: 700, color: segColor(lead.ai_segment) }}>
            Score {Math.round(lead.ai_score)}
          </span>
        )}
        {selected && (
          <CheckOutlined style={{ color: '#3b82f6', fontSize: 16 }} />
        )}
      </div>
    </div>
  </div>
);

/* ─── ConflictTable — per-field winner selector ─────────────── */
const ConflictTable = ({ newLead, existingLead, choices, setChoices }) => {
  const allSame = CONFLICT_FIELDS.every(
    ({ key }) => (newLead[key] || '') === (existingLead[key] || '')
  );

  if (allSame) {
    return (
      <div style={{ padding: '16px 0', color: '#6b7280', textAlign: 'center', fontSize: 13 }}>
        All field values are identical — no conflicts to resolve.
      </div>
    );
  }

  return (
    <div>
      {/* column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 1fr 1fr',
        gap: 8, marginBottom: 6, padding: '0 4px',
      }}>
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Field</div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#3b82f6',
          background: '#eff6ff', borderRadius: 6, padding: '4px 10px',
          textAlign: 'center',
        }}>
          🆕 New Lead
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#6b7280',
          background: '#f9fafb', borderRadius: 6, padding: '4px 10px',
          textAlign: 'center',
        }}>
          📋 Existing Lead
        </div>
      </div>

      {CONFLICT_FIELDS.map(({ key, label }) => {
        const nVal = newLead[key] || '';
        const eVal = existingLead[key] || '';
        const isDiff = nVal !== eVal;

        return (
          <div
            key={key}
            style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 1fr',
              gap: 8, marginBottom: 6, padding: '6px 4px',
              background: isDiff ? '#fffbeb' : 'transparent',
              borderRadius: 6,
              border: isDiff ? '1px solid #fde68a' : '1px solid transparent',
            }}
          >
            {/* label */}
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#374151',
              display: 'flex', alignItems: 'center',
            }}>
              {label}
              {isDiff && (
                <Tooltip title="Values differ">
                  <WarningOutlined style={{ color: '#f59e0b', marginLeft: 6, fontSize: 12 }} />
                </Tooltip>
              )}
            </div>

            {/* new lead value */}
            <div
              onClick={() => isDiff && setChoices((c) => ({ ...c, [key]: 'new' }))}
              style={{
                padding: '6px 10px', borderRadius: 6, cursor: isDiff ? 'pointer' : 'default',
                background: choices[key] === 'new' && isDiff ? '#dbeafe' : isDiff ? '#fff' : 'transparent',
                border: choices[key] === 'new' && isDiff ? '2px solid #3b82f6' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13,
              }}
            >
              {isDiff && (
                <Radio
                  checked={choices[key] === 'new'}
                  onChange={() => setChoices((c) => ({ ...c, [key]: 'new' }))}
                  style={{ flexShrink: 0 }}
                />
              )}
              <span style={{ color: nVal ? '#111827' : '#d1d5db', flex: 1 }}>
                {nVal || '—'}
              </span>
            </div>

            {/* existing lead value */}
            <div
              onClick={() => isDiff && setChoices((c) => ({ ...c, [key]: 'existing' }))}
              style={{
                padding: '6px 10px', borderRadius: 6, cursor: isDiff ? 'pointer' : 'default',
                background: choices[key] === 'existing' && isDiff ? '#f0fdf4' : isDiff ? '#fff' : 'transparent',
                border: choices[key] === 'existing' && isDiff ? '2px solid #10b981' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13,
              }}
            >
              {isDiff && (
                <Radio
                  checked={choices[key] === 'existing'}
                  onChange={() => setChoices((c) => ({ ...c, [key]: 'existing' }))}
                  style={{ flexShrink: 0 }}
                />
              )}
              <span style={{ color: eVal ? '#111827' : '#d1d5db', flex: 1 }}>
                {eVal || '—'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ─── Main modal ─────────────────────────────────────────────── */
const DuplicateDetectionModal = ({
  open,
  onClose,
  newLead,
  duplicates = [],
  onCreateAnyway,
  onMerged,
}) => {
  const [step, setStep]             = useState('list');    // 'list' | 'resolve'
  const [selectedDup, setSelectedDup] = useState(null);
  const [choices, setChoices]       = useState({});
  const queryClient = useQueryClient();

  /* default: prefer the existing lead's value for every field */
  const initChoices = (dup) => {
    const c = {};
    CONFLICT_FIELDS.forEach(({ key }) => {
      c[key] = 'existing'; // keep existing by default — safer
    });
    setChoices(c);
    setSelectedDup(dup);
    setStep('resolve');
  };

  const mergeMutation = useMutation({
    mutationFn: (payload) => duplicatesAPI.merge(payload),
    onSuccess: (res) => {
      message.success('Leads merged successfully!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onMerged?.(res.data);
      handleClose();
    },
    onError: (err) => {
      message.error(`Merge failed: ${err.message}`);
    },
  });

  const handleMerge = () => {
    if (!selectedDup) return;

    // map our internal 'new'/'existing' choices to primary/secondary
    // primary = existing lead (the one we keep), secondary = new form data
    // But we want to create a merged record — existing lead is primary_lead_id
    // and the new lead HASN'T been created yet, so we:
    // 1. Create the new lead first, then 2. Merge it into the existing one.
    // Simpler UX: just update the existing lead with the chosen field values directly.
    const updates = {};
    CONFLICT_FIELDS.forEach(({ key }) => {
      const winner = choices[key];
      const val = winner === 'new' ? newLead[key] : selectedDup[key];
      if (val !== undefined && val !== null) updates[key] = val;
    });

    mergeMutation.mutate({
      primary_lead_id:   selectedDup.lead_id,
      secondary_lead_id: '__new__',           // backend handles this flag
      field_choices:     choices,
      direct_updates:    updates,             // applied straight to primary
    });
  };

  // Simplified merge: just PATCH the existing lead with winner values,
  // then call onMerged so parent knows not to create a new lead.
  const handleMergeSimple = () => {
    if (!selectedDup) return;

    const updates = {};
    CONFLICT_FIELDS.forEach(({ key }) => {
      const val = choices[key] === 'new' ? newLead[key] : selectedDup[key];
      if (val !== undefined && val !== null && val !== '') updates[key] = val;
    });

    mergeMutation.mutate({
      primary_lead_id:   selectedDup.lead_id,
      secondary_lead_id: null,   // no secondary to delete — new lead was never saved
      field_choices:     choices,
      direct_updates:    updates,
    });
  };

  const handleClose = () => {
    setStep('list');
    setSelectedDup(null);
    setChoices({});
    onClose?.();
  };

  /* ── render ── */
  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#fef3c7', display: 'flex', alignItems: 'center',
            justifyContent: 'center',
          }}>
            <WarningOutlined style={{ color: '#d97706', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
              {step === 'list' ? 'Potential Duplicates Found' : 'Resolve Field Conflicts'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
              {step === 'list'
                ? `${duplicates.length} existing lead${duplicates.length !== 1 ? 's' : ''} may already match this record`
                : `Merging into: ${selectedDup?.full_name}`}
            </div>
          </div>
        </div>
      }
      width={660}
      footer={null}
      style={{ top: 40 }}
      styles={{ body: { padding: '16px 24px 24px' }}}
    >
      {/* ── STEP 1: list of duplicates ───────────────────────── */}
      {step === 'list' && (
        <>
          <div style={{ marginBottom: 16, fontSize: 13, color: '#374151' }}>
            Select a duplicate to review and merge, or create anyway.
          </div>

          {duplicates.map((dup) => (
            <DuplicateCard
              key={dup.lead_id}
              lead={dup}
              selected={false}
              onSelect={initChoices}
            />
          ))}

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => { onCreateAnyway?.(newLead); handleClose(); }}
            >
              Create Anyway
            </Button>
          </div>
        </>
      )}

      {/* ── STEP 2: conflict resolution ──────────────────────── */}
      {step === 'resolve' && selectedDup && (
        <>
          {/* mini summary of the two leads */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16,
          }}>
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: '#eff6ff', border: '1.5px solid #3b82f6',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>
                🆕 NEW LEAD (from form)
              </div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{newLead.full_name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{newLead.phone}</div>
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: '#f0fdf4', border: '1.5px solid #10b981',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                📋 EXISTING LEAD
              </div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedDup.full_name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {selectedDup.phone} · {selectedDup.status}
              </div>
            </div>
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
            <ConflictTable
              newLead={newLead}
              existingLead={selectedDup}
              choices={choices}
              setChoices={setChoices}
            />
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <Button onClick={() => setStep('list')}>← Back</Button>
            <Space>
              <Button
                icon={<PlusOutlined />}
                onClick={() => { onCreateAnyway?.(newLead); handleClose(); }}
              >
                Create Anyway
              </Button>
              <Button
                type="primary"
                icon={<MergeCellsOutlined />}
                loading={mergeMutation.isPending}
                onClick={handleMergeSimple}
                style={{ background: '#10b981', borderColor: '#10b981' }}
              >
                Merge & Save
              </Button>
            </Space>
          </div>
        </>
      )}
    </Modal>
  );
};

export default DuplicateDetectionModal;
