import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const theme = {
    isDark,
    toggleTheme,
    colors: isDark ? {
      // Dark mode colors
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4',
      
      background: '#0f172a',
      backgroundSecondary: '#1e293b',
      backgroundTertiary: '#334155',
      
      text: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textTertiary: '#94a3b8',
      
      border: '#334155',
      borderLight: '#475569',
      
      hover: '#1e293b',
      active: '#334155',
      
      cardBg: '#1e293b',
      cardBorder: '#334155',
      
      inputBg: '#0f172a',
      inputBorder: '#475569',
      
      shadow: 'rgba(0, 0, 0, 0.5)',
    } : {
      // Light mode colors
      primary: '#2563eb',
      secondary: '#7c3aed',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#0891b2',
      
      background: '#ffffff',
      backgroundSecondary: '#f8fafc',
      backgroundTertiary: '#f1f5f9',
      
      text: '#0f172a',
      textSecondary: '#475569',
      textTertiary: '#64748b',
      
      border: '#e2e8f0',
      borderLight: '#cbd5e1',
      
      hover: '#f8fafc',
      active: '#f1f5f9',
      
      cardBg: '#ffffff',
      cardBorder: '#e2e8f0',
      
      inputBg: '#ffffff',
      inputBorder: '#cbd5e1',
      
      shadow: 'rgba(0, 0, 0, 0.1)',
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};
