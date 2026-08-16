import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export default function Titlebar() {
  const send = (ch: string) => window.syella.send(ch);
  const isMac = window.syella.platform === 'darwin';
  return (
    <div
      className="glass drag"
      style={{
        height: 38, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        borderBottom: '1px solid var(--border-subtle)',
        userSelect: 'none',
        // Reserve space for the native traffic-light buttons on macOS.
        paddingLeft: isMac ? 80 : 14,
        paddingRight: 0, flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(15,21,36,0.75), rgba(10,15,26,0.55))',
      }}>
      <div className="no-drag" style={{ display: 'flex', height: '100%' }}>
        {!isMac && [
          { icon: Minus, label: 'minimize', act: 'window:minimize' },
          { icon: Square, label: 'maximize', act: 'window:maximize' },
          { icon: X, label: 'close', act: 'window:close', danger: true },
        ].map(btn => {
          const Icon = btn.icon;
          return (
            <button key={btn.act} onClick={() => send(btn.act)}
              style={{
                width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', transition: 'background 150ms, color 150ms',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = btn.danger ? '#dc2626' : 'rgba(140,170,230,0.08)';
                e.currentTarget.style.color = btn.danger ? '#fff' : 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}>
              <Icon size={btn.icon === Square ? 11 : 14} strokeWidth={btn.icon === Square ? 1.6 : 2} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
