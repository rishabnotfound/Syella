import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface Props { visible: boolean; onClose: () => void; }

// "Mod" is a placeholder we swap for the platform key (⌘ on Mac, Ctrl elsewhere).
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

const SECTIONS: { title: string; items: [string, string][] }[] = [
  {
    title: 'General',
    items: [
      ['Mod+K', 'Command palette'],
      ['Mod+N', 'New session'],
      ['Mod+P', 'Quick connect'],
      ['Mod+W', 'Close active tab'],
      // Ctrl+Tab always (Cmd+Tab is the OS app switcher on macOS).
      ['Ctrl+Tab', 'Next tab'],
      ['Ctrl+Shift+Tab', 'Previous tab'],
      ...(isMac
        ? ([
            ['Cmd+Alt+→', 'Next tab (Mac)'],
            ['Cmd+Alt+←', 'Previous tab (Mac)'],
          ] as [string, string][])
        : []),
      ['?', 'Show this help'],
    ],
  },
  {
    title: 'Layout',
    items: [
      ['Mod+B', 'Toggle sidebar'],
      ['Mod+Shift+B', 'Icon-rail sidebar'],
      ['Mod+E', 'Toggle SFTP panel'],
    ],
  },
  {
    title: 'Terminal',
    items: [
      ['Mod+C', 'Copy selection'],
      ['Mod+V', 'Paste'],
      ['Mod+A', 'Select all'],
      ['Mod+=', 'Zoom in'],
      ['Mod+-', 'Zoom out'],
      ['Mod+0', 'Reset zoom'],
    ],
  },
];

const MOD_LABEL = isMac ? '⌘' : 'Ctrl';
const CMD_LABEL = isMac ? '⌘' : 'Cmd';
const SHIFT_LABEL = isMac ? '⇧' : 'Shift';
const ALT_LABEL = isMac ? '⌥' : 'Alt';
const CTRL_LABEL = isMac ? '⌃' : 'Ctrl';
const formatKeys = (raw: string) =>
  raw
    .replace(/Mod/g, MOD_LABEL)
    .replace(/Ctrl/g, CTRL_LABEL)
    .replace(/Cmd/g, CMD_LABEL)
    .replace(/Shift/g, SHIFT_LABEL)
    .replace(/Alt/g, ALT_LABEL)
    .replace(/\+/g, isMac ? '' : '+');

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
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                  Move faster around Syella {isMac ? '· macOS' : ''}
                </div>
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
                          letterSpacing: isMac ? 1 : 0,
                        }}>{formatKeys(keys)}</kbd>
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
