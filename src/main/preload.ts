import { contextBridge, ipcRenderer } from 'electron';

const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const sub = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, sub);
    return () => { ipcRenderer.removeListener(channel, sub); };
  },
  once: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  },
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
};

contextBridge.exposeInMainWorld('syella', api);

export type SyellaAPI = typeof api;
