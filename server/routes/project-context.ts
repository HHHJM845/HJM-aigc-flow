// server/routes/project-context.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getProjectContext, upsertProjectContext } from '../db.js';

const router = Router();

router.get('/:projectId', (req: Request, res: Response) => {
  const ctx = getProjectContext(req.params.projectId);
  res.json(ctx ?? {});
});

router.put('/:projectId', (req: Request, res: Response) => {
  const { projectId } = req.params;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  const patch = req.body as Record<string, unknown>;
  const updated = upsertProjectContext(projectId, patch);
  res.json(updated);
});

export default router;
