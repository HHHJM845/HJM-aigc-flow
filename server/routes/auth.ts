// server/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getUserByUsername } from '../db.js';
import { createSession, getSession, deleteSession, extractToken } from '../auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }
  if (password.length > 72) {
    return res.status(400).json({ error: '密码不能超过72个字符' });
  }

  const DUMMY_HASH = '$2b$10$invalid.hash.for.timing.protection.only.xxxxxxxxxxxxxxxxx';
  const user = getUserByUsername(username.trim());
  const hashToCheck = user ? user.password_hash : DUMMY_HASH;
  const match = await bcrypt.compare(password, hashToCheck);

  if (!user || !match) {
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
