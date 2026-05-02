import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Clock, MessageSquare, TrendingUp, X, Sparkles } from 'lucide-react';

const AIInsightCard = ({ lead }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate AI insights based on lead data
  const generateInsights = () => {
    const insights = {
      intent: detectIntent(lead),
      bestContactTime: getBestContactTime(lead),
      followUpSuggestion: getFollowUpSuggestion(lead),
      conversionProbability: getConversionProbability(lead),
    };
    return insights;
  };

  const detectIntent = (lead) => {
    if (lead.score > 80) return 'High purchase intent - Multiple page views on pricing';
    if (lead.score > 60) return 'Moderate interest - Engaged with course content';
    if (lead.score > 40) return 'Early exploration - Browsing programs';
    return 'Low engagement - Needs nurturing';
  };

  const getBestContactTime = (lead) => {
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 11) return '10:00 AM - 11:30 AM (Highest response rate)';
    if (hour >= 14 && hour <= 16) return '2:00 PM - 4:00 PM (Good availability)';
    return '9:00 AM - 11:00 AM (Recommended)';
  };

  const getFollowUpSuggestion = (lead) => {
    if (lead.segment === 'hot') return 'Send personalized course brochure + scholarship info';
    if (lead.segment === 'warm') return 'Schedule consultation call within 24 hours';
    if (lead.segment === 'cold') return 'Send educational content to build trust';
    return 'Add to nurture campaign';
  };

  const getConversionProbability = (lead) => {
    if (lead.score > 80) return { value: 85, color: '#10b981', label: 'Very High' };
    if (lead.score > 60) return { value: 65, color: '#f59e0b', label: 'High' };
    if (lead.score > 40) return { value: 40, color: '#3b82f6', label: 'Moderate' };
    return { value: 15, color: '#6b7280', label: 'Low' };
  };

  const insights = generateInsights();

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: 12,
      padding: 16,
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* AI Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '4px 12px',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
        }}>
          <Sparkles size={14} />
          AI INSIGHTS
        </div>
        <div style={{
          marginLeft: 'auto',
          fontSize: 12,
          fontWeight: 600,
          opacity: 0.9,
        }}>
          Score: {lead.score || 0}
        </div>
      </div>

      {/* Quick Insights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <InsightRow icon={Brain} label="Intent Detected" value={insights.intent} />
        <InsightRow icon={Clock} label="Best Contact Time" value={insights.bestContactTime} />
        <InsightRow icon={MessageSquare} label="Recommended Action" value={insights.followUpSuggestion} />
        
        {/* Conversion Probability */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
            <span style={{ opacity: 0.9 }}>Conversion Probability</span>
            <span style={{ fontWeight: 600 }}>{insights.conversionProbability.value}%</span>
          </div>
          <div style={{
            height: 8,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${insights.conversionProbability.value}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: insights.conversionProbability.color,
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      </div>

      {/* Decorative elements */}
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 100,
        height: 100,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
    </div>
  );
};

const InsightRow = ({ icon: Icon, label, value }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    <div style={{
      width: 32,
      height: 32,
      flexShrink: 0,
      background: 'rgba(255,255,255,0.2)',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Icon size={16} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{value}</div>
    </div>
  </div>
);

// Tooltip component for "Why this lead is hot"
export const AIScoreTooltip = ({ score, reasons }) => {
  const [isVisible, setIsVisible] = useState(false);

  const defaultReasons = [
    { factor: 'Engagement Score', impact: '+25', description: 'Visited 5+ pages in last session' },
    { factor: 'Profile Completeness', impact: '+15', description: 'Provided detailed information' },
    { factor: 'Response Time', impact: '+20', description: 'Quick to respond to emails' },
    { factor: 'Budget Signals', impact: '+18', description: 'Inquired about premium courses' },
  ];

  const scoreReasons = reasons || defaultReasons;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <div style={{
          fontSize: 'var(--text-base)',
          fontWeight: 700,
          color: score > 70 ? 'var(--error)' : score > 50 ? 'var(--warning)' : 'var(--success)',
        }}>
          {score}
        </div>
        <Brain size={14} style={{ color: '#8b5cf6', opacity: 0.6 }} />
      </button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 8,
              width: 320,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 8px 24px var(--shadow)',
              zIndex: 1000,
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: '1px solid var(--border)',
            }}>
              <Brain size={16} style={{ color: '#8b5cf6' }} />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                AI Score Breakdown
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {scoreReasons.map((reason, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {reason.factor}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      {reason.description}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--success)',
                    whiteSpace: 'nowrap',
                  }}>
                    {reason.impact}
                  </div>
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div style={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 12,
              height: 12,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderLeft: 'none',
              transform: 'translateX(-50%) rotate(45deg)',
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIInsightCard;
