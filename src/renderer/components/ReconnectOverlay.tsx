import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RotateCw, X, Ban } from 'lucide-react';

interface Props {
  tabId: string;
  sessionName: string;
  onReconnect: () => void;
  onCancel: () => void;
  onClose: () => void;
}

const COUNTDOWN = 5;

export default function ReconnectOverlay({ sessionName, onReconnect, onCancel, onClose }: Props) {
  const [seconds, setSeconds] = useState(COUNTDOWN);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    clearInterval(timerRef.current);
    onCancel();
  };

  const handleManual = () => {
    clearInterval(timerRef.current);
    onReconnect();
  };

  const progress = ((COUNTDOWN - seconds + 1) / COUNTDOWN) * 100;

  return (
    <AnimatePresence>
      <motion.div
        key="reconnect-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(2,5,12,0.55)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        }}>
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="glass-strong"
          style={{
            width: 420, maxWidth: '92%', borderRadius: 16, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(180deg, rgba(248,113,113,0.06), rgba(10,15,26,0.15))',
          }}>
            <motion.div
              initial={{ rotate: -12, scale: 0.85, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              style={{
                width: 38, height: 38, borderRadius: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.28)',
              }}>
              <WifiOff size={16} color="var(--danger)" />
            </motion.div>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 0.2 }}>
                Connection lost
              </div>
              <div style={{
                fontSize: 11.5, color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {sessionName}
              </div>
            </div>
            <motion.button
 whileTap={{ scale: 0.9 }}
              onClick={handleCancel}
              title="Dismiss"
              style={{
                width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', background: 'transparent',
                border: '1px solid var(--border-subtle)',
              }}>
              <X size={13} />
            </motion.button>
          </div>

          <div style={{ padding: '18px 20px 14px' }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Auto-reconnect in
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600,
                color: 'var(--accent-light)', letterSpacing: 1,
              }}>
                {seconds}s
              </span>
            </div>

            <div style={{
              height: 4, background: 'rgba(140,170,230,0.08)',
              borderRadius: 2, overflow: 'hidden',
            }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.9, ease: 'linear' }}
                style={{
                  height: '100%',
                  background: 'var(--accent-gradient)',
                  borderRadius: 2,
                  boxShadow: '0 0 10px rgba(90,162,255,0.4)',
                }}
              />
            </div>
          </div>

          <div style={{
            display: 'flex', gap: 8, padding: '4px 16px 16px',
          }}>
            <motion.button
 whileTap={{ scale: 0.97 }}
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.2)',
                color: 'var(--danger)',
              }}>
              <Ban size={12} />
              Close tab
            </motion.button>
            <div style={{ flex: 1 }} />
            <motion.button
 whileTap={{ scale: 0.97 }}
              onClick={handleCancel}
              style={{
                padding: '9px 14px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}>
              Cancel
            </motion.button>
            <motion.button
 whileTap={{ scale: 0.97 }}
              onClick={handleManual}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                background: 'var(--accent-gradient)',
                border: '1px solid rgba(90,162,255,0.4)',
                color: '#fff',
                boxShadow: '0 6px 22px rgba(90,162,255,0.28)',
              }}>
              <RotateCw size={12} />
              Reconnect now
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
