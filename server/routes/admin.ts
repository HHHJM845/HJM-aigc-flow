// server/routes/admin.ts
import { Router } from 'express';
import { getAllUsers, createUser, deleteUser } from '../db.js';
import { getSession, extractToken } from '../auth.js';

const router = Router();

// Middleware: require admin token
function requireAdmin(req: any, res: any, next: any) {
  const token = extractToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Session expired' });
  if (session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  req.session = session;
  next();
}

// GET /api/admin/users
router.get('/users', requireAdmin, (_req, res) => {
  const users = getAllUsers();
  return res.json({ users });
});

// POST /api/admin/users
router.post('/users', requireAdmin, async (req: any, res) => {
  const { username, password, role = 'user' } = req.body as {
    username?: string;
    password?: string;
    role?: string;
  };
  if (!username || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' });
  }
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: '角色必须为 user 或 admin' });
  }

  const { default: bcrypt } = await import('bcryptjs');
  const hash = await bcrypt.hash(password, 10);
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    createUser(id, username.trim(), hash, role);
    return res.json({ ok: true, id, username: username.trim(), role });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: '用户名已存在' });
    }
    throw err;
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAdmin, (req: any, res) => {
  const { id } = req.params;
  if (id === req.session.userId) {
    return res.status(400).json({ error: '不能删除自己' });
  }
  deleteUser(id);
  return res.json({ ok: true });
});

export default router;
