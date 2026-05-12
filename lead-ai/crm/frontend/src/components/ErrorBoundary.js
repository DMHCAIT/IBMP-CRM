/**
 * IBMP CRM — Production-Grade Error Boundary
 * ============================================
 * Features:
 *   - Catches all unhandled React render / lifecycle errors
 *   - Environment-aware: shows stack trace in dev, hides it in production
 *   - Sentry integration (silently skipped if SENTRY_DSN is not configured)
 *   - "Try again" button resets boundary state without full page reload
 *   - Renders a beautiful fallback UI (no blank white screen ever)
 *   - Section-level boundary: wrap individual sections so one crash
 *     doesn't take down the whole app (see SectionErrorBoundary below)
 */

import React from 'react';

// ── Sentry integration (optional — no-op if not installed) ────────────────
// Dynamic require so webpack doesn't fail the build when @sentry/react is absent.
let Sentry = null;
try {
  const mod = '@sentry/' + 'react'; // eslint-disable-line
  Sentry = require(mod);            // eslint-disable-line
} catch (_) {
  // Sentry not installed — silently skip
}

// ── Environment helper ────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development';


// ── Full-page Error Boundary ───────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError:     false,
      error:        null,
      errorInfo:    null,
      eventId:      null,   // Sentry event ID for user feedback
    };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Send to Sentry if available
    if (Sentry) {
      const eventId = Sentry.captureException(error, {
        extra: { componentStack: errorInfo.componentStack },
      });
      this.setState({ eventId });
    }

    // Always log to console in dev
    if (isDev) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null, eventId: null });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, eventId } = this.state;
    const { fallback, title = 'Something went wrong' } = this.props;

    // Allow a custom fallback UI
    if (fallback) {
      return typeof fallback === 'function'
        ? fallback({ error, reset: this.handleReset })
        : fallback;
    }

    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          {/* Icon */}
          <div style={styles.iconWrapper}>
            <span style={styles.icon}>⚠️</span>
          </div>

          {/* Title */}
          <h2 style={styles.title}>{title}</h2>
          <p style={styles.subtitle}>
            {isDev
              ? error?.message || 'An unexpected error occurred'
              : 'An unexpected error occurred. Our team has been notified.'}
          </p>

          {/* Sentry feedback button */}
          {eventId && Sentry && (
            <button
              style={{ ...styles.btn, ...styles.btnSecondary, marginBottom: 8 }}
              onClick={() => Sentry.showReportDialog({ eventId })}
            >
              📋 Report this issue
            </button>
          )}

          {/* Action buttons */}
          <div style={styles.actions}>
            <button style={styles.btn} onClick={this.handleReset}>
              🔄 Try Again
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => window.location.reload()}
            >
              🔁 Reload Page
            </button>
          </div>

          {/* Dev-only stack trace */}
          {isDev && errorInfo?.componentStack && (
            <details style={styles.details}>
              <summary style={styles.summary}>🔍 Component Stack (dev only)</summary>
              <pre style={styles.pre}>{errorInfo.componentStack}</pre>
            </details>
          )}

          {isDev && error?.stack && (
            <details style={styles.details}>
              <summary style={styles.summary}>🔍 Error Stack (dev only)</summary>
              <pre style={styles.pre}>{error.stack}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}


/**
 * SectionErrorBoundary
 * ---------------------
 * Lightweight boundary for wrapping individual sections/widgets.
 * Shows a compact inline error card instead of a full-page takeover.
 *
 * Usage:
 *   <SectionErrorBoundary name="Lead Table">
 *     <LeadTable />
 *   </SectionErrorBoundary>
 */
class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (Sentry) Sentry.captureException(error);
    if (isDev) console.error(`[SectionErrorBoundary:${this.props.name}]`, error, errorInfo);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const sectionName = this.props.name || 'This section';

    return (
      <div style={styles.sectionCard}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div>
          <strong>{sectionName} failed to load</strong>
          {isDev && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
              {this.state.error?.message}
            </p>
          )}
        </div>
        <button
          style={{ ...styles.btn, padding: '4px 12px', fontSize: 13 }}
          onClick={this.handleReset}
        >
          Retry
        </button>
      </div>
    );
  }
}


// ── Styles ─────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    display:        'flex',
    justifyContent: 'center',
    alignItems:     'center',
    minHeight:      '100vh',
    padding:        '20px',
    background:     'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    fontFamily:     '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    background:   '#fff',
    borderRadius: 16,
    padding:      '40px 48px',
    maxWidth:     560,
    width:        '100%',
    boxShadow:    '0 20px 60px rgba(0,0,0,0.12)',
    textAlign:    'center',
  },
  iconWrapper: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontSize:   24,
    fontWeight: 700,
    color:      '#1a1a2e',
    margin:     '0 0 8px',
  },
  subtitle: {
    fontSize: 15,
    color:    '#666',
    margin:   '0 0 24px',
    lineHeight: 1.6,
  },
  actions: {
    display:        'flex',
    justifyContent: 'center',
    gap:            12,
    marginBottom:   20,
  },
  btn: {
    padding:      '10px 24px',
    borderRadius: 8,
    border:       'none',
    cursor:       'pointer',
    fontSize:     14,
    fontWeight:   600,
    background:   '#1677ff',
    color:        '#fff',
    transition:   'opacity 0.2s',
  },
  btnSecondary: {
    background: '#f0f0f0',
    color:      '#333',
  },
  details: {
    textAlign:    'left',
    marginTop:    16,
    background:   '#fafafa',
    borderRadius: 8,
    padding:      12,
  },
  summary: {
    cursor:     'pointer',
    fontWeight: 600,
    fontSize:   13,
    color:      '#555',
  },
  pre: {
    margin:     '8px 0 0',
    fontSize:   11,
    overflow:   'auto',
    maxHeight:  200,
    color:      '#c41d7f',
    whiteSpace: 'pre-wrap',
    wordBreak:  'break-all',
  },
  sectionCard: {
    display:      'flex',
    alignItems:   'center',
    gap:          12,
    padding:      '12px 16px',
    background:   '#fff3cd',
    border:       '1px solid #ffc107',
    borderRadius: 8,
    margin:       '8px 0',
  },
};


export default ErrorBoundary;
export { SectionErrorBoundary };
