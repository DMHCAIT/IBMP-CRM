/**
 * keepAlive.js
 *
 * Pings the backend /ping endpoint every INTERVAL_MS when the browser tab
 * is visible.  This prevents the Render free-tier container from going cold
 * during an active user session.
 *
 * Usage — call once from index.js or App.js:
 *   import { startKeepAlive } from './lib/keepAlive';
 *   startKeepAlive();
 */

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const API_BASE    = process.env.REACT_APP_API_URL || 'http://localhost:8000';

let _timer = null;

async function doPing() {
  // Only ping when the tab is active — don't wake the server for background tabs
  if (document.visibilityState !== 'visible') return;
  try {
    await fetch(`${API_BASE}/ping`, { method: 'GET', mode: 'cors' });
  } catch {
    // Silently ignore — if the server is unreachable we don't need to error
  }
}

export function startKeepAlive() {
  if (_timer) return; // already running
  doPing(); // immediate first ping on app load
  _timer = setInterval(doPing, INTERVAL_MS);
}

export function stopKeepAlive() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}
