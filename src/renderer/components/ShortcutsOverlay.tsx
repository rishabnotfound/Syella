import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface Props { visible: boolean; onClose: () => void; }

const SECTIONS: { title: string; items: [string, string][] }[] = [
  {
    title: 'General',
    items: [
      ['Ctrl+K', 'Command palette'],
      ['Ctrl+T', 'New session'],
      ['Ctrl+W', 'Close active tab'],
      ['Ctrl+Tab', 'Next tab'],
      ['Ctrl+Shift+Tab', 'Previous tab'],
      ['?', 'Show this help'],
    ],
  },
  {
    title: 'Layout',
    items: [
      ['Ctrl+B', 'Toggle sidebar'],
      ['Ctrl+Shift+B', 'Icon-rail sidebar'],
      ['Ctrl+E', 'Toggle SFTP panel'],
    ],
  },
  {
    title: 'Terminal',
    items: [
      ['Ctrl+=', 'Zoom in'],
      ['Ctrl+-', 'Zoom out'],
      ['Ctrl+0', 'Reset zoom'],
    ],
  },
];

export default function ShortcutsOverlay({ visible, onClose }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(2, 5, 12, 0.55)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            onClick={e => e.stopPropagation()}
            className="glass-strong"
            style={{
              width: 620, maxWidth: '92vw', borderRadius: 18, padding: 22,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-gradient-soft)', border: '1px solid var(--border-medium)',
              }}>
                <Keyboard size={16} color="var(--accent-light)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Keyboard shortcuts</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>Move faster around Syella</div>
              </div>
              <button onClick={onClose} style={{
                width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', background: 'transparent',
                transition: 'background 150ms, color 150ms',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {SECTIONS.map(section => (
                <div key={section.title}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)',
                    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8,
                  }}>{section.title}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {section.items.map(([keys, label]) => (
                      <div key={keys} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px', borderRadius: 8,
                        background: 'rgba(140,170,230,0.03)',
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                        <kbd style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10.5,
                          padding: '2px 7px', borderRadius: 5,
                          background: 'rgba(140,170,230,0.08)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}>{keys}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
