/**
 * GoogleSheetsSyncPanel
 * ======================
 * Settings UI for configuring the Google Sheets two-way sync.
 *
 * Features:
 *  - Connection status card (green/red ping to webhook health endpoint)
 *  - Webhook URL display (copy-to-clipboard)
 *  - Apps Script code viewer (copy full script in one click)
 *  - Step-by-step install guide with expandable sections
 *  - Field mapping table (sheet column → CRM field)
 *  - Conflict resolution policy explanation
 *
 * Usage:
 *   import GoogleSheetsSyncPanel from '../components/settings/GoogleSheetsSyncPanel';
 *   // Inside your SettingsPage:
 *   <GoogleSheetsSyncPanel />
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card, Alert, Tag, Tooltip, Collapse, Steps, Table, message,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
  CopyOutlined, LinkOutlined, FileTextOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WEBHOOK_URL = `${API_BASE}/api/webhooks/google-sheets`;

// ── Copy-to-clipboard helper ──────────────────────────────────────────────────
function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      message.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={doCopy} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 5, fontSize: 12,
      border: '0.5px solid var(--color-border-secondary)',
      background: 'transparent', cursor: 'pointer',
      color: copied ? '#10b981' : 'var(--color-text-secondary)',
    }}>
      <CopyOutlined style={{ fontSize: 12 }} />
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ── Connection status ─────────────────────────────────────────────────────────
function ConnectionStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sheets-webhook-health'],
    queryFn:  () => axios.get(WEBHOOK_URL).then(r => r.data),
    retry:    1,
    staleTime: 30_000,
  });

  if (isLoading) return (
    <Tag icon={<LoadingOutlined />} color="processing">Checking connection…</Tag>
  );
  if (isError) return (
    <Tag icon={<CloseCircleOutlined />} color="error">Webhook unreachable</Tag>
  );
  return (
    <Tag icon={<CheckCircleOutlined />} color="success">Webhook active — v{data?.version || '2'}</Tag>
  );
}

// ── Field mapping table ───────────────────────────────────────────────────────
const FIELD_MAP = [
  { sheet: 'status / lead_status',         crm: 'status',             notes: 'Must match CRM status values exactly' },
  { sheet: 'assigned_to / counselor',       crm: 'assigned_to',        notes: 'Full name as stored in CRM' },
  { sheet: 'follow_up_date / followup_date',crm: 'follow_up_date',     notes: 'Any date format (YYYY-MM-DD preferred)' },
  { sheet: 'full_name / name',              crm: 'full_name',          notes: '' },
  { sheet: 'email',                         crm: 'email',              notes: 'Validated email format' },
  { sheet: 'phone / whatsapp',              crm: 'phone / whatsapp',   notes: 'Digits + country code only' },
  { sheet: 'country',                       crm: 'country',            notes: '' },
  { sheet: 'source',                        crm: 'source',             notes: 'Normalised to CRM source list' },
  { sheet: 'course_interested / course',    crm: 'course_interested',  notes: '' },
  { sheet: 'next_action',                   crm: 'next_action',        notes: '' },
  { sheet: 'priority_level / priority',     crm: 'priority_level',     notes: 'low | normal | high | urgent' },
  { sheet: 'expected_revenue',              crm: 'expected_revenue',   notes: 'Numbers only, strips ₹/$,.' },
  { sheet: 'actual_revenue',                crm: 'actual_revenue',     notes: 'Numbers only' },
  { sheet: 'loss_reason / loss_note',       crm: 'loss_reason / loss_note', notes: '' },
  { sheet: 'qualification',                 crm: 'qualification',      notes: '' },
];

const mapColumns = [
  { title: 'Sheet column(s)', dataIndex: 'sheet', key: 'sheet',
    render: t => <code style={{ fontSize: 12 }}>{t}</code> },
  { title: 'CRM field',       dataIndex: 'crm',   key: 'crm',
    render: t => <code style={{ fontSize: 12, color: '#7c3aed' }}>{t}</code> },
  { title: 'Notes',           dataIndex: 'notes', key: 'notes',
    render: t => t ? <span style={{ fontSize: 12, color: '#64748b' }}>{t}</span> : null },
];

// ── Apps Script snippet ───────────────────────────────────────────────────────
const SCRIPT_SNIPPET = `// Paste full script from:
// lead-ai/crm/backend/sheets_apps_script/Code.gs
//
// Quick setup:
// 1. Extensions → Apps Script
// 2. Paste Code.gs content
// 3. Set CRM_WEBHOOK_URL in Project Settings → Script Properties
// 4. Run installTrigger() once`;

// ── Main component ────────────────────────────────────────────────────────────
export default function GoogleSheetsSyncPanel() {
  return (
    <div style={{ maxWidth: 800 }}>

      {/* Status + Webhook URL */}
      <Card
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '16px 20px' }}}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
              Webhook status
            </div>
            <ConnectionStatus />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Paste this URL into your Apps Script:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{
                fontSize: 12, background: 'var(--color-background-secondary)',
                padding: '4px 10px', borderRadius: 5,
                border: '0.5px solid var(--color-border-tertiary)',
                wordBreak: 'break-all',
              }}>
                {WEBHOOK_URL}
              </code>
              <CopyButton text={WEBHOOK_URL} />
            </div>
          </div>
        </div>
      </Card>

      {/* Install guide */}
      <Card
        title={<span><LinkOutlined style={{ marginRight: 6 }} />Setup guide</span>}
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '16px 20px' }}}
      >
        <Steps
          direction="vertical"
          size="small"
          items={[
            {
              title: 'Add a lead_id column to your sheet',
              description: (
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Every row that should sync needs a <code>lead_id</code> column
                  containing the CRM lead ID (e.g. <code>LEAD26050812AB1234</code>).
                  Export leads from the CRM using the existing export — it includes
                  this column automatically.
                </span>
              ),
              status: 'process',
            },
            {
              title: 'Add an optional Sync_Status column',
              description: (
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Create a column named exactly <code>Sync_Status</code>.
                  The Apps Script writes <em>✓ Synced</em>, <em>✗ Error</em>,
                  or <em>⚠ Conflict</em> here after each edit.
                </span>
              ),
              status: 'process',
            },
            {
              title: 'Install the Apps Script',
              description: (
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  <p style={{ margin: '0 0 8px' }}>
                    Open your sheet → <strong>Extensions → Apps Script</strong> →
                    paste the full contents of <code>Code.gs</code> → save.
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{
                      fontSize: 11, background: 'var(--color-background-secondary)',
                      padding: '6px 10px', borderRadius: 5, flex: 1,
                      border: '0.5px solid var(--color-border-tertiary)',
                      whiteSpace: 'pre',
                    }}>
                      {SCRIPT_SNIPPET}
                    </code>
                    <CopyButton
                      text="Open lead-ai/crm/backend/sheets_apps_script/Code.gs in your editor"
                      label="Copy path"
                    />
                  </div>
                </div>
              ),
              status: 'process',
            },
            {
              title: 'Set the webhook URL as a Script Property',
              description: (
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  In Apps Script → <strong>Project Settings → Script Properties</strong>
                  → Add: <code>CRM_WEBHOOK_URL</code> = <em>{WEBHOOK_URL}</em>
                  <br />
                  Optionally add <code>WEBHOOK_SECRET</code> matching
                  <code>SHEETS_WEBHOOK_SECRET</code> in your backend <code>.env</code>.
                </span>
              ),
              status: 'process',
            },
            {
              title: 'Run installTrigger() once',
              description: (
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  In the Apps Script editor, select <code>installTrigger</code> from
                  the function dropdown and click <strong>Run</strong>. Grant OAuth
                  permissions. From now on, every edit fires automatically.
                </span>
              ),
              status: 'process',
            },
            {
              title: 'Test the connection',
              description: (
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  In your sheet, click the new <strong>🔄 CRM Sync → Test connection</strong>
                  menu item. You should see a green response from the CRM.
                </span>
              ),
              status: 'process',
            },
          ]}
        />
      </Card>

      {/* Conflict resolution */}
      <Alert
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        style={{ marginBottom: 16 }}
        message="Conflict resolution policy: latest write wins"
        description={
          <span style={{ fontSize: 13 }}>
            When both the sheet and the CRM have been modified for the same field,
            the record with the newer <em>updated_at</em> timestamp wins. If the CRM
            was updated after the sheet edit, the sheet cell is flagged as
            <strong> ⚠ Conflict</strong> and the CRM value is pushed back on the
            next scheduled sync. No data is ever silently discarded.
          </span>
        }
      />

      {/* Field mapping reference */}
      <Card
        title={<span><FileTextOutlined style={{ marginRight: 6 }} />Accepted sheet columns → CRM fields</span>}
        styles={{ body: { padding: 0 }}}
      >
        <Table
          dataSource={FIELD_MAP}
          columns={mapColumns}
          rowKey="sheet"
          size="small"
          pagination={false}
          style={{ borderRadius: '0 0 8px 8px', overflow: 'hidden' }}
        />
        <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--color-text-tertiary)', borderTop: '0.5px solid var(--color-border-tertiary)' }}>
          Columns not in this list (e.g. ad_id, campaign_id) are silently ignored — they can remain in your sheet safely.
          Read-only CRM fields (ai_score, created_at, lead_id, etc.) are never overwritten by the sheet.
        </div>
      </Card>
    </div>
  );
}
