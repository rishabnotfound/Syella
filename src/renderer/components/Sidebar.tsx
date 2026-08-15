import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Search, Plus, Settings as SettingsIcon, MoreHorizontal, Star,
  Server, ChevronRight, Play, Edit3, Copy, Trash2, Filter, ListTree, Cable, HelpCircle,
} from 'lucide-react';
import { SyeSession, SyeGroup } from '../../types';

type Filter = 'all' | 'favorites' | 'connected';

interface Props {
  sessions: SyeSession[]; groups: SyeGroup[]; connectedTabIds: Set<string>;
  activeSessionId?: string | null;
  compact?: boolean;
  onConnect: (session: SyeSession) => void; onNewSession: () => void;
  onEditSession: (session: SyeSession) => void; onDuplicate: (session: SyeSession) => void;
  onDelete: (id: string) => void; onToggleFavorite: (session: SyeSession) => void;
  onSettings: () => void;
  onShowShortcuts: () => void;
}

function ContextMenu({ session, x, y, onClose, onConnect, onEdit, onDuplicate, onDelete, onToggleFavorite }: {
  session: SyeSession; x: number; y: number; onClose: () => void;
  onConnect: () => void; onEdit: () => void; onDuplicate: () => void;
  onDelete: () => void; onToggleFavorite: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { Icon: Play, label: 'Connect', action: onConnect },
    { Icon: Edit3, label: 'Edit', action: onEdit },
    { Icon: Star, label: session.favorite ? 'Unfavorite' : 'Favorite', action: onToggleFavorite },
    { Icon: Copy, label: 'Duplicate', action: onDuplicate },
    { Icon: Trash2, label: 'Delete', action: onDelete, danger: true },
  ];

  // Framer Motion applies `transform` to ancestors, which turns them into the
  // containing block for `position: fixed`, causing clipping. Portal to <body>.
  const width = 180;
  const height = items.length * 34 + 8;
  const clampedX = Math.min(x, window.innerWidth - width - 8);
  const clampedY = Math.min(y, window.innerHeight - height - 8);
  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="glass-strong"
      style={{
        position: 'fixed', left: clampedX, top: clampedY, zIndex: 800, minWidth: width,
        borderRadius: 10, padding: 4,
      }}>
      {items.map((item) => {
        const Icon = item.Icon;
        return (
          <div key={item.label} onClick={() => { item.action(); onClose(); }}
            style={{
              padding: '7px 10px', fontSize: 12, cursor: 'pointer',
              borderRadius: 6, transition: 'background 100ms, color 100ms',
              color: item.danger ? 'var(--danger)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 9,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = item.danger ? 'rgba(248,113,113,0.08)' : 'var(--bg-hover)';
              e.currentTarget.style.color = item.danger ? '#fca5a5' : 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = item.danger ? 'var(--danger)' : 'var(--text-secondary)';
            }}>
            <Icon size={13} />
            {item.label}
          </div>
        );
      })}
    </motion.div>,
    document.body
  );
}

