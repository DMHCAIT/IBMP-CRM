/**
 * IBMP CRM — Global Loading Context
 * ====================================
 * Provides app-wide loading state management so:
 *   - Any component can trigger a global loading overlay (for page transitions)
 *   - Individual sections can show inline spinners
 *   - Multiple concurrent loading operations are tracked correctly
 *     (overlay only hides when ALL operations complete)
 *
 * Usage:
 *   // 1. Wrap your app (already done in App.js):
 *   <LoadingProvider>
 *     <App />
 *   </LoadingProvider>
 *
 *   // 2. In any component:
 *   import { useLoading } from '../context/LoadingContext';
 *
 *   function MyComponent() {
 *     const { startLoading, stopLoading, isLoading } = useLoading();
 *
 *     const fetchData = async () => {
 *       startLoading('fetch-leads');
 *       try {
 *         const data = await api.getLeads();
 *         setLeads(data);
 *       } finally {
 *         stopLoading('fetch-leads');
 *       }
 *     };
 *   }
 *
 *   // 3. Use the withLoading helper for one-liners:
 *   const { withLoading } = useLoading();
 *   const data = await withLoading('fetch-leads', () => api.getLeads());
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';


// ── Context ───────────────────────────────────────────────────────────────────
const LoadingContext = createContext(null);


// ── Provider ──────────────────────────────────────────────────────────────────
export function LoadingProvider({ children }) {
  // Map of operation-key → boolean.  We count separately from the overlay flag
  // so concurrent ops don't race each other.
  const opsRef   = useRef(new Map());
  const [loadingKeys, setLoadingKeys] = useState(new Set());

  /** Register a named loading operation. */
  const startLoading = useCallback((key = 'global') => {
    setLoadingKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  /** Un-register a named loading operation. */
  const stopLoading = useCallback((key = 'global') => {
    setLoadingKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  /**
   * Wrap an async fn with start/stop lifecycle.
   * Returns the fn's result (or re-throws its error).
   */
  const withLoading = useCallback(async (key, fn) => {
    startLoading(key);
    try {
      return await fn();
    } finally {
      stopLoading(key);
    }
  }, [startLoading, stopLoading]);

  /** True if ANY operation is in progress. */
  const isLoading = loadingKeys.size > 0;

  /** True if a specific named operation is running. */
  const isLoadingKey = useCallback((key) => loadingKeys.has(key), [loadingKeys]);

  const value = {
    startLoading,
    stopLoading,
    withLoading,
    isLoading,
    isLoadingKey,
    loadingKeys,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {/* Global overlay — shown when isLoading is true */}
      {isLoading && <GlobalLoadingOverlay keys={loadingKeys} />}
    </LoadingContext.Provider>
  );
}


// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useLoading must be used inside <LoadingProvider>');
  }
  return ctx;
}


// ── Global overlay component ──────────────────────────────────────────────────
function GlobalLoadingOverlay({ keys }) {
  // Only show full overlay for 'global' or 'page-*' keys
  // Other keys (e.g. 'fetch-leads') show inline spinners, not a full overlay
  const shouldShowOverlay = [...keys].some(
    k => k === 'global' || k.startsWith('page-') || k.startsWith('nav-')
  );

  if (!shouldShowOverlay) return null;

  return (
    <div style={overlayStyle} role="status" aria-live="polite" aria-label="Loading">
      <div style={spinnerContainerStyle}>
        <Spinner size={48} color="#1677ff" />
        <p style={loadingTextStyle}>Loading…</p>
      </div>
    </div>
  );
}


// ── Spinner component (no dependency on antd/external lib) ────────────────────
export function Spinner({ size = 24, color = '#1677ff', style: extraStyle }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      style={{
        animation:   'ibmp-spin 0.8s linear infinite',
        display:     'block',
        ...extraStyle,
      }}
      role="img"
      aria-label="Loading"
    >
      <style>{`
        @keyframes ibmp-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <circle
        cx="25" cy="25" r="20"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray="80 40"
        strokeLinecap="round"
      />
    </svg>
  );
}


/**
 * InlineLoader
 * ------------
 * Show a small spinner inline when a specific loading key is active.
 *
 * Usage:
 *   <InlineLoader loadingKey="fetch-leads" />
 */
export function InlineLoader({ loadingKey, message = 'Loading…', minHeight = 120 }) {
  const { isLoadingKey } = useLoading();
  if (!isLoadingKey(loadingKey)) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', minHeight, padding: 24, gap: 12 }}>
      <Spinner size={32} />
      <span style={{ color: '#888', fontSize: 14 }}>{message}</span>
    </div>
  );
}


/**
 * SkeletonRow
 * -----------
 * Animated placeholder rows while table data loads.
 */
export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div style={skeletonStyle} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard({ height = 120 }) {
  return (
    <div style={{
      ...skeletonStyle,
      height,
      borderRadius: 12,
      marginBottom: 16,
    }} />
  );
}


// ── Styles ────────────────────────────────────────────────────────────────────
const overlayStyle = {
  position:       'fixed',
  inset:          0,
  zIndex:         9999,
  background:     'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(4px)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
};

const spinnerContainerStyle = {
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  gap:            16,
  background:     '#fff',
  borderRadius:   16,
  padding:        '32px 48px',
  boxShadow:      '0 8px 32px rgba(0,0,0,0.12)',
};

const loadingTextStyle = {
  margin:     0,
  fontSize:   15,
  color:      '#555',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const skeletonStyle = {
  height:           16,
  borderRadius:     4,
  background:       'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize:   '200% 100%',
  animation:        'ibmp-shimmer 1.4s infinite',
};
