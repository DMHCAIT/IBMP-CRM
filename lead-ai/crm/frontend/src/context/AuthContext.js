/**
 * AuthContext — Secure JWT authentication
 *
 * Security model:
 *  - JWT token is stored IN MEMORY ONLY (never written to localStorage/sessionStorage).
 *    This prevents XSS attacks from stealing tokens.
 *  - Non-sensitive user metadata (name, role, email — NO token) is persisted in
 *    sessionStorage so the UI remains responsive after a page refresh.
 *  - On a full page reload the token is gone; the Axios interceptor will send no
 *    Authorization header and the server will return 401, redirecting to /login.
 *    This is the correct, secure behaviour.
 *  - Logout across tabs is handled via a BroadcastChannel (where supported) or the
 *    storage event on the sessionStorage key.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
// NOTE: wsConnect/wsDisconnect are injected via a ref by AuthProvider so we
// don't create a circular dependency between AuthContext ↔ WebSocketContext.

const AuthContext = createContext(null);

// Only metadata — NEVER the token — lives in sessionStorage.
const SESSION_KEY = 'crm_user_meta';

// In-memory token store — module-level so Axios interceptors can access it
// without going through React state.
let _inMemoryToken = null;

/** Read the token for Axios interceptors (no React dependency). */
export function getAuthToken() {
  return _inMemoryToken;
}

/** Clear the in-memory token (called on logout / 401). */
export function clearAuthToken() {
  _inMemoryToken = null;
}

function loadSessionMeta() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Allow App.js to inject wsConnect/wsDisconnect without a circular import.
// App.js sets this after both providers are mounted.
export const wsCallbacks = { connect: null, disconnect: null };

export function AuthProvider({ children }) {
  // user state holds metadata only (no token)
  const [user, setUser] = useState(() => loadSessionMeta());

  // BroadcastChannel for cross-tab logout
  const channelRef = useRef(null);
  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel('crm_auth');
      channelRef.current.onmessage = (e) => {
        if (e.data === 'logout') {
          _inMemoryToken = null;
          sessionStorage.removeItem(SESSION_KEY);
          setUser(null);
        }
      };
    } catch {
      // BroadcastChannel not supported — fallback to storage event
      const onStorage = (e) => {
        if (e.key === SESSION_KEY && !e.newValue) {
          _inMemoryToken = null;
          setUser(null);
        }
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    return () => channelRef.current?.close();
  }, []);

  /**
   * Call after a successful login API response.
   * @param {object} userData  — full user object from server (includes token)
   */
  const login = useCallback((userData) => {
    // Store token in memory only
    _inMemoryToken = userData.token || userData.access_token || null;

    // Persist only non-sensitive metadata
    const { token, access_token, password, ...meta } = userData; // eslint-disable-line no-unused-vars
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(meta));
    } catch {
      // sessionStorage unavailable — continue; UI will still work
    }
    setUser(meta);

    // Open WebSocket for real-time events (tenant_id from JWT or 'default')
    if (_inMemoryToken && wsCallbacks.connect) {
      const tenantId = userData.tenant_id || meta.tenant_id || 'default';
      wsCallbacks.connect(_inMemoryToken, tenantId);
    }
  }, []);

  const logout = useCallback(() => {
    // Close WebSocket before clearing token
    if (wsCallbacks.disconnect) wsCallbacks.disconnect();

    _inMemoryToken = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
      channelRef.current?.postMessage('logout');
    } catch { /* ignore */ }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user && !!_inMemoryToken }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the auth context.
 * Must be used inside <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
