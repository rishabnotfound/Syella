import React from 'react';
import { Minus, Square, X, Terminal as TerminalIcon } from 'lucide-react';

export default function Titlebar() {
  const send = (ch: string) => window.syella.send(ch);
  return (
    <div
      className="glass drag"
      style={{
        height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        userSelect: 'none', paddingLeft: 14, paddingRight: 0, flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(15,21,36,0.75), rgba(10,15,26,0.55))',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-gradient-soft)',
          border: '1px solid var(--border-medium)',
        }}>
          <TerminalIcon size={12} color="var(--accent-light)" />
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 1.8 }}>SYELLA</span>
      </div>
      <div className="no-drag" style={{ display: 'flex', height: '100%' }}>
        {[
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
