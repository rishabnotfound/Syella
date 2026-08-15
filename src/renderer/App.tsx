import React, { useState, useEffect, useCallback, useRef, createRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import TerminalView, { TerminalHandle } from './components/Terminal';
import SftpPanel from './components/SftpPanel';
import StatusBar from './components/StatusBar';
import SessionEditor from './components/SessionEditor';
import CommandPalette from './components/CommandPalette';
import Settings from './components/Settings';
import FirstRun from './components/FirstRun';
import ReconnectOverlay from './components/ReconnectOverlay';
import SplashScreen from './components/SplashScreen';
import ShortcutsOverlay from './components/ShortcutsOverlay';
import SnippetsBar from './components/SnippetsBar';
import FileViewer from './components/FileViewer';
import QuickConnect from './components/QuickConnect';
import { useToast } from './components/Toast';
import { useSessions, useGroups, useSettings, useTabs, useFirstRun } from './hooks';
import { SyeSession } from '../types';

export default function App() {
  const toast = useToast();
  const { sessions, reload: reloadSessions, save: saveSession, remove: removeSession } = useSessions();
  const { groups, reload: reloadGroups, save: saveGroup } = useGroups();
  const { settings, save: saveSettings } = useSettings();
  const { tabs, activeTabId, setActiveTabId, openTab, closeTab, updateTabStatus } = useTabs();
  const { isFirstRun, complete: completeFirstRun } = useFirstRun();

  const [showSplash, setShowSplash] = useState(true);
  const [showEditor, setShowEditor] = useState<SyeSession | 'new' | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showQuickConnect, setShowQuickConnect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [sftpVisible, setSftpVisible] = useState<Record<string, boolean>>({});
  const [sftpState, setSftpState] = useState<Record<string, { path: string; back: string[] }>>({});
  const [viewerFile, setViewerFile] = useState<{ tabId: string; path: string; size: number } | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [disconnectedTabs, setDisconnectedTabs] = useState<Set<string>>(new Set());

  const activeTab = tabs.find(t => t.id === activeTabId) || null;
  const connectedSessionIds = useMemo(
    () => new Set(tabs.filter(t => t.status === 'connected').map(t => t.sessionId)),
    [tabs]
  );

  const terminalRefs = useRef<Map<string, React.RefObject<TerminalHandle | null>>>(new Map());
  const getTermRef = useCallback((id: string) => {
    let r = terminalRefs.current.get(id);
    if (!r) { r = createRef<TerminalHandle | null>(); terminalRefs.current.set(id, r); }
    return r;
  }, []);

  useEffect(() => {
    const alive = new Set(tabs.map(t => t.id));
    for (const key of terminalRefs.current.keys()) {
      if (!alive.has(key)) terminalRefs.current.delete(key);
    }
  }, [tabs]);

  const tabIdsKey = useMemo(() => tabs.map(t => t.id).join('|'), [tabs]);
  useEffect(() => {
    const ids = tabIdsKey.split('|').filter(Boolean);
    const unsubs = ids.map(tabId =>
      window.syella.on(`ssh:cwd:${tabId}`, (cwd: any) => {
        if (typeof cwd !== 'string' || !cwd.startsWith('/')) return;
        setSftpState(prev => {
          const cur = prev[tabId];
          if (cur?.path === cwd) return prev;
          const back = cur ? (cur.path && cur.path !== cwd ? [...cur.back, cur.path].slice(-50) : cur.back) : [];
          return { ...prev, [tabId]: { path: cwd, back } };
        });
      })
    );
    return () => unsubs.forEach(u => u());
  }, [tabIdsKey]);

  const handleConnect = useCallback((session: SyeSession) => {
    openTab(session);
    setShowEditor(null);
    setShowPalette(false);
  }, [openTab]);

  const handleSaveSession = useCallback(async (session: SyeSession, password?: string, privateKey?: string, passphrase?: string) => {
    await saveSession(session);
    if (password || privateKey || passphrase) {
      await window.syella.invoke('db:saveCredentials', {
        sessionId: session.id, password: password || '', privateKey: privateKey || '', passphrase: passphrase || '',
      });
    }
    if (session.group) {
      const existing = groups.find(g => g.name === session.group);
      if (!existing) {
        const { v4: uuid } = await import('uuid');
        await saveGroup({ id: uuid(), name: session.group, order: groups.length });
      }
    }
    setShowEditor(null);
    toast.success('Session saved', session.name);
  }, [saveSession, groups, saveGroup, toast]);

  const handleDeleteSession = useCallback(async (id: string) => {
    await removeSession(id);
    setShowEditor(null);
    toast.info('Session deleted');
  }, [removeSession, toast]);

  const handleDuplicateSession = useCallback(async (session: SyeSession) => {
    const { v4: uuid } = await import('uuid');
    const now = Date.now();
    const dup: SyeSession = {
      ...session, id: uuid(), name: `${session.name} (copy)`, createdAt: now, updatedAt: now,
    };
    await saveSession(dup);
    const creds = await window.syella.invoke('db:getCredentials', session.id);
    if (creds) {
      await window.syella.invoke('db:saveCredentials', { ...creds, sessionId: dup.id });
    }
    toast.success('Session duplicated', dup.name);
  }, [saveSession, toast]);

  const handleToggleFavorite = useCallback(async (session: SyeSession) => {
    await saveSession({ ...session, favorite: !session.favorite, updatedAt: Date.now() });
  }, [saveSession]);

  const handleBackupExport = useCallback(async () => {
    const password = prompt('Enter backup password:');
    if (!password) return;
    try {
      const path = await window.syella.invoke('backup:export', password);
      if (path) toast.success('Backup exported', path);
    } catch (e: any) {
      toast.error('Backup failed', e?.message || 'Unknown error');
    }
  }, [toast]);

  const handleBackupImport = useCallback(async () => {
    const password = prompt('Enter backup password:');
    if (!password) return;
    try {
      const result = await window.syella.invoke('backup:import', password, 'merge');
      if (result) {
        toast.success('Backup restored', `${result.sessions} sessions, ${result.groups} groups`);
        reloadSessions();
        reloadGroups();
      }
    } catch (e: any) {
      toast.error('Import failed', e?.message || 'Unknown error');
    }
  }, [reloadSessions, reloadGroups, toast]);

  const handleDisconnected = useCallback((tabId: string) => {
    updateTabStatus(tabId, 'disconnected');
    setDisconnectedTabs(prev => new Set(prev).add(tabId));
  }, [updateTabStatus]);

  const handleReconnect = useCallback((tabId: string) => {
    setDisconnectedTabs(prev => { const n = new Set(prev); n.delete(tabId); return n; });
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      closeTab(tabId);
      openTab(tab.session);
    }
  }, [tabs, closeTab, openTab]);

  const handleCancelReconnect = useCallback((tabId: string) => {
    setDisconnectedTabs(prev => { const n = new Set(prev); n.delete(tabId); return n; });
  }, []);

  const handleCloseDisconnected = useCallback((tabId: string) => {
    setDisconnectedTabs(prev => { const n = new Set(prev); n.delete(tabId); return n; });
    closeTab(tabId);
  }, [closeTab]);

  const runOnActiveTerm = useCallback((cmd: string) => {
    if (!activeTabId) return;
    const ref = terminalRefs.current.get(activeTabId);
    ref?.current?.runCommand(cmd);
  }, [activeTabId]);

  useEffect(() => {
    const isTypingInField = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setShowPalette(p => !p); return; }
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); setShowEditor('new'); return; }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
        return;
      }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1 && activeTabId) {
          const idx = tabs.findIndex(t => t.id === activeTabId);
          const next = e.shiftKey ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length;
          setActiveTabId(tabs[next].id);
        }
        return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
        e.preventDefault(); setSidebarCompact(v => !v); return;
      }
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); setSidebarVisible(v => !v); return; }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (activeTabId && activeTab?.status === 'connected') {
          setSftpVisible(p => ({ ...p, [activeTabId]: !p[activeTabId] }));
        }
        return;
      }
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        if (activeTabId) terminalRefs.current.get(activeTabId)?.current?.zoom(1);
        return;
      }
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        if (activeTabId) terminalRefs.current.get(activeTabId)?.current?.zoom(-1);
        return;
      }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        if (activeTabId) terminalRefs.current.get(activeTabId)?.current?.resetZoom();
        return;
      }
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        if (activeTab?.status === 'connected') setShowSnippets(v => !v);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '?' && !isTypingInField(e.target)) {
        e.preventDefault(); setShowShortcuts(v => !v); return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTabId, activeTab, tabs, closeTab, setActiveTabId]);

  if (showSplash) return <SplashScreen onFinished={() => setShowSplash(false)} />;
  if (isFirstRun === null) return <div style={{ background: '#000', width: '100%', height: '100%' }} />;
  if (isFirstRun) return <FirstRun onComplete={completeFirstRun} />;

  const sidebarWidth = sidebarVisible ? (sidebarCompact ? 56 : 240) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <Titlebar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <motion.div
          animate={{ width: sidebarWidth }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          style={{ overflow: 'hidden', flexShrink: 0 }}>
          <Sidebar sessions={sessions} groups={groups} connectedTabIds={connectedSessionIds}
            activeSessionId={activeTab?.sessionId}
            compact={sidebarCompact}
            onConnect={handleConnect} onNewSession={() => setShowEditor('new')}
            onEditSession={s => setShowEditor(s)} onSettings={() => setShowSettings(true)}
            onDuplicate={handleDuplicateSession} onDelete={handleDeleteSession}
            onToggleFavorite={handleToggleFavorite}
            onShowShortcuts={() => setShowShortcuts(true)} />
        </motion.div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {tabs.length > 0 && (
            <TabBar tabs={tabs} activeTabId={activeTabId}
              onSelect={setActiveTabId} onClose={closeTab}
              onNew={() => setShowQuickConnect(true)} />
          )}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {tabs.map(tab => (
              <div key={tab.id} style={{
                position: 'absolute', inset: 0,
                display: tab.id === activeTabId ? 'flex' : 'none',
              }}>
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <TerminalView ref={getTermRef(tab.id)}
                    tabId={tab.id} session={tab.session} settings={settings}
                    onConnected={() => updateTabStatus(tab.id, 'connected')}
                    onDisconnected={() => handleDisconnected(tab.id)}
                    onError={() => updateTabStatus(tab.id, 'error')} />
                  {disconnectedTabs.has(tab.id) && (
                    <ReconnectOverlay
                      tabId={tab.id}
                      sessionName={tab.session.name}
                      onReconnect={() => handleReconnect(tab.id)}
                      onCancel={() => handleCancelReconnect(tab.id)}
                      onClose={() => handleCloseDisconnected(tab.id)} />
                  )}
                  {tab.id === activeTabId && (
                    <SnippetsBar visible={showSnippets && tab.status === 'connected'}
                      onRun={(cmd) => runOnActiveTerm(cmd)}
                      onClose={() => setShowSnippets(false)} />
                  )}
                </div>
                {tab.status === 'connected' && (
                  <SftpPanelBinding
                    tabId={tab.id}
                    visible={!!sftpVisible[tab.id]}
                    state={sftpState[tab.id]}
                    setSftpVisible={setSftpVisible}
                    setSftpState={setSftpState}
                    setViewerFile={setViewerFile}
                  />
                )}
              </div>
            ))}
            {tabs.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14, userSelect: 'none',
              }}>
                <motion.img src="assets/icon.png" alt="Syella"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 0.18, scale: 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ width: 72, height: 72 }} />
                <div style={{ fontSize: 24, fontWeight: 200, color: 'var(--text-faint)', letterSpacing: 6 }}>SYELLA</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Double-click a session or press{' '}
                  <kbd style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    padding: '2px 7px', borderRadius: 5,
                    background: 'rgba(140,170,230,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-light)',
                  }}>Ctrl+K</kbd>
                </div>
              </div>
            )}
            <AnimatePresence>
              {tabs.length > 0 && activeTab?.status === 'connected' && !sftpVisible[activeTabId!] && (
                <motion.button key="sftp-toggle"
                  initial={{ opacity: 0, y: 8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setSftpVisible(p => ({ ...p, [activeTabId!]: true }))}
                  title="Open file manager (Ctrl+E)"
                  style={{
                    position: 'absolute', bottom: 16, right: 16, zIndex: 10,
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', fontSize: 11, borderRadius: 10,
                    background: 'rgba(15,21,36,0.7)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--accent-light)',
                    fontWeight: 500, letterSpacing: 0.5,
                  }}>
                  <FolderOpen size={13} />
                  Files
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <StatusBar activeTab={activeTab} />

      {showEditor && (
        <SessionEditor
          session={showEditor === 'new' ? undefined : showEditor}
          groups={groups}
          onSave={handleSaveSession}
          onDelete={showEditor !== 'new' ? handleDeleteSession : undefined}
          onClose={() => setShowEditor(null)} />
      )}

      <CommandPalette visible={showPalette} onClose={() => setShowPalette(false)}
        sessions={sessions} onConnect={handleConnect}
        onNewSession={() => { setShowPalette(false); setShowEditor('new'); }}
        onNewTab={() => { setShowPalette(false); setShowEditor('new'); }}
        onSettings={() => { setShowPalette(false); setShowSettings(true); }}
        onBackupExport={() => { setShowPalette(false); handleBackupExport(); }}
        onBackupImport={() => { setShowPalette(false); handleBackupImport(); }} />

      <QuickConnect visible={showQuickConnect}
        sessions={sessions}
        connectedSessionIds={connectedSessionIds}
        onClose={() => setShowQuickConnect(false)}
        onConnect={handleConnect}
        onNewSession={() => setShowEditor('new')} />

      <ShortcutsOverlay visible={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <FileViewer
        tabId={viewerFile?.tabId ?? null}
        path={viewerFile?.path ?? null}
        size={viewerFile?.size ?? 0}
        onClose={() => setViewerFile(null)}
        onNotify={(kind, title, body) => toast[kind](title, body)} />

      {showSettings && settings && (
        <Settings settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)}
          onBackupExport={handleBackupExport} onBackupImport={handleBackupImport} />
      )}
    </div>
  );
}

