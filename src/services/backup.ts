import * as crypto from 'crypto';
import * as fs from 'fs';
import { SyeBackup } from '../types';
import { getAllDataForBackup, restoreFromBackup } from './database';

const BACKUP_VERSION = 1;
const MAGIC = Buffer.from('SYELLA_BK');

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
  if (data.subarray(0, 8).toString() !== 'SYELLA_BK') throw new Error('Invalid backup file');
  const salt = data.subarray(8, 40);
  const iv = data.subarray(40, 56);
  const tag = data.subarray(56, 72);
  const encrypted = data.subarray(72);
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
