import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Editor, { loader } from '@monaco-editor/react';
// @ts-ignore — monaco's package.json exports map hides subpath from TS but webpack resolves it
import * as monaco from 'monaco-editor/editor/editor.api.js';
import {
  X, Save, RotateCcw, FileText, Image as ImageIcon, Film, Music, FileCode,
  Download, ZoomIn, ZoomOut, Loader2, AlertCircle,
} from 'lucide-react';

loader.config({ monaco });

const EDITABLE_MAX_BYTES = 4 * 1024 * 1024;
const MEDIA_MAX_BYTES = 60 * 1024 * 1024;

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'];
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'mkv', 'ogv', 'm4v'];
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'];

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon',
  avif: 'image/avif',
};
const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mkv: 'video/x-matroska', ogv: 'video/ogg', m4v: 'video/mp4',
};
const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
  m4a: 'audio/mp4', aac: 'audio/aac', opus: 'audio/ogg',
};

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', env: 'ini', cfg: 'ini', conf: 'ini',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', php: 'php', java: 'java',
  c: 'cpp', h: 'cpp', cpp: 'cpp', hpp: 'cpp', cc: 'cpp', cs: 'csharp',
  html: 'html', htm: 'html', xml: 'xml', css: 'css', scss: 'scss', less: 'scss',
  md: 'markdown', markdown: 'markdown',
  sql: 'sql',
  dockerfile: 'dockerfile',
};

type Kind = 'image' | 'video' | 'audio' | 'text' | 'binary';

function classify(name: string, size: number): { kind: Kind; ext: string; mime?: string; lang?: string } {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const baseName = name.toLowerCase();
  if (IMAGE_EXT.includes(ext)) return { kind: 'image', ext, mime: IMAGE_MIME[ext] };
  if (VIDEO_EXT.includes(ext)) return { kind: 'video', ext, mime: VIDEO_MIME[ext] };
  if (AUDIO_EXT.includes(ext)) return { kind: 'audio', ext, mime: AUDIO_MIME[ext] };
  if (baseName === 'dockerfile') return { kind: 'text', ext, lang: 'dockerfile' };
  if (baseName === 'makefile') return { kind: 'text', ext, lang: 'makefile' };
  if (LANG_MAP[ext]) return { kind: 'text', ext, lang: LANG_MAP[ext] };
  if (size > EDITABLE_MAX_BYTES) return { kind: 'binary', ext };
  return { kind: 'text', ext, lang: 'plaintext' };
}

function base64ToText(b64: string): string {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch { return ''; }
}

function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

interface Props {
  tabId: string | null;
  path: string | null;
  size: number;
  onClose: () => void;
  onSaved?: () => void;
  onNotify?: (kind: 'success' | 'error' | 'info', title: string, body?: string) => void;
}

