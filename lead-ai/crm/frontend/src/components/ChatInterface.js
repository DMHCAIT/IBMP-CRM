import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, Avatar, Tag, Spin, message as antMessage } from 'antd';
import {
  SendOutlined,
  WhatsAppOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { TextArea } = Input;

const ChatInterface = ({ visible, onClose, lead, type = 'whatsapp' }) => {
  // Renamed from `message` to `inputText` to avoid shadowing antd `message` import
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Fetch chat history via centralized axios instance (handles 401 redirect automatically)
  const { data: chatHistory, isLoading } = useQuery({
    queryKey: ['chat-history', lead?.lead_id, type],
    queryFn: async () => {
      const res = await api.get(`/api/communications/${lead.lead_id}/history?type=${type}`);
      return res.data;
    },
    enabled: !!lead && visible,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Send message mutation — uses isPending (TanStack Query v5)
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      const res = await api.post(`/api/communications/${type}/send`, messageData);
      return res.data;
    },
    onSuccess: () => {
      setInputText('');
      queryClient.invalidateQueries({ queryKey: ['chat-history', lead?.lead_id, type] });
      antMessage.success('Message sent successfully!');
    },
    onError: (error) => {
      antMessage.error(`Failed to send message: ${error.response?.data?.detail || error.message}`);
    },
  });

  const handleSendMessage = () => {
    if (!inputText.trim()) {
      antMessage.warning('Please enter a message');
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    sendMessageMutation.mutate({
      lead_id: lead.lead_id,
      to: type === 'whatsapp' ? lead.whatsapp : lead.email,
      message: inputText.trim(),
      sender: user.full_name || user.email,
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const renderMessage = (msg) => {
    const isOutbound = msg.direction === 'outbound';

    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          justifyContent: isOutbound ? 'flex-end' : 'flex-start',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            maxWidth: '70%',
            display: 'flex',
            flexDirection: isOutbound ? 'row-reverse' : 'row',
            gap: 8,
          }}
        >
          <Avatar
            size={32}
            style={{
              backgroundColor: isOutbound ? '#1890ff' : '#52c41a',
              flexShrink: 0,
            }}
            icon={<UserOutlined />}
          >
            {isOutbound ? 'You' : lead?.full_name?.[0] || 'L'}
          </Avatar>

          <div>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                backgroundColor: isOutbound ? '#1890ff' : '#f0f0f0',
                color: isOutbound ? 'white' : 'black',
                wordWrap: 'break-word',
              }}
            >
              {msg.content}
            </div>

            <div
              style={{
                fontSize: 11,
                color: '#999',
                marginTop: 4,
                textAlign: isOutbound ? 'right' : 'left',
                display: 'flex',
                gap: 8,
                justifyContent: isOutbound ? 'flex-end' : 'flex-start',
                alignItems: 'center',
              }}
            >
              <span>{dayjs(msg.timestamp).fromNow()}</span>
              {msg.status && (
                <Tag
                  color={
                    msg.status === 'delivered' || msg.status === 'sent'
                      ? 'green'
                      : msg.status === 'read'
                      ? 'blue'
                      : 'default'
                  }
                  style={{ fontSize: 10, padding: '0 4px' }}
                >
                  {msg.status}
                </Tag>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getTitle = () => {
    if (type === 'whatsapp') {
      return (
        <span>
          <WhatsAppOutlined style={{ color: '#25D366', marginRight: 8 }} />
          WhatsApp Chat - {lead?.full_name}
        </span>
      );
    }
    return `${type.charAt(0).toUpperCase() + type.slice(1)} - ${lead?.full_name}`;
  };

  return (
    <Modal
      title={getTitle()}
      open={visible}
      onCancel={onClose}
      width={600}
      footer={null}
      style={{ top: 20 }}
      styles={{ body: { padding: 0, height: '70vh', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Lead Info Header */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{lead?.full_name}</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {type === 'whatsapp' ? lead?.whatsapp : lead?.email}
            </div>
          </div>
          <Tag color={lead?.status === 'Enrolled' ? 'green' : 'blue'}>{lead?.status}</Tag>
        </div>
      </div>

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px',
          backgroundColor: type === 'whatsapp' ? '#e5ddd5' : 'white',
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : chatHistory && chatHistory.length > 0 ? (
          <>
            {chatHistory.map(renderMessage)}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            No messages yet. Start the conversation!
          </div>
        )}
      </div>

      {/* Message Input */}
      <div
        style={{
          padding: '12px 24px',
          borderTop: '1px solid #f0f0f0',
          backgroundColor: 'white',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Type a message to ${lead?.full_name}...`}
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={sendMessageMutation.isPending}
            disabled={!inputText.trim()}
          >
            Send
          </Button>
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
          💡 All conversations are stored for AI training and quality improvement
        </div>
      </div>
    </Modal>
  );
};

export default ChatInterface;
