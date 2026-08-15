import React, { useState } from 'react';
import { SyeSettings } from '../../types';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: 'rgba(56,140,255,0.04)', border: '1px solid rgba(56,140,255,0.1)',
  color: '#e4e8f0', fontSize: 13, transition: 'all 200ms',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, color: '#5a7090', marginBottom: 4, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 1,
};

const navTabs = ['Terminal', 'SSH', 'Security', 'Backup'];

interface Props {
  settings: SyeSettings; onSave: (s: SyeSettings) => void; onClose: () => void;
  onBackupExport: () => void; onBackupImport: () => void;
}

export default function Settings({ settings, onSave, onClose, onBackupExport, onBackupImport }: Props) {
  const [tab, setTab] = useState('Terminal');
  const [s, setS] = useState<SyeSettings>(JSON.parse(JSON.stringify(settings)));

  const update = <K extends keyof SyeSettings>(section: K, key: keyof SyeSettings[K], value: any) => {
    setS(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      animation: 'fadeIn 150ms ease-out',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 620, maxHeight: '80vh', display: 'flex', background: '#0a1020',
        border: '1px solid rgba(56,140,255,0.1)', borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)', animation: 'fadeInScale 200ms ease-out',
      }}>
        <div style={{
          width: 170, background: '#060a14', borderRight: '1px solid rgba(56,140,255,0.06)',
          padding: '20px 0', flexShrink: 0,
        }}>
          <div style={{ padding: '0 20px 18px', fontSize: 15, fontWeight: 600, color: '#e4e8f0' }}>Settings</div>
          {navTabs.map(t => (
            <div key={t} onClick={() => setTab(t)} style={{
              padding: '9px 20px', fontSize: 12, cursor: 'pointer', transition: 'all 150ms',
              color: t === tab ? '#e4e8f0' : '#5a7090',
              background: t === tab ? 'rgba(56,140,255,0.08)' : 'transparent',
              borderRight: t === tab ? '2px solid #388CFF' : '2px solid transparent',
            }}
              onMouseEnter={e => { if (t !== tab) e.currentTarget.style.color = '#7a8ba8'; }}
              onMouseLeave={e => { if (t !== tab) e.currentTarget.style.color = '#5a7090'; }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {tab === 'Terminal' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e8f0', marginBottom: 18 }}>Terminal</div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Font Family</label>
                <input style={inputStyle} value={s.terminal.fontFamily} onChange={e => update('terminal', 'fontFamily', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Font Size</label>
                  <input style={inputStyle} type="number" value={s.terminal.fontSize} onChange={e => update('terminal', 'fontSize', Number(e.target.value))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Cursor Style</label>
                  <select style={{ ...inputStyle, background: '#0d1525' }} value={s.terminal.cursorStyle} onChange={e => update('terminal', 'cursorStyle', e.target.value)}>
                    <option value="block">Block</option><option value="underline">Underline</option><option value="bar">Bar</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Scrollback</label>
                  <input style={inputStyle} type="number" value={s.terminal.scrollback} onChange={e => update('terminal', 'scrollback', Number(e.target.value))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Accent Color</label>
                  <input style={{ ...inputStyle, width: 80 }} type="color" value={s.general.accentColor} onChange={e => update('general', 'accentColor', e.target.value)} />
                </div>
              </div>
            </>
          )}
          {tab === 'SSH' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e8f0', marginBottom: 18 }}>SSH Defaults</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Default Port</label>
                  <input style={inputStyle} type="number" value={s.ssh.defaultPort} onChange={e => update('ssh', 'defaultPort', Number(e.target.value))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Keepalive (s)</label>
                  <input style={inputStyle} type="number" value={s.ssh.keepalive} onChange={e => update('ssh', 'keepalive', Number(e.target.value))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Timeout (s)</label>
                  <input style={inputStyle} type="number" value={s.ssh.connectionTimeout} onChange={e => update('ssh', 'connectionTimeout', Number(e.target.value))} />
                </div>
              </div>
            </>
          )}
          {tab === 'Security' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e8f0', marginBottom: 18 }}>Security</div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Auto-lock (minutes, 0 = disabled)</label>
                <input style={inputStyle} type="number" value={s.security.autoLockMinutes} onChange={e => update('security', 'autoLockMinutes', Number(e.target.value))} />
              </div>
              <div style={{ padding: '12px 0', fontSize: 12, color: '#3d5070' }}>
                All credentials encrypted with AES-256-GCM + PBKDF2 per-installation key.
              </div>
            </>
          )}
          {tab === 'Backup' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e8f0', marginBottom: 18 }}>Backup & Restore</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                <button onClick={onBackupExport} style={{
                  padding: '10px 20px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                  background: 'linear-gradient(135deg, #388CFF, #2060D0)', color: '#fff',
                }}>Export Encrypted Backup</button>
                <button onClick={onBackupImport} style={{
                  padding: '10px 20px', borderRadius: 9, fontSize: 12,
                  background: 'rgba(56,140,255,0.08)', border: '1px solid rgba(56,140,255,0.15)',
                  color: '#7a8ba8',
                }}>Import Backup</button>
              </div>
              <div style={{ fontSize: 12, color: '#3d5070', lineHeight: 1.8 }}>
                Backups are encrypted with a password you choose during export.<br />
                Contains: sessions, groups, credentials, settings.<br />
                File extension: .syella
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 18, borderTop: '1px solid rgba(56,140,255,0.06)', marginTop: 16 }}>
            <button onClick={onClose} style={{
              padding: '9px 20px', borderRadius: 9, fontSize: 13,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(56,140,255,0.08)', color: '#7a8ba8',
            }}>Cancel</button>
            <button onClick={() => { onSave(s); onClose(); }} style={{
              padding: '9px 24px', borderRadius: 9, fontSize: 13, fontWeight: 500,
              background: 'linear-gradient(135deg, #388CFF, #2060D0)', color: '#fff',
            }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
