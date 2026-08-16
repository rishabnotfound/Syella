import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Server, User, Lock, KeyRound, Zap, Folder, Star, Trash2,
  Eye, EyeOff, Save, FileKey, Hash,
  ArrowRight, DollarSign, Cloud, Calendar, Repeat,
} from 'lucide-react';
import { SyeSession, SyeGroup } from '../../types';
import { v4 as uuid } from 'uuid';

interface Props {
  session?: SyeSession;
  groups: SyeGroup[];
  onSave: (session: SyeSession, password?: string, privateKey?: string, passphrase?: string) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

type Section = 'identity' | 'auth' | 'billing';

export default function SessionEditor({ session, groups, onSave, onDelete, onClose }: Props) {
  const isNew = !session;
  const [section, setSection] = useState<Section>('identity');
  const [name, setName] = useState(session?.name || '');
  const [host, setHost] = useState(session?.host || '');
  const [port, setPort] = useState(session?.port || 22);
  const [username, setUsername] = useState(session?.username || 'root');
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>(session?.authMethod || 'password');
  const [group, setGroup] = useState(session?.group || '');
  const [favorite, setFavorite] = useState(session?.favorite || false);
  const [notes, setNotes] = useState(session?.notes || '');
  const [keepalive, setKeepalive] = useState(session?.keepalive || 30);
  const [timeoutVal, setTimeoutVal] = useState(session?.connectionTimeout || 15);
  const [startupCmd, setStartupCmd] = useState(session?.startupCommand || '');
  const [provider, setProvider] = useState(session?.provider || '');
  const [costAmount, setCostAmount] = useState<string>(session?.costAmount != null ? String(session.costAmount) : '');
  const [costCurrency, setCostCurrency] = useState(session?.costCurrency || 'USD');
  const [costPeriod, setCostPeriod] = useState<'monthly' | 'yearly' | 'hourly' | 'one-time'>(session?.costPeriod || 'monthly');
  const [expiresAt, setExpiresAt] = useState<string>(
    session?.expiresAt ? new Date(session.expiresAt).toISOString().slice(0, 10) : ''
  );
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      window.syella.invoke('db:getCredentials', session.id).then((c: any) => {
        if (c) { setPassword(c.password || ''); setPrivateKey(c.privateKey || ''); setPassphrase(c.passphrase || ''); }
      });
    }
    setTimeout(() => firstInputRef.current?.focus(), 60);
  }, [session]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (host) handleSave();
      } else if (e.key === 'Enter' && !e.shiftKey && !(e.ctrlKey || e.metaKey)) {
        const el = document.activeElement as HTMLElement | null;
        if (el && el.tagName === 'TEXTAREA') return;
        if (isNew && section !== 'billing' && host) {
          e.preventDefault();
          advance();
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, name, port, username, authMethod, group, favorite, notes, keepalive, timeoutVal, startupCmd, password, privateKey, passphrase, section, isNew]);

  const handleSave = () => {
    const now = Date.now();
    const s: SyeSession = {
      id: session?.id || uuid(),
      name: name || host,
      host, port, username, authMethod, group,
      tags: session?.tags || [], favorite, notes, keepalive,
      connectionTimeout: timeoutVal,
      startupCommand: startupCmd,
      proxyJump: session?.proxyJump || '',
      provider: provider.trim() || undefined,
      costAmount: costAmount.trim() ? Number(costAmount) : undefined,
      costCurrency: costAmount.trim() ? 'USD' : undefined,
      costPeriod: costAmount.trim() ? costPeriod : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
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

  const sections: { id: Section; label: string; Icon: React.ComponentType<any>; complete?: boolean }[] = useMemo(() => [
    { id: 'identity', label: 'Identity', Icon: Server, complete: !!host },
    { id: 'auth', label: 'Auth', Icon: Lock, complete: authMethod === 'password' ? !!password : !!privateKey },
    { id: 'billing', label: 'Billing', Icon: DollarSign, complete: !!(provider || costAmount || expiresAt) },
  ], [host, authMethod, password, privateKey, provider, costAmount, expiresAt]);

  const canSave = !!host;
  const isWizardStep = isNew && section !== 'billing';
  const nextSection: Section | null =
    section === 'identity' ? 'auth'
    : section === 'auth' ? 'billing'
    : null;
  const advance = () => {
    if (!canSave) return;
    if (nextSection) setSection(nextSection);
  };
  const primaryAction = () => {
    if (isWizardStep) advance();
    else handleSave();
  };
  const primaryLabel = isWizardStep
    ? (section === 'identity' ? 'Continue to auth' : 'Continue to billing')
    : (isNew ? 'Create session' : 'Save changes');
  const PrimaryIcon = isWizardStep ? ArrowRight : (isNew ? Zap : Save);

  return (
    <AnimatePresence>
      <motion.div
        key="editor-backdrop"
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
            width: 640, maxWidth: '96vw', maxHeight: '90vh',
            borderRadius: 18, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(180deg, rgba(15,21,36,0.65), rgba(10,15,26,0.15))',
          }}>
            <motion.div
              initial={{ rotate: -20, scale: 0.8, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              style={{
                width: 42, height: 42, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-gradient-soft)',
                border: '1px solid var(--border-medium)',
              }}>
              <Server size={18} color="var(--accent-light)" />
            </motion.div>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 0.2 }}>
                {isNew ? 'New Session' : name || 'Untitled'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {host ? `${username}@${host}:${port}` : 'Configure a new SSH connection'}
              </div>
            </div>
            <motion.button
 whileTap={{ scale: 0.92 }}
              onClick={() => setFavorite(v => !v)}
              title={favorite ? 'Unfavorite' : 'Favorite'}
              style={iconBtnStyle(favorite ? '#fbbf24' : 'var(--text-muted)')}>
              <Star size={15} fill={favorite ? '#fbbf24' : 'none'} />
            </motion.button>
            <motion.button
 whileTap={{ scale: 0.92 }}
              onClick={onClose} title="Close (Esc)"
              style={iconBtnStyle('var(--text-muted)')}>
              <X size={15} />
            </motion.button>
          </div>

          {/* Section tabs */}
          <div style={{
            display: 'flex', gap: 4, padding: '10px 14px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            {sections.map(s => {
              const active = section === s.id;
              const Icon = s.Icon;
              return (
                <button key={s.id} onClick={() => setSection(s.id)}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 14px 12px',
                    fontSize: 12, fontWeight: active ? 600 : 500,
                    color: active ? 'var(--accent-light)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'color 140ms',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)'; }}>
                  <Icon size={12} />
                  {s.label}
                  {s.complete && !active && (
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--success)',
                    }} />
                  )}
                  {active && (
                    <motion.div layoutId="editor-tab-underline"
                      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                      style={{
                        position: 'absolute', bottom: -1, left: 8, right: 8, height: 2,
                        background: 'var(--accent-gradient)',
                        borderRadius: 2,
                      }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '18px 20px 8px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <AnimatePresence mode="wait">
              {section === 'identity' && (
                <motion.div key="identity" {...sectionMotion} style={sectionColStyle}>
                  <Row>
                    <Field label="Nickname" Icon={Hash} flex={2}>
                      <Input ref={firstInputRef} value={name} onChange={setName} placeholder="Production DB" />
                    </Field>
                    <Field label="Group" Icon={Folder} flex={1}>
                      <Input value={group} onChange={setGroup} placeholder="Production" list="editor-groups" />
                      <datalist id="editor-groups">{groups.map(g => <option key={g.id} value={g.name} />)}</datalist>
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Host" Icon={Server} flex={3}>
                      <Input value={host} onChange={setHost} placeholder="192.168.1.10 or example.com" mono />
                    </Field>
                    <Field label="Port" Icon={null} flex={1}>
                      <Input type="number" value={String(port)} onChange={v => setPort(Number(v) || 22)} mono />
                    </Field>
                  </Row>
                  <Field label="Username" Icon={User}>
                    <Input value={username} onChange={setUsername} placeholder="root" mono />
                  </Field>
                </motion.div>
              )}

              {section === 'auth' && (
                <motion.div key="auth" {...sectionMotion} style={sectionColStyle}>
                  <div>
                    <FieldLabel Icon={Lock} label="Authentication method" />
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                      padding: 4, borderRadius: 10,
                      background: 'rgba(140,170,230,0.05)',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      {(['password', 'privateKey'] as const).map(m => {
                        const active = authMethod === m;
                        const Icon = m === 'password' ? Lock : KeyRound;
                        return (
                          <button key={m} onClick={() => setAuthMethod(m)}
                            style={{
                              position: 'relative',
                              padding: '9px 12px', borderRadius: 7,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                              fontSize: 12, fontWeight: active ? 600 : 500,
                              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                              cursor: 'pointer', transition: 'color 140ms',
                            }}>
                            {active && (
                              <motion.div layoutId="auth-toggle-bg"
                                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                                style={{
                                  position: 'absolute', inset: 0, borderRadius: 7,
                                  background: 'var(--accent-gradient-soft)',
                                  border: '1px solid rgba(90,162,255,0.28)',
                                }} />
                            )}
                            <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7 }}>
                              <Icon size={12} />
                              {m === 'password' ? 'Password' : 'Private Key'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {authMethod === 'password' ? (
                      <motion.div key="pw" {...swapMotion} style={sectionColStyle}>
                        <Field label="Password" Icon={Lock}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Input flex value={password} onChange={setPassword} type={showPw ? 'text' : 'password'} placeholder="•••••••" />
                            <motion.button whileTap={{ scale: 0.92 }}
                              onClick={() => setShowPw(v => !v)} title={showPw ? 'Hide' : 'Show'}
                              style={sideBtnStyle}>
                              {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                            </motion.button>
                          </div>
                        </Field>
                      </motion.div>
                    ) : (
                      <motion.div key="key" {...swapMotion} style={sectionColStyle}>
                        <Field label="Private Key" Icon={FileKey}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Input flex value={privateKey} onChange={setPrivateKey} placeholder="/path/to/id_rsa or paste key" mono />
                            <motion.button whileTap={{ scale: 0.96 }}
                              onClick={browseKey}
                              style={{ ...sideBtnStyle, width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 500 }}>
                              Browse
                            </motion.button>
                          </div>
                        </Field>
                        <Field label="Passphrase" Icon={KeyRound}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Input flex value={passphrase} onChange={setPassphrase} type={showPass ? 'text' : 'password'} placeholder="Optional" />
                            <motion.button whileTap={{ scale: 0.92 }}
                              onClick={() => setShowPass(v => !v)} title={showPass ? 'Hide' : 'Show'}
                              style={sideBtnStyle}>
                              {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                            </motion.button>
                          </div>
                        </Field>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {section === 'billing' && (
                <motion.div key="billing" {...sectionMotion} style={sectionColStyle}>
                  <div style={{
                    fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
                    padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(90,162,255,0.05)',
                    border: '1px solid rgba(90,162,255,0.15)',
                  }}>
                    Track hosting costs, provider, and renewal dates. All fields optional —
                    fill them in to see spend totals and expiry warnings across your fleet.
                  </div>
                  <Field label="Hosting provider" Icon={Cloud}>
                    <Input value={provider} onChange={setProvider} placeholder="Any hosting name" />
                  </Field>
                  <Row>
                    <Field label="Cost (USD)" Icon={DollarSign} flex={2}>
                      <Input value={costAmount} onChange={setCostAmount} placeholder="0.00" type="number" mono />
                    </Field>
                    <Field label="Billing period" Icon={Repeat} flex={2}>
                      <select value={costPeriod} onChange={e => setCostPeriod(e.target.value as any)}
                        style={{ ...inputStyleObj }}>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="hourly">Hourly</option>
                        <option value="one-time">One-time</option>
                      </select>
                    </Field>
                  </Row>
                  <Field label="Expires / renews on" Icon={Calendar}>
                    <Input type="date" value={expiresAt} onChange={setExpiresAt} mono />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'linear-gradient(180deg, rgba(10,15,26,0.15), rgba(10,15,26,0.5))',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {!isNew && onDelete && (
              <AnimatePresence mode="wait">
                {confirmDelete ? (
                  <motion.div key="conf"
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>Delete?</span>
                    <motion.button whileTap={{ scale: 0.96 }}
                      onClick={() => onDelete(session!.id)}
                      style={{
                        padding: '6px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                        background: 'var(--danger)', color: '#fff', border: '1px solid var(--danger)',
                      }}>Yes, delete</motion.button>
                    <motion.button whileTap={{ scale: 0.96 }}
                      onClick={() => setConfirmDelete(false)}
                      style={{
                        padding: '6px 12px', borderRadius: 7, fontSize: 11.5, color: 'var(--text-muted)',
                        background: 'transparent', border: '1px solid var(--border-subtle)',
                      }}>No</motion.button>
                  </motion.div>
                ) : (
                  <motion.button key="del"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 whileTap={{ scale: 0.96 }}
                    onClick={() => setConfirmDelete(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                      background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                      color: 'var(--danger)',
                    }}>
                    <Trash2 size={12} /> Delete
                  </motion.button>
                )}
              </AnimatePresence>
            )}
            <div style={{ flex: 1 }} />
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                background: 'transparent', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}>
              Cancel
            </motion.button>
            {isWizardStep && canSave && (
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                title="Skip remaining steps and create the session"
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}>
                Create now
              </motion.button>
            )}
            <motion.button whileTap={canSave ? { scale: 0.98 } : {}}
              onClick={primaryAction}
              disabled={!canSave}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 7,
                background: canSave ? 'var(--accent-gradient)' : 'rgba(140,170,230,0.06)',
                color: canSave ? '#fff' : 'var(--text-muted)',
                border: canSave ? '1px solid rgba(90,162,255,0.4)' : '1px solid var(--border-subtle)',
                opacity: canSave ? 1 : 0.6,
                cursor: canSave ? 'pointer' : 'default',
                boxShadow: canSave ? '0 6px 22px rgba(90,162,255,0.28)' : 'none',
              }}>
              <PrimaryIcon size={13} />
              {primaryLabel}
              <kbd style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5, padding: '1px 5px', borderRadius: 3,
                background: 'rgba(255,255,255,0.15)',
                color: canSave ? 'rgba(255,255,255,0.85)' : 'var(--text-faint)',
              }}>{isWizardStep ? '↵' : '⌘↵'}</kbd>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const inputStyleObj: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: 'rgba(140,170,230,0.05)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', fontSize: 12.5,
  outline: 'none', transition: 'border-color 150ms, background 150ms, box-shadow 150ms',
};

const sideBtnStyle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-muted)',
  background: 'rgba(140,170,230,0.05)',
  border: '1px solid var(--border-subtle)',
  cursor: 'pointer', transition: 'color 120ms, background 120ms',
};

const sectionColStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };

const sectionMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.18 },
};

const swapMotion = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.14 },
};

function iconBtnStyle(color: string): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 8, display: 'flex',
    alignItems: 'center', justifyContent: 'center', color,
    background: 'transparent', border: '1px solid var(--border-subtle)',
    cursor: 'pointer', transition: 'background 120ms, color 120ms',
  };
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>;
}

function FieldLabel({ Icon, label }: { Icon: React.ComponentType<any> | null; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5,
      fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2,
      color: 'var(--text-muted)',
    }}>
      {Icon && <Icon size={11} />}
      {label}
    </div>
  );
}

function Field({
  label, Icon, children, flex,
}: {
  label: string;
  Icon: React.ComponentType<any> | null;
  children: React.ReactNode;
  flex?: number;
}) {
  return (
    <div style={{ flex, minWidth: 0 }}>
      <FieldLabel Icon={Icon} label={label} />
      {children}
    </div>
  );
}

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  list?: string;
  mono?: boolean;
  flex?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { value, onChange, placeholder, type = 'text', list, mono, flex }, ref
) {
  return (
    <input
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      list={list}
      style={{
        ...inputStyleObj,
        flex: flex ? 1 : undefined,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
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
});
