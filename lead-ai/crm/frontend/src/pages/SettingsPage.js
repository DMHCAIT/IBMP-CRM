import React, { useState } from 'react';
import { Tabs, Form, Input, Button, Card, Row, Col, Alert, message, Spin } from 'antd';
import { useAuth } from '../context/AuthContext';
import { userStatsAPI } from '../api/api';
import { useMutation } from '@tanstack/react-query';
import { featureFlags } from '../config/featureFlags';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const SettingsPage = () => {
  const { user, updateUser } = useAuth();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // Password change mutation
  const passwordMutation = useMutation({
    mutationFn: (data) => userStatsAPI.changePassword(user.id, data),
    onSuccess: () => {
      message.success('Password changed successfully');
      passwordForm.resetFields();
    },
    onError: (error) => {
      message.error(error.response?.data?.message || 'Failed to change password');
    },
  });

  const handlePasswordChange = async (values) => {
    if (values.new_password !== values.confirm_password) {
      message.error('Passwords do not match');
      return;
    }
    passwordMutation.mutate({
      current_password: values.current_password,
      new_password: values.new_password,
    });
  };

  const items = [
    {
      key: '1',
      label: 'Profile',
      children: (
        <div style={{ maxWidth: '600px' }}>
          <Card style={{ borderRadius: '12px' }}>
            <Form layout="vertical" style={{ marginBottom: '24px' }}>
              <Form.Item label="Full Name">
                <Input
                  defaultValue={user?.full_name}
                  placeholder="Your full name"
                  readOnly
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>
              <Form.Item label="Email">
                <Input
                  type="email"
                  defaultValue={user?.email}
                  placeholder="Your email"
                  readOnly
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>
              <Form.Item label="Phone">
                <Input
                  defaultValue={user?.phone}
                  placeholder="Your phone number"
                  readOnly
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>
            </Form>
          </Card>

          <Card style={{ borderRadius: '12px', marginTop: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
              Change Password
            </h3>
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handlePasswordChange}
            >
              <Form.Item
                name="current_password"
                label="Current Password"
                rules={[{ required: true, message: 'Current password is required' }]}
              >
                <Input.Password
                  placeholder="Enter current password"
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>

              <Form.Item
                name="new_password"
                label="New Password"
                rules={[
                  { required: true, message: 'New password is required' },
                  { min: 8, message: 'Password must be at least 8 characters' },
                ]}
              >
                <Input.Password
                  placeholder="Enter new password"
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>

              <Form.Item
                name="confirm_password"
                label="Confirm Password"
                rules={[{ required: true, message: 'Please confirm your password' }]}
              >
                <Input.Password
                  placeholder="Confirm new password"
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={passwordMutation.isPending}
                style={{ borderRadius: '8px' }}
              >
                Update Password
              </Button>
            </Form>
          </Card>
        </div>
      ),
    },
    {
      key: '2',
      label: 'System',
      children: (
        <div style={{ maxWidth: '600px' }}>
          <Card style={{ borderRadius: '12px' }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    API URL
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}>
                    {API_BASE_URL}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Version
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}>
                    2.1.0
                  </div>
                </div>
              </Col>
            </Row>

            <div style={{ marginTop: '24px' }}>
              <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>
                Feature Flags
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(featureFlags).map(([flag, enabled]) => (
                  <div
                    key={flag}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <span>{flag}</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: enabled ? '#d1fae5' : '#fee2e2',
                        color: enabled ? '#059669' : '#dc2626',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}
                    >
                      {enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: '3',
      label: 'About',
      children: (
        <div style={{ maxWidth: '600px' }}>
          <Card style={{ borderRadius: '12px' }}>
            <Row gutter={[24, 24]}>
              <Col xs={24}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
                    MedFellow CRM v2.1.0
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    A comprehensive Customer Relationship Management platform for medical education enrollment management.
                  </p>
                </div>
              </Col>

              <Col xs={24}>
                <div>
                  <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>
                    Technology Stack
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div style={{
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>Frontend</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                        React, TypeScript, Ant Design, TanStack Query, Recharts
                      </div>
                    </div>
                    <div style={{
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>Backend</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                        Python, Flask, PostgreSQL, JWT Auth
                      </div>
                    </div>
                  </div>
                </div>
              </Col>

              <Col xs={24}>
                <Alert
                  message="Support"
                  description={
                    <>
                      <p style={{ margin: '8px 0' }}>
                        For support or issues, please contact:
                      </p>
                      <p style={{ margin: '8px 0', fontWeight: '600' }}>
                        Email: support@demo-crm.com
                      </p>
                    </>
                  }
                  type="info"
                  style={{ borderRadius: '8px' }}
                />
              </Col>
            </Row>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage your account preferences and system configuration
        </p>
      </div>

      <Card style={{ borderRadius: '12px' }}>
        <Tabs items={items} />
      </Card>
    </div>
  );
};

export default SettingsPage;
