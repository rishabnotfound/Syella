import React, { useState, useEffect, useCallback } from 'react';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import TerminalView from './components/Terminal';
import SftpPanel from './components/SftpPanel';
import StatusBar from './components/StatusBar';
import SessionEditor from './components/SessionEditor';
import CommandPalette from './components/CommandPalette';
import Settings from './components/Settings';
import FirstRun from './components/FirstRun';
import ReconnectOverlay from './components/ReconnectOverlay';
import SplashScreen from './components/SplashScreen';
import { useSessions, useGroups, useSettings, useTabs, useFirstRun } from './hooks';
import { SyeSession } from '../types';

export default function App() {
  const { sessions, reload: reloadSessions, save: saveSession, remove: removeSession } = useSessions();
  const { groups, reload: reloadGroups, save: saveGroup } = useGroups();
  const { settings, save: saveSettings } = useSettings();
  const { tabs, activeTabId, setActiveTabId, openTab, closeTab, updateTabStatus } = useTabs();
  const { isFirstRun, complete: completeFirstRun } = useFirstRun();

  const [showSplash, setShowSplash] = useState(true);
  const [showEditor, setShowEditor] = useState<SyeSession | 'new' | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sftpVisible, setSftpVisible] = useState<Record<string, boolean>>({});
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [disconnectedTabs, setDisconnectedTabs] = useState<Set<string>>(new Set());

  const activeTab = tabs.find(t => t.id === activeTabId) || null;
  const connectedSessionIds = new Set(tabs.filter(t => t.status === 'connected').map(t => t.sessionId));

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
  }, [saveSession, groups, saveGroup]);

  const handleDeleteSession = useCallback(async (id: string) => {
    await removeSession(id);
    setShowEditor(null);
  }, [removeSession]);

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
  }, [saveSession]);

  const handleToggleFavorite = useCallback(async (session: SyeSession) => {
    await saveSession({ ...session, favorite: !session.favorite, updatedAt: Date.now() });
  }, [saveSession]);

  const handleBackupExport = useCallback(async () => {
    const password = prompt('Enter backup password:');
    if (!password) return;
    const path = await window.syella.invoke('backup:export', password);
    if (path) alert(`Backup saved to: ${path}`);
  }, []);

  const handleBackupImport = useCallback(async () => {
    const password = prompt('Enter backup password:');
    if (!password) return;
    const result = await window.syella.invoke('backup:import', password, 'merge');
    if (result) {
      alert(`Restored ${result.sessions} sessions, ${result.groups} groups`);
      reloadSessions();
      reloadGroups();
    }
  }, [reloadSessions, reloadGroups]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setShowPalette(p => !p); }
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); setShowEditor('new'); }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1 && activeTabId) {
          const idx = tabs.findIndex(t => t.id === activeTabId);
          const next = e.shiftKey ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length;
          setActiveTabId(tabs[next].id);
        }
      }
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); setSidebarVisible(v => !v); }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (activeTabId && activeTab?.status === 'connected') {
          setSftpVisible(p => ({ ...p, [activeTabId]: !p[activeTabId] }));
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTabId, activeTab, tabs, closeTab, setActiveTabId]);

  if (showSplash) return <SplashScreen onFinished={() => setShowSplash(false)} />;
  if (isFirstRun === null) return <div style={{ background: '#000', width: '100%', height: '100%' }} />;
  if (isFirstRun) return <FirstRun onComplete={completeFirstRun} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#000' }}>
      <Titlebar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          width: sidebarVisible ? 240 : 0, overflow: 'hidden', flexShrink: 0,
          transition: 'width 250ms cubic-bezier(0.4,0,0.2,1)',
        }}>
          <Sidebar sessions={sessions} groups={groups} connectedTabIds={connectedSessionIds}
            onConnect={handleConnect} onNewSession={() => setShowEditor('new')}
            onEditSession={s => setShowEditor(s)} onSettings={() => setShowSettings(true)}
            onDuplicate={handleDuplicateSession} onDelete={handleDeleteSession}
            onToggleFavorite={handleToggleFavorite} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {tabs.length > 0 && (
            <TabBar tabs={tabs} activeTabId={activeTabId}
              onSelect={setActiveTabId} onClose={closeTab}
              onNew={() => setShowEditor('new')} />
          )}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {tabs.map(tab => (
              <div key={tab.id} style={{
                position: 'absolute', inset: 0,
                display: tab.id === activeTabId ? 'flex' : 'none',
              }}>
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <TerminalView tabId={tab.id} session={tab.session} settings={settings}
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
                </div>
                {sftpVisible[tab.id] && tab.status === 'connected' && (
                  <div style={{
                    width: 360, overflow: 'hidden', flexShrink: 0, position: 'relative',
                    borderLeft: '1px solid rgba(56,140,255,0.06)',
                    animation: 'slideInRight 200ms cubic-bezier(0.16,1,0.3,1)',
                  }}>
                    <button onClick={() => setSftpVisible(p => ({ ...p, [tab.id]: false }))}
                      style={{
                        position: 'absolute', top: 6, right: 8, zIndex: 11,
                        padding: '2px 8px', fontSize: 10, borderRadius: 4,
                        background: 'rgba(56,140,255,0.06)', border: '1px solid rgba(56,140,255,0.08)',
                        color: '#5a7090', cursor: 'pointer', transition: 'all 120ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.12)'; e.currentTarget.style.color = '#e4e8f0'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.06)'; e.currentTarget.style.color = '#5a7090'; }}>
                      Close
                    </button>
                    <SftpPanel tabId={tab.id} visible={sftpVisible[tab.id]} />
                  </div>
                )}
              </div>
            ))}
            {tabs.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14, userSelect: 'none',
                background: '#060a14', animation: 'fadeIn 400ms ease-out',
              }}>
                <img src="assets/logo.png" alt="Syella" style={{
                  width: 64, height: 64, opacity: 0.15,
                  filter: 'drop-shadow(0 0 30px rgba(56,140,255,0.2))',
                }} />
                <div style={{ fontSize: 22, fontWeight: 200, color: '#1e2736', letterSpacing: 4 }}>SYELLA</div>
                <div style={{ fontSize: 12, color: '#253050', marginTop: 2 }}>
                  Double-click a session or press <span style={{ color: '#388CFF', fontFamily: "'JetBrains Mono', monospace" }}>Ctrl+K</span>
                </div>
              </div>
            )}
          </div>
          {tabs.length > 0 && activeTab?.status === 'connected' && !sftpVisible[activeTabId!] && (
            <div style={{ position: 'absolute', bottom: 32, right: 16, zIndex: 10 }}>
              <button onClick={() => setSftpVisible(p => ({ ...p, [activeTabId!]: true }))}
                style={{
                  padding: '5px 14px', fontSize: 11, borderRadius: 6,
                  background: 'rgba(56,140,255,0.08)', border: '1px solid rgba(56,140,255,0.15)',
                  color: '#388CFF', cursor: 'pointer', transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
                  fontWeight: 500, backdropFilter: 'blur(8px)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.18)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(56,140,255,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,140,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                SFTP
              </button>
            </div>
          )}
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

      {showSettings && settings && (
        <Settings settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)}
          onBackupExport={handleBackupExport} onBackupImport={handleBackupImport} />
      )}
    </div>
  );
}
