// server/routes/review.ts
import { Router } from 'express';
import { randomBytes } from 'crypto';
import {
  getAllProjects,
  createSnapshot,
  getSnapshotById,
  createShare,
  getShareByToken,
  upsertAnnotation,
  getAnnotationsByShareId,
  createNotification,
  getNotificationsByProjectId,
  markNotificationRead,
  markAllNotificationsRead,
  type SnapshotData,
} from '../db.js';
import { broadcast } from '../ws.js';
import type { Project } from '../../src/lib/storage.js';

const router = Router();

// ── Helpers ──────────────────────────────────────────────

function genId(): string {
  return randomBytes(12).toString('base64url');
}

function genToken(): string {
  return randomBytes(9).toString('base64url'); // 12 URL-safe chars
}

function buildSnapshotData(project: Project): SnapshotData {
  const order = project.storyboardOrder ?? [];
  const rows = project.storyboardRows ?? [];
  const nodes = project.nodes ?? [];
  return {
    storyboardOrder: order,
    storyboardRows: rows,
    imageNodes: order.map(rowId => {
      const node = nodes.find(n => n.id === `storyboard-${rowId}`);
      const data = node?.data as Record<string, unknown> | undefined;
      const imageUrl = (data?.contents as string[] | undefined)?.[0]
        ?? (data?.content as string | undefined)
        ?? null;
      return { rowId, imageUrl };
    }),
  };
}

// ── POST /api/projects/:id/snapshot ──────────────────────

router.post('/projects/:id/snapshot', (req, res) => {
  const { id } = req.params;
  const { label } = req.body as { label?: string };

  const projects = getAllProjects();
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: 'project not found' });

  const snapshotId = genId();
  const snapshotLabel = label?.trim() || null;
  const data = buildSnapshotData(project);

  createSnapshot(snapshotId, id, data, snapshotLabel, false);
  res.json({ snapshotId, label: snapshotLabel, createdAt: Date.now() });
});

// ── POST /api/projects/:id/share ─────────────────────────

router.post('/projects/:id/share', (req, res) => {
  const { id } = req.params;

  const projects = getAllProjects();
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: 'project not found' });

  // Auto-create snapshot labeled with date
  const snapshotId = genId();
  const now = new Date();
  const label = `提交审片 · ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const data = buildSnapshotData(project);
  createSnapshot(snapshotId, id, data, label, true);

  const shareId = genId();
  const token = genToken();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  createShare(shareId, id, snapshotId, token, expiresAt);

  const url = `/r/${token}`;
  res.json({ shareId, token, url, expiresAt });
});

// ── GET /api/review/:token ────────────────────────────────

router.get('/review/:token', (req, res) => {
  const share = getShareByToken(req.params.token);
  if (!share) return res.status(410).json({ error: 'link expired or not found' });
  if (Date.now() > share.expires_at) return res.status(410).json({ error: 'link expired' });

  const snapshot = getSnapshotById(share.snapshot_id);
  if (!snapshot) return res.status(410).json({ error: 'snapshot not found' });

  const snapshotData: SnapshotData = JSON.parse(snapshot.data);

  // Fetch project name
  const projects = getAllProjects();
  const project = projects.find(p => p.id === share.project_id);
  const projectName = project?.name ?? '分镜提案';

  res.json({
    shareId: share.id,
    projectId: share.project_id,
    projectName,
    snapshotData,
    expiresAt: share.expires_at,
  });
});

// ── GET /api/review/:token/annotations ───────────────────

router.get('/review/:token/annotations', (req, res) => {
  const share = getShareByToken(req.params.token);
  if (!share) return res.status(410).json({ error: 'link expired or not found' });
  res.json(getAnnotationsByShareId(share.id));
});

// ── POST /api/review/:token/annotate ─────────────────────

router.post('/review/:token/annotate', (req, res) => {
  const share = getShareByToken(req.params.token);
  if (!share) return res.status(410).json({ error: 'link expired or not found' });
  if (Date.now() > share.expires_at) return res.status(410).json({ error: 'link expired' });

  const { rowIndex, rowId, status, comment } = req.body as {
    rowIndex: number;
    rowId: string;
    status: 'approved' | 'revision';
    comment?: string;
  };
  if (typeof rowIndex !== 'number' || !rowId || !status) {
    return res.status(400).json({ error: 'rowIndex, rowId and status are required' });
  }

  const annotationId = genId();
  upsertAnnotation(annotationId, share.id, rowIndex, rowId, status, comment ?? '');

  const notifId = genId();
  createNotification(notifId, share.project_id, share.id, rowIndex, rowId, status, comment ?? '');

  broadcast({
    type: 'annotation_added',
    projectId: share.project_id,
    shareId: share.id,
    rowIndex,
    rowId,
    status,
    comment: comment ?? '',
    createdAt: Date.now(),
  });

  res.json({ annotationId });
});

// ── GET /api/projects/:id/notifications ──────────────────

router.get('/projects/:id/notifications', (req, res) => {
  res.json(getNotificationsByProjectId(req.params.id));
});

// ── POST /api/notifications/:id/read ─────────────────────

router.post('/notifications/:id/read', (req, res) => {
  markNotificationRead(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/projects/:id/notifications/read-all ────────

router.post('/projects/:id/notifications/read-all', (req, res) => {
  markAllNotificationsRead(req.params.id);
  res.json({ ok: true });
});

export default router;
