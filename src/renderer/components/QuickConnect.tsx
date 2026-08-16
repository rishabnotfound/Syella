import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Server, Plus, Star, CornerDownLeft, Cable } from 'lucide-react';
import { SyeSession } from '../../types';

interface Props {
  visible: boolean;
  sessions: SyeSession[];
  connectedSessionIds: Set<string>;
  onClose: () => void;
  onConnect: (session: SyeSession) => void;
  onNewSession: () => void;
}

export default function QuickConnect({ visible, sessions, connectedSessionIds, onClose, onConnect, onNewSession }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(() => {
    const favs = sessions.filter(s => s.favorite);
    const rest = sessions.filter(s => !s.favorite).sort((a, b) => b.updatedAt - a.updatedAt);
    return [...favs, ...rest];
  }, [sessions]);

  const filtered = useMemo(() => {
    if (!query) return ordered;
    const q = query.toLowerCase();
    return ordered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.host.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q) ||
      (s.group || '').toLowerCase().includes(q)
    );
  }, [ordered, query]);

  useEffect(() => {
    if (visible) { setQuery(''); setActiveIndex(0); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [visible]);

  useEffect(() => { setActiveIndex(0); }, [filtered]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIndex]) { onConnect(filtered[activeIndex]); onClose(); }
    }
  };

  const runConnect = (s: SyeSession) => { onConnect(s); onClose(); };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(2,5,12,0.55)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 110, zIndex: 220,
          }}>
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="glass-strong"
            style={{ width: 560, maxWidth: '92vw', borderRadius: 16, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
            onKeyDown={handleKey}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
            }}>
              <Search size={15} color="var(--text-muted)" />
              <input
                ref={inputRef}
                value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search servers to connect…"
                style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', background: 'transparent' }} />
              <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{filtered.length} / {sessions.length}</span>
              <kbd style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 4,
                background: 'rgba(140,170,230,0.08)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)',
              }}>ESC</kbd>
            </div>

            <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto', padding: 6 }}>
              {sessions.length === 0 && (
                <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <Server size={22} color="var(--text-faint)" style={{ marginBottom: 10 }} />
                  <div>No saved servers.</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>
                    Add your first below.
                  </div>
                </div>
              )}
              {sessions.length > 0 && filtered.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                  No matching servers.
                </div>
              )}
              {filtered.map((s, i) => {
                const active = i === activeIndex;
                const connected = connectedSessionIds.has(s.id);
                return (
                  <div key={s.id}
                    data-idx={i}
                    onClick={() => runConnect(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12,
                      cursor: 'pointer', fontSize: 13, borderRadius: 9, position: 'relative',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}>
                    {active && (
                      <motion.div layoutId="qc-active"
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                        style={{
                          position: 'absolute', inset: 0, borderRadius: 9,
                          background: 'var(--bg-hover)',
                          border: '1px solid rgba(90,162,255,0.22)',
                        }} />
                    )}
                    <div style={{
                      position: 'relative', width: 32, height: 32, borderRadius: 9,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: connected ? 'rgba(52,211,153,0.12)' : 'var(--accent-gradient-soft)',
                      border: `1px solid ${connected ? 'rgba(52,211,153,0.3)' : 'var(--border-medium)'}`,
                    }}>
                      <Server size={14} color={connected ? 'var(--success)' : 'var(--accent-light)'} />
                      {connected && (
                        <span style={{
                          position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderRadius: '50%',
                          background: 'var(--success)',
                          border: '2px solid var(--bg-primary)',
                        }} />
                      )}
                    </div>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontWeight: active ? 600 : 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{s.name}</span>
                        {s.favorite && <Star size={10} fill="#fbbf24" color="#fbbf24" />}
                      </div>
                      <span style={{
                        fontSize: 11, color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {s.username}@{s.host}:{s.port}
                        {s.group ? <span style={{ color: 'var(--text-faint)' }}> · {s.group}</span> : null}
                      </span>
                    </div>
                    {connected && (
                      <span style={{
                        position: 'relative', fontSize: 10, color: 'var(--success)', letterSpacing: 0.5,
                        padding: '2px 7px', borderRadius: 4,
                        background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.22)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <Cable size={9} /> LIVE
                      </span>
                    )}
                    {active && <CornerDownLeft size={12} color="var(--text-muted)" style={{ position: 'relative' }} />}
                  </div>
                );
              })}
            </div>

            <div style={{
              padding: 8, borderTop: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'linear-gradient(180deg, rgba(10,15,26,0.2), rgba(10,15,26,0.5))',
            }}>
              <motion.button
 whileTap={{ scale: 0.97 }}
                onClick={() => { onNewSession(); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: 'var(--accent-gradient-soft)',
                  border: '1px solid rgba(90,162,255,0.28)', color: 'var(--accent-light)',
                }}>
                <Plus size={12} /> New session
              </motion.button>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10.5, color: 'var(--text-faint)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>↑↓</kbd> navigate
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>↵</kbd> connect
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const kbdStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 5px', borderRadius: 4,
  background: 'rgba(140,170,230,0.08)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)',
};
