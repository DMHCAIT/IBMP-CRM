import React from 'react';
import { motion } from 'framer-motion';
import { Inbox, Search, FileQuestion } from 'lucide-react';

export const EmptyState = ({ 
  icon: Icon = Inbox,
  title = 'No data found',
  description = 'Get started by adding your first item',
  action,
  actionLabel = 'Add Item',
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 64,
      textAlign: 'center',
    }}
  >
    <div style={{
      width: 80,
      height: 80,
      borderRadius: '50%',
      background: 'var(--bg-tertiary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    }}>
      <Icon size={32} style={{ color: 'var(--text-tertiary)' }} />
    </div>
    
    <h3 style={{
      fontSize: 'var(--text-lg)',
      fontWeight: 600,
      color: 'var(--text-primary)',
      marginBottom: 8,
    }}>
      {title}
    </h3>
    
    <p style={{
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)',
      marginBottom: 24,
      maxWidth: 400,
    }}>
      {description}
    </p>
    
    {action && (
      <button
        onClick={action}
        style={{
          padding: '12px 24px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {actionLabel}
      </button>
    )}
  </motion.div>
);

export const SearchEmpty = () => (
  <EmptyState
    icon={Search}
    title="No results found"
    description="Try adjusting your search terms or filters"
  />
);

export const ErrorState = ({ onRetry }) => (
  <EmptyState
    icon={FileQuestion}
    title="Something went wrong"
    description="We couldn't load this data. Please try again."
    action={onRetry}
    actionLabel="Retry"
  />
);
