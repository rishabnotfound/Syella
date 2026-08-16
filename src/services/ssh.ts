import { Client, ClientChannel, SFTPWrapper, ConnectConfig } from 'ssh2';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { SyeSession, SyeSessionCredentials, SyeSftpEntry } from '../types';

interface ActiveConnection {
  client: Client;
  shell?: ClientChannel;
  sftp?: SFTPWrapper;
  sessionId: string;
  tabId: string;
  cwd?: string;
}

const connections = new Map<string, ActiveConnection>();

export interface ConnectOptions { stealth?: boolean }

export function connect(win: BrowserWindow, tabId: string, session: SyeSession, creds: SyeSessionCredentials, cols: number, rows: number, opts: ConnectOptions = {}): void {
  const client = new Client();
  const config: ConnectConfig = {
    host: session.host,
    port: session.port,
    username: session.username,
    readyTimeout: (session.connectionTimeout || 15) * 1000,
    keepaliveInterval: (session.keepalive || 30) * 1000,
    keepaliveCountMax: 3,
  };

  if (session.authMethod === 'password' && creds.password) {
    config.password = creds.password;
  } else if (session.authMethod === 'privateKey' && creds.privateKey) {
    // Older sessions may have stored a filesystem path instead of the PEM/OpenSSH
    // material (pre-fix behavior of the Browse button). Detect that and read
    // the file inline so those sessions keep working.
    let key = creds.privateKey;
    if (!/-----BEGIN [A-Z0-9 ]+-----/.test(key) && key.length < 1024) {
      try {
        const resolved = key.startsWith('~/') ? path.join(process.env.HOME || '', key.slice(2)) : key;
        if (fs.existsSync(resolved)) key = fs.readFileSync(resolved, 'utf8');
      } catch {}
    }
    config.privateKey = key;
    if (creds.passphrase) config.passphrase = creds.passphrase;
  }

  if (opts.stealth) {
    // Reduce what the server can fingerprint about this client:
    //  - identify as generic OpenSSH so the ssh2-js library isn't advertised
    //  - strip the public key's trailing "user@host" comment (recovered by
    //    normalizing to a headers-only PEM/OPENSSH blob if present)
    //  - refuse to forward the local ssh-agent (huge footgun on hostile hosts)
    // Username, IP, and pubkey material itself are inherent to auth and can't
    // be masked here — those need a VPN/jump host at the network layer.
    (config as any).ident = 'SSH-2.0-OpenSSH_9.6';
    (config as any).agentForward = false;
    if (typeof config.privateKey === 'string') {
      config.privateKey = config.privateKey.replace(
        /(-----BEGIN [^-]+-----)([\s\S]*?)(-----END [^-]+-----)/,
        (_m, head, body, tail) => head + body.replace(/[ \t]+\S+@\S+\s*$/gm, '') + tail
      );
    }
  }

  client.on('ready', () => {
    const shellOpts: any = opts.stealth
      ? { term: 'xterm', cols, rows, env: {}, x11: false }
      : { term: 'xterm-256color', cols, rows };
    client.shell(shellOpts, (err, stream) => {
      if (err) {
        win.webContents.send(`ssh:error:${tabId}`, err.message);
        return;
      }
      const conn: ActiveConnection = { client, shell: stream, sessionId: session.id, tabId };
      connections.set(tabId, conn);
      // Signal `connected` immediately — the renderer dismisses its React
      // overlay so the very first bytes the shell sends (MOTD, prompt) show
      // up in the xterm on a clean slate, with nothing above them.
      win.webContents.send(`ssh:connected:${tabId}`);

      const dataChannel = `ssh:data:${tabId}`;
      let pending: Buffer[] = [];
      let scheduled = false;

      const flush = () => {
        scheduled = false;
        if (!pending.length) return;
        const merged = pending.length === 1 ? pending[0] : Buffer.concat(pending);
        pending = [];
        win.webContents.send(dataChannel, merged);
      };
      const enqueue = (data: Buffer) => {
        pending.push(data);
        if (scheduled) return;
        scheduled = true;
        setImmediate(flush);
      };

      // No shell injection: bytes from the server go straight through so MOTD,
      // prompt, and all escape sequences are exactly what the server sent.
      // The SFTP panel navigates via its own explicit UI (breadcrumbs, click,
      // back button) rather than trying to shadow the shell's cwd.
      stream.on('data', enqueue);
      stream.stderr.on('data', enqueue);
      stream.on('close', () => {
        flush();
        connections.delete(tabId);
        win.webContents.send(`ssh:disconnected:${tabId}`);
      });

      if (session.startupCommand) {
        stream.write(session.startupCommand + '\n');
      }
    });
  });

  client.on('error', (err) => win.webContents.send(`ssh:error:${tabId}`, err.message));
  client.on('close', () => {
    connections.delete(tabId);
    win.webContents.send(`ssh:disconnected:${tabId}`);
  });

  client.connect(config);
}

