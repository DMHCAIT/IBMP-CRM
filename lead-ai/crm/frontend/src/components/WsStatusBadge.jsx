/**
 * WsStatusBadge
 * ==============
 * A small coloured dot + label in the header that shows the WebSocket
 * connection status:
 *
 *   ● Live     — green,  connected
 *   ● Syncing  — amber,  connecting / reconnecting
 *   ● Offline  — red,    disconnected (no WS)
 *
 * Usage:
 *   import WsStatusBadge from '../components/WsStatusBadge';
 *   // In your layout header:
 *   <WsStatusBadge />
 */

import React from 'react';
import { Tooltip } from 'antd';
import { useWebSocket } from '../context/WebSocketContext';

const CONFIG = {
  connected:    { dot: '#10b981', label: 'Live',    tip: 'Real-time updates active' },
  connecting:   { dot: '#f59e0b', label: 'Syncing', tip: 'Connecting to real-time server…' },
  disconnected: { dot: '#ef4444', label: 'Offline', tip: 'Real-time updates unavailable — data may be stale' },
};

export default function WsStatusBadge() {
  const { status } = useWebSocket();
  const cfg = CONFIG[status] || CONFIG.disconnected;

  return (
    <Tooltip title={cfg.tip} placement="bottomRight">
      <span style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        5,
        fontSize:   12,
        fontWeight: 500,
        color:      cfg.dot,
        cursor:     'default',
        userSelect: 'none',
        padding:    '3px 8px',
        borderRadius: 20,
        border:     `1px solid ${cfg.dot}33`,
        background: `${cfg.dot}12`,
      }}>
        <span style={{
          width:        7,
          height:       7,
          borderRadius: '50%',
          background:   cfg.dot,
          // Pulse only while connecting
          animation:    status === 'connecting'
            ? 'ws-pulse 1s ease-in-out infinite'
            : status === 'connected'
            ? 'ws-glow 2.5s ease-in-out infinite'
            : 'none',
        }} />
        {cfg.label}
        <style>{`
          @keyframes ws-pulse {
            0%,100% { opacity: 1; }
            50%      { opacity: 0.3; }
          }
          @keyframes ws-glow {
            0%,100% { box-shadow: 0 0 0 0 ${cfg.dot}60; }
            50%      { box-shadow: 0 0 0 4px ${cfg.dot}00; }
          }
        `}</style>
      </span>
    </Tooltip>
  );
}
