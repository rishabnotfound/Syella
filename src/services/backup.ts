import * as crypto from 'crypto';
import * as fs from 'fs';
import { SyeBackup } from '../types';
import { getAllDataForBackup, restoreFromBackup } from './database';

const BACKUP_VERSION = 1;
const MAGIC = Buffer.from('SYELLA_BK');
const MAGIC_LEN = MAGIC.length; // 9 bytes

export function createBackup(password: string): Buffer {
  const data = getAllDataForBackup();
  const backup: SyeBackup = { version: BACKUP_VERSION, createdAt: Date.now(), ...data };
  const json = JSON.stringify(backup);
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 200000, 32, 'sha512');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, salt, iv, tag, encrypted]);
}

export function restoreBackup(data: Buffer, password: string, mode: 'merge' | 'replace'): { sessions: number; groups: number } {
  // Magic is 9 bytes ("SYELLA_BK"), not 8 — previously the salt was written at
  // offset 9 but read at offset 8, so every subsequent field was off by one
  // and decryption always failed with "Invalid password or corrupted backup".
  if (data.subarray(0, MAGIC_LEN).toString() !== 'SYELLA_BK') throw new Error('Invalid backup file');
  const salt = data.subarray(MAGIC_LEN, MAGIC_LEN + 32);
  const iv = data.subarray(MAGIC_LEN + 32, MAGIC_LEN + 48);
  const tag = data.subarray(MAGIC_LEN + 48, MAGIC_LEN + 64);
  const encrypted = data.subarray(MAGIC_LEN + 64);
  const key = crypto.pbkdf2Sync(password, salt, 200000, 32, 'sha512');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let json: string;
  try {
    json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Invalid password or corrupted backup');
  }
  const backup: SyeBackup = JSON.parse(json);
  if (backup.version !== BACKUP_VERSION) throw new Error('Unsupported backup version');
  restoreFromBackup(backup, mode);
  return { sessions: backup.sessions.length, groups: backup.groups.length };
}

export function exportBackupToFile(filePath: string, password: string): void {
  fs.writeFileSync(filePath, createBackup(password));
}

export function importBackupFromFile(filePath: string, password: string, mode: 'merge' | 'replace'): { sessions: number; groups: number } {
  const data = fs.readFileSync(filePath);
  return restoreBackup(data, password, mode);
}
