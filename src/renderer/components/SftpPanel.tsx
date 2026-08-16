import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Folder, FileText, Download, Trash2, Upload, FolderPlus, FilePlus, ArrowLeft,
  RefreshCw, X, ChevronRight, Eye, EyeOff, Home, MoreVertical, Edit3, FolderUp, CheckCircle2, AlertCircle,
  Loader2,
} from 'lucide-react';
import { SyeSftpEntry } from '../../types';
import InputModal from './InputModal';
import { registerUpload, useTabUploads, dismissUpload } from '../uploadStore';
import type { UploadState } from '../uploadStore';

const PANEL_BG = 'rgba(10, 15, 26, 0.96)';
// Soft gradient mask that fades from transparent (over the terminal) into the
// panel edge. Replaces the old opaque SVG "curve" that painted a big dark bar
// over the terminal — that looked like a broken layout, not decoration.
const EDGE_MASK_WIDTH = 28;

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

function Loader2Spin() {
  return <Loader2 size={22} color="var(--danger)" className="spin" />;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.ceil(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.ceil(sec % 60)}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function join(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`;
}

function EdgeMask() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', top: 0, left: -EDGE_MASK_WIDTH, height: '100%', width: EDGE_MASK_WIDTH,
        pointerEvents: 'none', zIndex: 0,
        background: 'linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.35))',
      }}
    />
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
 whileTap={disabled ? {} : { scale: 0.92 }}
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
  const initRef = useRef<Set<string>>(new Set());
  const activeLoadRef = useRef<string | null>(null);
  const dragCounterRef = useRef(0);
  const uploads = useTabUploads(tabId);

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

  const [deleting, setDeleting] = useState<{ name: string; removed: number; currentPath: string } | null>(null);

  useEffect(() => {
    const off = window.syella.on('sftp:deleteProgress', (p: any) => {
      if (!p || p.tabId !== tabId) return;
      if (p.done) { setDeleting(null); return; }
      setDeleting(prev => prev ? { ...prev, removed: p.removed || 0, currentPath: p.path || prev.currentPath } : prev);
    });
    return () => { off(); };
  }, [tabId]);

  const handleDelete = async (entry: SyeSftpEntry) => {
    const full = join(path, entry.name);
    const opId = crypto.randomUUID();
    if (entry.type === 'directory') {
      setDeleting({ name: entry.name, removed: 0, currentPath: full });
    }
    try {
      await window.syella.invoke('sftp:delete', tabId, full, entry.type === 'directory', opId);
      loadDir(path);
    } catch (e: any) { setError(e.message || 'Delete failed'); }
    finally { setDeleting(null); }
  };

  const handleDownload = async (entry: SyeSftpEntry) => {
    const full = join(path, entry.name);
    const localPath = await window.syella.invoke('dialog:saveFile', { defaultPath: entry.name });
    if (localPath) await window.syella.invoke('sftp:download', tabId, full, localPath, crypto.randomUUID());
  };

  const uploadLocalPaths = useCallback(async (paths: string[]) => {
    if (!paths.length || !path) return;
    const batchId = crypto.randomUUID();
    registerUpload(tabId, batchId);
    try {
      await window.syella.invoke('sftp:uploadPaths', tabId, path, paths, batchId);
    } catch {
      // Errors are already broadcast via transfer:error IPC to the store.
    }
    loadDir(path);
  }, [tabId, path, loadDir]);

  const handleCancelUpload = useCallback((batchId: string) => {
    window.syella.invoke('sftp:cancelUpload', batchId);
  }, []);

  const handleUpload = async () => {
    // multiSelections + treatPackageAsDirectory lets us pick many files at
    // once. For folders users should drag-drop (macOS file picker can't do
    // both files and folders in one dialog).
    const files = await window.syella.invoke('dialog:openFile', {
      properties: ['openFile', 'multiSelections'],
    });
    if (!files) return;
    uploadLocalPaths(files as string[]);
  };

  const handleUploadFolder = async () => {
    const dir = await window.syella.invoke('dialog:openDirectory');
    if (!dir) return;
    uploadLocalPaths([dir as string]);
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
    // Iterate items rather than .files so directories are included — Chromium
    // omits folders from dataTransfer.files, but items[i].getAsFile() returns
    // a File for both, and Electron's webUtils.getPathForFile gives us the
    // absolute disk path either way. Main process handles the recursion.
    const items = e.dataTransfer?.items;
    const paths: string[] = [];
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind !== 'file') continue;
        const f = it.getAsFile();
        if (!f) continue;
        const p = (f as any).path || window.syella.getPathForFile?.(f);
        if (p) paths.push(p);
      }
    }
    if (paths.length) uploadLocalPaths(paths);
    else setError('Could not read dropped item paths.');
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

  // A single aggregate is easier to reason about than N per-batch bars — the
  // overlay is a modal "you're busy" indicator, not a transfer manager. If the
  // user kicks off multiple drops we still show one blocking screen with
  // combined counters, and it clears as soon as everything is done.
  const uploadEntries = Object.entries(uploads);
  const activeUploads = uploadEntries.filter(([, u]) => !u.done);
  const hasActiveUpload = activeUploads.length > 0;
  const uploadAggregate = useMemo(() => {
    if (!uploadEntries.length) return null;
    let totalFiles = 0, doneFiles = 0, transferred = 0;
    let currentName = '';
    let errored = false, cancelled = false;
    for (const [, u] of uploadEntries) {
      totalFiles += u.totalFiles || 0;
      doneFiles += u.doneFiles || 0;
      transferred += u.transferred || 0;
      if (!currentName && u.currentName && !u.done) currentName = u.currentName;
      if (u.error) errored = true;
      if (u.cancelled) cancelled = true;
    }
    const allDone = uploadEntries.every(([, u]) => u.done);
    return { totalFiles, doneFiles, transferred, currentName, errored, cancelled, allDone };
  }, [uploadEntries]);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            ref={containerRef}
            initial={{ x: width + 20 }}
            animate={{ x: 0, transition: { duration: 0.55, ease: EASE } }}
            exit={{ x: width + 20, transition: { duration: 0.45, ease: EASE } }}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOverEvt}
            onDrop={onDrop}
            style={{
              position: 'absolute', top: 0, right: 0, height: '100%',
              width, zIndex: 12,
              background: PANEL_BG,
              borderLeft: '1px solid var(--border-subtle)',
              willChange: 'transform',
            }}>
            <EdgeMask />

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
                <IconBtn Icon={FolderUp} title="Upload folder" onClick={handleUploadFolder} />
                <IconBtn Icon={Upload} title="Upload files (or drag & drop)" onClick={handleUpload} primary />
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
 whileTap={{ scale: 0.9 }}
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
                  {deleting && (
                    <motion.div
                      key="deleting"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute', inset: 6, borderRadius: 12,
                        border: '1px solid rgba(248,113,113,0.35)',
                        background: 'rgba(20, 8, 12, 0.85)',
                        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 10, padding: 20, textAlign: 'center',
                      }}>
                      <Loader2Spin />
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
                        Deleting {deleting.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {deleting.removed} item{deleting.removed === 1 ? '' : 's'} removed
                      </div>
                      <div style={{
                        fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)',
                        maxWidth: '92%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {deleting.currentPath}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                      }}>
                      <Upload size={26} color="var(--accent-light)" />
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-light)' }}>Drop to upload</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{path}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {uploadAggregate && (
                <motion.div
                  key="upload-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    position: 'absolute', inset: 0, zIndex: 20,
                    background: 'rgba(8, 12, 22, 0.92)',
                    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 18, padding: 24, textAlign: 'center',
                  }}>
                  {uploadAggregate.errored ? (
                    <AlertCircle size={30} color="var(--danger)" />
                  ) : uploadAggregate.cancelled && uploadAggregate.allDone ? (
                    <AlertCircle size={30} color="var(--danger)" />
                  ) : uploadAggregate.allDone ? (
                    <CheckCircle2 size={30} color="var(--success)" />
                  ) : (
                    <Loader2 size={30} color="var(--accent-light)" className="spin" />
                  )}

                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: uploadAggregate.errored ? 'var(--danger)'
                      : uploadAggregate.allDone && uploadAggregate.cancelled ? 'var(--danger)'
                      : uploadAggregate.allDone ? 'var(--success)'
                      : 'var(--text-primary)',
                    letterSpacing: 0.3,
                  }}>
                    {uploadAggregate.errored ? 'Upload failed'
                      : uploadAggregate.allDone && uploadAggregate.cancelled ? 'Upload cancelled'
                      : uploadAggregate.allDone ? 'Upload complete'
                      : 'Uploading…'}
                  </div>

                  {!uploadAggregate.allDone && uploadAggregate.currentName && (
                    <div style={{
                      fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                      maxWidth: '88%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {uploadAggregate.currentName}
                    </div>
                  )}

                  <div style={{
                    position: 'relative', width: '78%', height: 5, borderRadius: 3, overflow: 'hidden',
                    background: uploadAggregate.errored || (uploadAggregate.cancelled && uploadAggregate.allDone)
                      ? 'rgba(248,113,113,0.14)'
                      : uploadAggregate.allDone ? 'rgba(52,211,153,0.14)'
                      : 'rgba(90,162,255,0.12)',
                  }}>
                    {uploadAggregate.allDone ? (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: uploadAggregate.errored || uploadAggregate.cancelled
                          ? 'var(--danger)' : 'var(--success)',
                      }} />
                    ) : (
                      <div className="march" style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0, width: '40%',
                        background: 'linear-gradient(90deg, transparent, var(--accent-light), transparent)',
                        willChange: 'transform',
                      }} />
                    )}
                  </div>

                  <div style={{
                    display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-faint)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {uploadAggregate.totalFiles > 0 && (
                      <span>{uploadAggregate.doneFiles}/{uploadAggregate.totalFiles} files</span>
                    )}
                    {uploadAggregate.transferred > 0 && (
                      <span>{formatSize(uploadAggregate.transferred)} moved</span>
                    )}
                  </div>

                  {hasActiveUpload && (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => activeUploads.forEach(([id]) => handleCancelUpload(id))}
                      style={{
                        marginTop: 4, padding: '7px 16px', fontSize: 11.5, fontWeight: 500,
                        color: 'var(--danger)', background: 'rgba(248,113,113,0.08)',
                        border: '1px solid rgba(248,113,113,0.3)', borderRadius: 7,
                        cursor: 'pointer', letterSpacing: 0.3,
                        transition: 'background 120ms, border-color 120ms',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(248,113,113,0.18)';
                        e.currentTarget.style.borderColor = 'rgba(248,113,113,0.5)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(248,113,113,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)';
                      }}>
                      Cancel upload
                    </motion.button>
                  )}

                  {uploadAggregate.allDone && (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => uploadEntries.forEach(([id]) => dismissUpload(tabId, id))}
                      style={{
                        marginTop: 4, padding: '7px 16px', fontSize: 11.5, fontWeight: 500,
                        color: 'var(--text-secondary)', background: 'transparent',
                        border: '1px solid var(--border-subtle)', borderRadius: 7,
                        cursor: 'pointer', letterSpacing: 0.3,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      Dismiss
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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

// The upload UI intentionally does NOT rely on a byte-percentage bar. That
// was the source of the "progress stuck at 0%" bug — throttled IPC could
// deliver the first payload late while the transfer already finished, leaving
// the width at 0. Instead we show a marching bar that's always animating while
// active, plus whatever coarse counters we do have (files done, bytes moved).
// The user sees liveness even in the worst-case IPC delivery scenario.
function UploadRow({ u, onCancel }: { u: UploadState; onCancel: () => void }) {
  const active = !u.done;
  const done = u.done && !u.error && !u.cancelled;
  const label = u.cancelled ? 'Upload cancelled'
    : u.error ? u.error
    : done
      ? `Uploaded${u.totalFiles ? ` ${u.totalFiles} file${u.totalFiles === 1 ? '' : 's'}` : ''}`
      : (u.currentName || 'Preparing upload…');
  const trackBg = done ? 'rgba(52,211,153,0.14)' : (u.error || u.cancelled) ? 'rgba(248,113,113,0.14)' : 'rgba(90,162,255,0.10)';
  const barColor = done ? 'var(--success)' : (u.error || u.cancelled) ? 'var(--danger)' : 'var(--accent-light)';

  const parts: string[] = [];
  if (u.totalFiles > 1) parts.push(`${u.doneFiles}/${u.totalFiles} files`);
  if (u.transferred > 0) parts.push(`${formatSize(u.transferred)} moved`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
        {u.error || u.cancelled ? <AlertCircle size={12} color="var(--danger)" />
          : done ? <CheckCircle2 size={12} color="var(--success)" />
          : <Upload size={12} color="var(--accent-light)" />}
        <span style={{
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: (u.error || u.cancelled) ? 'var(--danger)' : 'var(--text-secondary)',
          fontWeight: 500,
        }}>
          {label}
        </span>
        {active && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onCancel}
            title="Cancel upload"
            style={{
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 5, color: 'var(--text-muted)',
              background: 'transparent', border: '1px solid var(--border-subtle)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.14)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            <X size={11} />
          </motion.button>
        )}
      </div>

      <div style={{
        position: 'relative', height: 4, borderRadius: 2, overflow: 'hidden',
        background: trackBg,
      }}>
        {active ? (
          <div className="march" style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: '40%',
            background: `linear-gradient(90deg, transparent, ${barColor}, transparent)`,
            willChange: 'transform',
          }} />
        ) : (
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: '100%',
            background: barColor,
          }} />
        )}
      </div>

      {parts.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, fontSize: 10.5, color: 'var(--text-faint)',
          fontFamily: 'var(--font-mono)',
        }}>
          {parts.map((p, i) => <span key={i}>{p}</span>)}
        </div>
      )}
    </div>
  );
}
