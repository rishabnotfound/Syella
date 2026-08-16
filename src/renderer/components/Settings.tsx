import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Wifi, Lock, Archive, Download, Upload, FileDown, FileUp, ShieldCheck,
} from 'lucide-react';
import { SyeSettings } from '../../types';

type TabKey = 'ssh' | 'security' | 'backup';

interface Props {
  settings: SyeSettings;
  onSave: (s: SyeSettings) => void;
  onClose: () => void;
  onBackupExport: () => void;
  onBackupImport: () => void;
}

const TABS: { key: TabKey; label: string; Icon: React.ComponentType<any> }[] = [
  { key: 'ssh', label: 'SSH', Icon: Wifi },
  { key: 'security', label: 'Security', Icon: Lock },
  { key: 'backup', label: 'Backup', Icon: Archive },
];

export default function Settings({ settings, onSave, onClose, onBackupExport, onBackupImport }: Props) {
  const [tab, setTab] = useState<TabKey>('ssh');
  const [s, setS] = useState<SyeSettings>(JSON.parse(JSON.stringify(settings)));
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);

  const update = <K extends keyof SyeSettings>(section: K, key: keyof SyeSettings[K], value: any) => {
    setS(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  // Save/Cancel are only meaningful for editable-form tabs; Backup runs
  // one-shot actions so we hide the footer there entirely.
  const showFooter = tab !== 'backup';

  return (
    <AnimatePresence>
      <motion.div
        key="settings-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(2,5,12,0.62)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          onClick={e => e.stopPropagation()}
          className="glass-strong"
          style={{
            width: 640, maxWidth: '96vw', maxHeight: '86vh',
            borderRadius: 18, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(180deg, rgba(15,21,36,0.65), rgba(10,15,26,0.15))',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent-gradient-soft)',
              border: '1px solid var(--border-medium)',
            }}>
              <ShieldCheck size={16} color="var(--accent-light)" />
            </div>
            <div style={{ flex: 1, lineHeight: 1.2 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SSH defaults, security, backup</div>
            </div>
            <button onClick={onClose} title="Close (Esc)" style={iconBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, padding: '10px 14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            {TABS.map(t => {
              const active = tab === t.key;
              const Icon = t.Icon;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 14px 12px',
                    fontSize: 12, fontWeight: active ? 600 : 500,
                    color: active ? 'var(--accent-light)' : 'var(--text-muted)',
                    background: 'transparent', cursor: 'pointer',
                  }}>
                  <Icon size={12} />
                  {t.label}
                  {active && (
                    <motion.div layoutId="settings-tab-underline"
                      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                      style={{
                        position: 'absolute', bottom: -1, left: 8, right: 8, height: 2,
                        background: 'var(--accent-gradient)', borderRadius: 2,
                      }} />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
            {tab === 'ssh' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Field label="Default port">
                    <NumberInput value={s.ssh.defaultPort} onChange={v => update('ssh', 'defaultPort', v)} />
                  </Field>
                  <Field label="Keepalive (s)">
                    <NumberInput value={s.ssh.keepalive} onChange={v => update('ssh', 'keepalive', v)} />
                  </Field>
                  <Field label="Timeout (s)">
                    <NumberInput value={s.ssh.connectionTimeout} onChange={v => update('ssh', 'connectionTimeout', v)} />
                  </Field>
                </div>
                <div style={helpText}>
                  These defaults apply when creating new sessions. Per-session values in the session editor override these.
                </div>
              </div>
            )}

            {tab === 'security' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Auto-lock (minutes — 0 disables)">
                  <NumberInput value={s.security.autoLockMinutes} onChange={v => update('security', 'autoLockMinutes', v)} />
                </Field>
                <ToggleRow
                  title="Stealth connect"
                  body="Minimize what the server can fingerprint about your client: generic SSH identity string, no agent forwarding, no forwarded env vars, stripped public-key comment. Your IP and username are still visible."
                  value={s.security.stealthConnect}
                  onChange={v => update('security', 'stealthConnect', v)}
                />
                <div style={helpText}>
                  All stored credentials are encrypted with AES-256-GCM using a per-installation key derived via PBKDF2 (200k iterations, SHA-512).
                </div>
              </div>
            )}

            {tab === 'backup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <ActionRow
                  Icon={FileDown}
                  title="Export encrypted backup"
                  body="Save a password-protected .syella file containing every session, group, credential, and setting."
                  actionLabel="Export…"
                  ActionIcon={Download}
                  primary
                  onAction={onBackupExport}
                />
                <ActionRow
                  Icon={FileUp}
                  title="Import backup"
                  body="Restore from a .syella file. Sessions are merged with your existing ones (no data is deleted)."
                  actionLabel="Import…"
                  ActionIcon={Upload}
                  onAction={onBackupImport}
                />
                <div style={helpText}>
                  Backups are encrypted at rest. Keep your password safe — there's no recovery.
                </div>
              </div>
            )}
          </div>

          {showFooter && (
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'linear-gradient(180deg, rgba(10,15,26,0.15), rgba(10,15,26,0.5))',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flex: 1, fontSize: 11, color: dirty ? 'var(--warning)' : 'var(--text-faint)' }}>
                {dirty ? 'Unsaved changes' : ''}
              </div>
              <button onClick={onClose} style={cancelBtn}>Cancel</button>
              <button onClick={() => { onSave(s); onClose(); }}
                disabled={!dirty}
                style={{
                  ...saveBtn,
                  opacity: dirty ? 1 : 0.55,
                  cursor: dirty ? 'pointer' : 'default',
                }}>
                Save
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2,
        color: 'var(--text-muted)', marginBottom: 5,
      }}>{label}</div>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value) || 0)}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: 8,
        background: 'rgba(140,170,230,0.05)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)', fontSize: 12.5,
        fontFamily: 'var(--font-mono)',
        outline: 'none', transition: 'border-color 150ms, background 150ms, box-shadow 150ms',
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'rgba(90,162,255,0.4)';
        e.currentTarget.style.background = 'rgba(90,162,255,0.06)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,162,255,0.1)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.background = 'rgba(140,170,230,0.05)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

