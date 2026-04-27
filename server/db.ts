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

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_context (
    project_id  TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
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

const DEFAULT_IMAGE_TEMPLATES = [
  { name: '写实', genre: '写实摄影', styleTag: '写实', promptPreset: '超写实摄影风格，自然光线，细节丰富，照片级质感，真实皮肤纹理' },
  { name: '动漫', genre: '动漫插画', styleTag: '动漫', promptPreset: '日式动漫风格，清晰线条，鲜艳色彩，二次元角色，精细插画' },
  { name: '油画', genre: '艺术绘画', styleTag: '油画', promptPreset: '古典油画风格，丰富肌理，厚涂笔触，温暖色调，博物馆级质感' },
  { name: '水彩', genre: '艺术绘画', styleTag: '水彩', promptPreset: '水彩插画风格，通透色彩，柔和边缘，水痕晕染效果，轻盈唯美' },
  { name: '赛博朋克', genre: '科幻未来', styleTag: '赛博朋克', promptPreset: '赛博朋克风格，霓虹灯光，暗黑城市背景，科技感，未来都市氛围' },
  { name: '中国水墨', genre: '国风艺术', styleTag: '国风', promptPreset: '中国传统水墨画风格，留白构图，墨色浓淡变化，写意笔法，诗意意境' },
  { name: '素描', genre: '艺术绘画', styleTag: '素描', promptPreset: '铅笔素描风格，黑白灰调，线条清晰，光影层次丰富，手绘质感' },
  { name: '3D渲染', genre: '3D设计', styleTag: '3D渲染', promptPreset: '高质量3D渲染，逼真光照，材质细腻，景深效果，电影级渲染质感' },
];

export function seedDefaultImageTemplates(): void {
  const existing = db.prepare("SELECT COUNT(*) as cnt FROM templates WHERE id LIKE 'tpl_seed_%'").get() as { cnt: number };
  if (existing.cnt > 0) return; // already seeded
  const insert = db.prepare(`
    INSERT OR IGNORE INTO templates (id, name, genre, nodeType, promptPreset, styleTag, compositionTip, cameraParams, durationHint, audioHint, createdAt)
    VALUES (?, ?, ?, 'image', ?, ?, NULL, NULL, NULL, NULL, ?)
  `);
  const seedTx = db.transaction(() => {
    const now = Date.now();
    for (const t of DEFAULT_IMAGE_TEMPLATES) {
      insert.run(`tpl_seed_${t.name}`, t.name, t.genre, t.promptPreset, t.styleTag, now);
    }
  });
  seedTx();
}

// ── User / Auth functions ────────────────────────────────

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  created_at: number;
}

export function getUserByUsername(username: string): UserRecord | null {
  return (db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRecord) ?? null;
}

export function getAllUsers(): Omit<UserRecord, 'password_hash'>[] {
  return db.prepare(
    'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC'
  ).all() as Omit<UserRecord, 'password_hash'>[];
}

export function createUser(id: string, username: string, passwordHash: string, role: string): void {
  db.prepare(
    'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, passwordHash, role, Date.now());
}

export function deleteUser(id: string): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export async function seedAdminUser(): Promise<void> {
  const { default: bcrypt } = await import('bcryptjs');
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (existing) return;

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn('[auth] ADMIN_PASSWORD not set in .env — skipping admin seed');
    return;
  }

  const hash = await bcrypt.hash(adminPassword, 10);
  const id = 'user_admin';
  createUser(id, adminUsername, hash, 'admin');
  console.log(`[auth] Admin user '${adminUsername}' created`);
}

// ── Project Context functions ─────────────────────────────────

export interface ProjectContext {
  keyword?: string;
  topicInsight?: string;
  selectedTopic?: string;
  scriptSummary?: string;
  sceneCount?: number;
  sceneDescriptions?: string;
  updatedAt: number;
}

export function getProjectContext(projectId: string): ProjectContext | null {
  const row = db.prepare('SELECT data FROM project_context WHERE project_id = ?').get(projectId) as { data: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.data) as ProjectContext; } catch { return null; }
}

export function upsertProjectContext(projectId: string, patch: Partial<Omit<ProjectContext, 'updatedAt'>>): ProjectContext {
  const existing = getProjectContext(projectId) ?? {};
  const updated: ProjectContext = { ...existing, ...patch, updatedAt: Date.now() };
  db.prepare(
    'INSERT OR REPLACE INTO project_context (project_id, data, updated_at) VALUES (?, ?, ?)'
  ).run(projectId, JSON.stringify(updated), updated.updatedAt);
  return updated;
}

export function deleteProjectContext(projectId: string): void {
  db.prepare('DELETE FROM project_context WHERE project_id = ?').run(projectId);
}
