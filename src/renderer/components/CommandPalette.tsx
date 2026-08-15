import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SyeSession } from '../../types';

interface Command { id: string; label: string; category: string; action: () => void; }

interface Props {
  visible: boolean; onClose: () => void; sessions: SyeSession[];
  onConnect: (session: SyeSession) => void; onNewSession: () => void;
  onNewTab: () => void; onSettings: () => void;
  onBackupExport: () => void; onBackupImport: () => void;
}

export default function CommandPalette({ visible, onClose, sessions, onConnect, onNewSession, onNewTab, onSettings, onBackupExport, onBackupImport }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [
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

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100, zIndex: 200,
      animation: 'fadeIn 120ms ease-out',
    }} onClick={onClose}>
      <div style={{
        width: 520, background: '#0a1020', border: '1px solid rgba(56,140,255,0.12)',
        borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        animation: 'fadeInScale 180ms ease-out',
      }} onClick={e => e.stopPropagation()} onKeyDown={handleKey}>
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Type a command..." style={{
            width: '100%', padding: '16px 20px', fontSize: 14, color: '#e4e8f0',
            background: 'transparent', borderBottom: '1px solid rgba(56,140,255,0.08)',
          }} />
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#3d5070', fontSize: 13 }}>No results</div>
          )}
          {filtered.map((cmd, i) => (
            <div key={cmd.id} onClick={() => { cmd.action(); onClose(); }}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', fontSize: 13, transition: 'all 100ms',
                color: i === activeIndex ? '#e4e8f0' : '#7a8ba8',
                background: i === activeIndex ? 'rgba(56,140,255,0.1)' : 'transparent',
              }}>
              <span style={{ flex: 1 }}>{cmd.label}</span>
              <span style={{
                fontSize: 10, color: '#3d5070', padding: '2px 8px', borderRadius: 5,
                background: 'rgba(56,140,255,0.06)',
              }}>{cmd.category}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
