import React from 'react';

export const CardSkeleton = () => (
  <div style={{
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 24,
    animation: 'pulse 1.5s ease-in-out infinite',
  }}>
    <div style={{
      height: 16,
      width: '40%',
      background: 'var(--bg-tertiary)',
      borderRadius: 4,
      marginBottom: 16,
    }} />
    <div style={{
      height: 32,
      width: '60%',
      background: 'var(--bg-tertiary)',
      borderRadius: 4,
      marginBottom: 12,
    }} />
    <div style={{
      height: 12,
      width: '30%',
      background: 'var(--bg-tertiary)',
      borderRadius: 4,
    }} />
  </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {Array.from({ length: rows }).map((_, idx) => (
      <div
        key={idx}
        style={{
          height: 48,
          background: 'var(--bg-primary)',
          borderRadius: 8,
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${idx * 0.1}s`,
        }}
      />
    ))}
  </div>
);

export const ChartSkeleton = () => (
  <div style={{
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 24,
  }}>
    <div style={{
      height: 20,
      width: '30%',
      background: 'var(--bg-tertiary)',
      borderRadius: 4,
      marginBottom: 24,
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
    <div style={{
      height: 280,
      background: 'var(--bg-tertiary)',
      borderRadius: 8,
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  </div>
);

// Add pulse animation to CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;
document.head.appendChild(style);
