import React from 'react';

export default function Titlebar() {
  const send = (ch: string) => window.syella.send(ch);
  return (
    <div style={{
      height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: '#0a0e18', borderBottom: '1px solid rgba(56,140,255,0.08)',
      userSelect: 'none', paddingLeft: 14, paddingRight: 0, flexShrink: 0,
      // @ts-ignore
      WebkitAppRegion: 'drag',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="assets/logo.png" alt="" style={{ width: 20, height: 20 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#7a8ba8', letterSpacing: 1.5 }}>SYELLA</span>
      </div>
      <div style={{
        display: 'flex', height: '100%',
        // @ts-ignore
        WebkitAppRegion: 'no-drag',
      }}>
        <button onClick={() => send('window:minimize')} style={{
          width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', color: '#5a7090', cursor: 'pointer', fontSize: 16, transition: 'all 150ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.1)'; e.currentTarget.style.color = '#e4e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#5a7090'; }}>
          <svg width="12" height="1" viewBox="0 0 12 1"><rect width="12" height="1" fill="currentColor"/></svg>
        </button>
        <button onClick={() => send('window:maximize')} style={{
          width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', color: '#5a7090', cursor: 'pointer', fontSize: 16, transition: 'all 150ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.1)'; e.currentTarget.style.color = '#e4e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#5a7090'; }}>
          <svg width="11" height="11" viewBox="0 0 11 11"><rect width="11" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
        </button>
        <button onClick={() => send('window:close')} style={{
          width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', color: '#5a7090', cursor: 'pointer', fontSize: 16, transition: 'all 150ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#c53030'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#5a7090'; }}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  );
}
