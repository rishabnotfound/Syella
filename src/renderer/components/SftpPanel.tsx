import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Folder, FileText, Download, Trash2, Upload, FolderPlus, FilePlus, ArrowLeft,
  RefreshCw, X, ChevronRight, Eye, EyeOff, Home, MoreVertical, Edit3,
} from 'lucide-react';
import { SyeSftpEntry } from '../../types';
import InputModal from './InputModal';

const PANEL_BG = 'rgba(10, 15, 26, 0.86)';
const CURVE_WIDTH = 90;

export interface SftpState { path: string; back: string[]; }

interface Props {
  tabId: string;
  visible: boolean;
  onClose: () => void;
  onOpenFile?: (path: string, size: number) => void;
  state?: SftpState;
  onStateChange: (next: SftpState) => void;
  width?: number;
}

const EASE = [0.76, 0, 0.24, 1] as [number, number, number, number];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function join(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`;
}

function Curve({ height }: { height: number }) {
  const initialPath = `M${CURVE_WIDTH} 0 L${CURVE_WIDTH * 2} 0 L${CURVE_WIDTH * 2} ${height} L${CURVE_WIDTH} ${height} Q${-CURVE_WIDTH} ${height / 2} ${CURVE_WIDTH} 0`;
  const targetPath = `M${CURVE_WIDTH} 0 L${CURVE_WIDTH * 2} 0 L${CURVE_WIDTH * 2} ${height} L${CURVE_WIDTH} ${height} Q${CURVE_WIDTH} ${height / 2} ${CURVE_WIDTH} 0`;
  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: -CURVE_WIDTH, height: '100%', width: CURVE_WIDTH,
        pointerEvents: 'none', zIndex: 0,
      }}
      preserveAspectRatio="none"
      viewBox={`${CURVE_WIDTH} 0 ${CURVE_WIDTH} ${height}`}>
      <motion.path
        initial={{ d: initialPath }}
        animate={{ d: targetPath, transition: { duration: 0.9, ease: EASE } }}
        exit={{ d: initialPath, transition: { duration: 0.7, ease: EASE } }}
        fill={PANEL_BG} />
    </svg>
  );
}

function Breadcrumbs({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = useMemo(() => {
    const segs = path.split('/').filter(Boolean);
    const crumbs: { label: string; full: string }[] = [{ label: '/', full: '/' }];
    let acc = '';
    for (const s of segs) { acc += '/' + s; crumbs.push({ label: s, full: acc }); }
    return crumbs;
  }, [path]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, padding: '6px 12px', flexWrap: 'nowrap',
      overflowX: 'auto', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)',
    }}>
      {parts.map((c, i) => (
        <React.Fragment key={c.full}>
          {i > 0 && <ChevronRight size={10} color="var(--text-faint)" />}
          <button onClick={() => onNavigate(c.full)}
            style={{
              padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)',
              color: i === parts.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)',
              background: i === parts.length - 1 ? 'rgba(90,162,255,0.08)' : 'transparent',
              transition: 'background 120ms, color 120ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90,162,255,0.14)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => {
              e.currentTarget.style.background = i === parts.length - 1 ? 'rgba(90,162,255,0.08)' : 'transparent';
              e.currentTarget.style.color = i === parts.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)';
            }}>
            {i === 0 ? <Home size={10} style={{ display: 'inline', marginRight: 2, verticalAlign: -1 }} /> : null}
            {i === 0 ? 'root' : c.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function IconBtn({ Icon, title, onClick, danger, primary, disabled }: {
  Icon: React.ComponentType<any>; title: string; onClick: () => void;
  danger?: boolean; primary?: boolean; disabled?: boolean;
}) {
  const color = disabled ? 'var(--text-faint)' : danger ? 'var(--danger)' : primary ? 'var(--accent-light)' : 'var(--text-muted)';
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.06 }} whileTap={disabled ? {} : { scale: 0.92 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 7, color, background: 'transparent',
        border: '1px solid var(--border-subtle)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 120ms, border-color 120ms, opacity 150ms',
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.background = danger ? 'rgba(248,113,113,0.12)' : 'rgba(90,162,255,0.1)';
        e.currentTarget.style.borderColor = danger ? 'rgba(248,113,113,0.3)' : 'rgba(90,162,255,0.28)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}>
      <Icon size={13} />
    </motion.button>
  );
}

function RowMenu({ x, y, entry, onClose, onRename, onDownload, onDelete }: {
  x: number; y: number; entry: SyeSftpEntry; onClose: () => void;
  onRename: () => void; onDownload: () => void; onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', esc); };
  }, [onClose]);

  const items = [
    { Icon: Edit3, label: 'Rename', action: onRename },
    ...(entry.type === 'file' ? [{ Icon: Download, label: 'Download', action: onDownload }] : []),
    { Icon: Trash2, label: 'Delete', action: onDelete, danger: true },
  ];

  // Clamp to viewport
  const width = 160;
  const height = items.length * 32 + 8;
  const clampedX = Math.min(x, window.innerWidth - width - 8);
  const clampedY = Math.min(y, window.innerHeight - height - 8);

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="glass-strong"
      style={{
        position: 'fixed', left: clampedX, top: clampedY, zIndex: 800, minWidth: width,
        borderRadius: 10, padding: 4,
      }}>
      {items.map(item => {
        const Icon = item.Icon;
        return (
          <div key={item.label}
            onClick={() => { item.action(); onClose(); }}
            style={{
              padding: '7px 10px', fontSize: 12, cursor: 'pointer',
              borderRadius: 6, transition: 'background 100ms, color 100ms',
              color: item.danger ? 'var(--danger)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 9,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = item.danger ? 'rgba(248,113,113,0.08)' : 'var(--bg-hover)';
              e.currentTarget.style.color = item.danger ? '#fca5a5' : 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = item.danger ? 'var(--danger)' : 'var(--text-secondary)';
            }}>
            <Icon size={12} />
            {item.label}
          </div>
        );
      })}
    </motion.div>,
    document.body
  );
}

export default function SftpPanel({ tabId, visible, onClose, onOpenFile, state, onStateChange, width = 400 }: Props) {
  const path = state?.path || '';
  const back = state?.back || [];
  const [entries, setEntries] = useState<SyeSftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [rowMenu, setRowMenu] = useState<{ entry: SyeSftpEntry; x: number; y: number } | null>(null);
  const [mkModal, setMkModal] = useState<{ kind: 'folder' | 'file' } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(800);
  const initRef = useRef<Set<string>>(new Set());
  const activeLoadRef = useRef<string | null>(null);
  const dragCounterRef = useRef(0);

  const loadDir = useCallback(async (dir: string) => {
    if (!dir) return;
    activeLoadRef.current = dir;
    setLoading(true);
    setError(null);
    try {
      const list = await window.syella.invoke('sftp:list', tabId, dir);
      if (activeLoadRef.current !== dir) return;
      const sorted = (list as SyeSftpEntry[]).sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
    } catch (e: any) {
      if (activeLoadRef.current === dir) setError(e.message || 'Failed to list directory');
    }
    if (activeLoadRef.current === dir) setLoading(false);
  }, [tabId]);

  useEffect(() => {
    if (!visible) return;
    if (state?.path) { loadDir(state.path); return; }
    if (initRef.current.has(tabId)) return;
    initRef.current.add(tabId);
    (async () => {
      let start = '/';
      try {
        const home = await window.syella.invoke('sftp:home', tabId) as string;
        if (home && home.startsWith('/')) start = home;
      } catch {}
      onStateChange({ path: start, back: [] });
    })();
  }, [visible, tabId, state?.path, loadDir, onStateChange]);

  useEffect(() => {
    if (visible && path) loadDir(path);
  }, [path, visible, loadDir]);

  useEffect(() => {
    if (!visible) return;
    const measure = () => {
      const h = containerRef.current?.parentElement?.getBoundingClientRect().height;
      if (h) setContainerHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current?.parentElement) ro.observe(containerRef.current.parentElement);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); ro.disconnect(); };
  }, [visible]);

  const navigate = (dir: string) => {
    if (!path || dir === path) return;
    onStateChange({ path: dir, back: [...back, path].slice(-50) });
  };

  const goBack = () => {
    if (!back.length) return;
    const prev = back[back.length - 1];
    onStateChange({ path: prev, back: back.slice(0, -1) });
  };

  const jumpTo = (dir: string) => {
    if (dir === path) return;
    onStateChange({ path: dir, back: path ? [...back, path].slice(-50) : back });
  };

  const handleClick = (entry: SyeSftpEntry) => {
    const full = join(path, entry.name);
    if (entry.type === 'directory') navigate(full);
    else if (entry.type === 'file') onOpenFile?.(full, entry.size);
  };

  const handleDelete = async (entry: SyeSftpEntry) => {
    const full = join(path, entry.name);
    try {
      await window.syella.invoke('sftp:delete', tabId, full, entry.type === 'directory');
      loadDir(path);
    } catch (e: any) { setError(e.message || 'Delete failed'); }
  };

  const handleDownload = async (entry: SyeSftpEntry) => {
    const full = join(path, entry.name);
    const localPath = await window.syella.invoke('dialog:saveFile', { defaultPath: entry.name });
    if (localPath) await window.syella.invoke('sftp:download', tabId, full, localPath, crypto.randomUUID());
  };

  const uploadLocalPaths = useCallback(async (paths: string[]) => {
    for (const f of paths) {
      const name = f.split(/[\\/]/).pop();
      if (!name) continue;
      const remote = join(path, name);
      try {
        await window.syella.invoke('sftp:upload', tabId, f, remote, crypto.randomUUID());
      } catch (e: any) {
        setError(e.message || `Upload failed: ${name}`);
      }
    }
    loadDir(path);
  }, [tabId, path, loadDir]);

  const handleUpload = async () => {
    const files = await window.syella.invoke('dialog:openFile', { properties: ['openFile', 'multiSelections'] });
    if (!files) return;
    uploadLocalPaths(files as string[]);
  };

  const handleMkdirConfirm = async (name: string) => {
    setMkModal(null);
    try {
      await window.syella.invoke('sftp:mkdir', tabId, join(path, name));
      loadDir(path);
    } catch (e: any) { setError(e.message || 'Could not create folder'); }
  };

  const handleNewFileConfirm = async (name: string) => {
    setMkModal(null);
    try {
      await window.syella.invoke('sftp:writeFile', tabId, join(path, name), '');
      loadDir(path);
    } catch (e: any) { setError(e.message || 'Could not create file'); }
  };

  const startRename = (entry: SyeSftpEntry) => {
    setRenaming(entry.name);
    setRenameValue(entry.name);
  };

  const commitRename = async (originalName: string) => {
    const next = renameValue.trim();
    setRenaming(null);
    if (!next || next === originalName) return;
    try {
      await window.syella.invoke('sftp:rename', tabId, join(path, originalName), join(path, next));
      loadDir(path);
    } catch (e: any) { setError(e.message || 'Rename failed'); }
  };

  const cancelRename = () => setRenaming(null);

  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setDragOver(false); }
  };
  const onDragOverEvt = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragOver(false);
    const list = e.dataTransfer?.files;
    if (!list || !list.length) return;
    const paths: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i);
      if (!f) continue;
      const p = (f as any).path || window.syella.getPathForFile?.(f);
      if (p) paths.push(p);
    }
    if (paths.length) uploadLocalPaths(paths);
    else setError('Could not read dropped file path.');
  };

  const openRowMenu = (e: React.MouseEvent, entry: SyeSftpEntry) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setRowMenu({ entry, x: rect.right + 4, y: rect.top });
  };

  const visibleEntries = useMemo(
    () => showHidden ? entries : entries.filter(e => !e.name.startsWith('.')),
    [entries, showHidden]
  );

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            ref={containerRef}
            initial={{ x: width + CURVE_WIDTH + 20 }}
            animate={{ x: 0, transition: { duration: 0.85, ease: EASE } }}
            exit={{ x: width + CURVE_WIDTH + 20, transition: { duration: 0.7, ease: EASE } }}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOverEvt}
            onDrop={onDrop}
            style={{
              position: 'absolute', top: 0, right: 0, height: '100%',
              width, zIndex: 12,
              background: PANEL_BG,
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              borderLeft: '1px solid var(--border-subtle)',
              willChange: 'transform',
            }}>
            <Curve height={containerHeight} />

            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'linear-gradient(180deg, rgba(15,21,36,0.6), rgba(10,15,26,0.2))',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent-gradient-soft)',
                  border: '1px solid var(--border-medium)',
                }}>
                  <Folder size={14} color="var(--accent-light)" fill="rgba(90,162,255,0.18)" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 0.4 }}>Files</span>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{visibleEntries.length} items</span>
                </div>
                <div style={{ flex: 1 }} />
                <IconBtn Icon={showHidden ? EyeOff : Eye} title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
                  onClick={() => setShowHidden(v => !v)} />
                <IconBtn Icon={X} title="Close" onClick={onClose} danger />
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <IconBtn Icon={ArrowLeft} title="Back" onClick={goBack} disabled={!back.length} />
                <IconBtn Icon={RefreshCw} title="Refresh" onClick={() => loadDir(path)} />
                <div style={{ flex: 1 }} />
                <IconBtn Icon={FilePlus} title="New file" onClick={() => setMkModal({ kind: 'file' })} />
                <IconBtn Icon={FolderPlus} title="New folder" onClick={() => setMkModal({ kind: 'folder' })} />
                <IconBtn Icon={Upload} title="Upload files" onClick={handleUpload} primary />
              </div>

              <Breadcrumbs path={path || '/'} onNavigate={jumpTo} />

              {error && (
                <div style={{
                  padding: '8px 12px', color: 'var(--danger)', fontSize: 11,
                  background: 'rgba(248,113,113,0.06)', borderBottom: '1px solid rgba(248,113,113,0.15)',
                }}>{error}</div>
              )}

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 70px 100px 28px', gap: 8,
                padding: '6px 12px', fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase',
                color: 'var(--text-faint)', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <span>Name</span>
                <span style={{ textAlign: 'right' }}>Size</span>
                <span>Modified</span>
                <span></span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', position: 'relative' }}>
                {loading && (
                  <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                    Loading…
                  </div>
                )}
                {!loading && visibleEntries.length === 0 && (
                  <div style={{ padding: 24, color: 'var(--text-faint)', fontSize: 12, textAlign: 'center' }}>
                    Empty directory
                  </div>
                )}
                {!loading && (
                  <AnimatePresence initial={false}>
                    {visibleEntries.map((entry, idx) => {
                      const isRenaming = renaming === entry.name;
                      return (
                        <motion.div key={entry.name}
                          layout
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ delay: Math.min(idx * 0.008, 0.15), duration: 0.18 }}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr 70px 100px 28px', gap: 8,
                            padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                            alignItems: 'center', position: 'relative',
                            transition: 'background 120ms',
                          }}
                          onClick={() => { if (!isRenaming) handleClick(entry); }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(140,170,230,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0 }}>
                            {entry.type === 'directory'
                              ? <Folder size={13} color="var(--accent-light)" fill="rgba(90,162,255,0.2)" style={{ flexShrink: 0 }} />
                              : <FileText size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                            {isRenaming ? (
                              <motion.input
                                initial={{ opacity: 0, scaleX: 0.96 }}
                                animate={{ opacity: 1, scaleX: 1 }}
                                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitRename(entry.name); }
                                  else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                                }}
                                onBlur={() => commitRename(entry.name)}
                                style={{
                                  flex: 1, minWidth: 0,
                                  fontSize: 12, color: 'var(--text-primary)',
                                  background: 'rgba(90,162,255,0.08)',
                                  border: '1px solid rgba(90,162,255,0.35)',
                                  borderRadius: 4, padding: '2px 6px',
                                  transformOrigin: 'left center',
                                }} />
                            ) : (
                              <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                color: entry.name.startsWith('.') ? 'var(--text-faint)' : 'var(--text-secondary)',
                              }}>
                                {entry.name}
                              </span>
                            )}
                          </div>
                          <span style={{ color: 'var(--text-muted)', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                            {entry.type === 'file' ? formatSize(entry.size) : ''}
                          </span>
                          <span style={{ color: 'var(--text-faint)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formatDate(entry.modifyTime)}
                          </span>
                          <motion.button
                            whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                            onClick={(e) => openRowMenu(e, entry)}
                            style={{
                              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: 5, color: 'var(--text-muted)',
                              transition: 'background 100ms, color 100ms',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--accent-light)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                            <MoreVertical size={12} />
                          </motion.button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}

                <AnimatePresence>
                  {dragOver && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute', inset: 6, borderRadius: 12,
                        border: '2px dashed rgba(90,162,255,0.55)',
                        background: 'rgba(90,162,255,0.08)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 10, pointerEvents: 'none',
                        backdropFilter: 'blur(4px)',
                      }}>
                      <Upload size={26} color="var(--accent-light)" />
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-light)' }}>Drop to upload</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{path}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rowMenu && (
          <RowMenu
            x={rowMenu.x} y={rowMenu.y} entry={rowMenu.entry}
            onClose={() => setRowMenu(null)}
            onRename={() => startRename(rowMenu.entry)}
            onDownload={() => handleDownload(rowMenu.entry)}
            onDelete={() => handleDelete(rowMenu.entry)}
          />
        )}
      </AnimatePresence>

      <InputModal
        visible={mkModal?.kind === 'folder'}
        title="New folder"
        placeholder="folder name"
        confirmLabel="Create folder"
        onConfirm={handleMkdirConfirm}
        onCancel={() => setMkModal(null)}
      />
      <InputModal
        visible={mkModal?.kind === 'file'}
        title="New file"
        placeholder="filename.ext"
        confirmLabel="Create file"
        onConfirm={handleNewFileConfirm}
        onCancel={() => setMkModal(null)}
      />
    </>
  );
}