export function disconnect(tabId: string): void {
  const conn = connections.get(tabId);
  if (conn) {
    conn.shell?.close();
    conn.client.end();
    connections.delete(tabId);
  }
}

export function sendData(tabId: string, data: string): void {
  connections.get(tabId)?.shell?.write(data);
}

export function resize(tabId: string, cols: number, rows: number): void {
  connections.get(tabId)?.shell?.setWindow(rows, cols, 0, 0);
}

export function getCwd(tabId: string): string | null {
  return connections.get(tabId)?.cwd || null;
}

function getSftp(tabId: string): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    const conn = connections.get(tabId);
    if (!conn) return reject(new Error('Not connected'));
    if (conn.sftp) return resolve(conn.sftp);
    conn.client.sftp((err, sftp) => {
      if (err) return reject(err);
      conn.sftp = sftp;
      resolve(sftp);
    });
  });
}

export async function sftpList(tabId: string, remotePath: string): Promise<SyeSftpEntry[]> {
  const sftp = await getSftp(tabId);
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) return reject(err);
      resolve(list.map(item => ({
        name: item.filename,
        type: item.attrs.isDirectory() ? 'directory' : item.attrs.isSymbolicLink() ? 'symlink' : 'file',
        size: item.attrs.size,
        modifyTime: item.attrs.mtime * 1000,
        accessTime: item.attrs.atime * 1000,
        permissions: item.attrs.mode,
        owner: item.attrs.uid,
        group: item.attrs.gid,
      })));
    });
  });
}

export async function sftpMkdir(tabId: string, remotePath: string): Promise<void> {
  const sftp = await getSftp(tabId);
  return new Promise((resolve, reject) => sftp.mkdir(remotePath, (err) => err ? reject(err) : resolve()));
}

export async function sftpDelete(
  win: BrowserWindow, tabId: string, remotePath: string, isDir: boolean, opId: string,
): Promise<void> {
  const sftp = await getSftp(tabId);
  const send = (payload: any) => {
    if (!win.isDestroyed()) win.webContents.send('sftp:deleteProgress', { id: opId, tabId, ...payload });
  };
  if (!isDir) {
    send({ removed: 0, path: remotePath });
    await new Promise<void>((resolve, reject) => sftp.unlink(remotePath, (err) => err ? reject(err) : resolve()));
    send({ done: true, removed: 1 });
    return;
  }

  let removed = 0;
  let lastSent = 0;
  const tick = (currentPath: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastSent < 100) return;
    lastSent = now;
    send({ removed, path: currentPath });
  };
  tick(remotePath, true);

  const walk = async (dir: string): Promise<void> => {
    const entries = await new Promise<any[]>((resolve, reject) =>
      sftp.readdir(dir, (err, list) => err ? reject(err) : resolve(list)));
    const files: string[] = [];
    const subdirs: string[] = [];
    for (const entry of entries) {
      if (entry.filename === '.' || entry.filename === '..') continue;
      const child = dir.endsWith('/') ? dir + entry.filename : dir + '/' + entry.filename;
      const isSubDir = entry.attrs.isDirectory
        ? entry.attrs.isDirectory()
        : (entry.longname || '').startsWith('d');
      if (isSubDir) subdirs.push(child); else files.push(child);
    }
    // Parallelize file deletion; each resolved file bumps the counter.
    await Promise.all(files.map(f => new Promise<void>((resolve, reject) =>
      sftp.unlink(f, (err) => {
        if (err) return reject(err);
        removed += 1;
        tick(f);
        resolve();
      }))));
    for (const sub of subdirs) {
      await walk(sub);
      await new Promise<void>((resolve, reject) => sftp.rmdir(sub, (err) => {
        if (err) return reject(err);
        removed += 1;
        tick(sub);
        resolve();
      }));
    }
  };
  await walk(remotePath);
  await new Promise<void>((resolve, reject) => sftp.rmdir(remotePath, (err) => err ? reject(err) : resolve()));
  removed += 1;
  send({ done: true, removed });
}

export async function sftpRename(tabId: string, oldPath: string, newPath: string): Promise<void> {
  const sftp = await getSftp(tabId);
  return new Promise((resolve, reject) => sftp.rename(oldPath, newPath, (err) => err ? reject(err) : resolve()));
}