export default function FileViewer({ tabId, path, size, onClose, onSaved, onNotify }: Props) {
  const open = !!(tabId && path);
  const name = path ? path.split('/').pop() || path : '';
  const meta = useMemo(() => open ? classify(name, size) : null, [name, size, open]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [originalText, setOriginalText] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [imgZoom, setImgZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const releaseUrl = () => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
  };

  useEffect(() => {
    if (!open || !meta) return;
    setError(null); setTextContent(''); setOriginalText(''); setMediaUrl(null); setImgZoom(1);
    releaseUrl();

    if (meta.kind === 'binary') return;

    if (meta.kind === 'image' && meta.mime === 'image/svg+xml') {
      // Treat SVG as text too, so it's editable
    }

    if ((meta.kind === 'image' || meta.kind === 'video' || meta.kind === 'audio') && size > MEDIA_MAX_BYTES) {
      setError(`File too large to preview (${formatSize(size)}). Download instead.`);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const res = await window.syella.invoke('sftp:readFile', tabId, path) as { data: string; size: number };
        if (meta.kind === 'text') {
          const t = base64ToText(res.data);
          setTextContent(t); setOriginalText(t);
        } else if (meta.kind === 'image' || meta.kind === 'video' || meta.kind === 'audio') {
          const bin = atob(res.data);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: meta.mime || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setMediaUrl(url);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to read file');
      } finally {
        setLoading(false);
      }
    })();

    return () => { releaseUrl(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, path, tabId]);

  useEffect(() => () => { releaseUrl(); }, []);

  const dirty = meta?.kind === 'text' && textContent !== originalText;

  const save = useCallback(async () => {
    if (!tabId || !path || meta?.kind !== 'text') return;
    setSaving(true);
    try {
      await window.syella.invoke('sftp:writeFile', tabId, path, textToBase64(textContent));
      setOriginalText(textContent);
      onNotify?.('success', 'Saved', name);
      onSaved?.();
    } catch (e: any) {
      onNotify?.('error', 'Save failed', e?.message || 'Unknown error');
    } finally { setSaving(false); }
  }, [tabId, path, meta, textContent, name, onNotify, onSaved]);

  const downloadLocally = useCallback(async () => {
    if (!tabId || !path) return;
    const localPath = await window.syella.invoke('dialog:saveFile', { defaultPath: name });
    if (!localPath) return;
    try {
      await window.syella.invoke('sftp:download', tabId, path, localPath, crypto.randomUUID());
      onNotify?.('success', 'Downloaded', name);
    } catch (e: any) {
      onNotify?.('error', 'Download failed', e?.message || 'Unknown error');
    }
  }, [tabId, path, name, onNotify]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, save, onClose]);

  const HeaderIcon = meta?.kind === 'image' ? ImageIcon
    : meta?.kind === 'video' ? Film
    : meta?.kind === 'audio' ? Music
    : meta?.kind === 'text' ? FileCode
    : FileText;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(2,5,12,0.72)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            onClick={e => e.stopPropagation()}
            className="glass-strong"
            style={{
              width: '92vw', maxWidth: 1200, height: '86vh', borderRadius: 16, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'linear-gradient(180deg, rgba(15,21,36,0.6), rgba(10,15,26,0.2))',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-gradient-soft)',
                border: '1px solid var(--border-medium)',
              }}>
                <HeaderIcon size={15} color="var(--accent-light)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                  {dirty && <span style={{ color: 'var(--warning)', marginLeft: 6, fontSize: 11 }}>●</span>}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {path} · {formatSize(size)} {meta?.lang && meta.kind === 'text' ? `· ${meta.lang}` : ''}
                </div>
              </div>

              {meta?.kind === 'image' && (
                <>
                  <IconAction Icon={ZoomOut} title="Zoom out" onClick={() => setImgZoom(z => Math.max(0.25, z - 0.25))} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 40, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    {Math.round(imgZoom * 100)}%
                  </div>
                  <IconAction Icon={ZoomIn} title="Zoom in" onClick={() => setImgZoom(z => Math.min(5, z + 0.25))} />
                </>
              )}

              <IconAction Icon={Download} title="Download" onClick={downloadLocally} />
              {meta?.kind === 'text' && (
                <>
                  <IconAction Icon={RotateCcw} title="Revert" onClick={() => setTextContent(originalText)} disabled={!dirty} />
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={save} disabled={!dirty || saving}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                      background: dirty ? 'var(--accent-gradient)' : 'rgba(140,170,230,0.06)',
                      color: dirty ? '#fff' : 'var(--text-muted)',
                      border: dirty ? '1px solid rgba(90,162,255,0.4)' : '1px solid var(--border-subtle)',
                      cursor: dirty && !saving ? 'pointer' : 'default',
                      opacity: saving ? 0.7 : 1,
                    }}>
                    {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                    {saving ? 'Saving' : 'Save'}
                    <kbd style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9.5, padding: '1px 5px', borderRadius: 3,
                      background: 'rgba(255,255,255,0.15)', color: dirty ? 'rgba(255,255,255,0.85)' : 'var(--text-faint)',
                    }}>⌘S</kbd>
                  </motion.button>
                </>
              )}
              <IconAction Icon={X} title="Close" onClick={onClose} danger />
            </div>

            <div style={{ flex: 1, position: 'relative', background: '#0a0f1a', overflow: 'hidden' }}>
              {loading && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)',
                }}>
                  <Loader2 size={22} className="spin" color="var(--accent-light)" />
                  <span style={{ fontSize: 12 }}>Reading file…</span>
                </div>
              )}

              {error && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--danger)',
                }}>
                  <AlertCircle size={22} />
                  <span style={{ fontSize: 12.5 }}>{error}</span>
                </div>
              )}

              {!loading && !error && meta?.kind === 'binary' && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)',
                  padding: 20, textAlign: 'center',
                }}>
                  <FileText size={30} color="var(--text-faint)" />
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Binary or oversized file</div>
                  <div style={{ fontSize: 11.5, maxWidth: 380 }}>
                    This file cannot be previewed inline. Download it to inspect locally.
                  </div>
                </div>
              )}

              {!loading && !error && meta?.kind === 'image' && mediaUrl && (
                <div style={{
                  position: 'absolute', inset: 0, overflow: 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundImage: 'linear-gradient(45deg, #12182600 25%, #0f1421 25%, #0f1421 50%, #12182600 50%, #12182600 75%, #0f1421 75%)',
                  backgroundSize: '20px 20px',
                }}>
                  <img src={mediaUrl} alt={name}
                    style={{
                      transform: `scale(${imgZoom})`, transformOrigin: 'center center',
                      transition: 'transform 180ms cubic-bezier(0.4,0,0.2,1)',
                      maxWidth: imgZoom <= 1 ? '100%' : 'none',
                      maxHeight: imgZoom <= 1 ? '100%' : 'none',
                      imageRendering: imgZoom > 2 ? 'pixelated' : 'auto',
                    }} />
                </div>
              )}

              {!loading && !error && meta?.kind === 'video' && mediaUrl && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
                }}>
                  <video src={mediaUrl} controls autoPlay
                    style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10, background: '#000' }} />
                </div>
              )}

              {!loading && !error && meta?.kind === 'audio' && mediaUrl && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24,
                }}>
                  <div style={{
                    width: 84, height: 84, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--accent-gradient-soft)', border: '1px solid var(--border-medium)',
                  }}>
                    <Music size={34} color="var(--accent-light)" />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{name}</div>
                  <audio src={mediaUrl} controls autoPlay style={{ width: 420, maxWidth: '90%' }} />
                </div>
              )}

              {!loading && !error && meta?.kind === 'text' && (
                <Editor
                  height="100%"
                  language={meta.lang}
                  value={textContent}
                  onChange={(v) => setTextContent(v ?? '')}
                  theme="vs-dark"
                  options={{
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    fontSize: 13,
                    lineHeight: 1.55,
                    minimap: { enabled: true, scale: 1, renderCharacters: false },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorSmoothCaretAnimation: 'on',
                    cursorBlinking: 'smooth',
                    renderLineHighlight: 'all',
                    padding: { top: 12, bottom: 12 },
                    tabSize: 2,
                    wordWrap: 'off',
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true, indentation: true },
                    fontLigatures: true,
                  }}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IconAction({ Icon, title, onClick, danger, disabled }: {
  Icon: React.ComponentType<any>; title: string; onClick: () => void;
  danger?: boolean; disabled?: boolean;
}) {
  return (
    <motion.button whileTap={disabled ? {} : { scale: 0.92 }}
      onClick={onClick} disabled={disabled} title={title}
      style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, color: disabled ? 'var(--text-faint)' : danger ? 'var(--text-muted)' : 'var(--text-muted)',
        background: 'transparent',
        border: '1px solid var(--border-subtle)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 120ms, color 120ms, border-color 120ms',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.background = danger ? 'rgba(248,113,113,0.12)' : 'rgba(90,162,255,0.1)';
        e.currentTarget.style.color = danger ? 'var(--danger)' : 'var(--accent-light)';
        e.currentTarget.style.borderColor = danger ? 'rgba(248,113,113,0.3)' : 'rgba(90,162,255,0.28)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--text-muted)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}>
      <Icon size={13} />
    </motion.button>
  );
}
