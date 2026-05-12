/**
 * useWsEvent — subscribe to a WebSocket event type inside any component
 *
 * Usage:
 *   import useWsEvent from '../hooks/useWsEvent';
 *
 *   // Invalidate React Query cache when a lead is updated elsewhere
 *   const queryClient = useQueryClient();
 *   useWsEvent('lead.updated', (envelope) => {
 *     queryClient.invalidateQueries({ queryKey: ['leads'] });
 *   });
 *
 *   // React to status changes
 *   useWsEvent('status.changed', ({ payload }) => {
 *     toast.info(`Lead ${payload.lead_id} → ${payload.status}`);
 *   });
 *
 *   // Subscribe to ALL events
 *   useWsEvent('*', (envelope) => console.log('[WS]', envelope));
 *
 * The handler is stable — you don't need to wrap it in useCallback.
 * The subscription is automatically cleaned up on unmount.
 */

import { useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

/**
 * @param {string}   eventType  WebSocket event type to subscribe to, or '*' for all
 * @param {function} handler    Called with the full event envelope on each event
 * @param {Array}    deps       Optional extra deps that should re-register the handler
 */
export default function useWsEvent(eventType, handler, deps = []) {
  const { subscribe } = useWebSocket();

  // Keep a stable ref to the latest handler so the subscription never needs
  // to be re-created when the handler closure changes.
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });

  useEffect(() => {
    const stableHandler = (envelope) => handlerRef.current(envelope);
    const unsubscribe = subscribe(eventType, stableHandler);
    return unsubscribe;
  }, [subscribe, eventType, ...deps]); // deps spread is intentional — callers opt-in to re-registration
}