export async function sftpDownload(win: BrowserWindow, tabId: string, remotePath: string, localPath: string, transferId: string): Promise<void> {
  const sftp = await getSftp(tabId);
  const stat = await new Promise<any>((resolve, reject) => sftp.stat(remotePath, (err: Error | undefined, s: any) => err ? reject(err) : resolve(s)));
  const total = stat.size;
  let transferred = 0;
  const readStream = sftp.createReadStream(remotePath);
  const writeStream = fs.createWriteStream(localPath);
  readStream.on('data', (chunk: any) => {
    transferred += chunk.length;
    win.webContents.send('transfer:progress', { id: transferId, transferred, total, speed: chunk.length });
  });
  return new Promise<void>((resolve, reject) => {
    readStream.pipe(writeStream);
    writeStream.on('finish', () => { win.webContents.send('transfer:complete', { id: transferId }); resolve(); });
    readStream.on('error', (err: Error) => { win.webContents.send('transfer:error', { id: transferId, error: err.message }); reject(err); });
    writeStream.on('error', (err: Error) => { win.webContents.send('transfer:error', { id: transferId, error: err.message }); reject(err); });
  });
}

export async function sftpReadFile(tabId: string, remotePath: string): Promise<{ data: string; size: number }> {
  const sftp = await getSftp(tabId);
  return new Promise((resolve, reject) => {
    sftp.readFile(remotePath, (err, buf) => {
      if (err) return reject(err);
      resolve({ data: buf.toString('base64'), size: buf.length });
    });
  });
}

export async function sftpWriteFile(tabId: string, remotePath: string, base64Data: string): Promise<void> {
  const sftp = await getSftp(tabId);
  const buf = Buffer.from(base64Data, 'base64');
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, buf, (err) => err ? reject(err) : resolve());
  });
}

export async function sftpStat(tabId: string, remotePath: string): Promise<{ size: number; isDirectory: boolean }> {
  const sftp = await getSftp(tabId);
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, s: any) => {
      if (err) return reject(err);
      resolve({ size: s.size, isDirectory: s.isDirectory() });
    });
  });
}

export async function sftpUpload(win: BrowserWindow, tabId: string, localPath: string, remotePath: string, transferId: string): Promise<void> {
  const sftp = await getSftp(tabId);
  const stat = fs.statSync(localPath);
  const total = stat.size;
  let transferred = 0;
  const readStream = fs.createReadStream(localPath);
  const writeStream = sftp.createWriteStream(remotePath);
  readStream.on('data', (chunk: any) => {
    transferred += chunk.length;
    win.webContents.send('transfer:progress', { id: transferId, transferred, total, speed: chunk.length });
  });
  return new Promise<void>((resolve, reject) => {
    readStream.pipe(writeStream);
    writeStream.on('finish', () => { win.webContents.send('transfer:complete', { id: transferId }); resolve(); });
    readStream.on('error', (err: Error) => { win.webContents.send('transfer:error', { id: transferId, error: err.message }); reject(err); });
    writeStream.on('error', (err: Error) => { win.webContents.send('transfer:error', { id: transferId, error: err.message }); reject(err); });
  });
}

interface UploadPlanEntry {
  local: string;
  remote: string;
  size: number;
}

async function mkdirP(sftp: SFTPWrapper, dir: string): Promise<void> {
  return new Promise(resolve => {
    // sftp.mkdir errors on existing dirs — we tolerate that. For nested paths
    // we walk from the root creating each segment. Cheap because SSH latency
    // dominates and users rarely drop deeply-nested trees.
    const parts = dir.split('/').filter(Boolean);
    let acc = dir.startsWith('/') ? '' : '.';
    let i = 0;
    const step = () => {
      if (i >= parts.length) return resolve();
      acc = acc + '/' + parts[i++];
      sftp.mkdir(acc, () => step());
    };
    step();
  });
}

function walkLocalTree(root: string, remoteBase: string): UploadPlanEntry[] {
  const out: UploadPlanEntry[] = [];
  const stat = fs.statSync(root);
  const baseName = path.basename(root);
  if (!stat.isDirectory()) {
    out.push({ local: root, remote: `${remoteBase}/${baseName}`.replace(/\/+/g, '/'), size: stat.size });
    return out;
  }
  const walk = (localDir: string, remoteDir: string) => {
    for (const name of fs.readdirSync(localDir)) {
      const l = path.join(localDir, name);
      const r = `${remoteDir}/${name}`.replace(/\/+/g, '/');
      const s = fs.statSync(l);
      if (s.isDirectory()) walk(l, r);
      else if (s.isFile()) out.push({ local: l, remote: r, size: s.size });
    }
  };
  walk(root, `${remoteBase}/${baseName}`.replace(/\/+/g, '/'));
  return out;
}

function uploadSingleFile(win: BrowserWindow, sftp: SFTPWrapper, entry: UploadPlanEntry, onChunk: (delta: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(entry.local);
    const writeStream = sftp.createWriteStream(entry.remote);
    readStream.on('data', (chunk: any) => onChunk(chunk.length));
    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', () => resolve());
    readStream.pipe(writeStream);
  });
}

