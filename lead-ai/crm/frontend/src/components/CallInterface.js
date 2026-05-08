import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Space, Tag, Typography, Spin, message as antMessage, Divider } from 'antd';
import {
  PhoneOutlined,
  AudioOutlined,
  CloseOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/api';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

const { Text, Title } = Typography;

const CallInterface = ({ visible, onClose, lead }) => {
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, connected, ended
  const [callDuration, setCallDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const timerRef = useRef(null);
  const queryClient = useQueryClient();

  // Initiate call mutation — uses centralized api (handles auth + 401 redirect)
  const initiateCallMutation = useMutation({
    mutationFn: async () => {
      const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
      const res = await api.post('/api/communications/call/initiate', {
        lead_id: lead.lead_id,
        to_number: lead.phone,
        counselor: user.full_name || user.email,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCallStatus('calling');
      setIsRecording(true);
      antMessage.success('Call initiated successfully!');
      
      // Simulate call connection after 3 seconds
      setTimeout(() => {
        setCallStatus('connected');
        startTimer();
      }, 3000);
    },
    onError: (error) => {
      antMessage.error(`Failed to initiate call: ${error.message}`);
      setCallStatus('idle');
    }
  });

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleEndCall = () => {
    stopTimer();
    setCallStatus('ended');
    
    // Simulate recording URL
    setTimeout(() => {
      setRecordingUrl('https://example.com/recordings/sample.mp3');
    }, 1000);
  };

  const handleStartCall = () => {
    if (!lead.phone) {
      antMessage.error('No phone number available for this lead');
      return;
    }
    
    initiateCallMutation.mutate();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  const renderCallContent = () => {
    switch (callStatus) {
      case 'idle':
        return (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}
            >
              <PhoneOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </div>
            
            <Title level={4}>{lead?.full_name}</Title>
            <Text type="secondary">{lead?.phone}</Text>
            
            <div style={{ marginTop: 32 }}>
              <Button
                type="primary"
                size="large"
                icon={<PhoneOutlined />}
                onClick={handleStartCall}
                loading={initiateCallMutation.isPending}
                style={{
                  width: 200,
                  height: 50,
                  borderRadius: 25,
                  fontSize: 16
                }}
              >
                Call Now
              </Button>
            </div>
            
            <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f6ffed', borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                🎙️ This call will be automatically recorded for quality and training purposes
              </Text>
            </div>
          </div>
        );

      case 'calling':
        return (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            
            <div style={{ marginTop: 24 }}>
              <Title level={4}>Calling {lead?.full_name}...</Title>
              <Text type="secondary">{lead?.phone}</Text>
            </div>
            
            <div style={{ marginTop: 24 }}>
              <Tag color="processing" icon={<AudioOutlined />}>
                Connecting...
              </Tag>
            </div>
            
            <div style={{ marginTop: 32 }}>
              <Button
                danger
                size="large"
                icon={<CloseOutlined />}
                onClick={handleEndCall}
                style={{
                  width: 120,
                  height: 50,
                  borderRadius: 25
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      case 'connected':
        return (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                backgroundColor: '#52c41a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                animation: 'pulse 2s infinite'
              }}
            >
              <PhoneOutlined style={{ fontSize: 48, color: 'white' }} />
            </div>
            
            <Title level={4}>{lead?.full_name}</Title>
            <Text type="secondary">{lead?.phone}</Text>
            
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 48, fontWeight: 'bold', color: '#52c41a' }}>
                {formatDuration(callDuration)}
              </div>
            </div>
            
            <div style={{ marginTop: 16 }}>
              {isRecording && (
                <Tag color="red" icon={<AudioOutlined />}>
                  Recording in progress
                </Tag>
              )}
            </div>
            
            <div style={{ marginTop: 32 }}>
              <Button
                danger
                size="large"
                icon={<CloseOutlined />}
                onClick={handleEndCall}
                style={{
                  width: 160,
                  height: 50,
                  borderRadius: 25,
                  fontSize: 16
                }}
              >
                End Call
              </Button>
            </div>
          </div>
        );

      case 'ended':
        return (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}
            >
              <PhoneOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />
            </div>
            
            <Title level={4}>Call Ended</Title>
            <Text type="secondary">{lead?.full_name}</Text>
            
            <Divider />
            
            <div style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">Duration:</Text>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>
                    {formatDuration(callDuration)}
                  </div>
                </div>
                
                <div>
                  <Text type="secondary">Recording Status:</Text>
                  <div style={{ marginTop: 8 }}>
                    {recordingUrl ? (
                      <Tag color="success" icon={<AudioOutlined />}>
                        Recording saved successfully
                      </Tag>
                    ) : (
                      <Spin size="small" /> 
                    )}
                  </div>
                </div>
                
                {recordingUrl && (
                  <div>
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={() => window.open(recordingUrl, '_blank')}
                      block
                    >
                      Download Recording
                    </Button>
                  </div>
                )}
                
                <div
                  style={{
                    padding: 12,
                    backgroundColor: '#e6f7ff',
                    borderRadius: 8,
                    marginTop: 16
                  }}
                >
                  <Text style={{ fontSize: 12 }}>
                    📊 This recording will be used for:
                    <ul style={{ marginTop: 8, marginBottom: 0 }}>
                      <li>Quality assurance</li>
                      <li>AI model training</li>
                      <li>Performance analysis</li>
                      <li>Compliance monitoring</li>
                    </ul>
                  </Text>
                </div>
              </Space>
            </div>
            
            <div style={{ marginTop: 32 }}>
              <Space>
                <Button onClick={onClose}>
                  Close
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    setCallStatus('idle');
                    setCallDuration(0);
                    setRecordingUrl(null);
                  }}
                >
                  Make Another Call
                </Button>
              </Space>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={
        <span>
          <PhoneOutlined style={{ marginRight: 8 }} />
          Voice Call
        </span>
      }
      open={visible}
      onCancel={callStatus === 'connected' ? handleEndCall : onClose}
      width={500}
      footer={null}
      closable={callStatus !== 'calling' && callStatus !== 'connected'}
    >
      {renderCallContent()}
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }
      `}</style>
    </Modal>
  );
};

export default CallInterface;
