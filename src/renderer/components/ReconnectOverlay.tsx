import React, { useState, useEffect, useRef } from 'react';

interface Props {
  tabId: string;
  sessionName: string;
  onReconnect: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export default function ReconnectOverlay({ tabId, sessionName, onReconnect, onCancel, onClose }: Props) {
  const [seconds, setSeconds] = useState(3);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined as any);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          onReconnect();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleCancel = () => {
    clearInterval(timerRef.current);
    onCancel();
  };

  const handleManual = () => {
    clearInterval(timerRef.current);
    onReconnect();
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 50,
      animation: 'fadeIn 200ms ease-out',
    }}>
      <div style={{
        width: 380, padding: 28, background: '#0a1020',
        border: '1px solid rgba(56,140,255,0.12)', borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'fadeInScale 250ms ease-out',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e8f0', marginBottom: 8 }}>
          Connection Lost
        </div>
        <div style={{ fontSize: 12, color: '#7a8ba8', marginBottom: 20 }}>
          Disconnected from {sessionName}
        </div>
        <div style={{ fontSize: 13, color: '#388CFF', marginBottom: 20 }}>
          Reconnecting in {seconds}s...
        </div>
        <div style={{
          height: 3, background: '#0d1525', borderRadius: 2, overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{
            height: '100%', background: 'linear-gradient(90deg, #388CFF, #2060D0)', borderRadius: 2,
            animation: 'countdownShrink 3s linear forwards',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={handleManual} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: 'linear-gradient(135deg, #388CFF, #2060D0)', color: '#fff', transition: 'all 200ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(56,140,255,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
            Reconnect Now
          </button>
          <button onClick={handleCancel} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(56,140,255,0.1)',
            color: '#7a8ba8', transition: 'all 200ms',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e4e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#7a8ba8'; }}>
            Cancel
          </button>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
            color: '#ef4444', transition: 'all 200ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}>
            Close Tab
          </button>
        </div>
      </div>
    </div>
  );
}
