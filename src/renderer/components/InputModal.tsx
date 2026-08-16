import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function InputModal({
  visible, title, placeholder, initialValue = '', confirmLabel = 'Create', onConfirm, onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [visible, initialValue]);

  useEffect(() => {
    if (!visible) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [visible, onCancel]);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onConfirm(v);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
          style={{
            position: 'fixed', inset: 0, zIndex: 600,
            background: 'rgba(2,5,12,0.55)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={e => e.stopPropagation()}
            className="glass-strong"
            style={{
              width: 380, borderRadius: 14, padding: 18,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 0.3 }}>
                {title}
              </div>
              <motion.button whileTap={{ scale: 0.92 }}
                onClick={onCancel}
                style={{
                  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 5, color: 'var(--text-muted)',
                }}>
                <X size={12} />
              </motion.button>
            </div>
            <input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder={placeholder}
              style={{
                padding: '9px 12px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                background: 'rgba(140,170,230,0.06)',
                border: '1px solid var(--border-medium)',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={onCancel}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)',
                  background: 'transparent', border: '1px solid var(--border-subtle)',
                }}>
                Cancel
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={submit}
                disabled={!value.trim()}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  color: value.trim() ? '#fff' : 'var(--text-muted)',
                  background: value.trim() ? 'var(--accent-gradient)' : 'rgba(140,170,230,0.06)',
                  border: value.trim() ? '1px solid rgba(90,162,255,0.4)' : '1px solid var(--border-subtle)',
                  opacity: value.trim() ? 1 : 0.6,
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
