import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { SyeSession, SyeSessionCredentials, SyeGroup, SyeSettings } from '../types';

let db: SqlJsDatabase;
let dbPath: string;
let encryptionKey: Buffer;

const DEFAULT_SETTINGS: SyeSettings = {
  terminal: {
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
    fontSize: 14, cursorStyle: 'bar', cursorBlink: true,
    scrollback: 10000, copyOnSelect: false, bellStyle: 'none',
  },
  ssh: { defaultPort: 22, keepalive: 30, connectionTimeout: 15 },
  security: { autoLockMinutes: 0, clearClipboardSeconds: 0 },
  general: { accentColor: '#388CFF', transparency: 0.15, confirmBeforeClose: true, restoreTabsOnStart: false },
};

function deriveKey(master: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(master, salt, 100000, 32, 'sha512');
}

function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(32);
  const key = deriveKey(encryptionKey, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), enc]).toString('base64');
}

function decrypt(data: string): string {
  if (!data) return '';
  const buf = Buffer.from(data, 'base64');
  const salt = buf.subarray(0, 32);
  const iv = buf.subarray(32, 48);
  const tag = buf.subarray(48, 64);
  const enc = buf.subarray(64);
  const key = deriveKey(encryptionKey, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function persist(): void {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export async function initDatabase(dataPath: string): Promise<void> {
  const dbDir = path.join(dataPath, 'database');
  fs.mkdirSync(dbDir, { recursive: true });

  const keyPath = path.join(dbDir, '.master.key');
  if (fs.existsSync(keyPath)) {
    encryptionKey = fs.readFileSync(keyPath);
  } else {
    encryptionKey = crypto.randomBytes(64);
    fs.writeFileSync(keyPath, encryptionKey, { mode: 0o600 });
  }

  const SQL = await initSqlJs();
  dbPath = path.join(dbDir, 'syella.db');

  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, host TEXT NOT NULL, port INTEGER DEFAULT 22,
      username TEXT NOT NULL, authMethod TEXT DEFAULT 'password', "group" TEXT DEFAULT '',
      tags TEXT DEFAULT '[]', favorite INTEGER DEFAULT 0, notes TEXT DEFAULT '',
      keepalive INTEGER DEFAULT 30, connectionTimeout INTEGER DEFAULT 15,
      startupCommand TEXT DEFAULT '', proxyJump TEXT DEFAULT '',
      createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS credentials (
      sessionId TEXT PRIMARY KEY, password TEXT DEFAULT '', privateKey TEXT DEFAULT '',
      passphrase TEXT DEFAULT '', FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, "order" INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);

  const existing = db.exec('SELECT value FROM settings WHERE key = ?', ['app']);
  if (!existing.length || !existing[0].values.length) {
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['app', JSON.stringify(DEFAULT_SETTINGS)]);
  }
  persist();
}

function queryAll(sql: string, params: any[] = []): any[] {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
    return obj;
  });
}

function queryOne(sql: string, params: any[] = []): any | undefined {
  const rows = queryAll(sql, params);
  return rows[0];
}

export function getSessions(): SyeSession[] {
  return queryAll('SELECT * FROM sessions ORDER BY name').map(r => ({
    ...r, tags: JSON.parse(r.tags), favorite: !!r.favorite,
  }));
}

export function getSession(id: string): SyeSession | undefined {
  const r = queryOne('SELECT * FROM sessions WHERE id = ?', [id]);
  if (!r) return undefined;
  return { ...r, tags: JSON.parse(r.tags), favorite: !!r.favorite };
}

export function saveSession(session: SyeSession): void {
  db.run(
    `INSERT OR REPLACE INTO sessions (id, name, host, port, username, authMethod, "group", tags, favorite, notes, keepalive, connectionTimeout, startupCommand, proxyJump, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.name, session.host, session.port, session.username, session.authMethod,
     session.group, JSON.stringify(session.tags), session.favorite ? 1 : 0, session.notes,
     session.keepalive, session.connectionTimeout, session.startupCommand, session.proxyJump,
     session.createdAt, session.updatedAt]
  );
  persist();
}

export function deleteSession(id: string): void {
  db.run('DELETE FROM credentials WHERE sessionId = ?', [id]);
  db.run('DELETE FROM sessions WHERE id = ?', [id]);
  persist();
}

export function getCredentials(sessionId: string): SyeSessionCredentials | undefined {
  const r = queryOne('SELECT * FROM credentials WHERE sessionId = ?', [sessionId]);
  if (!r) return undefined;
  return {
    sessionId: r.sessionId,
    password: r.password ? decrypt(r.password) : undefined,
    privateKey: r.privateKey ? decrypt(r.privateKey) : undefined,
    passphrase: r.passphrase ? decrypt(r.passphrase) : undefined,
  };
}

export function saveCredentials(creds: SyeSessionCredentials): void {
  db.run('INSERT OR REPLACE INTO credentials (sessionId, password, privateKey, passphrase) VALUES (?, ?, ?, ?)',
    [creds.sessionId, creds.password ? encrypt(creds.password) : '', creds.privateKey ? encrypt(creds.privateKey) : '', creds.passphrase ? encrypt(creds.passphrase) : '']);
  persist();
}

export function getGroups(): SyeGroup[] {
  return queryAll('SELECT * FROM groups ORDER BY "order"');
}

export function saveGroup(group: SyeGroup): void {
  db.run('INSERT OR REPLACE INTO groups (id, name, "order") VALUES (?, ?, ?)', [group.id, group.name, group.order]);
  persist();
}

export function deleteGroup(id: string): void {
  db.run('DELETE FROM groups WHERE id = ?', [id]);
  persist();
}

export function getSettings(): SyeSettings {
  const r = queryOne('SELECT value FROM settings WHERE key = ?', ['app']);
  return r ? JSON.parse(r.value) : DEFAULT_SETTINGS;
}

export function saveSettings(settings: SyeSettings): void {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['app', JSON.stringify(settings)]);
  persist();
}

export function isFirstRun(): boolean {
  const r = queryOne('SELECT value FROM metadata WHERE key = ?', ['firstRunComplete']);
  return !r;
}

export function completeFirstRun(): void {
  db.run('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)', ['firstRunComplete', '1']);
  persist();
}

export function getAllDataForBackup() {
  const sessions = getSessions();
  const groups = getGroups();
  const settings = getSettings();
  const credentials = sessions.map(s => getCredentials(s.id)).filter(Boolean) as SyeSessionCredentials[];
  return { sessions, groups, settings, credentials };
}

export function restoreFromBackup(data: { sessions: SyeSession[]; groups: SyeGroup[]; settings: SyeSettings; credentials: SyeSessionCredentials[] }, mode: 'merge' | 'replace'): void {
  if (mode === 'replace') {
    db.run('DELETE FROM credentials');
    db.run('DELETE FROM sessions');
    db.run('DELETE FROM groups');
  }
  for (const g of data.groups) saveGroup(g);
  for (const s of data.sessions) saveSession(s);
  for (const c of data.credentials) saveCredentials(c);
  saveSettings(data.settings);
}

export function closeDatabase(): void {
  if (db) { persist(); db.close(); }
}
