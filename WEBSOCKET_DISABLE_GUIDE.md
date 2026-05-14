# WebSocket Disable Guide

## Issue
Browser console shows WebSocket connection errors even though the CRM works perfectly without it:
```
WebSocket connection to 'wss://...' failed
```

## Why This Happens
The browser logs WebSocket connection failures **before** JavaScript error handlers can suppress them. This is a browser-level warning that cannot be silenced with `try/catch` or `onerror` handlers.

## Solution
WebSocket is completely **optional** for the CRM. All features work without it (using HTTP polling and React Query's auto-refresh). We've added an environment variable to disable WebSocket entirely.

## How to Disable WebSocket

### Option 1: Environment Variable (Recommended)
Add this to your Vercel environment variables:

```
REACT_APP_DISABLE_WEBSOCKET=true
```

**Steps in Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `REACT_APP_DISABLE_WEBSOCKET`
   - **Value**: `true`
   - **Environments**: Production, Preview, Development (select all)
3. Click "Save"
4. Redeploy: Deployments → Latest → "Redeploy"

### Option 2: Update .env.production (Already Done)
The file `lead-ai/crm/frontend/.env.production` already has:
```
REACT_APP_DISABLE_WEBSOCKET=true
```

This will be used during build if Vercel doesn't override it with environment variables.

## What Happens When Disabled

✅ **What STILL Works**:
- All lead updates (inline editing)
- Real-time data refresh (React Query polls every 30s)
- Lead creation/deletion
- Notes and activities
- All analytics and dashboards
- Campaign tracking
- Everything works normally!

❌ **What Stops Working**:
- Instant multi-user updates (you won't see other users' changes until next auto-refresh)
- Live notifications (not implemented yet anyway)

## Impact
**Zero functional impact**. The CRM is designed to work perfectly without WebSocket. It's only a "nice to have" for instant multi-user updates, which React Query already handles with 30-second polling.

## Verification
After deploying with `REACT_APP_DISABLE_WEBSOCKET=true`:
1. Open browser console (F12)
2. Refresh the CRM
3. No WebSocket errors should appear
4. All features work normally

## Technical Details
- WebSocket was already marked as "optional" in the code
- Error handlers were suppressing errors in JavaScript, but not browser logs
- Now the WebSocket connection is never attempted if disabled
- Falls back to HTTP polling (which was already working)

## Rollback
To re-enable WebSocket:
1. Remove the environment variable from Vercel
2. Or set `REACT_APP_DISABLE_WEBSOCKET=false`
3. Redeploy