export default function Sidebar({
  sessions, groups, connectedTabIds, activeSessionId, compact,
  onConnect, onNewSession, onEditSession, onDuplicate, onDelete, onToggleFavorite, onSettings, onShowShortcuts,
}: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ session: SyeSession; x: number; y: number } | null>(null);

  const filtered = useMemo(() => {
    let list = sessions;
    if (filter === 'favorites') list = list.filter(s => s.favorite);
    else if (filter === 'connected') list = list.filter(s => connectedTabIds.has(s.id));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.host.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
    }
    return list;
  }, [sessions, search, filter, connectedTabIds]);

  const grouped = useMemo(() => {
    const map = new Map<string, SyeSession[]>();
    for (const sess of filtered) {
      const g = sess.group || 'Ungrouped';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(sess);
    }
    return map;
  }, [filtered]);

  const toggleGroup = (g: string) => setCollapsed(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });

  const openMenu = (e: React.MouseEvent, sess: SyeSession) => {
    e.stopPropagation();
    setMenu({ session: sess, x: e.clientX, y: e.clientY });
  };

  if (compact) {
    return (
      <div style={{
        width: 56, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 0 8px', gap: 6,
        background: 'linear-gradient(180deg, rgba(10,15,26,0.75), rgba(6,9,17,0.9))',
        borderRight: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(20px) saturate(180%)',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-gradient-soft)', border: '1px solid var(--border-medium)',
        }}>
          <Cable size={16} color="var(--accent-light)" />
        </div>
        <div style={{ height: 1, width: 28, background: 'var(--border-subtle)', margin: '6px 0' }} />
        <div style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {sessions.slice(0, 20).map(s => {
            const connected = connectedTabIds.has(s.id);
            const active = activeSessionId === s.id;
            return (
              <motion.button key={s.id}
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
                onClick={() => onConnect(s)}
                title={s.name}
                style={{
                  width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(90,162,255,0.28)' : 'transparent'}`,
                  color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                  transition: 'background 150ms, color 150ms',
                }}>
                <Server size={14} />
                {connected && <span style={{
                  position: 'absolute', bottom: 3, right: 3, width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--success)',
                }} />}
              </motion.button>
            );
          })}
        </div>
        <div style={{ height: 1, width: 28, background: 'var(--border-subtle)', margin: '4px 0' }} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onNewSession} title="New session" style={{
          width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-light)', background: 'var(--accent-dim)', border: '1px solid rgba(90,162,255,0.22)',
        }}>
          <Plus size={15} />
        </motion.button>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onSettings} title="Settings" style={{
          width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}>
          <SettingsIcon size={15} />
        </motion.button>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onShowShortcuts} title="Keyboard shortcuts (?)" style={{
          width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)',
        }}>
          <HelpCircle size={14} />
        </motion.button>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(180deg, rgba(10,15,26,0.7), rgba(6,9,17,0.9))',
      borderRight: '1px solid var(--border-subtle)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    }}>
      {/* Brand row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 8px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-gradient-soft)',
          border: '1px solid var(--border-medium)',
        }}>
          <Cable size={15} color="var(--accent-light)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 0.2 }}>Syella</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sessions.length} sessions · {connectedTabIds.size} live</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '2px 10px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9,
          background: 'rgba(140,170,230,0.05)', border: '1px solid var(--border-subtle)',
          transition: 'border-color 150ms, background 150ms',
        }}>
          <Search size={12} color="var(--text-faint)" />
          <input
            placeholder="Quick connect..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, color: 'var(--text-primary)', fontSize: 12, background: 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--text-muted)', fontSize: 11 }}>✕</button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6 }}>
        {([
          { k: 'all' as Filter, label: 'All', Icon: ListTree },
          { k: 'favorites' as Filter, label: 'Favorites', Icon: Star },
          { k: 'connected' as Filter, label: 'Live', Icon: Cable },
        ]).map(({ k, label, Icon }) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`chip ${filter === k ? 'active' : ''}`}
            style={{ cursor: 'pointer' }}>
            <Icon size={10} />
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '2px 0 6px' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            <Filter size={16} style={{ opacity: 0.4, marginBottom: 6 }} />
            <div>No sessions match.</div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {Array.from(grouped.entries()).map(([group, items]) => {
            const isCollapsed = collapsed.has(group);
            return (
              <motion.div key={group} layout style={{ padding: '2px 0' }}>
                <div onClick={() => toggleGroup(group)}
                  style={{
                    padding: '5px 16px 5px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: 1.4, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'color 120ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                  <motion.span
                    animate={{ rotate: isCollapsed ? 0 : 90 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{ display: 'inline-flex' }}>
                    <ChevronRight size={11} />
                  </motion.span>
                  {group}
                  <span style={{
                    fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto',
                    background: 'rgba(140,170,230,0.05)', padding: '1px 7px', borderRadius: 8,
                  }}>{items.length}</span>
                </div>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ height: { type: 'spring', stiffness: 260, damping: 30 }, opacity: { duration: 0.15 } }}
                      style={{ overflow: 'hidden' }}>
                      {items.map(sess => {
                        const connected = connectedTabIds.has(sess.id);
                        const active = activeSessionId === sess.id;
                        return (
                          <motion.div key={sess.id}
                            layout
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            whileHover="hover"
                            variants={{ hover: {} }}
                            onDoubleClick={() => onConnect(sess)}
                            style={{
                              position: 'relative',
                              padding: '7px 10px 7px 14px', display: 'flex', alignItems: 'center', gap: 9,
                              fontSize: 12.5, cursor: 'default',
                              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                              borderRadius: 8, margin: '1px 8px',
                            }}>
                            {/* Hover/active bg */}
                            {(active) && (
                              <motion.div layoutId="sidebar-active-bg"
                                style={{
                                  position: 'absolute', inset: 0, borderRadius: 8,
                                  background: 'linear-gradient(90deg, rgba(90,162,255,0.16), rgba(90,162,255,0.04))',
                                  border: '1px solid rgba(90,162,255,0.22)',
                                }}
                                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                              />
                            )}
                            <motion.div
                              variants={{ hover: { background: 'var(--bg-hover)' } }}
                              transition={{ duration: 0.12 }}
                              style={{
                                position: 'absolute', inset: 0, borderRadius: 8,
                                background: 'transparent', pointerEvents: 'none',
                                opacity: active ? 0 : 1,
                              }}
                            />
                            {/* Content */}
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
                              <div style={{ position: 'relative', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Server size={13} color={active ? 'var(--accent-light)' : connected ? 'var(--success)' : 'var(--text-faint)'} />
                                {connected && (
                                  <span style={{
                                    position: 'absolute', bottom: -1, right: -1,
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: 'var(--success)',
                                    border: '2px solid var(--bg-primary)',
                                  }} />
                                )}
                              </div>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: active ? 500 : 400 }}>
                                {sess.name}
                              </span>
                              <span onClick={e => { e.stopPropagation(); onToggleFavorite(sess); }}
                                style={{ cursor: 'pointer', display: 'flex', padding: 2, borderRadius: 4 }}>
                                <Star size={12}
                                  color={sess.favorite ? '#fbbf24' : 'var(--text-faint)'}
                                  fill={sess.favorite ? '#fbbf24' : 'none'} />
                              </span>
                              <span onClick={e => openMenu(e, sess)}
                                style={{
                                  width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  borderRadius: 5, cursor: 'pointer',
                                  color: 'var(--text-muted)',
                                  transition: 'background 100ms, color 100ms',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                <MoreHorizontal size={13} />
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6,
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <motion.button
          whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          onClick={onNewSession} style={{
          padding: '9px 12px', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--accent-gradient-soft)',
          border: '1px solid rgba(90,162,255,0.28)',
          color: 'var(--accent-light)', fontSize: 12, fontWeight: 500,
        }}>
          <Plus size={13} />
          New Session
        </motion.button>
        <div style={{ display: 'flex', gap: 6 }}>
          <motion.button
            whileHover={{ background: 'var(--bg-hover)' as any }}
            transition={{ duration: 0.12 }}
            onClick={onSettings} style={{
            flex: 1,
            padding: '8px 12px', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'transparent',
            color: 'var(--text-secondary)', fontSize: 11.5,
          }}>
            <SettingsIcon size={13} />
            Settings
          </motion.button>
          <motion.button
            whileHover={{ background: 'var(--bg-hover)' as any, scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.12 }}
            onClick={onShowShortcuts}
            title="Keyboard shortcuts (?)"
            style={{
              width: 34,
              padding: '8px 0', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
              color: 'var(--text-muted)',
            }}>
            <HelpCircle size={13} />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {menu && (
          <ContextMenu session={menu.session} x={menu.x} y={menu.y}
            onClose={() => setMenu(null)}
            onConnect={() => onConnect(menu.session)}
            onEdit={() => onEditSession(menu.session)}
            onDuplicate={() => onDuplicate(menu.session)}
            onDelete={() => onDelete(menu.session.id)}
            onToggleFavorite={() => onToggleFavorite(menu.session)} />
        )}
      </AnimatePresence>
    </div>
  );
}
