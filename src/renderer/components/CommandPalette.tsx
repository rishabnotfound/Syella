import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, Settings as SettingsIcon, Download, Server, CornerDownLeft, Search,
} from 'lucide-react';
import { SyeSession } from '../../types';

interface PaletteCommand { id: string; label: string; category: string; action: () => void; }

interface Props {
  visible: boolean; onClose: () => void; sessions: SyeSession[];
  onConnect: (session: SyeSession) => void; onNewSession: () => void;
  onNewTab: () => void; onSettings: () => void;
  onBackupExport: () => void; onBackupImport: () => void;
}

const CATEGORY_META: Record<string, { color: string; Icon: React.ComponentType<any> }> = {
  Session: { color: '#5aa2ff', Icon: Plus },
  Tab:     { color: '#5aa2ff', Icon: Plus },
  App:     { color: '#a78bfa', Icon: SettingsIcon },
  Backup:  { color: '#34d399', Icon: Download },
  Connect: { color: '#34d399', Icon: Server },
};

export default function CommandPalette({ visible, onClose, sessions, onConnect, onNewSession, onNewTab, onSettings, onBackupExport, onBackupImport }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<PaletteCommand[]>(() => {
    const cmds: PaletteCommand[] = [
      { id: 'new-session', label: 'New Session', category: 'Session', action: onNewSession },
      { id: 'new-tab', label: 'New Tab', category: 'Tab', action: onNewTab },
      { id: 'settings', label: 'Settings', category: 'App', action: onSettings },
      { id: 'backup-export', label: 'Export Backup', category: 'Backup', action: onBackupExport },
      { id: 'backup-import', label: 'Import Backup', category: 'Backup', action: onBackupImport },
    ];
    for (const sess of sessions) {
      cmds.push({ id: `connect-${sess.id}`, label: `Connect: ${sess.name}`, category: 'Connect', action: () => onConnect(sess) });
    }
    return cmds;
  }, [sessions, onConnect, onNewSession, onNewTab, onSettings, onBackupExport, onBackupImport]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (visible) { setQuery(''); setActiveIndex(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [visible]);

  useEffect(() => { setActiveIndex(0); }, [filtered]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[activeIndex]) { filtered[activeIndex].action(); onClose(); }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(2, 5, 12, 0.55)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 110, zIndex: 200,
          }}>
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="glass-strong"
            style={{
              width: 560, maxWidth: '92vw', borderRadius: 16, overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()} onKeyDown={handleKey}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
            }}>
              <Search size={15} color="var(--text-muted)" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Type a command or search sessions..."
                style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', background: 'transparent' }} />
              <kbd style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 4,
                background: 'rgba(140,170,230,0.08)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)',
              }}>ESC</kbd>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', padding: 6 }}>
              {filtered.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No results
                </div>
              )}
              {filtered.map((cmd, i) => {
                const meta = CATEGORY_META[cmd.category] || CATEGORY_META.App;
                const Icon = meta.Icon;
                const active = i === activeIndex;
                return (
                  <div key={cmd.id} onClick={() => { cmd.action(); onClose(); }}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer', fontSize: 13, borderRadius: 8, position: 'relative',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}>
                    {active && (
                      <motion.div layoutId="palette-active"
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                        style={{
                          position: 'absolute', inset: 0, borderRadius: 8,
                          background: 'var(--bg-hover)',
                          border: '1px solid var(--border-subtle)',
                        }} />
                    )}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${meta.color}18`,
                      }}>
                        <Icon size={13} color={meta.color} />
                      </div>
                      <span style={{ flex: 1 }}>{cmd.label}</span>
                      <span style={{
                        fontSize: 10, color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 5,
                        background: 'rgba(140,170,230,0.06)',
                      }}>{cmd.category}</span>
                      {active && <CornerDownLeft size={12} color="var(--text-muted)" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
