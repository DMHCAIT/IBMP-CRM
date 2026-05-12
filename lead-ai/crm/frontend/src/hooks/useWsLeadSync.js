/**
 * useWsLeadSync — drop into any page that shows leads to get instant updates
 *
 * Subscribes to all lead-related WebSocket events and automatically
 * invalidates the correct React Query cache keys so the UI refreshes
 * without a full page reload.
 *
 * Usage:
 *   import useWsLeadSync from '../hooks/useWsLeadSync';
 *
 *   function LeadsPage() {
 *     useWsLeadSync();           // one line — live updates enabled
 *     // ... rest of component
 *   }
 *
 * Optionally pass a callback for custom side effects:
 *   useWsLeadSync((event) => {
 *     if (event.type === 'lead.created') showToast('New lead arrived!');
 *   });
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useWsEvent from './useWsEvent';

const LEAD_EVENT_TYPES = [
  'lead.created',
  'lead.updated',
  'lead.deleted',
  'status.changed',
  'assignment.changed',
  'note.created',
  'activity.created',
  'ai.score_updated',
  'bulk.update',
];

/**
 * @param {function} [onEvent]  Optional callback called for every lead event
 */
export default function useWsLeadSync(onEvent) {
  const queryClient = useQueryClient();

  const handler = useCallback((envelope) => {
    const { type, payload = {} } = envelope;

    // Invalidate the relevant React Query caches
    switch (type) {
      case 'lead.created':
        // New lead → refresh list + stats
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
        break;

      case 'lead.updated':
      case 'status.changed':
      case 'assignment.changed':
      case 'ai.score_updated': {
        // Refresh list + the specific lead detail if it's open
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        if (payload.lead_id) {
          queryClient.invalidateQueries({ queryKey: ['lead', payload.lead_id] });
        }
        break;
      }

      case 'lead.deleted':
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        if (payload.lead_id) {
          queryClient.removeQueries({ queryKey: ['lead', payload.lead_id] });
        }
        break;

      case 'note.created':
      case 'activity.created':
        if (payload.lead_id) {
          queryClient.invalidateQueries({ queryKey: ['lead', payload.lead_id] });
          queryClient.invalidateQueries({ queryKey: ['notes', payload.lead_id] });
          queryClient.invalidateQueries({ queryKey: ['activities', payload.lead_id] });
        }
        break;

      case 'bulk.update':
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        break;

      default:
        break;
    }

    // Call optional custom callback
    if (onEvent) onEvent(envelope);
  }, [queryClient, onEvent]);

  // Subscribe to all lead event types
  LEAD_EVENT_TYPES.forEach(type => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWsEvent(type, handler);
  });
}