interface ActionRowProps {
  Icon: React.ComponentType<any>;
  title: string;
  body: string;
  actionLabel: string;
  ActionIcon: React.ComponentType<any>;
  onAction: () => void;
  primary?: boolean;
}
function ActionRow({ Icon, title, body, actionLabel, ActionIcon, onAction, primary }: ActionRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: 14, borderRadius: 11,
      background: 'rgba(140,170,230,0.04)',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent-light)',
        background: 'var(--accent-gradient-soft)',
        border: '1px solid var(--border-medium)',
        flexShrink: 0,
      }}>
        <Icon size={15} />
      </div>
      <div style={{ flex: 1, lineHeight: 1.35 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{body}</div>
      </div>
      <button onClick={onAction}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: primary ? 'var(--accent-gradient)' : 'transparent',
          border: primary ? '1px solid rgba(90,162,255,0.4)' : '1px solid var(--border-subtle)',
          color: primary ? '#fff' : 'var(--text-secondary)',
          boxShadow: primary ? '0 4px 16px rgba(90,162,255,0.2)' : 'none',
        }}>
        <ActionIcon size={12} />
        {actionLabel}
      </button>
    </div>
  );
}

function ToggleRow({ title, body, value, onChange }: {
  title: string; body: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: 14, borderRadius: 11,
      background: 'rgba(140,170,230,0.04)',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{body}</div>
      </div>
      <button onClick={() => onChange(!value)} role="switch" aria-checked={value}
        style={{
          position: 'relative', width: 38, height: 22, borderRadius: 12,
          background: value ? 'var(--accent-gradient)' : 'rgba(140,170,230,0.14)',
          border: '1px solid ' + (value ? 'rgba(90,162,255,0.5)' : 'var(--border-subtle)'),
          cursor: 'pointer', flexShrink: 0,
          transition: 'background 160ms, border-color 160ms',
        }}>
        <motion.div
          animate={{ x: value ? 16 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          style={{
            position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 8,
            background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
          }} />
      </button>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, display: 'flex',
  alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
  background: 'transparent', border: '1px solid var(--border-subtle)',
  cursor: 'pointer',
};

const helpText: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6,
  padding: '10px 12px', borderRadius: 8,
  background: 'rgba(140,170,230,0.03)',
  border: '1px dashed var(--border-subtle)',
};

const cancelBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
  background: 'transparent', border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)', cursor: 'pointer',
};

const saveBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
  background: 'var(--accent-gradient)', color: '#fff',
  border: '1px solid rgba(90,162,255,0.4)',
  boxShadow: '0 6px 22px rgba(90,162,255,0.28)',
};
