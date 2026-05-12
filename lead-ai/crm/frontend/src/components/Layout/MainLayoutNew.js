/**
 * @deprecated Use ProfessionalLayout instead.
 * TODO: `git rm` this file once confirmed no references remain.
 */
export { default } from './ProfessionalLayout';

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Hospital,
  BookOpen,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Menu as MenuIcon,
  X,
  TrendingUp,
  GitBranch,
  UserPlus,
  Activity,
  Bell,
  Settings,
  LogOut,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const MainLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme, colors } = useTheme();

  const menuItems = [
    { key: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { key: '/leads', icon: Users, label: 'Leads' },
    { key: '/pipeline', icon: GitBranch, label: 'Pipeline' },
    { key: '/lead-analysis', icon: TrendingUp, label: 'Lead Analysis' },
    { key: '/hospitals', icon: Hospital, label: 'Hospitals' },
    { key: '/courses', icon: BookOpen, label: 'Courses' },
    { key: '/users', icon: UserPlus, label: 'Team' },
    { key: '/user-activity', icon: Activity, label: 'User Activity' },
    { key: '/analytics', icon: BarChart3, label: 'Analytics' },
  ];

  const sidebarVariants = {
    expanded: { width: 256 },
    collapsed: { width: 80 },
  };

  const menuItemVariants = {
    hover: { 
      scale: 1.02,
      backgroundColor: colors.hover,
      transition: { duration: 0.2 }
    },
    tap: { scale: 0.98 }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: colors.background }}>
      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={collapsed ? 'collapsed' : 'expanded'}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:flex flex-col border-r"
        style={{ 
          background: colors.cardBg,
          borderColor: colors.border,
        }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b px-4" style={{ borderColor: colors.border }}>
          <motion.div
            className="flex items-center gap-3"
            animate={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}>
              🏥
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-bold text-xl whitespace-nowrap"
                  style={{ color: colors.text }}
                >
                  Med CRM
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.key;
            
            return (
              <motion.button
                key={item.key}
                variants={menuItemVariants}
                whileHover="hover"
                whileTap="tap"
                onClick={() => navigate(item.key)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all relative"
                style={{
                  background: isActive ? colors.primary : 'transparent',
                  color: isActive ? '#fff' : colors.textSecondary,
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: colors.primary }}
                    initial={false}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon size={20} className="relative z-10 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="relative z-10 font-medium whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </nav>

        {/* Collapse Button */}
        <div className="p-4 border-t" style={{ borderColor: colors.border }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 rounded-lg transition-colors"
            style={{ 
              background: colors.backgroundSecondary,
              color: colors.textSecondary,
            }}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </motion.button>
        </div>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 md:hidden shadow-2xl"
              style={{ background: colors.cardBg }}
            >
              <div className="h-16 flex items-center justify-between px-4 border-b" style={{ borderColor: colors.border }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}>
                    🏥
                  </div>
                  <div className="font-bold text-xl" style={{ color: colors.text }}>Med CRM</div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} style={{ color: colors.textSecondary }}>
                  <X size={24} />
                </button>
              </div>
              <nav className="p-4 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.key;
                  
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        navigate(item.key);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all"
                      style={{
                        background: isActive ? colors.primary : 'transparent',
                        color: isActive ? '#fff' : colors.textSecondary,
                      }}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6"
          style={{ 
            background: colors.cardBg,
            borderColor: colors.border,
          }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden"
              style={{ color: colors.textSecondary }}
            >
              <MenuIcon size={24} />
            </button>
            <h1 className="text-xl font-semibold hidden sm:block" style={{ color: colors.text }}>
              {menuItems.find(item => item.key === location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
              style={{ 
                background: colors.backgroundSecondary,
                color: colors.textSecondary,
              }}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isDark ? 'moon' : 'sun'}
                  initial={{ rotate: -180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 180, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isDark ? <Moon size={20} /> : <Sun size={20} />}
                </motion.div>
              </AnimatePresence>
            </motion.button>

            {/* Notifications */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative"
              style={{ 
                background: colors.backgroundSecondary,
                color: colors.textSecondary,
              }}
            >
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full" 
                style={{ background: colors.error }} />
            </motion.button>

            {/* Settings */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
              style={{ 
                background: colors.backgroundSecondary,
                color: colors.textSecondary,
              }}
            >
              <Settings size={20} />
            </motion.button>

            {/* User Menu */}
            <div className="hidden sm:flex items-center gap-3 ml-2 pl-2 border-l"
              style={{ borderColor: colors.border }}>
              <div className="text-right">
                <div className="text-sm font-medium" style={{ color: colors.text }}>Admin User</div>
                <div className="text-xs" style={{ color: colors.textTertiary }}>admin@medcrm.com</div>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}>
                AU
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto" style={{ background: colors.backgroundSecondary }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 md:p-6"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
