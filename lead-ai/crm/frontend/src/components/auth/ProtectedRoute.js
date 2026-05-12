import React from 'react';
import { Navigate } from 'react-router-dom';
import { canAccessRoute } from '../../config/rbac';

const ProtectedRoute = ({ children, route }) => {
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const userRole = user.role;

  if (!userRole) {
    return <Navigate to="/login" replace />;
  }

  if (route && !canAccessRoute(userRole, route)) {
    return (
      <div style={{ 
        padding: 'var(--space-6)', 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: 'var(--space-4)',
        }}>
          🔒
        </div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '600', marginBottom: 'var(--space-2)' }}>
          Access Denied
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          You don't have permission to access this page.
        </p>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: 'var(--text-sm)',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
