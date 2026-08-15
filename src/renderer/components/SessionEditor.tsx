import React, { useState, useEffect } from 'react';
import { SyeSession, SyeGroup } from '../../types';
import { v4 as uuid } from 'uuid';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 9,
  background: 'rgba(56,140,255,0.04)', border: '1px solid rgba(56,140,255,0.1)',
  color: '#e4e8f0', fontSize: 13, transition: 'all 200ms',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, color: '#5a7090', marginBottom: 5, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 1.2,
};

interface Props {
  session?: SyeSession; groups: SyeGroup[];
  onSave: (session: SyeSession, password?: string, privateKey?: string, passphrase?: string) => void;
  onDelete?: (id: string) => void; onClose: () => void;
}

export default function SessionEditor({ session, groups, onSave, onDelete, onClose }: Props) {
  const isNew = !session;
  const [name, setName] = useState(session?.name || '');
  const [host, setHost] = useState(session?.host || '');
  const [port, setPort] = useState(session?.port || 22);
  const [username, setUsername] = useState(session?.username || 'root');
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>(session?.authMethod || 'password');
  const [group, setGroup] = useState(session?.group || '');
  const [favorite, setFavorite] = useState(session?.favorite || false);
  const [notes, setNotes] = useState(session?.notes || '');
  const [keepalive, setKeepalive] = useState(session?.keepalive || 30);
  const [timeout, setTimeoutVal] = useState(session?.connectionTimeout || 15);
  const [startupCmd, setStartupCmd] = useState(session?.startupCommand || '');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');

  useEffect(() => {
    if (session) {
      window.syella.invoke('db:getCredentials', session.id).then((c: any) => {
        if (c) { setPassword(c.password || ''); setPrivateKey(c.privateKey || ''); setPassphrase(c.passphrase || ''); }
      });
    }
  }, [session]);

  const handleSave = () => {
    const now = Date.now();
    const s: SyeSession = {
      id: session?.id || uuid(), name: name || host, host, port, username, authMethod, group,
      tags: session?.tags || [], favorite, notes, keepalive, connectionTimeout: timeout,
      startupCommand: startupCmd, proxyJump: session?.proxyJump || '',
      createdAt: session?.createdAt || now, updatedAt: now,
    };
    onSave(s, password, privateKey, passphrase);
  };

  const browseKey = async () => {
    const files = await window.syella.invoke('dialog:openFile', {
      title: 'Select Private Key', properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (files?.[0]) setPrivateKey(files[0]);
  };

  const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(56,140,255,0.3)';
    e.currentTarget.style.boxShadow = '0 0 12px rgba(56,140,255,0.08)';
  };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(56,140,255,0.1)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      animation: 'fadeIn 150ms ease-out',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 540, maxHeight: '82vh', overflowY: 'auto', background: '#0a1020',
        border: '1px solid rgba(56,140,255,0.1)', borderRadius: 14, padding: 28,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)', animation: 'fadeInScale 200ms ease-out',
      }}>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 24, color: '#e4e8f0' }}>
          {isNew ? 'New Session' : `Edit: ${session.name}`}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Nickname</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)}
              placeholder="My Server" onFocus={focusStyle} onBlur={blurStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Group</label>
            <input style={inputStyle} value={group} onChange={e => setGroup(e.target.value)}
              placeholder="Production" list="groups" onFocus={focusStyle} onBlur={blurStyle} />
            <datalist id="groups">{groups.map(g => <option key={g.id} value={g.name} />)}</datalist>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 3 }}>
            <label style={labelStyle}>Host</label>
            <input style={inputStyle} value={host} onChange={e => setHost(e.target.value)}
              placeholder="192.168.1.1" onFocus={focusStyle} onBlur={blurStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Port</label>
            <input style={inputStyle} type="number" value={port} onChange={e => setPort(Number(e.target.value))}
              onFocus={focusStyle} onBlur={blurStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Username</label>
          <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)}
            onFocus={focusStyle} onBlur={blurStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Authentication</label>
          <select style={{ ...inputStyle, background: '#0d1525' }} value={authMethod}
            onChange={e => setAuthMethod(e.target.value as any)} onFocus={focusStyle as any} onBlur={blurStyle as any}>
            <option value="password">Password</option>
            <option value="privateKey">Private Key</option>
          </select>
        </div>

        {authMethod === 'password' && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)}
              onFocus={focusStyle} onBlur={blurStyle} />
          </div>
        )}

        {authMethod === 'privateKey' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Private Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={privateKey} onChange={e => setPrivateKey(e.target.value)}
                  placeholder="Path or paste key" onFocus={focusStyle} onBlur={blurStyle} />
                <button onClick={browseKey} style={{
                  padding: '10px 16px', borderRadius: 9, fontSize: 12,
                  background: 'rgba(56,140,255,0.08)', border: '1px solid rgba(56,140,255,0.15)',
                  color: '#7a8ba8', transition: 'all 200ms',
                }}>Browse</button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Passphrase</label>
              <input style={inputStyle} type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)}
                onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Keepalive (s)</label>
            <input style={inputStyle} type="number" value={keepalive} onChange={e => setKeepalive(Number(e.target.value))}
              onFocus={focusStyle} onBlur={blurStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Timeout (s)</label>
            <input style={inputStyle} type="number" value={timeout} onChange={e => setTimeoutVal(Number(e.target.value))}
              onFocus={focusStyle} onBlur={blurStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Startup Command</label>
          <input style={inputStyle} value={startupCmd} onChange={e => setStartupCmd(e.target.value)}
            placeholder="cd /app && clear" onFocus={focusStyle} onBlur={blurStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={notes}
            onChange={e => setNotes(e.target.value)} onFocus={focusStyle as any} onBlur={blurStyle as any} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#7a8ba8', marginBottom: 6 }}
          onClick={() => setFavorite(!favorite)}>
          <span style={{ color: favorite ? '#f59e0b' : '#253050', fontSize: 15, transition: 'color 200ms' }}>★</span>
          Favorite
        </label>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 18,
          borderTop: '1px solid rgba(56,140,255,0.06)',
        }}>
          {!isNew && onDelete && (
            <button onClick={() => { if (confirm('Delete this session?')) onDelete(session.id); }}
              style={{
                padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 500, marginRight: 'auto',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444',
              }}>Delete</button>
          )}
          <button onClick={onClose} style={{
            padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 500,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(56,140,255,0.08)', color: '#7a8ba8',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={!host} style={{
            padding: '9px 24px', borderRadius: 9, fontSize: 13, fontWeight: 500,
            background: host ? 'linear-gradient(135deg, #388CFF, #2060D0)' : '#152540',
            color: host ? '#fff' : '#3d5070', transition: 'all 200ms',
          }}>{isNew ? 'Create' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
