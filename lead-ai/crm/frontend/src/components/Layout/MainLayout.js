/**
 * @deprecated Use ProfessionalLayout instead.
 * This file is kept only so any missed import doesn't hard-crash the app.
 * TODO: `git rm` this file once confirmed no references remain.
 */
export { default } from './ProfessionalLayout';

// ── archived original below (do not use) ──────────────────────────────────
import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  MedicineBoxOutlined,
  BookOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UsergroupAddOutlined,
  FundProjectionScreenOutlined,
  LineChartOutlined,
  FundOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const MainLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/leads',
      icon: <TeamOutlined />,
      label: 'Leads',
    },
    {
      key: '/pipeline',
      icon: <FundProjectionScreenOutlined />,
      label: 'Pipeline',
    },
    {
      key: '/lead-analysis',
      icon: <FundOutlined />,
      label: 'Lead Analysis',
    },
    {
      key: '/hospitals',
      icon: <MedicineBoxOutlined />,
      label: 'Hospitals',
    },
    {
      key: '/courses',
      icon: <BookOutlined />,
      label: 'Courses',
    },
    {
      key: '/users',
      icon: <UsergroupAddOutlined />,
      label: 'Team',
    },
    {
      key: '/user-activity',
      icon: <LineChartOutlined />,
      label: 'User Activity',
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: 'Analytics',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '20px',
          fontWeight: 'bold',
        }}>
          {collapsed ? '🏥' : '🏥 Med CRM'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
            style: { fontSize: '18px', cursor: 'pointer' },
            onClick: () => setCollapsed(!collapsed),
          })}
          <div style={{ marginLeft: 'auto', fontSize: '16px', fontWeight: 500 }}>
            AI-Powered Medical Education CRM
          </div>
        </Header>
        <Content style={{ margin: '24px', padding: '24px', background: '#fff', borderRadius: '8px' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
