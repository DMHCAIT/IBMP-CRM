/**
 * WhatsApp Real-Time Popup System
 * ================================
 * Uses Supabase Realtime to listen for new inbound messages.
 * When a lead sends a message, a popup instantly appears for the assigned agent.
 *
 * Install: npm install @supabase/supabase-js
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://your-project.supabase.co";       // Replace with yours
const SUPABASE_ANON_KEY = "your-anon-key";                     // Replace with yours

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ═══════════════════════════════════════════════════════════
// INITIALIZE — Call this when agent logs into CRM
// Pass the logged-in agent's ID
// ═══════════════════════════════════════════════════════════

export function initWhatsAppRealtime(agentId) {
  console.log(`WhatsApp Realtime started for agent: ${agentId}`);

  // Listen ONLY for messages assigned to this agent
  const channel = supabase
    .channel(`whatsapp-agent-${agentId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",                        // New message arrived
        schema: "public",
        table: "whatsapp_messages",
        filter: `assigned_agent_id=eq.${agentId}`,
      },
      (payload) => {
        const message = payload.new;

        // Only show popup for inbound messages (lead → CRM)
        if (message.direction === "inbound" && !message.is_read) {
          showMessagePopup(message);
          updateChatListBadge(message.from_number);
          playNotificationSound();
        }
      }
    )
    .subscribe();

  return channel; // Save this to unsubscribe later if needed
}


// ═══════════════════════════════════════════════════════════
// POPUP NOTIFICATION
// ═══════════════════════════════════════════════════════════

function showMessagePopup(message) {
  // Remove existing popup if any
  const existing = document.getElementById("wa-popup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.id = "wa-popup";
  popup.innerHTML = `
    <div style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #fff;
      border-left: 4px solid #25D366;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      padding: 16px 20px;
      min-width: 300px;
      max-width: 360px;
      z-index: 99999;
      cursor: pointer;
      animation: slideIn 0.3s ease;
      font-family: sans-serif;
    " onclick="openChat('${message.from_number}')">

      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <div style="
          width: 38px; height: 38px;
          background: #25D366;
          border-radius: 50%;
          display:flex; align-items:center; justify-content:center;
          color: white; font-size: 18px;
        ">💬</div>
        <div>
          <div style="font-weight:700; font-size:14px; color:#111;">
            ${message.contact_name || message.from_number}
          </div>
          <div style="font-size:11px; color:#888;">New WhatsApp Message</div>
        </div>
        <button onclick="event.stopPropagation(); this.closest('#wa-popup').remove();"
          style="margin-left:auto; background:none; border:none; font-size:18px;
                 cursor:pointer; color:#999; line-height:1;">×</button>
      </div>

      <div style="
        font-size: 13px;
        color: #444;
        background: #f7f7f7;
        border-radius: 8px;
        padding: 8px 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      ">
        ${escapeHtml(message.content)}
      </div>

      <div style="font-size:11px; color:#aaa; margin-top:6px; text-align:right;">
        ${formatTime(message.timestamp)} · Tap to open chat
      </div>
    </div>

    <style>
      @keyframes slideIn {
        from { transform: translateX(120%); opacity: 0; }
        to   { transform: translateX(0);   opacity: 1; }
      }
    </style>
  `;

  document.body.appendChild(popup);

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    const el = document.getElementById("wa-popup");
    if (el) el.remove();
  }, 8000);

  // Also show browser notification if tab is in background
  showBrowserNotification(message);
}


// ═══════════════════════════════════════════════════════════
// BROWSER NOTIFICATION (when agent is on another tab)
// ═══════════════════════════════════════════════════════════

function showBrowserNotification(message) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    const notification = new Notification(
      `💬 ${message.contact_name || message.from_number}`,
      {
        body: message.content,
        icon: "/static/whatsapp-icon.png",  // Your CRM WhatsApp icon
        tag: `wa-${message.from_number}`,   // Groups notifications from same lead
      }
    );
    notification.onclick = () => {
      window.focus();
      openChat(message.from_number);
      notification.close();
    };
  } else if (Notification.permission !== "denied") {
    // Request permission on first message
    Notification.requestPermission();
  }
}


// ═══════════════════════════════════════════════════════════
// UPDATE CHAT LIST — Badge count on conversation list
// ═══════════════════════════════════════════════════════════

function updateChatListBadge(phoneNumber) {
  // Update the unread badge on the chat list item for this lead
  // Adjust selector to match your CRM's HTML structure
  const chatItem = document.querySelector(`[data-phone="${phoneNumber}"]`);
  if (chatItem) {
    let badge = chatItem.querySelector(".unread-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "unread-badge";
      badge.style.cssText = `
        background: #25D366; color: white;
        border-radius: 50%; padding: 2px 7px;
        font-size: 11px; font-weight: bold;
        margin-left: 6px;
      `;
      chatItem.appendChild(badge);
    }
    const current = parseInt(badge.textContent) || 0;
    badge.textContent = current + 1;
  }
}


// ═══════════════════════════════════════════════════════════
// LOAD CHAT HISTORY — When agent opens a conversation
// ═══════════════════════════════════════════════════════════

export async function loadChatHistory(phoneNumber) {
  const response = await fetch(`/api/whatsapp/history/${phoneNumber}/`);
  const data = await response.json();
  return data.messages || [];
}


// ═══════════════════════════════════════════════════════════
// SEND MESSAGE — When agent types and hits send
// ═══════════════════════════════════════════════════════════

export async function sendMessage(toNumber, message, agentId, type = "text") {
  const response = await fetch("/api/whatsapp/send/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: toNumber,
      message: message,
      agent_id: agentId,
      type: type,
    }),
  });
  return response.json();
}


// ═══════════════════════════════════════════════════════════
// MARK AS READ — When agent opens a chat
// ═══════════════════════════════════════════════════════════

export async function markAsRead(phoneNumber) {
  await fetch("/api/whatsapp/mark-read/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber }),
  });

  // Remove badge from chat list
  const badge = document.querySelector(
    `[data-phone="${phoneNumber}"] .unread-badge`
  );
  if (badge) badge.remove();
}


// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function playNotificationSound() {
  try {
    const audio = new Audio("/static/notification.mp3"); // Add a short sound file
    audio.volume = 0.5;
    audio.play().catch(() => {}); // Silently fail if blocked
  } catch (e) {}
}

function openChat(phoneNumber) {
  // Navigate to the lead's chat in your CRM
  // Adjust this URL to match your CRM routing
  window.location.href = `/crm/leads/chat/${phoneNumber}/`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text || ""));
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


// ═══════════════════════════════════════════════════════════
// USAGE EXAMPLE — In your CRM main app file:
// ═══════════════════════════════════════════════════════════
//
//  import { initWhatsAppRealtime, sendMessage, loadChatHistory, markAsRead } from './realtime_popup.js';
//
//  // When agent logs in:
//  const channel = initWhatsAppRealtime(currentAgent.id);
//
//  // When agent opens a chat:
//  const messages = await loadChatHistory('919876543210');
//  await markAsRead('919876543210');
//
//  // When agent sends a message:
//  await sendMessage('919876543210', 'Hello!', currentAgent.id);
//
//  // When agent logs out:
//  supabase.removeChannel(channel);
