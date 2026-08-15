import React from 'react';
import { SyeTab } from '../../types';

function indicator(status: string): React.CSSProperties {
  const bg = status === 'connected' ? '#22c55e' : status === 'connecting' ? '#f59e0b' : status === 'error' ? '#ef4444' : '#1a2540';
  return {
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: bg,
    boxShadow: status === 'connected' ? '0 0 6px rgba(34,197,94,0.4)' : status === 'connecting' ? '0 0 6px rgba(245,158,11,0.3)' : 'none',
    animation: status === 'connecting' ? 'pulse 1.5s infinite' : 'none', transition: 'all 300ms',
  };
}

interface Props {
  tabs: SyeTab[]; activeTabId: string | null;
  onSelect: (id: string) => void; onClose: (id: string) => void; onNew: () => void;
}

export default function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }: Props) {
  return (
    <div style={{
      height: 40, display: 'flex', alignItems: 'stretch', background: '#030810',
      borderBottom: '1px solid rgba(56,140,255,0.08)', overflow: 'hidden', flexShrink: 0,
    }}>
      {tabs.map(tab => {
        const active = tab.id === activeTabId;
        return (
          <div key={tab.id} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px', fontSize: 12,
            color: active ? '#e4e8f0' : '#5a7090', cursor: 'pointer',
            borderRight: '1px solid rgba(56,140,255,0.05)',
            background: active ? '#000' : 'transparent',
            transition: 'all 200ms', position: 'relative', maxWidth: 220, minWidth: 110,
          }}
            onClick={() => onSelect(tab.id)}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#060a14'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
            <span style={indicator(tab.status)} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: active ? 500 : 400 }}>
              {tab.title}
            </span>
            <span style={{
              width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 5, fontSize: 10, color: '#3d5070', flexShrink: 0, transition: 'all 120ms',
            }}
              onClick={e => { e.stopPropagation(); onClose(tab.id); }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#3d5070'; }}>
              ✕
            </span>
            {active && <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
              background: 'linear-gradient(90deg, #388CFF, #2060D0)', borderRadius: '2px 2px 0 0',
            }} />}
          </div>
        );
      })}
      <div style={{
        width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#3d5070', cursor: 'pointer', fontSize: 16, transition: 'all 200ms',
      }}
        onClick={onNew}
        onMouseEnter={e => { e.currentTarget.style.color = '#388CFF'; e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#3d5070'; e.currentTarget.style.background = 'transparent'; }}>
        +
      </div>
    </div>
  );
}
