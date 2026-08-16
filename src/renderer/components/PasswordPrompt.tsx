import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface Props {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  requireConfirm?: boolean;
  minLength?: number;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

// Electron's window.prompt() is disabled in packaged builds — returns null and
// silently kills every flow that used to depend on it. This is the modal we
// use instead for backup export / import passwords.
export default function PasswordPrompt({
  visible, title, description, confirmLabel, requireConfirm, minLength = 4,
  onSubmit, onCancel,
}: Props) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setPw(''); setConfirm(''); setShow(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [visible]);

  const mismatch = requireConfirm && confirm.length > 0 && pw !== confirm;
  const tooShort = pw.length > 0 && pw.length < minLength;
  const canSubmit =
    pw.length >= minLength && (!requireConfirm || (confirm.length >= minLength && pw === confirm));

  const submit = () => { if (canSubmit) onSubmit(pw); };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onCancel}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(2,5,12,0.62)',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={e => e.stopPropagation()}
            className="glass-strong"
            style={{
              width: 420, maxWidth: '92vw', borderRadius: 16, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'linear-gradient(180deg, rgba(15,21,36,0.55), rgba(10,15,26,0.15))',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-gradient-soft)',
                border: '1px solid var(--border-medium)',
              }}>
                {requireConfirm ? <ShieldCheck size={16} color="var(--accent-light)" /> : <Lock size={16} color="var(--accent-light)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {title}
                </div>
                {description && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                    {description}
                  </div>
                )}
              </div>
              <motion.button
 whileTap={{ scale: 0.9 }}
                onClick={onCancel} title="Cancel (Esc)"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                }}>
                <X size={13} />
              </motion.button>
            </div>

            <div style={{ padding: '16px 18px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2,
                  color: 'var(--text-muted)', marginBottom: 6,
                }}>Password</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    ref={inputRef}
                    type={show ? 'text' : 'password'}
                    value={pw}
                    onChange={e => setPw(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); submit(); }
                      else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                    }}
                    placeholder="•••••••••"
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 8,
                      background: 'rgba(140,170,230,0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)', fontSize: 12.5,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => setShow(v => !v)}
                    title={show ? 'Hide' : 'Show'}
                    style={{
                      width: 34, height: 34, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', background: 'rgba(140,170,230,0.05)',
                      border: '1px solid var(--border-subtle)',
                    }}>
                    {show ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                {tooShort && (
                  <div style={{ fontSize: 10.5, color: 'var(--warning)', marginTop: 5 }}>
                    Must be at least {minLength} characters
                  </div>
                )}
              </div>

              {requireConfirm && (
                <div>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2,
                    color: 'var(--text-muted)', marginBottom: 6,
                  }}>Confirm password</div>
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); submit(); }
                      else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                    }}
                    placeholder="•••••••••"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      background: 'rgba(140,170,230,0.05)',
                      border: `1px solid ${mismatch ? 'rgba(248,113,113,0.4)' : 'var(--border-subtle)'}`,
                      color: 'var(--text-primary)', fontSize: 12.5,
                      outline: 'none',
                    }}
                  />
                  {mismatch && (
                    <div style={{ fontSize: 10.5, color: 'var(--danger)', marginTop: 5 }}>
                      Passwords don't match
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{
              padding: '10px 16px 14px', display: 'flex', gap: 8, justifyContent: 'flex-end',
            }}>
              <motion.button
 whileTap={{ scale: 0.97 }}
                onClick={onCancel}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}>
                Cancel
              </motion.button>
              <motion.button

                whileTap={canSubmit ? { scale: 0.97 } : {}}
                onClick={submit}
                disabled={!canSubmit}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: canSubmit ? 'var(--accent-gradient)' : 'rgba(140,170,230,0.06)',
                  color: canSubmit ? '#fff' : 'var(--text-muted)',
                  border: canSubmit ? '1px solid rgba(90,162,255,0.4)' : '1px solid var(--border-subtle)',
                  cursor: canSubmit ? 'pointer' : 'default',
                  opacity: canSubmit ? 1 : 0.6,
                  boxShadow: canSubmit ? '0 6px 22px rgba(90,162,255,0.28)' : 'none',
                }}>
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
