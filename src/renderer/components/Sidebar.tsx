import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SyeSession, SyeGroup } from '../../types';

const Ico = ({ d, color, size = 14 }: { d: string; color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ flexShrink: 0 }}>
    <path d={d} />
  </svg>
);

const ICONS = {
  search: 'M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z',
  plus: 'M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 11-2 0V9H3a1 1 0 010-2h4V3a1 1 0 011-1z',
  gear: 'M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM6.754 8a1.246 1.246 0 112.492 0 1.246 1.246 0 01-2.492 0z M14.088 7.012l-.737-.18a5.43 5.43 0 00-.399-.964l.404-.664a.5.5 0 00-.075-.592l-.715-.714a.5.5 0 00-.592-.075l-.664.404a5.43 5.43 0 00-.964-.4l-.18-.736A.5.5 0 009.68 3H8.32a.5.5 0 00-.488.39l-.18.737a5.43 5.43 0 00-.964.399l-.664-.404a.5.5 0 00-.592.075l-.714.715a.5.5 0 00-.075.592l.404.664a5.43 5.43 0 00-.4.964l-.736.18A.5.5 0 003 8.32v1.36a.5.5 0 00.39.488l.737.18c.1.338.234.66.399.964l-.404.664a.5.5 0 00.075.592l.715.714a.5.5 0 00.592.075l.664-.404c.304.165.626.299.964.4l.18.736a.5.5 0 00.488.391h1.36a.5.5 0 00.488-.39l.18-.737a5.43 5.43 0 00.964-.399l.664.404a.5.5 0 00.592-.075l.714-.715a.5.5 0 00.075-.592l-.404-.664c.165-.304.299-.626.4-.964l.736-.18A.5.5 0 0013 9.68V8.32a.5.5 0 00-.39-.488z',
  dots: 'M3 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z',
  star: 'M8 1.5l2.09 4.26 4.71.69-3.4 3.32.8 4.68L8 12.26 3.8 14.45l.8-4.68-3.4-3.32 4.71-.69L8 1.5z',
  starOutline: 'M8 2.6l1.53 3.12.16.32.35.05 3.45.5-2.49 2.43-.25.25.06.35.59 3.42L8.35 11.3 8 11.12l-.35.18-3.05 1.61.59-3.42.06-.35-.25-.25-2.49-2.43 3.45-.5.35-.05.16-.32L8 2.6zM8 1.5l-2.09 4.26-4.71.69 3.4 3.32-.8 4.68L8 12.26l4.2 2.19-.8-4.68 3.4-3.32-4.71-.69L8 1.5z',
};

