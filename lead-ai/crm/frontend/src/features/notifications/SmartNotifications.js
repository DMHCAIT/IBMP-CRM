import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellDot,
  MessageCircle,
  Phone,
  Clock,
  Sparkles,
  CreditCard,
  X,
  Check,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isFeatureEnabled } from '../../config/featureFlags';
import api from '../../api/api';

const SmartNotifications = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, priority
  const queryClient = useQueryClient();

  // Fetch notifications via centralized axios (handles 401 redirect automatically)
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      const params = {};
      if (filter === 'unread') params.read = 'false';
      if (filter === 'priority') params.priority = 'high';
      const res = await api.get('/api/notifications', { params });
      return res.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: isFeatureEnabled('WEBSOCKET_NOTIFICATIONS') ? false : 60 * 1000,
  });

  // WebSocket connection (if enabled) — reads token from localStorage directly for WS handshake
  useEffect(() => {
    if (!isFeatureEnabled('WEBSOCKET_NOTIFICATIONS')) return;

    const base = (process.env.REACT_APP_API_URL || 'http://localhost:8000')
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
    const token = JSON.parse(localStorage.getItem('user') || '{}')?.token;
    const ws = new WebSocket(`${base}/ws/notifications?token=${token}`);

    ws.onmessage = (event) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = JSON.parse(event.data);
        new Notification(notification.title, {
          body: notification.description,
          icon: '/logo192.png',
        });
      }
    };

    return () => ws.close();
  }, [queryClient]);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const res = await api.patch(`/api/notifications/${notificationId}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Snooze mutation
  const snoozeMutation = useMutation({
    mutationFn: async ({ notificationId, hours }) => {
      const res = await api.patch(`/api/notifications/${notificationId}/snooze`, { hours });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/notifications/read-all');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter(n => !n.readAt).length;

  const getNotificationIcon = (type) => {
    const icons = {
      hot_lead_inactive: AlertCircle,
      payment_opened: CreditCard,
      follow_up_overdue: Clock,
      buying_intent: Sparkles,
      whatsapp: MessageCircle,
      call_reminder: Phone,
    };
    return icons[type] || Bell;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: '#ef4444',
      medium: '#f59e0b',
      low: '#6b7280',
    };
    return colors[priority] || colors.low;
  };

  const handleAction = (notification) => {
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
      markAsReadMutation.mutate(notification.id);
    }
  };

  const groupedNotifications = notifications.reduce((acc, notification) => {
    const today = new Date().toDateString();
    const notifDate = new Date(notification.createdAt).toDateString();
    const group = notifDate === today ? 'Today' : 'Earlier';
    
    if (!acc[group]) acc[group] = [];
    acc[group].push(notification);
    return acc;
  }, {});

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Icon */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 'var(--space-2)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {unreadCount > 0 ? (
          <BellDot size={20} color="var(--text-primary)" />
        ) : (
          <Bell size={20} color="var(--text-secondary)" />
        )}
        
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '10px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.div>
        )}
      </motion.button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.3)',
                zIndex: 999,
              }}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              style={{
                position: 'fixed',
                top: '70px',
                right: '20px',
                width: '400px',
                maxHeight: '600px',
                background: 'var(--bg-primary)',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                border: '1px solid var(--border-color)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{ 
                padding: 'var(--space-4)', 
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', margin: 0 }}>
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => markAllAsReadMutation.mutate()}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: 'var(--text-sm)',
                      cursor: 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    Mark all read
                  </motion.button>
                )}
              </div>

              {/* Filter Tabs */}
              <div style={{ 
                padding: 'var(--space-3)', 
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                gap: 'var(--space-2)',
              }}>
                {['all', 'unread', 'priority'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: filter === f ? 'var(--color-primary)' : 'transparent',
                      color: filter === f ? 'white' : 'var(--text-secondary)',
                      fontSize: 'var(--text-sm)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Notifications List */}
              <div style={{ 
                flex: 1, 
                overflowY: 'auto',
                padding: 'var(--space-3)',
              }}>
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>
                    Loading...
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>
                    <Bell size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
                    <p>No notifications</p>
                  </div>
                ) : (
                  Object.entries(groupedNotifications).map(([group, items]) => (
                    <div key={group} style={{ marginBottom: 'var(--space-4)' }}>
                      <div style={{ 
                        fontSize: 'var(--text-xs)', 
                        color: 'var(--text-tertiary)',
                        fontWeight: '600',
                        marginBottom: 'var(--space-2)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {group}
                      </div>
                      
                      {items.map((notification) => {
                        const Icon = getNotificationIcon(notification.type);
                        const isUnread = !notification.readAt;
                        
                        return (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            style={{
                              background: isUnread ? 'var(--bg-secondary)' : 'transparent',
                              borderRadius: '8px',
                              padding: 'var(--space-3)',
                              marginBottom: 'var(--space-2)',
                              border: `1px solid ${isUnread ? 'var(--border-color)' : 'transparent'}`,
                              position: 'relative',
                            }}
                          >
                            {/* Priority indicator */}
                            {notification.priority === 'high' && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 'var(--space-3)',
                                  right: 'var(--space-3)',
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: getPriorityColor(notification.priority),
                                }}
                              />
                            )}

                            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  background: `${getPriorityColor(notification.priority)}15`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <Icon size={16} color={getPriorityColor(notification.priority)} />
                              </div>

                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: '600', marginBottom: '4px' }}>
                                  {notification.title}
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                                  {notification.description}
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                  {notification.actionUrl && (
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => handleAction(notification)}
                                      style={{
                                        padding: '4px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: 'var(--color-primary)',
                                        color: 'white',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      {notification.actionLabel || 'Take Action'}
                                      <ExternalLink size={10} />
                                    </motion.button>
                                  )}

                                  {isUnread && (
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => markAsReadMutation.mutate(notification.id)}
                                      style={{
                                        padding: '4px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'transparent',
                                        color: 'var(--text-secondary)',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <Check size={10} />
                                      Mark read
                                    </motion.button>
                                  )}

                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => snoozeMutation.mutate({ notificationId: notification.id, hours: 2 })}
                                    style={{
                                      padding: '4px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color)',
                                      background: 'transparent',
                                      color: 'var(--text-secondary)',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <Clock size={10} />
                                    Snooze 2h
                                  </motion.button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartNotifications;
