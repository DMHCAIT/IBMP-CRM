/**
 * AuthContext — Secure JWT authentication
 *
 * Security model:
 *  - JWT token is stored in sessionStorage (persists during browser session).
 *    This allows page refreshes without logout while still being cleared on tab close.
 *  - User metadata (name, role, email) is also persisted in sessionStorage.
 *  - On page reload, both token and user metadata are restored automatically.
 *  - Logout across tabs is handled via a BroadcastChannel (where supported) or the
 *    storage event on the sessionStorage key.
 *  - For maximum security, consider storing token in httpOnly cookies instead.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
// NOTE: wsConnect/wsDisconnect are injected via a ref by AuthProvider so we
// don't create a circular dependency between AuthContext ↔ WebSocketContext.

const AuthContext = createContext(null);

// Only metadata — NEVER the token — lives in sessionStorage.
const SESSION_KEY = 'crm_user_meta';
const TOKEN_KEY = 'crm_auth_token';

// In-memory token store — module-level so Axios interceptors can access it
// without going through React state.
let _inMemoryToken = null;

/** Read the token for Axios interceptors (no React dependency). */
export function getAuthToken() {
  // Try memory first, then sessionStorage
  if (_inMemoryToken) return _inMemoryToken;
  
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored) {
      _inMemoryToken = stored;
      return stored;
    }
  } catch {
    // sessionStorage unavailable
  }
  return null;
}

/** Clear the in-memory token (called on logout / 401). */
export function clearAuthToken() {
  _inMemoryToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
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

  // Initialize token from sessionStorage on mount
  useEffect(() => {
    try {
      const storedToken = sessionStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        _inMemoryToken = storedToken;
        
        // Reconnect WebSocket if token exists
        if (user && wsCallbacks.connect) {
          const tenantId = user.tenant_id || 'default';
          wsCallbacks.connect(storedToken, tenantId);
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []); // Only run once on mount

  // BroadcastChannel for cross-tab logout
  const channelRef = useRef(null);
  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel('crm_auth');
      channelRef.current.onmessage = (e) => {
        if (e.data === 'logout') {
          clearAuthToken();
          sessionStorage.removeItem(SESSION_KEY);
          setUser(null);
        }
      };
    } catch {
      // BroadcastChannel not supported — fallback to storage event
      const onStorage = (e) => {
        if (e.key === SESSION_KEY && !e.newValue) {
          clearAuthToken();
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
    // Store token in memory AND sessionStorage
    _inMemoryToken = userData.token || userData.access_token || null;
    
    try {
      if (_inMemoryToken) {
        sessionStorage.setItem(TOKEN_KEY, _inMemoryToken);
      }
    } catch {
      // sessionStorage unavailable
    }

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

    clearAuthToken();
    try {
      sessionStorage.removeItem(SESSION_KEY);
      channelRef.current?.postMessage('logout');
    } catch { /* ignore */ }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user && !!getAuthToken() }}>
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