interface Props {
  sessions: SyeSession[]; groups: SyeGroup[]; connectedTabIds: Set<string>;
  onConnect: (session: SyeSession) => void; onNewSession: () => void;
  onEditSession: (session: SyeSession) => void; onDuplicate: (session: SyeSession) => void;
  onDelete: (id: string) => void; onToggleFavorite: (session: SyeSession) => void;
  onSettings: () => void;
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
    { icon: 'M3 4v9a2 2 0 002 2h6a2 2 0 002-2V4M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1', label: 'Connect', action: onConnect },
    { icon: 'M11.49 3.17c-.38-.38-.89-.59-1.42-.59-.53 0-1.04.21-1.42.59L3.59 8.24l-.53 3.06 3.06-.53 5.06-5.06c.78-.78.78-2.05 0-2.83zM7.05 10.24l-2.29.39.39-2.29 4.72-4.72 1.9 1.9-4.72 4.72z', label: 'Edit', action: onEdit },
    { icon: session.favorite ? ICONS.star : ICONS.starOutline, label: session.favorite ? 'Unfavorite' : 'Favorite', action: onToggleFavorite, isPath: true },
    { icon: 'M4 3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V6.414A1 1 0 0012.707 6L10 3.293A1 1 0 009.586 3H4zm5 1v2h2L9 4z', label: 'Duplicate', action: onDuplicate },
    { icon: 'M5 3a1 1 0 00-1 1v1H3a1 1 0 100 2h1v5a2 2 0 002 2h4a2 2 0 002-2V7h1a1 1 0 100-2h-1V4a1 1 0 00-1-1H5z', label: 'Delete', action: onDelete, danger: true },
  ];

  return (
    <div ref={ref} style={{
      position: 'fixed', left: x, top: y, zIndex: 500, minWidth: 170,
      background: '#0c1424', border: '1px solid rgba(56,140,255,0.12)', borderRadius: 8,
      padding: '4px 0', boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
      animation: 'fadeInScale 100ms cubic-bezier(0.16,1,0.3,1)',
    }}>
      {items.map((item, i) => (
        <div key={i} onClick={() => { item.action(); onClose(); }}
          style={{
            padding: '7px 12px', fontSize: 12, cursor: 'pointer', transition: 'all 80ms',
            color: item.danger ? '#ef4444' : '#b0c0d8', display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.1)'; e.currentTarget.style.color = item.danger ? '#ff6b6b' : '#e4e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = item.danger ? '#ef4444' : '#b0c0d8'; }}>
          <Ico d={(item as any).isPath ? item.icon : item.icon} color="currentColor" size={13} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({ sessions, groups, connectedTabIds, onConnect, onNewSession, onEditSession, onDuplicate, onDelete, onToggleFavorite, onSettings }: Props) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ session: SyeSession; x: number; y: number } | null>(null);

  const filtered = useMemo(() => {
    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(s => s.name.toLowerCase().includes(q) || s.host.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
  }, [sessions, search]);

  const favorites = filtered.filter(s => s.favorite);
  const grouped = useMemo(() => {
    const map = new Map<string, SyeSession[]>();
    for (const sess of filtered) {
      const g = sess.group || 'Ungrouped';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(sess);
    }
    return map;
  }, [filtered]);

  const isConnected = (sess: SyeSession) => connectedTabIds.has(sess.id);
  const toggleGroup = (g: string) => setCollapsed(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });

  const openMenu = (e: React.MouseEvent, sess: SyeSession) => {
    e.stopPropagation();
    setMenu({ session: sess, x: e.clientX, y: e.clientY });
  };

  const renderItem = (sess: SyeSession) => {
    const connected = isConnected(sess);
    const isHov = hovered === sess.id;
    return (
      <div key={sess.id}
        onDoubleClick={() => onConnect(sess)}
        onMouseEnter={() => setHovered(sess.id)}
        onMouseLeave={() => setHovered(null)}
        style={{
          padding: '6px 10px 6px 14px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12.5, color: isHov ? '#e4e8f0' : '#8899b0', cursor: 'default',
          background: isHov ? 'rgba(56,140,255,0.06)' : 'transparent',
          transition: 'all 100ms cubic-bezier(0.4,0,0.2,1)', borderRadius: 5, margin: '1px 6px',
        }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: connected ? '#50fa7b' : '#1e2736',
          boxShadow: connected ? '0 0 8px rgba(80,250,123,0.4)' : 'none',
          transition: 'all 200ms',
        }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sess.name}
        </span>
        {isHov && (
          <span onClick={e => { e.stopPropagation(); onToggleFavorite(sess); }}
            style={{ cursor: 'pointer', transition: 'transform 150ms, color 150ms', display: 'flex' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
            <Ico d={sess.favorite ? ICONS.star : ICONS.starOutline} color={sess.favorite ? '#f1fa8c' : '#3d5070'} size={14} />
          </span>
        )}
        {!isHov && sess.favorite && (
          <Ico d={ICONS.star} color="#f1fa8c" size={14} />
        )}
        {isHov && (
          <span onClick={e => openMenu(e, sess)}
            style={{
              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4, cursor: 'pointer', transition: 'all 100ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <Ico d={ICONS.dots} color={isHov ? '#7a8ba8' : '#3d5070'} size={14} />
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: 240, minWidth: 200, height: '100%', display: 'flex', flexDirection: 'column',
      background: '#060a14', borderRight: '1px solid rgba(56,140,255,0.06)', overflow: 'hidden',
    }}>
      <div style={{ padding: '0 10px 6px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 6,
          background: 'rgba(56,140,255,0.04)', border: '1px solid rgba(56,140,255,0.06)',
          transition: 'all 200ms',
        }}>
          <Ico d={ICONS.search} color="#3d5070" size={12} />
          <input
            placeholder="Quick connect..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, color: '#e4e8f0', fontSize: 12, background: 'none', border: 'none', outline: 'none' }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {favorites.length > 0 && (
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '5px 14px 3px', fontSize: 10, fontWeight: 600, color: '#f1fa8c', textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ico d={ICONS.star} color="#f1fa8c" size={9} />
              Favorites
            </div>
            {favorites.map(renderItem)}
          </div>
        )}
        {Array.from(grouped.entries()).map(([group, items]) => (
          <div key={group} style={{ padding: '2px 0' }}>
            <div onClick={() => toggleGroup(group)}
              style={{
                padding: '5px 14px 3px', fontSize: 10, fontWeight: 600, color: '#3d5070',
                textTransform: 'uppercase', letterSpacing: 1.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, transition: 'color 100ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#7a8ba8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#3d5070')}>
              <span style={{
                fontSize: 8, transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
                transform: collapsed.has(group) ? 'rotate(-90deg)' : 'rotate(0)', display: 'inline-block',
              }}>{'\u25BC'}</span>
              {group}
              <span style={{ fontSize: 10, color: '#1e2736', marginLeft: 'auto', background: 'rgba(56,140,255,0.06)', padding: '1px 6px', borderRadius: 8 }}>{items.length}</span>
            </div>
            <div style={{
              overflow: 'hidden', maxHeight: collapsed.has(group) ? 0 : 2000,
              transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1)',
            }}>
              {items.map(renderItem)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid rgba(56,140,255,0.04)' }}>
        <button onClick={onNewSession} style={{
          padding: '8px 0', borderRadius: 6, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: 'rgba(56,140,255,0.08)', border: '1px solid rgba(56,140,255,0.12)',
          color: '#388CFF', fontSize: 12, fontWeight: 500, transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)', cursor: 'pointer',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.15)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <Ico d={ICONS.plus} color="#388CFF" size={12} />
          New Session
        </button>
        <button onClick={onSettings} style={{
          padding: '7px 0', borderRadius: 6, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: 'transparent', border: '1px solid rgba(56,140,255,0.04)',
          color: '#5a7090', fontSize: 11, transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)', cursor: 'pointer',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; e.currentTarget.style.color = '#e4e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5a7090'; }}>
          <Ico d={ICONS.gear} color="currentColor" size={12} />
          Settings
        </button>
      </div>
      {menu && (
        <ContextMenu session={menu.session} x={menu.x} y={menu.y}
          onClose={() => setMenu(null)}
          onConnect={() => onConnect(menu.session)}
          onEdit={() => onEditSession(menu.session)}
          onDuplicate={() => onDuplicate(menu.session)}
          onDelete={() => onDelete(menu.session.id)}
          onToggleFavorite={() => onToggleFavorite(menu.session)} />
      )}
    </div>
  );
}
