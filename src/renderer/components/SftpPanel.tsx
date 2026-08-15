import React, { useState, useEffect, useCallback } from 'react';
import { SyeSftpEntry } from '../../types';

const st: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: '#030810', borderTop: '1px solid rgba(56,140,255,0.08)',
  },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
    borderBottom: '1px solid rgba(56,140,255,0.06)',
  },
  pathInput: {
    flex: 1, padding: '6px 10px', borderRadius: 6,
    background: 'rgba(56,140,255,0.04)', border: '1px solid rgba(56,140,255,0.1)',
    color: '#e4e8f0', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
    transition: 'all 200ms',
  },
  btn: {
    padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
    background: 'rgba(56,140,255,0.06)', border: '1px solid rgba(56,140,255,0.1)',
    color: '#7a8ba8', transition: 'all 150ms',
  },
  list: { flex: 1, overflowY: 'auto' as const },
  row: {
    display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: 8,
    padding: '6px 12px', fontSize: 12, cursor: 'pointer', alignItems: 'center',
    transition: 'background 100ms',
  },
  header: { color: '#3d5070', fontSize: 11, fontWeight: 600, cursor: 'default' },
  name: { display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' },
  icon: { flexShrink: 0, fontSize: 14 },
  size: { color: '#5a7090', textAlign: 'right' as const, fontSize: 11 },
  date: { color: '#3d5070', fontSize: 11 },
};

interface Props { tabId: string; visible: boolean; }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SftpPanel({ tabId, visible }: Props) {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<SyeSftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(['/']);

  const loadDir = useCallback(async (dir: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await window.syella.invoke('sftp:list', tabId, dir);
      const sorted = (list as SyeSftpEntry[]).sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      setPath(dir);
    } catch (e: any) { setError(e.message || 'Failed to list directory'); }
    setLoading(false);
  }, [tabId]);

  useEffect(() => { if (visible) loadDir('/'); }, [visible]);

  const navigate = (dir: string) => {
    setHistory(prev => [...prev, dir]);
    loadDir(dir);
  };

  const goUp = () => {
    const parent = path.split('/').slice(0, -1).join('/') || '/';
    navigate(parent);
  };

  const goBack = () => {
    if (history.length < 2) return;
    const prev = history[history.length - 2];
    setHistory(h => h.slice(0, -1));
    loadDir(prev);
  };

  const handleClick = (entry: SyeSftpEntry) => {
    if (entry.type === 'directory') {
      navigate(path === '/' ? `/${entry.name}` : `${path}/${entry.name}`);
    }
  };

  const handleDelete = async (entry: SyeSftpEntry) => {
    const full = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
    await window.syella.invoke('sftp:delete', tabId, full, entry.type === 'directory');
    loadDir(path);
  };

  const handleDownload = async (entry: SyeSftpEntry) => {
    const full = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
    const localPath = await window.syella.invoke('dialog:saveFile', { defaultPath: entry.name });
    if (localPath) await window.syella.invoke('sftp:download', tabId, full, localPath, crypto.randomUUID());
  };

  const handleUpload = async () => {
    const files = await window.syella.invoke('dialog:openFile', { properties: ['openFile', 'multiSelections'] });
    if (!files) return;
    for (const f of files) {
      const name = f.split(/[\\/]/).pop();
      const remote = path === '/' ? `/${name}` : `${path}/${name}`;
      await window.syella.invoke('sftp:upload', tabId, f, remote, crypto.randomUUID());
    }
    loadDir(path);
  };

  const handleMkdir = async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    const full = path === '/' ? `/${name}` : `${path}/${name}`;
    await window.syella.invoke('sftp:mkdir', tabId, full);
    loadDir(path);
  };

  if (!visible) return null;

  return (
    <div style={st.root}>
      <div style={st.toolbar}>
        <button style={st.btn} onClick={goBack} title="Back"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.12)'; e.currentTarget.style.color = '#e4e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; e.currentTarget.style.color = '#7a8ba8'; }}>
          &#8592;
        </button>
        <button style={st.btn} onClick={goUp} title="Up"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.12)'; e.currentTarget.style.color = '#e4e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; e.currentTarget.style.color = '#7a8ba8'; }}>
          &#8593;
        </button>
        <input style={st.pathInput} value={path} onChange={e => setPath(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') loadDir(path); }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(56,140,255,0.3)'; e.currentTarget.style.boxShadow = '0 0 8px rgba(56,140,255,0.08)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(56,140,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }} />
        <button style={st.btn} onClick={() => loadDir(path)}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.12)'; e.currentTarget.style.color = '#e4e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; e.currentTarget.style.color = '#7a8ba8'; }}>
          Refresh
        </button>
        <button style={{ ...st.btn, color: '#388CFF', borderColor: 'rgba(56,140,255,0.2)' }} onClick={handleUpload}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; }}>
          Upload
        </button>
        <button style={st.btn} onClick={handleMkdir}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.12)'; e.currentTarget.style.color = '#e4e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; e.currentTarget.style.color = '#7a8ba8'; }}>
          + Folder
        </button>
      </div>
      {error && <div style={{ padding: '8px 12px', color: '#ef4444', fontSize: 12 }}>{error}</div>}
      <div style={{ ...st.row, ...st.header }}>
        <span>Name</span><span style={{ textAlign: 'right' }}>Size</span><span>Modified</span>
      </div>
      <div style={st.list}>
        {loading && <div style={{ padding: 12, color: '#3d5070', fontSize: 12 }}>Loading...</div>}
        {!loading && entries.map(entry => (
          <div key={entry.name} style={st.row}
            onDoubleClick={() => handleClick(entry)}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,140,255,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={st.name}>
              <span style={{ ...st.icon, color: entry.type === 'directory' ? '#388CFF' : '#5a7090' }}>
                {entry.type === 'directory' ? '\u{1F4C1}' : '\u{1F4C4}'}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: entry.name.startsWith('.') ? '#3d5070' : '#b0c0d8' }}>
                {entry.name}
              </span>
            </div>
            <span style={st.size}>{entry.type === 'file' ? formatSize(entry.size) : ''}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={st.date}>{formatDate(entry.modifyTime)}</span>
              {entry.type === 'file' && (
                <button style={{ ...st.btn, padding: '2px 6px', fontSize: 10 }} onClick={() => handleDownload(entry)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.12)'; e.currentTarget.style.color = '#388CFF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; e.currentTarget.style.color = '#7a8ba8'; }}>
                  DL
                </button>
              )}
              <button style={{ ...st.btn, padding: '2px 6px', fontSize: 10, color: '#ef4444', borderColor: 'rgba(239,68,68,0.15)' }}
                onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ff6b6b'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; e.currentTarget.style.color = '#ef4444'; }}>
                Del
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
