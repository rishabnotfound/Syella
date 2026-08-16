import { useSyncExternalStore } from 'react';

export interface UploadState {
  batchId: string;
  transferred: number;
  total: number;
  totalFiles: number;
  doneFiles: number;
  currentName: string;
  done: boolean;
  cancelled?: boolean;
  error?: string;
}

// Poll-based upload tracking. Push events (transfer:progress etc.) were
// unreliable — the renderer could miss them if the store hooked up late or if
// a batch of chunks got coalesced past the throttle. Now the renderer owns a
// timer that pulls the authoritative state from main every 300ms while any
// batch is active. The main-process snapshot is the single source of truth.
type TabUploads = Record<string, UploadState>;
type Store = Record<string, TabUploads>;

let state: Store = {};
const listeners = new Set<() => void>();
const batchToTab = new Map<string, string>();
const POLL_INTERVAL = 300;
const POST_DONE_LINGER = 3500;
const CANCEL_LINGER = 1800;
let pollTimer: number | null = null;

function emit() {
  for (const l of listeners) l();
}

function updateTab(tabId: string, mut: (u: TabUploads) => TabUploads) {
  state = { ...state, [tabId]: mut(state[tabId] || {}) };
  emit();
}

function startPolling() {
  if (pollTimer != null) return;
  if (typeof window === 'undefined' || !(window as any).syella) return;
  const api = (window as any).syella;
  const tick = async () => {
    const entries = Array.from(batchToTab.entries());
    if (entries.length === 0) {
      if (pollTimer != null) { clearInterval(pollTimer); pollTimer = null; }
      return;
    }
    // Fire all polls in parallel — each round trip is small.
    await Promise.all(entries.map(async ([batchId, tabId]) => {
      try {
        const snap = await api.invoke('sftp:uploadStatus', batchId);
        if (!snap) return;
        updateTab(tabId, u => ({
          ...u,
          [batchId]: {
            batchId,
            transferred: snap.transferred,
            total: snap.total,
            totalFiles: snap.totalFiles,
            doneFiles: snap.doneFiles,
            currentName: snap.currentName || u[batchId]?.currentName || '',
            done: snap.done,
            cancelled: snap.cancelled,
            error: snap.error,
          },
        }));
        if (snap.done) {
          batchToTab.delete(batchId);
          const linger = snap.cancelled ? CANCEL_LINGER : POST_DONE_LINGER;
          setTimeout(() => dismissUpload(tabId, batchId), linger);
        }
      } catch {
        // Ignore; next tick will try again.
      }
    }));
  };
  // Kick off immediately so the UI updates within one frame of the first tick.
  tick();
  pollTimer = window.setInterval(tick, POLL_INTERVAL) as unknown as number;
}

export function registerUpload(tabId: string, batchId: string) {
  batchToTab.set(batchId, tabId);
  updateTab(tabId, u => ({
    ...u,
    [batchId]: {
      batchId, transferred: 0, total: 0, totalFiles: 0, doneFiles: 0,
      currentName: 'Preparing…', done: false,
    },
  }));
  startPolling();
}

export function dismissUpload(tabId: string, batchId: string) {
  batchToTab.delete(batchId);
  updateTab(tabId, u => {
    const { [batchId]: _drop, ...rest } = u;
    return rest;
  });
}

const EMPTY: TabUploads = {};

export function useTabUploads(tabId: string): TabUploads {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state[tabId] || EMPTY,
    () => EMPTY,
  );
}

// Kept for App.tsx compat.
export function useWireUploads() {}
