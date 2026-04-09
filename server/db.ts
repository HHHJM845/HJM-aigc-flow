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

  CREATE TABLE IF NOT EXISTS project_snapshots (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    data        TEXT NOT NULL,
    label       TEXT,
    auto        INTEGER DEFAULT 0,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_shares (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    snapshot_id TEXT NOT NULL,
    token       TEXT UNIQUE NOT NULL,
    expires_at  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id          TEXT PRIMARY KEY,
    share_id    TEXT NOT NULL,
    row_index   INTEGER NOT NULL,
    row_id      TEXT NOT NULL,
    status      TEXT NOT NULL,
    comment     TEXT DEFAULT '',
    created_at  INTEGER NOT NULL,
    UNIQUE(share_id, row_index)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    share_id    TEXT NOT NULL,
    row_index   INTEGER NOT NULL,
    row_id      TEXT NOT NULL,
    status      TEXT NOT NULL,
    comment     TEXT DEFAULT '',
    created_at  INTEGER NOT NULL,
    read        INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS templates (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    genre           TEXT NOT NULL,
    nodeType        TEXT NOT NULL,
    promptPreset    TEXT NOT NULL,
    styleTag        TEXT,
    compositionTip  TEXT,
    cameraParams    TEXT,
    durationHint    INTEGER,
    audioHint       TEXT,
    createdAt       INTEGER NOT NULL
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

// ── Review collaboration types ──────────────────────────

export interface SnapshotData {
  storyboardOrder: string[];
  storyboardRows: Array<{
    id: string;
    index: number;
    shotType: string;
    description: string;
    sourceSegment?: string;
  }>;
  imageNodes: Array<{
    rowId: string;
    imageUrl: string | null;
  }>;
}

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  data: string; // JSON string of SnapshotData
  label: string | null;
  auto: number;
  created_at: number;
}

export interface ProjectShare {
  id: string;
  project_id: string;
  snapshot_id: string;
  token: string;
  expires_at: number;
  created_at: number;
}

export interface Annotation {
  id: string;
  share_id: string;
  row_index: number;
  row_id: string;
  status: 'pending' | 'approved' | 'revision';
  comment: string;
  created_at: number;
}

export interface Notification {
  id: string;
  project_id: string;
  share_id: string;
  row_index: number;
  row_id: string;
  status: string;
  comment: string;
  created_at: number;
  read: number;
}

// ── Snapshot functions ───────────────────────────────────

export function createSnapshot(
  id: string,
  projectId: string,
  data: SnapshotData,
  label: string | null,
  auto: boolean
): void {
  db.prepare(
    'INSERT INTO project_snapshots (id, project_id, data, label, auto, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, JSON.stringify(data), label, auto ? 1 : 0, Date.now());
}

export function getSnapshotById(id: string): ProjectSnapshot | null {
  return (db.prepare('SELECT * FROM project_snapshots WHERE id = ?').get(id) as ProjectSnapshot) ?? null;
}

export function getSnapshotsByProjectId(projectId: string): Omit<ProjectSnapshot, 'data'>[] {
  return db.prepare(
    'SELECT id, project_id, label, auto, created_at FROM project_snapshots WHERE project_id = ? ORDER BY created_at DESC'
  ).all(projectId) as Omit<ProjectSnapshot, 'data'>[];
}

// ── Share functions ──────────────────────────────────────

export function createShare(
  id: string,
  projectId: string,
  snapshotId: string,
  token: string,
  expiresAt: number
): void {
  db.prepare(
    'INSERT INTO project_shares (id, project_id, snapshot_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, snapshotId, token, expiresAt, Date.now());
}

export function getShareByToken(token: string): ProjectShare | null {
  return (db.prepare('SELECT * FROM project_shares WHERE token = ?').get(token) as ProjectShare) ?? null;
}

// ── Annotation functions ─────────────────────────────────

export function upsertAnnotation(
  id: string,
  shareId: string,
  rowIndex: number,
  rowId: string,
  status: string,
  comment: string
): void {
  db.prepare(`
    INSERT INTO annotations (id, share_id, row_index, row_id, status, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(share_id, row_index) DO UPDATE SET
      id = excluded.id,
      status = excluded.status,
      comment = excluded.comment,
      created_at = excluded.created_at
  `).run(id, shareId, rowIndex, rowId, status, comment, Date.now());
}

export function getAnnotationsByShareId(shareId: string): Annotation[] {
  return db.prepare('SELECT * FROM annotations WHERE share_id = ? ORDER BY row_index').all(shareId) as Annotation[];
}

// ── Notification functions ───────────────────────────────

export function createNotification(
  id: string,
  projectId: string,
  shareId: string,
  rowIndex: number,
  rowId: string,
  status: string,
  comment: string
): void {
  db.prepare(
    'INSERT INTO notifications (id, project_id, share_id, row_index, row_id, status, comment, created_at, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)'
  ).run(id, projectId, shareId, rowIndex, rowId, status, comment, Date.now());
}

export function getNotificationsByProjectId(projectId: string): Notification[] {
  return db.prepare(
    'SELECT * FROM notifications WHERE project_id = ? ORDER BY created_at DESC'
  ).all(projectId) as Notification[];
}

export function markNotificationRead(id: string): void {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
}

export function markAllNotificationsRead(projectId: string): void {
  db.prepare('UPDATE notifications SET read = 1 WHERE project_id = ?').run(projectId);
}

// ── Template functions ───────────────────────────────────

export interface Template {
  id: string;
  name: string;
  genre: string;
  nodeType: 'image' | 'video';
  promptPreset: string;
  styleTag: string | null;
  compositionTip: string | null;
  cameraParams: string | null;
  durationHint: number | null;
  audioHint: string | null;
  createdAt: number;
}

export function getTemplates(nodeType?: string, genre?: string): Template[] {
  let sql = 'SELECT * FROM templates WHERE 1=1';
  const params: (string | number)[] = [];
  if (nodeType) { sql += ' AND nodeType = ?'; params.push(nodeType); }
  if (genre && genre !== '全部') { sql += ' AND genre = ?'; params.push(genre); }
  sql += ' ORDER BY createdAt DESC';
  return db.prepare(sql).all(...params) as Template[];
}

export function createTemplate(t: Omit<Template, 'createdAt'>): void {
  db.prepare(`
    INSERT INTO templates
      (id, name, genre, nodeType, promptPreset, styleTag, compositionTip, cameraParams, durationHint, audioHint, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(t.id, t.name, t.genre, t.nodeType, t.promptPreset,
         t.styleTag ?? null, t.compositionTip ?? null,
         t.cameraParams ?? null, t.durationHint ?? null,
         t.audioHint ?? null, Date.now());
}

export function updateTemplate(id: string, t: Partial<Omit<Template, 'id' | 'createdAt'>>): void {
  const ALLOWED = new Set(['name','genre','nodeType','promptPreset','styleTag','compositionTip','cameraParams','durationHint','audioHint']);
  const keys = Object.keys(t).filter(k => ALLOWED.has(k));
  if (!keys.length) return;
  const fields = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => (t as Record<string, unknown>)[k]);
  db.prepare(`UPDATE templates SET ${fields} WHERE id = ?`).run(...values, id);
}

export function deleteTemplate(id: string): void {
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
}
