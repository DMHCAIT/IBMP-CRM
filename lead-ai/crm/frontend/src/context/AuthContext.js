/**
 * AuthContext — Auto-logged in as Admin (no authentication required)
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'user';

// Default admin user (no login required)
const DEFAULT_USER = {
  id: 1,
  email: 'admin@demo-crm.com',
  full_name: 'Super Admin',
  role: 'Super Admin',
  token: 'auto-login-token'
};

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = loadStoredUser();
    // Always ensure we have a user (auto-login)
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USER));
      return DEFAULT_USER;
    }
    return stored;
  });

  // Sync across browser tabs
  useEffect(() => {
    function onStorage(e) {
      if (e.key === STORAGE_KEY) {
        setUser(e.newValue ? JSON.parse(e.newValue) : DEFAULT_USER);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback((userData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    // Do nothing - login is disabled
    console.log('Logout disabled - authentication removed');
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: true }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the auth context.
 * Throws if used outside of <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
