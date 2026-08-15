import { contextBridge, ipcRenderer, webUtils } from 'electron';

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
  // `File.path` is deprecated/removed in modern Electron with contextIsolation;
  // webUtils.getPathForFile is the sanctioned way to recover the absolute path
  // of a dropped file so we can hand it to the main-process sftp uploader.
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('syella', api);

export type SyellaAPI = typeof api;
