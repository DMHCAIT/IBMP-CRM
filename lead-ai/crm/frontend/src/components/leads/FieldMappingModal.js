import React, { useState, useEffect } from 'react';
import { Modal, Select, Table, Alert, Space, Typography, Tag, Button, Divider, Card, Row, Col, Tooltip } from 'antd';
import { CheckCircleOutlined, WarningOutlined, InfoCircleOutlined, SwapOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;
const { Option } = Select;

// CRM field definitions with metadata
const CRM_FIELDS = [
  { key: 'full_name', label: 'Full Name', required: true, type: 'text', icon: '👤', desc: 'Lead full name' },
  { key: 'email', label: 'Email', required: false, type: 'email', icon: '📧', desc: 'Email address' },
  { key: 'phone', label: 'Phone', required: true, type: 'phone', icon: '📞', desc: 'Primary phone number' },
  { key: 'whatsapp', label: 'WhatsApp', required: false, type: 'phone', icon: '💬', desc: 'WhatsApp number' },
  { key: 'country', label: 'Country', required: false, type: 'text', icon: '🌍', desc: 'Country' },
  { key: 'source', label: 'Source', required: false, type: 'text', icon: '📍', desc: 'Lead source (e.g., Website, Referral)' },
  { key: 'course_interested', label: 'Course Interested', required: false, type: 'text', icon: '🎓', desc: 'Fellowship or course' },
  { key: 'qualification', label: 'Qualification', required: false, type: 'text', icon: '🎯', desc: 'Academic qualification (e.g., MBBS, MD)' },
  { key: 'company', label: 'Company', required: false, type: 'select', icon: '🏢', desc: 'Company / brand: IBMP or DMHCA' },
  { key: 'status', label: 'Status', required: false, type: 'select', icon: '📊', desc: 'Lead status' },
  { key: 'assigned_to', label: 'Assigned To', required: false, type: 'text', icon: '👥', desc: 'Counselor name' },
  { key: 'expected_revenue', label: 'Expected Revenue', required: false, type: 'number', icon: '💰', desc: 'Expected deal value' },
  { key: 'notes', label: 'Notes', required: false, type: 'text', icon: '📝', desc: 'Additional notes' },
  { key: 'utm_source',   label: 'UTM Source',   required: false, type: 'text', icon: '📡', desc: 'Ad channel: google, facebook, etc.' },
  { key: 'utm_medium',   label: 'UTM Medium',   required: false, type: 'text', icon: '📡', desc: 'Ad type: cpc, organic, email, etc.' },
  { key: 'utm_campaign', label: 'UTM Campaign', required: false, type: 'text', icon: '📡', desc: 'Campaign name: mbbs_jan26, etc.' },
];

// Auto-mapping intelligence: common variations
const AUTO_MAP_PATTERNS = {
  full_name: ['name', 'fullname', 'full_name', 'leadname', 'student_name', 'candidate_name', 'contact_name'],
  email: ['email', 'email_address', 'mail', 'e-mail', 'contact_email'],
  phone: ['phone', 'mobile', 'phone_number', 'contact', 'mobile_number', 'cell', 'telephone', 'contact_number'],
  whatsapp: ['whatsapp', 'wa', 'whatsapp_number', 'wa_number'],
  country: ['country', 'location', 'nation', 'region'],
  source: ['source', 'lead_source', 'origin', 'channel', 'campaign'],
  course_interested: ['course', 'fellowship', 'program', 'course_interested', 'interested_in', 'specialization'],
  qualification: ['qualification', 'qualify', 'degree', 'education', 'academic', 'academic_qualification'],
  company: ['company', 'brand', 'organization', 'organisation', 'business'],
  status: ['status', 'lead_status', 'stage', 'state'],
  assigned_to: ['assigned_to', 'counselor', 'agent', 'owner', 'assigned', 'handler'],
  expected_revenue: ['revenue', 'value', 'deal_value', 'expected_revenue', 'amount', 'fees', 'price'],
  notes: ['notes', 'comments', 'remarks', 'description', 'details', 'memo'],
  utm_source:   ['utm_source', 'utm source', 'utmsource', 'ad_source', 'ad source'],
  utm_medium:   ['utm_medium', 'utm medium', 'utmmedium', 'ad_medium', 'ad medium'],
  utm_campaign: ['utm_campaign', 'utm campaign', 'utmcampaign', 'campaign', 'ad_campaign'],
};

const FieldMappingModal = ({ visible, onCancel, fileColumns, previewData, onConfirm }) => {
  const [mapping, setMapping] = useState({});
  const [autoMapped, setAutoMapped] = useState(false);

  // Auto-map columns on first load
  useEffect(() => {
    if (fileColumns && fileColumns.length > 0 && !autoMapped) {
      const newMapping = {};
      
      fileColumns.forEach(col => {
        const normalized = col.toLowerCase().trim().replace(/\s+/g, '_');
        
        // Try exact match first
        const exactMatch = CRM_FIELDS.find(f => f.key === normalized);
        if (exactMatch) {
          newMapping[col] = exactMatch.key;
          return;
        }
        
        // Try pattern matching
        for (const [crmField, patterns] of Object.entries(AUTO_MAP_PATTERNS)) {
          if (patterns.some(p => normalized.includes(p) || p.includes(normalized))) {
            newMapping[col] = crmField;
            return;
          }
        }
        
        // Leave unmapped if no match found
        newMapping[col] = null;
      });
      
      setMapping(newMapping);
      setAutoMapped(true);
    }
  }, [fileColumns, autoMapped]);

  const handleMappingChange = (fileColumn, crmField) => {
    setMapping(prev => ({ ...prev, [fileColumn]: crmField }));
  };

  const getMappedFields = () => {
    const mapped = Object.values(mapping).filter(v => v !== null);
    return new Set(mapped);
  };

  const getUnmappedRequired = () => {
    const mappedFields = getMappedFields();
    return CRM_FIELDS.filter(f => f.required && !mappedFields.has(f.key));
  };

  const isValidMapping = () => {
    return getUnmappedRequired().length === 0;
  };

  const handleConfirm = () => {
    if (!isValidMapping()) {
      return;
    }
    onConfirm(mapping);
  };

  const getPreviewRow = () => {
    if (!previewData || previewData.length === 0) return null;
    
    const row = previewData[0];
    const mappedRow = {};
    
    Object.entries(mapping).forEach(([fileCol, crmField]) => {
      if (crmField) {
        mappedRow[crmField] = row[fileCol];
      }
    });
    
    return mappedRow;
  };

  const mappedFields = getMappedFields();
  const unmappedRequired = getUnmappedRequired();
  const previewRow = getPreviewRow();

  // Count stats
  const totalColumns = fileColumns?.length || 0;
  const mappedCount = Object.values(mapping).filter(v => v !== null).length;
  const unmappedCount = totalColumns - mappedCount;

  return (
    <Modal
      title={
        <Space>
          <SwapOutlined style={{ color: '#1890ff' }} />
          <span>Map Excel Columns to CRM Fields</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={!isValidMapping()}
          icon={<CheckCircleOutlined />}
        >
          Confirm & Import {previewData?.length || 0} Leads
        </Button>,
      ]}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' }}}
    >
      {/* Status Summary */}
      <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff', border: '1px solid #d6e4ff' }}>
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{totalColumns}</div>
              <Text type="secondary">Excel Columns</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{mappedCount}</div>
              <Text type="secondary">Mapped</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{unmappedCount}</div>
              <Text type="secondary">Unmapped</Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Validation Alerts */}
      {unmappedRequired.length > 0 && (
        <Alert
          message="Missing Required Fields"
          description={
            <span>
              Please map the following required fields:{' '}
              {unmappedRequired.map(f => (
                <Tag key={f.key} color="red" style={{ margin: '2px' }}>
                  {f.icon} {f.label}
                </Tag>
              ))}
            </span>
          }
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      {isValidMapping() && (
        <Alert
          message="All Required Fields Mapped"
          description={`Ready to import ${previewData?.length || 0} leads. Review the mapping below and click Confirm.`}
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Mapping Instructions */}
      <Alert
        message="How to Map Fields"
        description="Select a CRM field for each Excel column. Required fields must be mapped. Unmapped columns will be ignored."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
        closable
      />

      <Divider orientation="left">Column Mapping</Divider>

      {/* Mapping Table */}
      <Table
        dataSource={fileColumns?.map(col => ({
          key: col,
          excelColumn: col,
          crmField: mapping[col],
          sampleValue: previewData?.[0]?.[col],
        }))}
        pagination={false}
        size="small"
        bordered
        columns={[
          {
            title: <Text strong>Excel Column</Text>,
            dataIndex: 'excelColumn',
            key: 'excelColumn',
            width: 200,
            render: (text) => <Tag color="blue">{text}</Tag>,
          },
          {
            title: <Text strong>Sample Value</Text>,
            dataIndex: 'sampleValue',
            key: 'sampleValue',
            width: 200,
            render: (text) => (
              <Text
                ellipsis={{ tooltip: true }}
                style={{ fontSize: 12, color: '#595959' }}
              >
                {text || <Text type="secondary" italic>(empty)</Text>}
              </Text>
            ),
          },
          {
            title: (
              <Space>
                <SwapOutlined />
                <Text strong>Map to CRM Field</Text>
              </Space>
            ),
            key: 'mapping',
            render: (_, record) => (
              <Select
                style={{ width: '100%' }}
                placeholder="Select CRM field or skip"
                value={record.crmField}
                onChange={(value) => handleMappingChange(record.excelColumn, value)}
                allowClear
                showSearch
                optionFilterProp="children"
              >
                <Option value={null}>
                  <Text type="secondary" italic>Skip this column</Text>
                </Option>
                {CRM_FIELDS.map(field => {
                  const alreadyMapped = Object.values(mapping).filter(v => v === field.key).length > 0 && mapping[record.excelColumn] !== field.key;
                  return (
                    <Option key={field.key} value={field.key} disabled={alreadyMapped}>
                      <Space>
                        <span>{field.icon}</span>
                        <span>{field.label}</span>
                        {field.required && <Tag color="red" style={{ fontSize: 10 }}>Required</Tag>}
                        {alreadyMapped && <Tag color="orange" style={{ fontSize: 10 }}>Already Mapped</Tag>}
                      </Space>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{field.desc}</div>
                    </Option>
                  );
                })}
              </Select>
            ),
          },
        ]}
      />

      {/* Preview Section */}
      {previewRow && isValidMapping() && (
        <>
          <Divider orientation="left">Preview Mapped Data (First Row)</Divider>
          <Card size="small" styles={{ body: { background: '#fafafa' }}}>
            <Row gutter={[8, 8]}>
              {Object.entries(previewRow).map(([field, value]) => {
                const fieldDef = CRM_FIELDS.find(f => f.key === field);
                return (
                  <Col span={12} key={field}>
                    <div style={{ padding: '8px', background: 'white', borderRadius: 4, border: '1px solid #f0f0f0' }}>
                      <Space direction="vertical" size={0} style={{ width: '100%' }}>
                        <Text strong style={{ fontSize: 12, color: '#1890ff' }}>
                          {fieldDef?.icon} {fieldDef?.label}
                        </Text>
                        <Text style={{ fontSize: 13 }}>
                          {value || <Text type="secondary" italic>(empty)</Text>}
                        </Text>
                      </Space>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </>
      )}
    </Modal>
  );
};

export default FieldMappingModal;
