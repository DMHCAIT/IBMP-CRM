import React from 'react';
import { motion } from 'framer-motion';

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon: Icon,
  onClick,
  disabled,
  ...props 
}) => {
  const variants = {
    primary: {
      background: 'var(--accent)',
      color: '#fff',
      hover: 'var(--accent-hover)',
    },
    secondary: {
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      hover: 'var(--bg-tertiary)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      hover: 'var(--bg-secondary)',
    },
    danger: {
      background: 'var(--error)',
      color: '#fff',
      hover: '#dc2626',
    },
  };

  const sizes = {
    sm: { padding: '6px 12px', fontSize: 'var(--text-xs)' },
    md: { padding: '10px 20px', fontSize: 'var(--text-sm)' },
    lg: { padding: '14px 28px', fontSize: 'var(--text-base)' },
  };

  const style = {
    ...sizes[size],
    background: variants[variant].background,
    color: variants[variant].color,
    border: 'none',
    borderRadius: 8,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.15s ease',
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      style={style}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </motion.button>
  );
};

export const Card = ({ children, hover = false, ...props }) => (
  <motion.div
    whileHover={hover ? { y: -2, boxShadow: '0 8px 24px var(--shadow)' } : {}}
    style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 24,
      transition: 'all 0.15s ease',
    }}
    {...props}
  >
    {children}
  </motion.div>
);

export const Badge = ({ children, variant = 'default', ...props }) => {
  const variants = {
    default: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' },
    success: { bg: '#f0fdf4', color: '#10b981' },
    warning: { bg: '#fef3c7', color: '#f59e0b' },
    error: { bg: '#fef2f2', color: '#ef4444' },
    info: { bg: '#eff6ff', color: '#3b82f6' },
  };

  return (
    <span
      style={{
        padding: '4px 12px',
        borderRadius: 6,
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        background: variants[variant].bg,
        color: variants[variant].color,
        display: 'inline-block',
      }}
      {...props}
    >
      {children}
    </span>
  );
};

export const Input = ({ label, error, icon: Icon, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && (
      <label style={{
        display: 'block',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        color: 'var(--text-primary)',
        marginBottom: 8,
      }}>
        {label}
      </label>
    )}
    <div style={{ position: 'relative' }}>
      {Icon && (
        <div style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-tertiary)',
        }}>
          <Icon size={16} />
        </div>
      )}
      <input
        style={{
          width: '100%',
          padding: Icon ? '10px 16px 10px 40px' : '10px 16px',
          border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
          borderRadius: 8,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          background: 'var(--bg-primary)',
          outline: 'none',
          transition: 'border-color 0.15s ease',
        }}
        {...props}
      />
    </div>
    {error && (
      <span style={{
        display: 'block',
        marginTop: 4,
        fontSize: 'var(--text-xs)',
        color: 'var(--error)',
      }}>
        {error}
      </span>
    )}
  </div>
);
