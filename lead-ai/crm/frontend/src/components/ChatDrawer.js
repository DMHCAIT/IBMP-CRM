import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Drawer, Input, Button, Upload, Spin, Typography, Avatar,
  Tooltip, message as antdMessage, Space, Badge,
} from 'antd';
import {
  SendOutlined, PaperClipOutlined, FileOutlined,
  PhoneOutlined, LoadingOutlined, CheckOutlined,
  CloseOutlined, FilePdfOutlined, FileImageOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { leadsAPI, uploadAPI } from '../api/api';

const { Text } = Typography;

// ── helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(msgs) {
  const groups = {};
  msgs.forEach(m => {
    const key = new Date(m.timestamp).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return groups;
}

function getFileIcon(type, filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  if (type === 'image' || ['jpg','jpeg','png','gif','webp'].includes(ext))
    return <FileImageOutlined style={{ fontSize: 20, color: '#1890ff' }} />;
  if (type === 'video' || ['mp4','mov','avi'].includes(ext))
    return <PlayCircleOutlined style={{ fontSize: 20, color: '#722ed1' }} />;
  if (ext === 'pdf')
    return <FilePdfOutlined style={{ fontSize: 20, color: '#f5222d' }} />;
  return <FileOutlined style={{ fontSize: 20, color: '#52c41a' }} />;
}

function isImageType(type, url = '', filename = '') {
  if (type === 'image') return true;
  const ext = (url || filename).split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);
}

// ── bubble ───────────────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const out = msg.direction === 'outbound';
  const bubbleStyle = {
    maxWidth: '72%',
    padding: '8px 12px',
    borderRadius: out ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
    background: out ? '#25d366' : '#fff',
    color: out ? '#fff' : '#111',
    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
    fontSize: 14,
    wordBreak: 'break-word',
    position: 'relative',
  };

  const isImg = isImageType(msg.msg_type, msg.media_url || '', msg.filename || '');

  return (
    <div style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
      {!out && (
        <Avatar size={28} style={{ background: '#1890ff', marginRight: 6, flexShrink: 0, fontSize: 12, alignSelf: 'flex-end' }}>
          {(msg.sender_name || 'L').charAt(0).toUpperCase()}
        </Avatar>
      )}
      <div style={bubbleStyle}>
        {/* Sender name (inbound only) */}
        {!out && msg.sender_name && (
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1890ff', marginBottom: 2 }}>
            {msg.sender_name}
          </div>
        )}

        {/* Image */}
        {msg.media_url && isImg && (
          <a href={msg.media_url} target="_blank" rel="noreferrer">
            <img
              src={msg.media_url}
              alt={msg.filename || 'image'}
              style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block', marginBottom: msg.content ? 6 : 0 }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          </a>
        )}

        {/* Non-image media (document/video/audio) */}
        {msg.media_url && !isImg && (
          <a href={msg.media_url} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
              background: out ? 'rgba(255,255,255,0.2)' : '#f0f2f5',
              padding: '6px 10px', borderRadius: 8, marginBottom: msg.content ? 6 : 0 }}>
            {getFileIcon(msg.msg_type, msg.filename || '')}
            <span style={{ fontSize: 13, color: out ? '#fff' : '#333', flex: 1, wordBreak: 'break-all' }}>
              {msg.filename || 'Open file'}
            </span>
          </a>
        )}

        {/* Text content */}
        {msg.content && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>}

        {/* Timestamp + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 3, marginTop: 3, opacity: 0.75, fontSize: 10 }}>
          <span>{formatTime(msg.timestamp)}</span>
          {out && (
            msg.status === 'failed'
              ? <CloseOutlined style={{ color: '#ff4d4f', fontSize: 10 }} />
              : <CheckOutlined style={{ fontSize: 10 }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function ChatDrawer({ lead, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  const phone = lead?.whatsapp || lead?.phone || '';

  // fetch messages
  const fetchMessages = useCallback(async () => {
    if (!lead?.id) return;
    try {
      const res = await leadsAPI.getChatMessages(lead.id);
      setMessages(res.data || []);
    } catch {
      // silently fail on poll
    } finally {
      setLoading(false);
    }
  }, [lead?.id]);

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    fetchMessages();
    // poll every 5 seconds
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  // auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // send text
  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await leadsAPI.sendChatMessage(lead.id, {
        message: body,
        msg_type: 'text',
        sender_name: user.full_name || 'CRM',
        country_code: '+91',
      });
      setMessages(prev => [...prev, res.data]);
    } catch (e) {
      antdMessage.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // file upload → send
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const MAX = 16 * 1024 * 1024; // 16 MB
    if (file.size > MAX) {
      antdMessage.error('File too large (max 16 MB)');
      return;
    }

    setUploading(true);
    try {
      // upload to Supabase Storage
      const upRes = await uploadAPI.uploadFile(file);
      const { url, filename, content_type } = upRes.data;

      // determine type
      let msg_type = 'document';
      if (content_type?.startsWith('image/')) msg_type = 'image';
      else if (content_type?.startsWith('video/')) msg_type = 'video';
      else if (content_type?.startsWith('audio/')) msg_type = 'audio';

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await leadsAPI.sendChatMessage(lead.id, {
        msg_type,
        media_url: url,
        filename: filename,
        message: '',
        sender_name: user.full_name || 'CRM',
        country_code: '+91',
      });
      setMessages(prev => [...prev, res.data]);
      antdMessage.success('File sent!');
    } catch (err) {
      antdMessage.error('Failed to send file: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  const dateGroups = groupByDate(messages);

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={38} style={{ background: '#25d366', fontSize: 16, flexShrink: 0 }}>
            {(lead?.full_name || 'L').charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{lead?.full_name || 'Lead'}</div>
            <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
              <PhoneOutlined />
              {phone || 'No number'}
              {lead?.course_interested && (
                <span style={{ color: '#1890ff', marginLeft: 6 }}>• {lead.course_interested}</span>
              )}
            </div>
          </div>
          <Badge
            dot
            color="#25d366"
            style={{ marginLeft: 'auto' }}
            title="WhatsApp"
          />
        </div>
      }
      placement="right"
      width={420}
      onClose={onClose}
      open={!!lead}
      styles={{
        header: { background: '#075e54', color: '#fff', borderBottom: '1px solid #054d44' },
        body: { padding: 0, display: 'flex', flexDirection: 'column', background: '#ece5dd' },
      }}
      closable
      closeIcon={<CloseOutlined style={{ color: '#fff' }} />}
    >
      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 28 }} spin />} />
            <div style={{ marginTop: 8, color: '#666' }}>Loading messages…</div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: '#888' }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ marginTop: 8 }}>No messages yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Send a message to start the conversation</div>
          </div>
        ) : (
          Object.entries(dateGroups).map(([dateStr, msgs]) => (
            <div key={dateStr}>
              {/* Date separator */}
              <div style={{ textAlign: 'center', margin: '12px 0' }}>
                <span style={{ background: '#d1f4cc', padding: '3px 10px', borderRadius: 8, fontSize: 11, color: '#555' }}>
                  {formatDate(msgs[0].timestamp)}
                </span>
              </div>
              {msgs.map(m => <MessageBubble key={m.id} msg={m} />)}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '10px 12px',
        background: '#f0f2f5',
        borderTop: '1px solid #ddd',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
      }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Attach button */}
        <Tooltip title="Attach file (image, PDF, doc, video)">
          <Button
            shape="circle"
            icon={uploading ? <LoadingOutlined /> : <PaperClipOutlined />}
            disabled={uploading || sending}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: 'none', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
          />
        </Tooltip>

        {/* Text input */}
        <Input.TextArea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message…"
          autoSize={{ minRows: 1, maxRows: 5 }}
          style={{ flex: 1, borderRadius: 20, padding: '8px 14px', resize: 'none', fontSize: 14 }}
          disabled={sending || uploading}
        />

        {/* Send button */}
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={sending ? <LoadingOutlined /> : <SendOutlined />}
          disabled={(!text.trim() && !uploading) || sending}
          onClick={handleSend}
          style={{ background: '#25d366', borderColor: '#25d366', flexShrink: 0 }}
        />
      </div>
    </Drawer>
  );
}
