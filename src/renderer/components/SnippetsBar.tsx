import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Plus, X } from 'lucide-react';

interface Snippet { label: string; cmd: string; }

interface Props {
  visible: boolean;
  onRun: (cmd: string) => void;
  onClose: () => void;
}

const STORE_KEY = 'syella.snippets.v1';

const DEFAULTS: Snippet[] = [
  { label: 'ls -lah',       cmd: 'ls -lah' },
  { label: 'df -h',         cmd: 'df -h' },
  { label: 'free -m',       cmd: 'free -m' },
  { label: 'top procs',     cmd: 'ps aux --sort=-%cpu | head' },
  { label: 'tail syslog',   cmd: 'tail -n 50 /var/log/syslog' },
  { label: 'listen ports',  cmd: 'ss -tulpn' },
  { label: 'docker ps',     cmd: 'docker ps' },
  { label: 'uptime',        cmd: 'uptime' },
];

function load(): Snippet[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULTS;
}

function save(list: Snippet[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch {}
}

export default function SnippetsBar({ visible, onRun, onClose }: Props) {
  const [items, setItems] = useState<Snippet[]>(() => load());
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [cmd, setCmd] = useState('');

  useEffect(() => save(items), [items]);

  const addSnippet = () => {
    if (!label.trim() || !cmd.trim()) return;
    setItems(prev => [...prev, { label: label.trim(), cmd: cmd.trim() }]);
    setLabel(''); setCmd(''); setAdding(false);
  };

  const remove = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18 }}
          className="glass-panel"
          style={{
            position: 'absolute', left: 16, right: 16, bottom: 12, zIndex: 8,
            borderRadius: 12, padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8, borderRight: '1px solid var(--border-subtle)' }}>
            <Zap size={13} color="var(--accent-light)" />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1.2 }}>Snippets</span>
          </div>

          {items.map((s, i) => (
            <motion.div key={s.label + i} layout
              whileHover={{ y: -1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              style={{ position: 'relative', display: 'flex' }}>
              <button
                onClick={() => onRun(s.cmd)}
                title={s.cmd}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  padding: '4px 10px', borderRadius: 999,
                  background: 'rgba(140,170,230,0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  transition: 'background 150ms, color 150ms, border-color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent-light)'; e.currentTarget.style.borderColor = 'rgba(90,162,255,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(140,170,230,0.06)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
                {s.label}
              </button>
              <button onClick={() => remove(i)} style={{
                position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                color: 'var(--text-muted)', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 120ms',
              }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                 onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                <X size={9} />
              </button>
            </motion.div>
          ))}

          {adding ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="label"
                style={{
                  fontSize: 11, color: 'var(--text-primary)',
                  padding: '4px 8px', borderRadius: 6, width: 100,
                  background: 'rgba(140,170,230,0.05)', border: '1px solid var(--border-subtle)',
                }} />
              <input value={cmd} onChange={e => setCmd(e.target.value)} placeholder="command"
                onKeyDown={e => { if (e.key === 'Enter') addSnippet(); if (e.key === 'Escape') setAdding(false); }}
                style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
                  padding: '4px 8px', borderRadius: 6, width: 180,
                  background: 'rgba(140,170,230,0.05)', border: '1px solid var(--border-subtle)',
                }} />
              <button onClick={addSnippet} style={{
                fontSize: 11, padding: '4px 8px', borderRadius: 6,
                background: 'var(--accent-dim)', color: 'var(--accent-light)',
              }}>Add</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '4px 8px', borderRadius: 6,
              color: 'var(--text-muted)', background: 'transparent',
              border: '1px dashed var(--border-medium)',
            }}>
              <Plus size={11} /> Add
            </button>
          )}

          <button onClick={onClose} style={{
            marginLeft: 'auto', color: 'var(--text-muted)', padding: 4, borderRadius: 6,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
