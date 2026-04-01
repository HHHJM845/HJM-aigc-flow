// server/db.ts
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Project } from '../src/lib/storage.js';

import type BetterSqlite3 from 'better-sqlite3';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3') as typeof BetterSqlite3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/projects.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id        TEXT PRIMARY KEY,
    data      TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`);

export function getAllProjects(): Project[] {
  const rows = db.prepare('SELECT data FROM projects ORDER BY updatedAt DESC').all() as { data: string }[];
  return rows.flatMap((r: { data: string }) => {
    try { return [JSON.parse(r.data) as Project]; }
    catch { return []; }
  });
}

export function upsertProject(project: Project): void {
  db.prepare(
    'INSERT OR REPLACE INTO projects (id, data, updatedAt) VALUES (?, ?, ?)'
  ).run(project.id, JSON.stringify(project), project.updatedAt);
}

export function removeProject(id: string): void {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}