// Snapshot per batch — pulled by the renderer via `sftp:uploadStatus` so the
// UI has a reliable source of truth even if IPC push events lag or drop.
interface BatchSnapshot {
  tabId: string;
  transferred: number;
  total: number;
  totalFiles: number;
  doneFiles: number;
  currentName: string;
  done: boolean;
  cancelled: boolean;
  error?: string;
}
interface ActiveBatch {
  cancelled: boolean;
  abortCurrent?: () => void;
  snapshot: BatchSnapshot;
}
const activeBatches = new Map<string, ActiveBatch>();

export function sftpCancelUpload(batchId: string): void {
  const b = activeBatches.get(batchId);
  if (!b) return;
  b.cancelled = true;
  b.abortCurrent?.();
}

// Renderer polls this every ~300ms while any batch is active. Returns null
// once the batch has been GC'd (~2s after completion) so the poller can stop.
export function sftpUploadStatus(batchId: string): BatchSnapshot | null {
  const b = activeBatches.get(batchId);
  return b ? { ...b.snapshot } : null;
}

function uploadSingleFileCancelable(
  sftp: SFTPWrapper, entry: UploadPlanEntry,
  onChunk: (delta: number) => void, batch: ActiveBatch,
): Promise<void> {
  // sftp.createWriteStream + pipe was silently swallowing the completion signal
  // — 'finish' fires when the local read is drained but the remote SFTP handle
  // hasn't necessarily been closed, so we'd never resolve. Using sftp.fastPut
  // instead: it opens, writes, closes, and callbacks — one event, one resolve.
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      batch.abortCurrent = undefined;
      if (err) reject(err); else resolve();
    };
    let lastReported = 0;
    batch.abortCurrent = () => done(new Error('cancelled'));
    (sftp as any).fastPut(entry.local, entry.remote, {
      step: (transferredForFile: number) => {
        if (settled) return;
        const delta = transferredForFile - lastReported;
        if (delta > 0) { lastReported = transferredForFile; onChunk(delta); }
      },
    }, (err: Error | undefined) => {
      if (err) done(err); else done();
    });
  });
}

export async function sftpUploadPaths(
  win: BrowserWindow, tabId: string, remoteBase: string, localPaths: string[], batchId: string
): Promise<void> {
  const sftp = await getSftp(tabId);
  const snapshot: BatchSnapshot = {
    tabId, transferred: 0, total: 0, totalFiles: 0, doneFiles: 0,
    currentName: '', done: false, cancelled: false,
  };
  const batch: ActiveBatch = { cancelled: false, snapshot };
  activeBatches.set(batchId, batch);

  // Build a flat plan of every file to upload (walking folders).
  const plan: UploadPlanEntry[] = [];
  for (const p of localPaths) {
    try { plan.push(...walkLocalTree(p, remoteBase)); } catch {}
  }
  snapshot.total = plan.reduce((s, e) => s + e.size, 0);
  snapshot.totalFiles = plan.length;
  snapshot.currentName = plan[0] ? path.basename(plan[0].local) : '';

  // Create parent directories in remote, shortest-first so parents exist first.
  const dirs = new Set<string>();
  for (const e of plan) dirs.add(path.posix.dirname(e.remote));
  const dirList = Array.from(dirs).sort((a, b) => a.length - b.length);
  for (const d of dirList) {
    if (batch.cancelled) break;
    await mkdirP(sftp, d);
  }

  for (const entry of plan) {
    if (batch.cancelled) break;
    snapshot.currentName = path.basename(entry.local);
    try {
      await uploadSingleFileCancelable(sftp, entry, (delta) => {
        snapshot.transferred += delta;
      }, batch);
      snapshot.doneFiles += 1;
    } catch (e: any) {
      if (batch.cancelled) break;
      snapshot.error = `${entry.local}: ${e.message}`;
    }
  }

  snapshot.done = true;
  snapshot.cancelled = batch.cancelled;
  // Keep the entry alive briefly so the renderer's next poll sees the terminal
  // state before we GC it (otherwise the poll would return null and the UI
  // wouldn't know whether to show "done" or just stop tracking).
  setTimeout(() => activeBatches.delete(batchId), 4000);
}

export function execCommand(tabId: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = connections.get(tabId);
    if (!conn) return reject(new Error('Not connected'));
    conn.client.exec(command, (err, stream) => {
      if (err) return reject(err);
      let output = '';
      stream.on('data', (data: any) => { output += data.toString(); });
      stream.stderr.on('data', (data: any) => { output += data.toString(); });
      stream.on('close', () => resolve(output.trim()));
    });
  });
}

export function disconnectAll(): void {
  for (const [id, conn] of connections) {
    conn.shell?.close();
    conn.client.end();
  }
  connections.clear();
}
