import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { SyeTab } from '../../types';

interface Props {
  tabs: SyeTab[]; activeTabId: string | null;
  onSelect: (id: string) => void; onClose: (id: string) => void; onNew: () => void;
}

function StatusDot({ status }: { status: SyeTab['status'] }) {
  if (status === 'connecting') {
    return <Loader2 size={11} className="spin" color="var(--warning)" />;
  }
  if (status === 'connected') {
    return (
      <span style={{ position: 'relative', width: 8, height: 8 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--success)',
        }} />
        <span style={{
          position: 'absolute', inset: -3, borderRadius: '50%',
          background: 'rgba(52,211,153,0.25)', animation: 'softPulse 2.4s ease-in-out infinite',
        }} />
      </span>
    );
  }
  if (status === 'error') return <AlertCircle size={11} color="var(--danger)" />;
  return <WifiOff size={11} color="var(--text-faint)" />;
}

export default function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }: Props) {
  return (
    <div
      className="glass"
      style={{
        height: 40, display: 'flex', alignItems: 'stretch',
        borderBottom: '1px solid var(--border-subtle)',
        overflow: 'hidden', flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(15,21,36,0.6), rgba(10,15,26,0.45))',
      }}>
      <AnimatePresence initial={false}>
        {tabs.map(tab => {
          const active = tab.id === activeTabId;
          return (
            <motion.div key={tab.id}
              layout
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '0 16px', fontSize: 12,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer',
                borderRight: '1px solid var(--border-subtle)',
                background: active ? 'rgba(90,162,255,0.06)' : 'transparent',
                position: 'relative', maxWidth: 220, minWidth: 130,
                overflow: 'hidden',
              }}
              onClick={() => onSelect(tab.id)}
              whileHover={!active ? { backgroundColor: 'rgba(140,170,230,0.04)' } : {}}>
              <StatusDot status={tab.status} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: active ? 500 : 400 }}>
                {tab.title}
              </span>
              <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                onClick={e => { e.stopPropagation(); onClose(tab.id); }}
                style={{
                  width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 5, color: 'var(--text-muted)', flexShrink: 0,
                  transition: 'background 120ms, color 120ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.14)'; e.currentTarget.style.color = 'var(--danger)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={11} strokeWidth={2.4} />
              </motion.button>
              {active && (
                <motion.div layoutId="tabbar-active-underline"
                  transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                    background: 'var(--accent-gradient)',
                    boxShadow: '0 0 12px rgba(90,162,255,0.35)',
                  }} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
        onClick={onNew}
        style={{
          width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', transition: 'background 150ms, color 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-light)'; e.currentTarget.style.background = 'rgba(90,162,255,0.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
        <Plus size={14} />
      </motion.button>
    </div>
  );
}
