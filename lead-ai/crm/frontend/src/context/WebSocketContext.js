/**
 * IBMP CRM — WebSocket Context
 * ==============================
 * Provides a single, app-wide WebSocket connection that reconnects
 * automatically and delivers real-time events to subscribers.
 *
 * Architecture:
 *  1. On login, AuthContext calls wsConnect(token, tenantId).
 *  2. This context opens  ws(s)://<API_HOST>/ws/<tenantId>?token=<JWT>
 *  3. Any component can call  useWsEvent(eventType, handler)  to react to events.
 *  4. On logout / 401, AuthContext calls wsDisconnect().
 *
 * Event envelope:
 *   { type, tenant_id, payload, ts }
 *
 * Supported event types (from websocket_manager.py):
 *   lead.created  lead.updated  lead.deleted
 *   note.created  activity.created
 *   assignment.changed  status.changed  bulk.update  ai.score_updated
 *   connected  ping  pong
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getAuthToken } from './AuthContext';

const WebSocketContext = createContext(null);

// ── Exponential back-off reconnect delays (ms) ────────────────────────────────
const BACKOFF = [2_000, 4_000, 8_000, 15_000, 30_000, 60_000];
const MAX_RECONNECT_ATTEMPTS = 6; // stop retrying after this many failures

// ── Build the WebSocket URL from the REST API base URL ───────────────────────
function buildWsUrl(tenantId, token) {
  const apiBase = process.env.REACT_APP_API_URL || '';
  // Convert  http(s)://host  →  ws(s)://host
  const wsBase = apiBase.replace(/^http/, 'ws');
  const tid = encodeURIComponent(tenantId || 'default');
  const tok = encodeURIComponent(token || '');
  return `${wsBase}/ws/${tid}?token=${tok}`;
}

export function WebSocketProvider({ children }) {
  const wsRef          = useRef(null);    // live WebSocket instance
  const reconnectTimer = useRef(null);    // setTimeout handle
  const attemptRef     = useRef(0);       // reconnect attempt counter
  const connectedRef   = useRef(false);   // prevents double-connect
  const tenantRef      = useRef('default');

  // Map: event-type → Set<handler function>
  const listenersRef = useRef(new Map());

  const [status, setStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'

  // ── Internal: subscribe listeners to incoming messages ─────────────────────
  const _dispatch = useCallback((envelope) => {
    const type = envelope?.type;
    if (!type) return;

    // Call all handlers registered for this exact event type
    const bucket = listenersRef.current.get(type);
    if (bucket) bucket.forEach(fn => { try { fn(envelope); } catch (_) {} });

    // Also call wildcard '*' handlers
    const wildcard = listenersRef.current.get('*');
    if (wildcard) wildcard.forEach(fn => { try { fn(envelope); } catch (_) {} });
  }, []);

  // ── Internal: open the connection ──────────────────────────────────────────
  const _connect = useCallback((tenantId, token) => {
    if (connectedRef.current) return;
    connectedRef.current = true;
    tenantRef.current = tenantId || 'default';

    const url = buildWsUrl(tenantId, token);
    setStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data);
        _dispatch(envelope);
      } catch (_) {}
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — handle cleanup there
    };

    ws.onclose = (event) => {
      connectedRef.current = false;
      setStatus('disconnected');

      // 4001 = missing token, 4003 = auth failed → don't reconnect
      if (event.code === 4001 || event.code === 4003) return;

      // Stop retrying after max attempts (avoids console spam on Render free tier)
      if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.warn('[WS] Max reconnect attempts reached. Real-time updates paused.');
        return;
      }

      // Schedule reconnect with back-off
      const delay = BACKOFF[Math.min(attemptRef.current, BACKOFF.length - 1)];
      attemptRef.current += 1;

      reconnectTimer.current = setTimeout(() => {
        const currentToken = getAuthToken();
        if (currentToken) {
          _connect(tenantRef.current, currentToken);
        }
      }, delay);
    };
  }, [_dispatch]);

  // ── Internal: close the connection ─────────────────────────────────────────
  const _disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect on intentional close
      wsRef.current.close(1000, 'logout');
      wsRef.current = null;
    }
    connectedRef.current = false;
    attemptRef.current = 0;
    setStatus('disconnected');
  }, []);

  // Cleanup on unmount
  useEffect(() => () => _disconnect(), [_disconnect]);

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Called by AuthContext after a successful login. */
  const wsConnect = useCallback((token, tenantId = 'default') => {
    _disconnect(); // close any stale connection first
    _connect(tenantId, token);
  }, [_connect, _disconnect]);

  /** Called by AuthContext on logout. */
  const wsDisconnect = _disconnect;

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function.
   *
   * @param {string}   eventType  e.g. "lead.updated", "*" for all events
   * @param {function} handler    fn(envelope) => void
   */
  const subscribe = useCallback((eventType, handler) => {
    const map = listenersRef.current;
    if (!map.has(eventType)) map.set(eventType, new Set());
    map.get(eventType).add(handler);
    return () => map.get(eventType)?.delete(handler);
  }, []);

  /**
   * Send a ping to keep the connection alive.
   * The server responds with { type: "pong" }.
   */
  const ping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{
      status,
      wsConnect,
      wsDisconnect,
      subscribe,
      ping,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used inside <WebSocketProvider>');
  return ctx;
}

export default WebSocketContext;
