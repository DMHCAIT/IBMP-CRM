-- ═══════════════════════════════════════════════════════════
-- SUPABASE SCHEMA — WhatsApp CRM Integration
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════


-- ── Table: whatsapp_messages ─────────────────────────────
-- Stores every message sent and received
-- Supabase Realtime watches this table for new rows
-- New inbound row = popup notification fires on frontend

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id          TEXT UNIQUE,                    -- Meta's message ID
    from_number         TEXT NOT NULL,                  -- Sender's phone number
    to_number           TEXT,                           -- Receiver's phone number
    contact_name        TEXT DEFAULT '',                -- Lead's WhatsApp display name
    content             TEXT DEFAULT '',                -- Message text
    media_url           TEXT DEFAULT '',                -- Image/doc URL if any
    message_type        TEXT DEFAULT 'text',            -- text / image / document / audio
    direction           TEXT NOT NULL,                  -- 'inbound' or 'outbound'
    status              TEXT DEFAULT 'sent',            -- sent / delivered / read / received / failed
    assigned_agent_id   TEXT,                           -- Which agent handles this lead
    is_read             BOOLEAN DEFAULT FALSE,          -- FALSE = show popup to agent
    timestamp           TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lead conversation lookup
CREATE INDEX IF NOT EXISTS idx_messages_from_number ON whatsapp_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_messages_agent ON whatsapp_messages(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON whatsapp_messages(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON whatsapp_messages(timestamp DESC);


-- ── Table: whatsapp_conversations ───────────────────────
-- One row per lead — tracks last message & unread count
-- Your CRM chat list reads from this table

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number        TEXT UNIQUE NOT NULL,           -- Lead's phone number
    contact_name        TEXT DEFAULT '',
    last_message        TEXT DEFAULT '',                -- Preview in chat list
    last_message_time   TIMESTAMPTZ DEFAULT NOW(),
    unread_count        INTEGER DEFAULT 0,              -- Badge count for agent
    assigned_agent_id   TEXT,
    lead_id             TEXT,                           -- Your CRM lead ID
    window_open         BOOLEAN DEFAULT FALSE,          -- Is 24hr window active?
    window_expires_at   TIMESTAMPTZ,                    -- When 24hr window closes
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_agent ON whatsapp_conversations(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON whatsapp_conversations(updated_at DESC);


-- ── FUNCTION: Auto-update conversation on new message ───
-- Runs automatically every time a new message is inserted

CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO whatsapp_conversations (
        phone_number,
        contact_name,
        last_message,
        last_message_time,
        unread_count,
        assigned_agent_id,
        window_open,
        window_expires_at
    )
    VALUES (
        CASE WHEN NEW.direction = 'inbound' THEN NEW.from_number ELSE NEW.to_number END,
        NEW.contact_name,
        NEW.content,
        NEW.timestamp,
        CASE WHEN NEW.direction = 'inbound' AND NOT NEW.is_read THEN 1 ELSE 0 END,
        NEW.assigned_agent_id,
        CASE WHEN NEW.direction = 'inbound' THEN TRUE ELSE FALSE END,
        CASE WHEN NEW.direction = 'inbound' THEN NOW() + INTERVAL '24 hours' ELSE NULL END
    )
    ON CONFLICT (phone_number) DO UPDATE SET
        last_message        = EXCLUDED.last_message,
        last_message_time   = EXCLUDED.last_message_time,
        assigned_agent_id   = COALESCE(EXCLUDED.assigned_agent_id, whatsapp_conversations.assigned_agent_id),
        window_open         = CASE WHEN NEW.direction = 'inbound' THEN TRUE ELSE whatsapp_conversations.window_open END,
        window_expires_at   = CASE WHEN NEW.direction = 'inbound' THEN NOW() + INTERVAL '24 hours' ELSE whatsapp_conversations.window_expires_at END,
        unread_count        = CASE
                                WHEN NEW.direction = 'inbound' AND NOT NEW.is_read
                                THEN whatsapp_conversations.unread_count + 1
                                ELSE whatsapp_conversations.unread_count
                              END,
        updated_at          = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to messages table
CREATE TRIGGER trigger_update_conversation
AFTER INSERT ON whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();


-- ── ENABLE REALTIME ──────────────────────────────────────
-- This makes Supabase push new messages to frontend instantly
-- Go to Supabase Dashboard → Database → Replication → Enable for these tables

-- Run in Supabase SQL Editor:
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