// Stable callback binding so SftpPanel doesn't receive fresh function refs
// every App re-render, which was retriggering its effects in a loop in
// production builds (React 19 no longer masks this with StrictMode).
interface SftpBindingProps {
  tabId: string;
  visible: boolean;
  state: { path: string; back: string[] } | undefined;
  setSftpVisible: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSftpState: React.Dispatch<React.SetStateAction<Record<string, { path: string; back: string[] }>>>;
  setViewerFile: React.Dispatch<React.SetStateAction<{ tabId: string; path: string; size: number } | null>>;
}
function SftpPanelBinding({ tabId, visible, state, setSftpVisible, setSftpState, setViewerFile }: SftpBindingProps) {
  const onClose = useCallback(
    () => setSftpVisible(p => ({ ...p, [tabId]: false })),
    [tabId, setSftpVisible]
  );
  const onOpenFile = useCallback(
    (path: string, size: number) => setViewerFile({ tabId, path, size }),
    [tabId, setViewerFile]
  );
  const onStateChange = useCallback(
    (next: { path: string; back: string[] }) => setSftpState(p => ({ ...p, [tabId]: next })),
    [tabId, setSftpState]
  );
  return (
    <SftpPanel
      tabId={tabId}
      visible={visible}
      state={state}
      onClose={onClose}
      onOpenFile={onOpenFile}
      onStateChange={onStateChange}
    />
  );
}
