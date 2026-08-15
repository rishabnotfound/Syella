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

// Bash & zsh init that emits OSC 7 (file://host/pwd) on every prompt.
// Kept as a single line with explicit ';' between clauses — bash/zsh both need
// a terminator before then/elif/fi/esac when there are no newlines.
const CWD_INIT =
  `__syella_emit_cwd() { printf '\\033]7;file://%s%s\\007' "$(hostname 2>/dev/null)" "$PWD"; }; ` +
  `if [ -n "$BASH_VERSION" ]; then ` +
  `  case ";$PROMPT_COMMAND;" in *";__syella_emit_cwd;"*) : ;; *) PROMPT_COMMAND="__syella_emit_cwd;$PROMPT_COMMAND" ;; esac; ` +
  `elif [ -n "$ZSH_VERSION" ]; then ` +
  `  autoload -Uz add-zsh-hook 2>/dev/null && add-zsh-hook precmd __syella_emit_cwd; ` +
  `fi; ` +
  `__syella_emit_cwd`;

export function connect(win: BrowserWindow, tabId: string, session: SyeSession, creds: SyeSessionCredentials, cols: number, rows: number): void {
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
    config.privateKey = creds.privateKey;
    if (creds.passphrase) config.passphrase = creds.passphrase;
  }

  client.on('ready', () => {
    client.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
      if (err) {
        win.webContents.send(`ssh:error:${tabId}`, err.message);
        return;
      }
      const conn: ActiveConnection = { client, shell: stream, sessionId: session.id, tabId };
      connections.set(tabId, conn);
      win.webContents.send(`ssh:connected:${tabId}`);

      const dataChannel = `ssh:data:${tabId}`;
      const cwdChannel = `ssh:cwd:${tabId}`;
      let pending: Buffer[] = [];
      let scheduled = false;
      let residual: Buffer = Buffer.alloc(0);

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

      // Strip OSC 7 (ESC ] 7 ; ... BEL | ESC \\) sequences before forwarding,
      // and emit each cwd we see. Handles split-across-chunks via `residual`.
      const OSC = 0x1b, BRACKET = 0x5d, BEL = 0x07;
      const scanAndStrip = (chunk: Buffer) => {
        const buf = residual.length ? Buffer.concat([residual, chunk]) : chunk;
        residual = Buffer.alloc(0);
        let out: Buffer[] = [];
        let i = 0;
        while (i < buf.length) {
          if (buf[i] === OSC && buf[i + 1] === BRACKET) {
            // find terminator: BEL (0x07) or ST (ESC \\ = 0x1b 0x5c)
            let end = -1, termLen = 0;
            for (let j = i + 2; j < buf.length; j++) {
              if (buf[j] === BEL) { end = j; termLen = 1; break; }
              if (buf[j] === OSC && buf[j + 1] === 0x5c) { end = j; termLen = 2; break; }
            }
            if (end === -1) { residual = buf.slice(i); break; }
            const payload = buf.slice(i + 2, end).toString('utf8');
            const m = /^7;file:\/\/[^/]*(\/.*)$/.exec(payload);
            if (m) {
              const cwd = decodeURI(m[1]);
              const c = connections.get(tabId);
              if (c && c.cwd !== cwd) { c.cwd = cwd; win.webContents.send(cwdChannel, cwd); }
              // drop the sequence entirely
              i = end + termLen;
              continue;
            }
            // not OSC 7 — keep it
            out.push(buf.slice(i, end + termLen));
            i = end + termLen;
            continue;
          }
          // fast-forward to the NEXT ESC (skip current byte to avoid a spin
          // when this ESC is not OSC — e.g. CSI colors, cursor moves).
          let next = buf.indexOf(OSC, i + 1);
          if (next === -1) next = buf.length;
          out.push(buf.slice(i, next));
          i = next;
        }
        if (out.length) enqueue(Buffer.concat(out));
      };

      stream.on('data', scanAndStrip);
      stream.stderr.on('data', enqueue);
      stream.on('close', () => {
        flush();
        connections.delete(tabId);
        win.webContents.send(`ssh:disconnected:${tabId}`);
      });

      // Install cwd emitter (idempotent). Wrap in eval so the multi-line snippet
      // isn't printed. Silently no-ops on shells that don't support it.
      stream.write(`eval "${CWD_INIT.replace(/"/g, '\\"')}" >/dev/null 2>&1\n`);
      // Clear the extra prompt echo caused by that command so the banner stays clean.
      stream.write('clear\n');

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

export async function sftpDelete(tabId: string, remotePath: string, isDir: boolean): Promise<void> {
  const sftp = await getSftp(tabId);
  return new Promise((resolve, reject) => {
    if (isDir) sftp.rmdir(remotePath, (err) => err ? reject(err) : resolve());
    else sftp.unlink(remotePath, (err) => err ? reject(err) : resolve());
  });
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
