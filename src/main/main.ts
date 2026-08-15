import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as db from '../services/database';
import * as ssh from '../services/ssh';
import * as backup from '../services/backup';

app.setName('Syella');
if (process.platform === 'darwin') app.setAboutPanelOptions({ applicationName: 'Syella' });

let mainWindow: BrowserWindow | null = null;

function getDataPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) return path.join(__dirname, '..', '..', 'data');
  const portable = path.join(path.dirname(app.getPath('exe')), 'data');
  fs.mkdirSync(portable, { recursive: true });
  return portable;
}

function resolveIconPath(): string {
  const candidates = [
    path.join(__dirname, '..', 'renderer', 'assets', 'icon.png'),
    path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    path.join(process.resourcesPath || '', 'assets', 'icon.png'),
  ];
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch {}
  }
  return candidates[0];
}

function createWindow(): void {
  const iconPath = resolveIconPath();
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    frame: false,
    backgroundColor: '#000000',
    show: false,
    icon: iconPath,
    title: 'Syella',
    webPreferences: {
      preload: path.join(__dirname, '..', 'main', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function registerIpc(): void {
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  ipcMain.handle('db:getSessions', () => db.getSessions());
  ipcMain.handle('db:getSession', (_, id: string) => db.getSession(id));
  ipcMain.handle('db:saveSession', (_, session) => db.saveSession(session));
  ipcMain.handle('db:deleteSession', (_, id: string) => db.deleteSession(id));
  ipcMain.handle('db:getGroups', () => db.getGroups());
  ipcMain.handle('db:saveGroup', (_, group) => db.saveGroup(group));
  ipcMain.handle('db:deleteGroup', (_, id: string) => db.deleteGroup(id));
  ipcMain.handle('db:getSettings', () => db.getSettings());
  ipcMain.handle('db:saveSettings', (_, settings) => db.saveSettings(settings));
  ipcMain.handle('db:getCredentials', (_, sessionId: string) => db.getCredentials(sessionId));
  ipcMain.handle('db:saveCredentials', (_, creds) => db.saveCredentials(creds));
  ipcMain.handle('app:getDataPath', () => getDataPath());
  ipcMain.handle('app:isFirstRun', () => db.isFirstRun());
  ipcMain.handle('app:completeFirstRun', () => db.completeFirstRun());

  ipcMain.handle('ssh:connect', (_, { tabId, session, credentials, cols, rows }) => {
    if (!mainWindow) return;
    ssh.connect(mainWindow, tabId, session, credentials, cols, rows);
  });
  ipcMain.handle('ssh:disconnect', (_, tabId: string) => ssh.disconnect(tabId));
  ipcMain.on('ssh:data', (_, tabId: string, data: string) => ssh.sendData(tabId, data));
  ipcMain.on('ssh:resize', (_, tabId: string, cols: number, rows: number) => ssh.resize(tabId, cols, rows));

  ipcMain.handle('ssh:exec', (_, tabId: string, command: string) => ssh.execCommand(tabId, command));
  ipcMain.handle('ssh:getCwd', (_, tabId: string) => ssh.getCwd(tabId));

  ipcMain.handle('sftp:list', (_, tabId: string, remotePath: string) => ssh.sftpList(tabId, remotePath));
  ipcMain.handle('sftp:mkdir', (_, tabId: string, remotePath: string) => ssh.sftpMkdir(tabId, remotePath));
  ipcMain.handle('sftp:delete', (_, tabId: string, remotePath: string, isDir: boolean) => ssh.sftpDelete(tabId, remotePath, isDir));
  ipcMain.handle('sftp:rename', (_, tabId: string, oldPath: string, newPath: string) => ssh.sftpRename(tabId, oldPath, newPath));
  ipcMain.handle('sftp:upload', (_, tabId: string, localPath: string, remotePath: string, transferId: string) => {
    if (mainWindow) ssh.sftpUpload(mainWindow, tabId, localPath, remotePath, transferId);
  });
  ipcMain.handle('sftp:download', (_, tabId: string, remotePath: string, localPath: string, transferId: string) => {
    if (mainWindow) ssh.sftpDownload(mainWindow, tabId, remotePath, localPath, transferId);
  });
  ipcMain.handle('sftp:readFile', (_, tabId: string, remotePath: string) => ssh.sftpReadFile(tabId, remotePath));
  ipcMain.handle('sftp:writeFile', (_, tabId: string, remotePath: string, base64Data: string) => ssh.sftpWriteFile(tabId, remotePath, base64Data));
  ipcMain.handle('sftp:stat', (_, tabId: string, remotePath: string) => ssh.sftpStat(tabId, remotePath));
  ipcMain.handle('sftp:home', async (_, tabId: string) => {
    const cached = ssh.getCwd(tabId);
    if (cached && cached.startsWith('/')) return cached;
    try {
      const out = await ssh.execCommand(tabId, 'echo $HOME');
      const home = (out || '').trim().split('\n').pop() || '';
      return home.startsWith('/') ? home : '/';
    } catch { return '/'; }
  });

  ipcMain.handle('backup:export', async (_, password: string) => {
    if (!mainWindow) return;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Syella Backup', defaultPath: `syella-backup-${Date.now()}.syella`,
      filters: [{ name: 'Syella Backup', extensions: ['syella'] }],
    });
    if (result.canceled || !result.filePath) return null;
    backup.exportBackupToFile(result.filePath, password);
    return result.filePath;
  });

  ipcMain.handle('backup:import', async (_, password: string, mode: 'merge' | 'replace') => {
    if (!mainWindow) return;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Syella Backup', filters: [{ name: 'Syella Backup', extensions: ['syella'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return backup.importBackupFromFile(result.filePaths[0], password, mode);
  });

  ipcMain.handle('dialog:openFile', async (_, options) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? null : result.filePaths;
  });

  ipcMain.handle('dialog:saveFile', async (_, options) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && app.dock) {
    try {
      const img = nativeImage.createFromPath(resolveIconPath());
      if (!img.isEmpty()) app.dock.setIcon(img);
    } catch {}
  }
  await db.initDatabase(getDataPath());
  registerIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  ssh.disconnectAll();
  db.closeDatabase();
  app.quit();
});
