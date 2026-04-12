// server/routes/auth.ts
import { Router } from 'express';
import { getUserByUsername } from '../db.js';
import { createSession, getSession, deleteSession, extractToken } from '../auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }

  const user = getUserByUsername(username.trim());
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const { default: bcrypt } = await import('bcryptjs');
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = createSession(user.id, user.username, user.role);
  return res.json({ token, username: user.username, role: user.role });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const token = extractToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Session expired' });

  return res.json({ username: session.username, role: session.role });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = extractToken(req.headers.authorization);
  if (token) deleteSession(token);
  return res.json({ ok: true });
});

export default router;
