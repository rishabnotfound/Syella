export interface SyeSession {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  group: string;
  tags: string[];
  favorite: boolean;
  notes: string;
  keepalive: number;
  connectionTimeout: number;
  startupCommand: string;
  proxyJump: string;
  createdAt: number;
  updatedAt: number;
}

export interface SyeSessionCredentials {
  sessionId: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SyeGroup {
  id: string;
  name: string;
  order: number;
}

export interface SyeTab {
  id: string;
  sessionId: string;
  session: SyeSession;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  title: string;
}

export interface SyePane {
  id: string;
  tabId: string;
  direction: 'horizontal' | 'vertical';
  children: SyePane[];
  sessionId?: string;
  size: number;
}

export interface SyeTransfer {
  id: string;
  sessionId: string;
  type: 'upload' | 'download';
  localPath: string;
  remotePath: string;
  size: number;
  transferred: number;
  speed: number;
  status: 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

export interface SyeSftpEntry {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifyTime: number;
  accessTime: number;
  permissions: number;
  owner: number;
  group: number;
}

export interface SyeSettings {
  terminal: {
    fontFamily: string;
    fontSize: number;
    cursorStyle: 'block' | 'underline' | 'bar';
    cursorBlink: boolean;
    scrollback: number;
    copyOnSelect: boolean;
    bellStyle: 'none' | 'sound' | 'visual';
  };
  ssh: {
    defaultPort: number;
    keepalive: number;
    connectionTimeout: number;
  };
  security: {
    autoLockMinutes: number;
    clearClipboardSeconds: number;
  };
  general: {
    accentColor: string;
    transparency: number;
    confirmBeforeClose: boolean;
    restoreTabsOnStart: boolean;
  };
}

export interface SyeBackup {
  version: number;
  createdAt: number;
  sessions: SyeSession[];
  groups: SyeGroup[];
  settings: SyeSettings;
  credentials: SyeSessionCredentials[];
}

export type IpcChannels =
  | 'db:getSessions'
  | 'db:getSession'
  | 'db:saveSession'
  | 'db:deleteSession'
  | 'db:getGroups'
  | 'db:saveGroup'
  | 'db:deleteGroup'
  | 'db:getSettings'
  | 'db:saveSettings'
  | 'db:getCredentials'
  | 'db:saveCredentials'
  | 'ssh:connect'
  | 'ssh:disconnect'
  | 'ssh:data'
  | 'ssh:resize'
  | 'sftp:list'
  | 'sftp:mkdir'
  | 'sftp:delete'
  | 'sftp:rename'
  | 'sftp:upload'
  | 'sftp:download'
  | 'sftp:stat'
  | 'backup:create'
  | 'backup:restore'
  | 'backup:export'
  | 'backup:import'
  | 'app:getDataPath'
  | 'app:isFirstRun'
  | 'app:completeFirstRun'
  | 'dialog:openFile'
  | 'dialog:saveFile'
  | 'dialog:openDirectory'
  | 'window:minimize'
  | 'window:maximize'
  | 'window:close';
