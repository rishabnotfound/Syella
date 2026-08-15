import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info' | 'warn';
interface ToastItem { id: string; kind: ToastKind; title: string; body?: string; }

interface ToastCtx {
  push: (t: Omit<ToastItem, 'id'>) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
  warn: (title: string, body?: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const KIND_META: Record<ToastKind, { color: string; Icon: React.ComponentType<any> }> = {
  success: { color: '#34d399', Icon: CheckCircle2 },
  error:   { color: '#f87171', Icon: XCircle },
  info:    { color: '#60a5fa', Icon: Info },
  warn:    { color: '#fbbf24', Icon: AlertTriangle },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) { clearTimeout(tm); timers.current.delete(id); }
  }, []);

  const push = useCallback<ToastCtx['push']>((t) => {
    const id = Math.random().toString(36).slice(2);
    setItems(prev => [...prev, { ...t, id }]);
    const tm = setTimeout(() => remove(id), 4200);
    timers.current.set(id, tm);
  }, [remove]);

  const value: ToastCtx = {
    push,
    success: (title, body) => push({ kind: 'success', title, body }),
    error:   (title, body) => push({ kind: 'error',   title, body }),
    info:    (title, body) => push({ kind: 'info',    title, body }),
    warn:    (title, body) => push({ kind: 'warn',    title, body }),
  };

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div style={{
        position: 'fixed', bottom: 44, right: 18, zIndex: 900,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
      }}>
        <AnimatePresence>
          {items.map(t => {
            const meta = KIND_META[t.kind];
            const Icon = meta.Icon;
            return (
              <motion.div key={t.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="glass-panel"
                style={{
                  pointerEvents: 'auto',
                  width: 320, borderRadius: 12,
                  padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10,
                  borderLeft: `2px solid ${meta.color}`,
                }}>
                <Icon size={16} color={meta.color} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</div>
                  {t.body && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{t.body}</div>}
                </div>
                <button onClick={() => remove(t.id)} style={{
                  color: 'var(--text-muted)', padding: 2, borderRadius: 4, display: 'flex',
                }}>
                  <X size={13} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
