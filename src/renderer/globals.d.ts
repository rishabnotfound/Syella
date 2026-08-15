interface SyellaAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<any>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  once: (channel: string, callback: (...args: unknown[]) => void) => void;
  send: (channel: string, ...args: unknown[]) => void;
  getPathForFile?: (file: File) => string;
}

interface Window {
  syella: SyellaAPI;
}
