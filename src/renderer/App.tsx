import React, { useState, useEffect, useCallback, useRef, createRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
// FleetOverview lives inline as the empty-state screen (no tabs open). It
// auto-collapses to a minimal SYELLA welcome when no session has billing info,
// and expands to a rich cost/expiry dashboard once you set any.
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
import PasswordPrompt from './components/PasswordPrompt';
import FleetOverview from './components/FleetOverview';
import { useToast } from './components/Toast';
import { useSessions, useGroups, useSettings, useTabs, useFirstRun } from './hooks';
import { useWireUploads, useTabUploads } from './uploadStore';
import { SyeSession } from '../types';

export default function App() {
  const toast = useToast();
  const { sessions, reload: reloadSessions, save: saveSession, remove: removeSession } = useSessions();
  const { groups, reload: reloadGroups, save: saveGroup } = useGroups();
  const { settings, save: saveSettings } = useSettings();
  const { tabs, activeTabId, setActiveTabId, openTab, closeTab, updateTabStatus, reorderTabs } = useTabs();
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
  const [pwPrompt, setPwPrompt] = useState<null | {
    title: string; description: string; confirmLabel: string; requireConfirm: boolean;
    onSubmit: (pw: string) => void;
  }>(null);

  useWireUploads();

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

  const handleBackupExport = useCallback(() => {
    setPwPrompt({
      title: 'Encrypt backup',
      description: 'Choose a password to protect this backup file.',
      confirmLabel: 'Export backup',
      requireConfirm: true,
      onSubmit: async (password) => {
        setPwPrompt(null);
        try {
          const path = await window.syella.invoke('backup:export', password);
          if (path) toast.success('Backup exported', path);
        } catch (e: any) {
          toast.error('Backup failed', e?.message || 'Unknown error');
        }
      },
    });
  }, [toast]);

  const handleBackupImport = useCallback(() => {
    setPwPrompt({
      title: 'Restore backup',
      description: 'Enter the password used when the backup was created.',
      confirmLabel: 'Restore',
      requireConfirm: false,
      onSubmit: async (password) => {
        setPwPrompt(null);
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
      },
    });
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
    const isMac = /Mac/i.test(navigator.platform);
    // Shortcut policy (avoid ever colliding with OS shortcuts):
    //   Tab-switch  : Ctrl+Tab always (Cmd+Tab is the macOS app switcher, do
    //                 NOT trap it under any circumstance)
    //   Prev/next   : Cmd+Option+←/→ on Mac (native Terminal.app pattern)
    //   Sidebar rail: Cmd+Shift+B on Mac, Ctrl+Shift+B elsewhere
    //   Zoom / snip : Cmd on Mac, Ctrl elsewhere
    //   Menubar     : +K/+N/+W/+B/+E flow through the native menu accelerator,
    //                 which uses CmdOrCtrl automatically — so nothing extra here.
    const mod = (e: KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey);
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Tab (both platforms) — cycle tabs. Never trap Cmd+Tab on macOS.
      if (e.ctrlKey && !e.metaKey && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1 && activeTabId) {
          const idx = tabs.findIndex(t => t.id === activeTabId);
          const next = e.shiftKey ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length;
          setActiveTabId(tabs[next].id);
        }
        return;
      }
      // Mac-only: Cmd+Option+←/→ moves between tabs (Terminal.app / iTerm2 convention).
      if (isMac && e.metaKey && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (tabs.length > 1 && activeTabId) {
          const idx = tabs.findIndex(t => t.id === activeTabId);
          const next = e.key === 'ArrowLeft'
            ? (idx - 1 + tabs.length) % tabs.length
            : (idx + 1) % tabs.length;
          setActiveTabId(tabs[next].id);
        }
        return;
      }
      if (mod(e) && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
        e.preventDefault(); setSidebarCompact(v => !v); return;
      }
      if (mod(e) && !e.shiftKey && !e.altKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        if (activeTabId) terminalRefs.current.get(activeTabId)?.current?.zoom(1);
        return;
      }
      if (mod(e) && !e.shiftKey && !e.altKey && e.key === '-') {
        e.preventDefault();
        if (activeTabId) terminalRefs.current.get(activeTabId)?.current?.zoom(-1);
        return;
      }
      if (mod(e) && !e.shiftKey && !e.altKey && e.key === '0') {
        e.preventDefault();
        if (activeTabId) terminalRefs.current.get(activeTabId)?.current?.resetZoom();
        return;
      }
      if (mod(e) && e.key === '/') {
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

  // Bridge for the native menubar (main-process → renderer). The menu items
  // just fire these channels; the actual behavior lives here so we don't
  // duplicate logic between menu / shortcuts / palette.
  useEffect(() => {
    const activeTerm = () => activeTabId ? terminalRefs.current.get(activeTabId)?.current : null;

    // Copy/paste/selectAll must dispatch to whatever has focus. Native input
    // fields (SessionEditor, QuickConnect, palette) get the DOM clipboard;
    // xterm's canvas gets our custom bridge.
    const editingInField = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return el;
      return null;
    };
    const doCopy = () => {
      const el = editingInField();
      if (el) {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        const text = typeof input.value === 'string'
          ? input.value.substring(input.selectionStart ?? 0, input.selectionEnd ?? 0)
          : (window.getSelection()?.toString() || '');
        if (text) navigator.clipboard.writeText(text).catch(() => {});
      } else {
        activeTerm()?.copySelection();
      }
    };
    const doPaste = async () => {
      const el = editingInField();
      if (el) {
        try {
          const text = await navigator.clipboard.readText();
          if (!text) return;
          const input = el as HTMLInputElement | HTMLTextAreaElement;
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? start;
          const merged = input.value.slice(0, start) + text + input.value.slice(end);
          // React tracks controlled inputs via a hidden _valueTracker. A plain
          // `input.value = ...` bypasses it, so React sees no change and on the
          // next render clobbers our value back to state. Go through the native
          // prototype setter so React's tracker picks up the mutation.
          const proto = input instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(input, merged);
          else input.value = merged;
          const pos = start + text.length;
          input.setSelectionRange(pos, pos);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } catch {}
      } else {
        activeTerm()?.pasteFromClipboard();
      }
    };
    const doSelectAll = () => {
      const el = editingInField();
      if (el && (el as HTMLInputElement).select) {
        (el as HTMLInputElement).select();
      } else {
        activeTerm()?.selectAll();
      }
    };

    const unsubs = [
      window.syella.on('menu:newSession', () => setShowEditor('new')),
      window.syella.on('menu:palette', () => setShowPalette(p => !p)),
      window.syella.on('menu:quickConnect', () => setShowQuickConnect(true)),
      window.syella.on('menu:closeTab', () => { if (activeTabId) closeTab(activeTabId); }),
      window.syella.on('menu:settings', () => setShowSettings(true)),
      window.syella.on('menu:toggleSidebar', () => setSidebarVisible(v => !v)),
      window.syella.on('menu:toggleSftp', () => {
        if (activeTabId && activeTab?.status === 'connected') {
          setSftpVisible(p => ({ ...p, [activeTabId]: !p[activeTabId] }));
        }
      }),
      window.syella.on('menu:find', () => { /* reserved: xterm search UI */ }),
      window.syella.on('menu:copy', doCopy),
      window.syella.on('menu:paste', doPaste),
      window.syella.on('menu:selectAll', doSelectAll),
    ];
    return () => unsubs.forEach(u => u());
  }, [activeTabId, activeTab, closeTab]);

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
              onReorder={reorderTabs}
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
              <FleetOverview
                sessions={sessions}
                onEditSession={(s) => setShowEditor(s)}
                onConnect={handleConnect}
                onNewSession={() => setShowEditor('new')}
                onOpenPalette={() => setShowPalette(true)}
              />
            )}
            <AnimatePresence>
              {tabs.length > 0 && activeTab?.status === 'connected' && !sftpVisible[activeTabId!] && (
                <SftpToggleButton
                  key="sftp-toggle"
                  tabId={activeTabId!}
                  onClick={() => setSftpVisible(p => ({ ...p, [activeTabId!]: true }))} />
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

      <PasswordPrompt
        visible={!!pwPrompt}
        title={pwPrompt?.title || ''}
        description={pwPrompt?.description}
        confirmLabel={pwPrompt?.confirmLabel || 'Confirm'}
        requireConfirm={!!pwPrompt?.requireConfirm}
        onSubmit={pw => pwPrompt?.onSubmit(pw)}
        onCancel={() => setPwPrompt(null)}
      />
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

// Pulls upload state per-tab so it can badge the toggle when uploads run in
// the background (panel closed).
function SftpToggleButton({ tabId, onClick }: { tabId: string; onClick: () => void }) {
  const uploads = useTabUploads(tabId);
  const active = Object.values(uploads).filter(u => !u.done);
  const busy = active.length > 0;
  return (
    <motion.button
      initial={{ opacity: 0, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      title={busy ? `${active.length} upload${active.length === 1 ? '' : 's'} in progress — click to view` : 'Open file manager (Ctrl+E)'}
      style={{
        position: 'absolute', bottom: 16, right: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', fontSize: 11, borderRadius: 10,
        background: busy ? 'rgba(90,162,255,0.16)' : 'rgba(15,21,36,0.7)',
        border: `1px solid ${busy ? 'rgba(90,162,255,0.5)' : 'var(--border-medium)'}`,
        color: 'var(--accent-light)',
        fontWeight: 500, letterSpacing: 0.5,
      }}>
      <FolderOpen size={13} />
      Files
      {busy && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 16, height: 16, padding: '0 5px', borderRadius: 8,
          background: 'var(--accent)', color: '#fff',
          fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
        }}>{active.length}</span>
      )}
    </motion.button>
  );
}
