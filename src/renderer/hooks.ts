import { useState, useEffect, useCallback, useRef } from 'react';
import { SyeSession, SyeGroup, SyeSettings, SyeTab, SyeSessionCredentials } from '../types';
import { v4 as uuid } from 'uuid';

const api = () => window.syella;

export function useSessions() {
  const [sessions, setSessions] = useState<SyeSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api().invoke('db:getSessions');
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (session: SyeSession) => {
    await api().invoke('db:saveSession', session);
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await api().invoke('db:deleteSession', id);
    await load();
  }, [load]);

  return { sessions, loading, reload: load, save, remove };
}

export function useGroups() {
  const [groups, setGroups] = useState<SyeGroup[]>([]);

  const load = useCallback(async () => {
    setGroups(await api().invoke('db:getGroups'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (group: SyeGroup) => {
    await api().invoke('db:saveGroup', group);
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await api().invoke('db:deleteGroup', id);
    await load();
  }, [load]);

  return { groups, reload: load, save, remove };
}

export function useSettings() {
  const [settings, setSettings] = useState<SyeSettings | null>(null);

  useEffect(() => {
    api().invoke('db:getSettings').then(setSettings);
  }, []);

  const save = useCallback(async (s: SyeSettings) => {
    await api().invoke('db:saveSettings', s);
    setSettings(s);
  }, []);

  return { settings, save };
}

export function useTabs() {
  const [tabs, setTabs] = useState<SyeTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = useCallback((session: SyeSession) => {
    const tab: SyeTab = {
      id: uuid(),
      sessionId: session.id,
      session,
      status: 'connecting',
      title: session.name,
    };
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    return tab;
  }, []);

  const closeTab = useCallback((tabId: string) => {
    api().invoke('ssh:disconnect', tabId);
    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (tabId === activeTabId) setActiveTabId(next.length ? next[next.length - 1].id : null);
      return next;
    });
  }, [activeTabId]);

  const updateTabStatus = useCallback((tabId: string, status: SyeTab['status']) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status } : t));
  }, []);

  return { tabs, activeTabId, setActiveTabId, openTab, closeTab, updateTabStatus };
}

export function useFirstRun() {
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);

  useEffect(() => {
    api().invoke('app:isFirstRun').then(setIsFirstRun);
  }, []);

  const complete = useCallback(async () => {
    await api().invoke('app:completeFirstRun');
    setIsFirstRun(false);
  }, []);

  return { isFirstRun, complete };
}
