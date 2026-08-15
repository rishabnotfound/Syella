import React, { useState } from 'react';

interface Props { onComplete: () => void; }

export default function FirstRun({ onComplete }: Props) {
  const [step, setStep] = useState(0);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.15,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(56,140,255,0.3) 0%, transparent 60%)',
      }} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', animation: 'fadeIn 600ms ease-out' }}>
        <img src="assets/logo.png" alt="Syella" style={{
          width: 80, height: 80, marginBottom: 20,
          filter: 'drop-shadow(0 0 30px rgba(56,140,255,0.3))',
        }} />
        <div style={{ fontSize: 32, fontWeight: 700, color: '#e4e8f0', letterSpacing: 4, marginBottom: 8 }}>SYELLA</div>
        <div style={{ fontSize: 14, color: '#5a7090', marginBottom: 48 }}>
          {step === 0 ? 'Your portable SSH workstation.' : 'Ready to go.'}
        </div>
        <div style={{
          width: 440, padding: 36, background: '#0a1020',
          border: '1px solid rgba(56,140,255,0.1)', borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)', animation: 'fadeInScale 400ms ease-out',
        }}>
          <div style={{ fontSize: 13, color: '#7a8ba8', lineHeight: 2, marginBottom: 28 }}>
            {step === 0 ? (
              <>Secure. Local. Beautiful.<br /><br />
              All data stored locally alongside the application.<br />
              No cloud. No telemetry. No account required.</>
            ) : (
              <>Create your first session from the sidebar,<br />
              or press <span style={{ color: '#388CFF', fontFamily: "'JetBrains Mono', monospace", padding: '2px 6px', background: 'rgba(56,140,255,0.1)', borderRadius: 4 }}>Ctrl+K</span> for the command palette.</>
            )}
          </div>
          <button onClick={step === 0 ? () => setStep(1) : onComplete}
            style={{
              padding: '13px 44px', borderRadius: 10, fontSize: 14, fontWeight: 600, border: 'none',
              background: 'linear-gradient(135deg, #388CFF 0%, #2060D0 100%)', color: '#fff',
              cursor: 'pointer', transition: 'all 250ms', boxShadow: '0 4px 20px rgba(56,140,255,0.25)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(56,140,255,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(56,140,255,0.25)'; }}>
            {step === 0 ? 'Get Started' : 'Start Using Syella'}
          </button>
        </div>
        <div style={{ marginTop: 28, fontSize: 11, color: '#253050' }}>v1.0.0</div>
      </div>
    </div>
  );
}
