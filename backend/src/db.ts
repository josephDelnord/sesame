import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePassword } from './password.js';

/**
 * Base de données des équipements clients.
 *
 * Stockage JSON isolé derrière cette interface : remplaçable par SQLite ou
 * PostgreSQL sans toucher au reste de l'application. Les mots de passe ne
 * sont jamais stockés : ils sont recalculés à la demande.
 */

export interface RouterRecord {
  id: number;
  serialNumber: string;
  clientCode: string;
  ip: string;
  createdAt: string;
}

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const DB_FILE = join(DATA_DIR, 'db.json');

let records: RouterRecord[] = [];
let nextId = 1;

export function initDb(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (existsSync(DB_FILE)) {
    const raw = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    records = raw.records ?? [];
    nextId = raw.nextId ?? records.length + 1;
  }
}

function persist(): void {
  writeFileSync(DB_FILE, JSON.stringify({ records, nextId }, null, 2));
}

export function listRecords(): RouterRecord[] {
  return records.map((r) => ({ ...r }));
}

/**
 * Retrouve l'enregistrement correspondant aux données partielles fournies.
 * Chaque champ fourni (non vide) doit correspondre ; au moins un est requis.
 */
export function findRecord(partial: {
  serialNumber?: string;
  clientCode?: string;
  ip?: string;
}): RouterRecord | null {
  const criteria: Array<[keyof RouterRecord, string]> = [];
  if (partial.serialNumber) criteria.push(['serialNumber', partial.serialNumber.trim().toUpperCase()]);
  if (partial.clientCode) criteria.push(['clientCode', partial.clientCode.trim().toUpperCase()]);
  if (partial.ip) criteria.push(['ip', partial.ip.trim()]);

  if (criteria.length === 0) return null;

  const matches = records.filter((r) =>
    criteria.every(([key, value]) => String(r[key]).toUpperCase() === value),
  );
  if (matches.length > 1) {
    throw new Error('AMBIGUOUS');
  }
  return matches[0] ? { ...matches[0] } : null;
}

export function createRecord(input: {
  serialNumber: string;
  clientCode: string;
  ip: string;
}): RouterRecord {
  const record: RouterRecord = {
    id: nextId++,
    serialNumber: input.serialNumber.trim().toUpperCase(),
    clientCode: input.clientCode.trim().toUpperCase(),
    ip: input.ip.trim(),
    createdAt: new Date().toISOString(),
  };
  records.push(record);
  persist();
  return record;
}

/** Mot de passe recalculé pour un enregistrement (jamais stocké). */
export function passwordOf(record: RouterRecord): string {
  return generatePassword(record.serialNumber, record.clientCode);
}

export function isEmpty(): boolean {
  return records.length === 0;
}
