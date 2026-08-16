import { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu, shell, net } from 'electron';
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

  // Windows portable build: electron-builder sets PORTABLE_EXECUTABLE_DIR to
  // the folder the .exe was launched from (NOT the temp extraction dir).
  // Storing data there is what makes "portable" actually portable.
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir) {
    const p = path.join(portableDir, 'data');
    fs.mkdirSync(p, { recursive: true });
    return p;
  }

  // macOS: writing inside /Applications/Syella.app is blocked and gets wiped
  // on reinstall. Use the standard per-user data location instead.
  if (process.platform === 'darwin') {
    const p = path.join(app.getPath('userData'), 'data');
    fs.mkdirSync(p, { recursive: true });
    return p;
  }

  // Windows Setup + everything else: keep the existing behavior of storing
  // data next to the executable (user prefers this for Setup builds).
  const p = path.join(path.dirname(app.getPath('exe')), 'data');
  fs.mkdirSync(p, { recursive: true });
  return p;
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
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    // On macOS use hiddenInset so the real traffic-light buttons appear inline
    // with our custom titlebar — this is the single biggest thing that makes
    // the app feel native instead of a web page in a frameless shell.
    frame: isMac ? undefined : false,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    trafficLightPosition: isMac ? { x: 14, y: 12 } : undefined,
    backgroundColor: '#05070d',
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

  // Route every outbound link (xterm WebLinksAddon, <a href>, window.open,
  // ctrl-clicks) to the user's default browser instead of opening a new
  // Electron BrowserWindow or navigating the renderer away from index.html.
  // Anything not http(s)/mailto is denied outright — no file:// escapes, no
  // custom-scheme surprises.
  const openExternallyIfSafe = (url: string) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
        shell.openExternal(url);
      }
    } catch {}
  };
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternallyIfSafe(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === mainWindow?.webContents.getURL()) return;
    event.preventDefault();
    openExternallyIfSafe(url);
  });
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
  ipcMain.handle('shell:openExternal', (_, url: string) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
        shell.openExternal(url);
        return true;
      }
    } catch {}
    return false;
  });
  ipcMain.handle('app:isFirstRun', () => db.isFirstRun());
  ipcMain.handle('app:completeFirstRun', () => db.completeFirstRun());

  ipcMain.handle('ssh:connect', (_, { tabId, session, credentials, cols, rows }) => {
    if (!mainWindow) return;
    const stealth = !!db.getSettings().security.stealthConnect;
    ssh.connect(mainWindow, tabId, session, credentials, cols, rows, { stealth });
  });
  ipcMain.handle('ssh:disconnect', (_, tabId: string) => ssh.disconnect(tabId));
  ipcMain.on('ssh:data', (_, tabId: string, data: string) => ssh.sendData(tabId, data));
  ipcMain.on('ssh:resize', (_, tabId: string, cols: number, rows: number) => ssh.resize(tabId, cols, rows));

  ipcMain.handle('ssh:exec', (_, tabId: string, command: string) => ssh.execCommand(tabId, command));
  ipcMain.handle('ssh:getCwd', (_, tabId: string) => ssh.getCwd(tabId));

  ipcMain.handle('sftp:list', (_, tabId: string, remotePath: string) => ssh.sftpList(tabId, remotePath));
  ipcMain.handle('sftp:mkdir', (_, tabId: string, remotePath: string) => ssh.sftpMkdir(tabId, remotePath));
  ipcMain.handle('sftp:delete', (_, tabId: string, remotePath: string, isDir: boolean, opId: string) => {
    if (mainWindow) return ssh.sftpDelete(mainWindow, tabId, remotePath, isDir, opId);
  });
  ipcMain.handle('sftp:rename', (_, tabId: string, oldPath: string, newPath: string) => ssh.sftpRename(tabId, oldPath, newPath));
  ipcMain.handle('sftp:upload', (_, tabId: string, localPath: string, remotePath: string, transferId: string) => {
    if (mainWindow) ssh.sftpUpload(mainWindow, tabId, localPath, remotePath, transferId);
  });
  ipcMain.handle('sftp:uploadPaths', (_, tabId: string, remoteBase: string, localPaths: string[], batchId: string) => {
    if (mainWindow) return ssh.sftpUploadPaths(mainWindow, tabId, remoteBase, localPaths, batchId);
  });
  ipcMain.handle('sftp:cancelUpload', (_, batchId: string) => ssh.sftpCancelUpload(batchId));
  ipcMain.handle('sftp:uploadStatus', (_, batchId: string) => ssh.sftpUploadStatus(batchId));

  // FX rates — renderer CSP blocks external fetches, so we do it here via
  // electron's net module (uses the OS network stack, bypasses CSP entirely).
  // Rate-shape returned to renderer: { EUR: 0.92, INR: 83.1, ... } — always
  // uppercase keys, base = USD.
  ipcMain.handle('fx:fetchUsdRates', async () => {
    const endpoints = [
      { url: 'https://open.er-api.com/v6/latest/USD', parse: (j: any) => j?.rates },
      // fawazahmed0's currency-api uses lowercase keys under { usd: {...} }.
      { url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
        parse: (j: any) => j?.usd ? Object.fromEntries(Object.entries(j.usd).map(([k, v]) => [k.toUpperCase(), v])) : null },
    ];
    for (const { url, parse } of endpoints) {
      try {
        const body = await new Promise<string>((resolve, reject) => {
          const req = net.request(url);
          const chunks: Buffer[] = [];
          req.on('response', res => {
            if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`));
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            res.on('error', reject);
          });
          req.on('error', reject);
          req.end();
        });
        const json = JSON.parse(body);
        const rates = parse(json);
        if (rates && typeof rates.EUR === 'number' && typeof rates.INR === 'number') {
          return { rates, ts: Date.now() };
        }
      } catch {}
    }
    return null;
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

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const send = (channel: string) => () => mainWindow?.webContents.send(channel);

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'Syella',
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { label: 'Settings…', accelerator: 'Cmd+,', click: send('menu:settings') },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Session', accelerator: 'CmdOrCtrl+N', click: send('menu:newSession') },
        { label: 'Command Palette', accelerator: 'CmdOrCtrl+K', click: send('menu:palette') },
        { label: 'Quick Connect', accelerator: 'CmdOrCtrl+P', click: send('menu:quickConnect') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: send('menu:closeTab') },
        ...(!isMac ? [
          { type: 'separator' as const },
          { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: send('menu:settings') },
          { type: 'separator' as const },
          { role: 'quit' as const },
        ] : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        // Copy/Paste/SelectAll: we intentionally use `click` (not the native
        // role) so we can route these to xterm when the terminal is focused.
        // xterm renders into a canvas, so the built-in Edit roles miss it.
        // Real <input>/<textarea> fields still get their shortcut via the
        // browser's default handling of Cmd/Ctrl+C/V/A.
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: send('menu:copy') },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: send('menu:paste') },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: send('menu:selectAll') },
        { type: 'separator' },
        { label: 'Find in Terminal', accelerator: 'CmdOrCtrl+F', click: send('menu:find') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: send('menu:toggleSidebar') },
        { label: 'Toggle File Manager', accelerator: 'CmdOrCtrl+E', click: send('menu:toggleSftp') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },
    {
      role: 'help',
      submenu: [
        { label: 'Syella on GitHub', click: () => shell.openExternal('https://github.com/rishabnotfound/Syella') },
        { label: 'Report an Issue', click: () => shell.openExternal('https://github.com/rishabnotfound/Syella/issues') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  ssh.disconnectAll();
  db.closeDatabase();
  app.quit();
});
