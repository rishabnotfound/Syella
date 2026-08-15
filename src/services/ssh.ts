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
}

const connections = new Map<string, ActiveConnection>();

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

      stream.on('data', (data: Buffer) => win.webContents.send(`ssh:data:${tabId}`, data.toString('binary')));
      stream.stderr.on('data', (data: Buffer) => win.webContents.send(`ssh:data:${tabId}`, data.toString('binary')));
      stream.on('close', () => {
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
