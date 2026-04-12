# Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake login (any input accepted) with real bcrypt-verified accounts stored in SQLite, with an in-app admin page for managing users.

**Architecture:** SQLite `users` table stores accounts with bcrypt-hashed passwords. On login, the server verifies credentials and stores a session token in memory; the frontend stores the token in sessionStorage. An admin-only view inside the app lets the admin create and delete user accounts.

**Tech Stack:** bcryptjs, better-sqlite3 (existing), Express (existing), React + sessionStorage (existing)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/db.ts` | Modify | Add `users` table DDL + user CRUD functions + `seedAdminUser()` |
| `server/auth.ts` | Create | In-memory session Map: createSession / getSession / deleteSession |
| `server/routes/auth.ts` | Create | POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout |
| `server/routes/admin.ts` | Create | GET/POST/DELETE /api/admin/users (admin-only) |
| `server/index.ts` | Modify | Register auth + admin routes, call seedAdminUser() |
| `.env` | Modify | Add ADMIN_USERNAME + ADMIN_PASSWORD |
| `.env.example` | Modify | Document new env vars |
| `src/components/LoginView.tsx` | Modify | Call real API; remove register button |
| `src/App.tsx` | Modify | Add role state; verify session on mount; pass role to UserMenu; update logout |
| `src/components/UserMenu.tsx` | Modify | Accept role + onNavigateAdmin props; show admin entry |
| `src/components/AdminView.tsx` | Create | User list + create user form |

---

## Task 1: Install bcryptjs

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /Users/yrxs01/Desktop/HJM-aigc-flow-main
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

Expected output ends with: `added N packages`

- [ ] **Step 2: Verify the install**

```bash
node -e "import('bcryptjs').then(m => console.log('ok', typeof m.default.hash))"
```

Expected: `ok function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bcryptjs for password hashing"
```

---

## Task 2: Add users table and CRUD functions to db.ts

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: Add the users table DDL**

Inside the existing `db.exec(`` ` ``...`` ` ``)` block in `server/db.ts`, append the following table definition after the `templates` table:

```sql
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    INTEGER NOT NULL
  );
```

The full `db.exec` block should now end with `...templates table DDL...users table DDL...` before the closing backtick.

- [ ] **Step 2: Add the UserRecord interface and user CRUD functions**

At the end of `server/db.ts`, after the `seedDefaultImageTemplates` function, append:

```ts
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
  const id = `user_admin_${Date.now()}`;
  db.prepare(
    'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, adminUsername, hash, 'admin', Date.now());
  console.log(`[auth] Admin user '${adminUsername}' created`);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/yrxs01/Desktop/HJM-aigc-flow-main
npx tsc --noEmit
```

Expected: no errors (or only pre-existing unrelated errors)

- [ ] **Step 4: Commit**

```bash
git add server/db.ts
git commit -m "feat: add users table and CRUD functions to db"
```

---

## Task 3: Create server/auth.ts (session management)

**Files:**
- Create: `server/auth.ts`

- [ ] **Step 1: Create the file**

```ts
// server/auth.ts

export interface SessionData {
  userId: string;
  username: string;
  role: string;
}

const sessions = new Map<string, SessionData>();

export function createSession(userId: string, username: string, role: string): string {
  const token = crypto.randomUUID();
  sessions.set(token, { userId, username, role });
  return token;
}

export function getSession(token: string): SessionData | null {
  return sessions.get(token) ?? null;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

/** Extract bearer token from Authorization header, or null */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add server/auth.ts
git commit -m "feat: add in-memory session management"
```

---

## Task 4: Create server/routes/auth.ts

**Files:**
- Create: `server/routes/auth.ts`

- [ ] **Step 1: Create the file**

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add server/routes/auth.ts
git commit -m "feat: add auth routes (login/logout/me)"
```

---

## Task 5: Create server/routes/admin.ts

**Files:**
- Create: `server/routes/admin.ts`

- [ ] **Step 1: Create the file**

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add server/routes/admin.ts
git commit -m "feat: add admin routes for user management"
```

---

## Task 6: Register routes and call seedAdminUser in server/index.ts

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add imports at the top of server/index.ts**

After the existing imports (after line `import { seedDefaultImageTemplates } from './db.js';`), add:

```ts
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { seedAdminUser } from './db.js';
```

- [ ] **Step 2: Call seedAdminUser after seedDefaultImageTemplates**

Replace this line:
```ts
seedDefaultImageTemplates();
```

With:
```ts
seedDefaultImageTemplates();
seedAdminUser().catch(err => console.error('[auth] seed error:', err));
```

- [ ] **Step 3: Register the new routes**

After the line `app.use('/api', reviewRouter);`, add:

```ts
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 5: Test the login endpoint manually**

Start the server:
```bash
npm run dev:server
```

In another terminal, test with a nonexistent user (should fail):
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"nobody","password":"wrong"}' | cat
```
Expected: `{"error":"用户名或密码错误"}`

Then set ADMIN_PASSWORD in .env (Task 7 below) and restart server. Test valid login:
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_ADMIN_PASSWORD"}' | cat
```
Expected: `{"token":"...","username":"admin","role":"admin"}`

- [ ] **Step 6: Commit**

```bash
git add server/index.ts
git commit -m "feat: register auth/admin routes and seed admin user on startup"
```

---

## Task 7: Update .env and .env.example

**Files:**
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Add to .env**

Open `.env` and append:
```
# 管理员账号（首次启动自动创建）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

Replace `your_secure_password_here` with your actual admin password.

- [ ] **Step 2: Add to .env.example**

Open `.env.example` and append:
```
# 管理员账号（首次启动自动创建）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

- [ ] **Step 3: Commit only .env.example (not .env)**

```bash
git add .env.example
git commit -m "docs: add ADMIN_USERNAME/ADMIN_PASSWORD to .env.example"
```

---

## Task 8: Update LoginView.tsx to call real API

**Files:**
- Modify: `src/components/LoginView.tsx`

- [ ] **Step 1: Update the Props interface and handleSubmit**

Replace the current `Props` interface and component signature:

```tsx
interface Props {
  onLogin: (username: string, role: string) => void;
}

export default function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入账号和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json() as { token?: string; username?: string; role?: string; error?: string };
      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }
      sessionStorage.setItem('token', data.token!);
      sessionStorage.setItem('role', data.role!);
      onLogin(data.username!, data.role!);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 2: Update the submit button to show loading state**

Replace the submit button:
```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full rounded-md bg-black py-3.5 text-sm font-semibold text-white hover:bg-black/80 active:scale-[0.98] transition-all border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
  style={{ fontFamily: 'Inter' }}
>
  {loading ? '登录中...' : '登录'}
</button>
```

- [ ] **Step 3: Remove the 「在此注册」button**

Delete the entire `<p>` block at the bottom of the form:
```tsx
{/* 注册提示 — 删除此块 */}
<p className="text-center text-xs text-white/40" style={{ fontFamily: 'Inter' }}>
  还没有账号？{' '}
  <button type="button" className="font-semibold text-white/70 hover:text-white transition-colors">
    在此注册
  </button>
</p>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/LoginView.tsx
git commit -m "feat: LoginView calls real auth API"
```

---

## Task 9: Update App.tsx (role state, session verification, logout)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add role state and session verification**

Find the `App` component's state declarations (around line 1279). Replace:

```ts
const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem('loggedIn') === '1');
const [username, setUsername] = useState(() => sessionStorage.getItem('username') || 'user');
```

With:

```ts
const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem('token'));
const [username, setUsername] = useState(() => sessionStorage.getItem('username') || 'user');
const [role, setRole] = useState(() => sessionStorage.getItem('role') || 'user');

// Verify token is still valid on mount (server restart clears sessions)
useEffect(() => {
  const token = sessionStorage.getItem('token');
  if (!token) return;
  fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('role');
      setIsLoggedIn(false);
    }
  }).catch(() => {});
}, []);
```

- [ ] **Step 2: Update the onLogin callback**

Find the `LoginView` render in the `if (!isLoggedIn)` block (around line 1583). Replace:

```tsx
<LoginView
  onLogin={(name) => {
    sessionStorage.setItem('loggedIn', '1');
    sessionStorage.setItem('username', name);
    setUsername(name);
    setIsLoggedIn(true);
  }}
/>
```

With:

```tsx
<LoginView
  onLogin={(name, userRole) => {
    sessionStorage.setItem('username', name);
    sessionStorage.setItem('role', userRole);
    setUsername(name);
    setRole(userRole);
    setIsLoggedIn(true);
  }}
/>
```

- [ ] **Step 3: Update handleLogout to call the logout API and pass role to UserMenu**

Replace the `handleLogout` function:

```ts
const handleLogout = () => {
  const token = sessionStorage.getItem('token');
  if (token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('role');
  setIsLoggedIn(false);
  setRole('user');
  setView('home');
};
```

- [ ] **Step 4: Pass role and onNavigateAdmin to UserMenu**

Find the `<UserMenu` usage (around line 1601). Add the `role` and `onNavigateAdmin` props:

```tsx
<UserMenu
  username={username}
  role={role}
  onLogout={handleLogout}
  onNavigateAdmin={() => setView('admin')}
  sidebarOpen={showAssistant}
  showAssistant={showAssistant}
  onToggleAssistant={() => setShowAssistant(v => !v)}
  notifications={notifications}
  onRead={...}
  onReadAll={...}
  onNavigate={...}
/>
```

- [ ] **Step 5: Add 'admin' to the view type and render AdminView**

Find the `view` state declaration:
```ts
const [view, setView] = useState<'home' | 'canvas'>('home');
```
Change it to:
```ts
const [view, setView] = useState<'home' | 'canvas' | 'admin'>('home');
```

Add the import at the top of the file:
```ts
import AdminView from './components/AdminView';
```

In the render section, find the `view === 'home'` / `Flow` conditional and add the admin branch. Change the `ReactFlowProvider` wrapper to:

```tsx
<ReactFlowProvider>
  {view === 'admin' ? (
    <AdminView
      currentUsername={username}
      onBack={() => setView('home')}
    />
  ) : view === 'home' ? (
    <HomePage ... />
  ) : (
    <Flow ... />
  )}
</ReactFlowProvider>
```

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App wires role state, session verification, and admin navigation"
```

---

## Task 10: Update UserMenu.tsx to show admin entry

**Files:**
- Modify: `src/components/UserMenu.tsx`

- [ ] **Step 1: Add role and onNavigateAdmin to Props**

Replace the `Props` interface:

```ts
interface Props {
  username: string;
  role?: string;
  onLogout: () => void;
  onNavigateAdmin?: () => void;
  notifications?: NotificationItem[];
  onRead?: (id: string) => void;
  onReadAll?: (projectId: string) => void;
  onNavigate?: (projectId: string, rowId: string) => void;
  showAssistant?: boolean;
  onToggleAssistant?: () => void;
}
```

Update the component signature to destructure `role` and `onNavigateAdmin`:

```ts
export default function UserMenu({
  username, role = 'user', onLogout, onNavigateAdmin,
  notifications = [], onRead, onReadAll, onNavigate,
  sidebarOpen = false, showAssistant = false, onToggleAssistant
}: Props & { sidebarOpen?: boolean }) {
```

- [ ] **Step 2: Add the admin entry to the main dropdown panel**

In the main dropdown panel (`panel === 'main'`), find the logout button. Above it, add:

```tsx
{role === 'admin' && (
  <button
    onClick={() => { setOpen(false); onNavigateAdmin?.(); }}
    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-gray-300 hover:bg-white/[0.06] hover:text-white transition-colors text-left"
    style={{ fontFamily: 'Inter' }}
  >
    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>manage_accounts</span>
    用户管理
  </button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/UserMenu.tsx
git commit -m "feat: UserMenu shows admin entry for admin role"
```

---

## Task 11: Create AdminView.tsx

**Files:**
- Create: `src/components/AdminView.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/AdminView.tsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, Plus, Loader2 } from 'lucide-react';

interface UserItem {
  id: string;
  username: string;
  role: string;
  created_at: number;
}

interface Props {
  currentUsername: string;
  onBack: () => void;
}

export default function AdminView({ currentUsername, onBack }: Props) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const token = sessionStorage.getItem('token') || '';

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { users?: UserItem[]; error?: string };
      if (!res.ok) { setError(data.error || '加载失败'); return; }
      setUsers(data.users!);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      setCreateError('请填写用户名和密码');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setCreateError(data.error || '创建失败'); return; }
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      fetchUsers();
    } catch {
      setCreateError('网络错误');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`确定删除用户「${username}」吗？`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        alert(data.error || '删除失败');
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch {
      alert('网络错误');
    }
  };

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white"
      style={{ fontFamily: 'Inter' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-5 border-b border-white/[0.08]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <span className="text-white/20">|</span>
        <h1 className="text-sm font-semibold text-white">用户管理</h1>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-10 space-y-10">

        {/* Create user form */}
        <section>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">新建用户</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="用户名"
                value={newUsername}
                onChange={e => { setNewUsername(e.target.value); setCreateError(''); }}
                className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
              />
              <input
                type="password"
                placeholder="密码"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setCreateError(''); }}
                className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
              />
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'user' | 'admin')}
                className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
              >
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              创建用户
            </button>
          </form>
        </section>

        {/* User list */}
        <section>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">所有用户</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-white/40">
              <Loader2 size={14} className="animate-spin" /> 加载中...
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : (
            <div className="space-y-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#141414] border border-white/[0.06]"
                >
                  <div>
                    <span className="text-sm text-white">{user.username}</span>
                    <span className={`ml-3 text-xs px-2 py-0.5 rounded-full ${
                      user.role === 'admin'
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'bg-white/[0.06] text-white/40'
                    }`}>
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </div>
                  {user.username !== currentUsername && (
                    <button
                      onClick={() => handleDelete(user.id, user.username)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="删除用户"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-white/30">暂无用户</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AdminView.tsx
git commit -m "feat: add AdminView for user management"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Start dev server and backend**

```bash
npm run dev:all
```

- [ ] **Step 2: Test invalid login**

Open `http://localhost:3000`. Try logging in with a random username and password.
Expected: "用户名或密码错误" error shown, no entry to the app.

- [ ] **Step 3: Test valid admin login**

Log in with `admin` and the password set in `.env`.
Expected: enters the app normally.

- [ ] **Step 4: Test admin user management**

Click the avatar in the top-right → "用户管理".
Expected: admin management page opens.
Create a new user (e.g., `testuser` / `test123` / 普通用户).
Expected: user appears in the list.

- [ ] **Step 5: Test new user login**

Log out. Log in as `testuser` / `test123`.
Expected: enters the app. No "用户管理" option in the menu (regular user).

- [ ] **Step 6: Test session expiry after server restart**

While logged in, restart the backend (`Ctrl+C` and `npm run dev:server`).
Reload the browser.
Expected: redirected to login page (token invalidated by restart).

- [ ] **Step 7: Test delete user**

Log in as admin. Go to user management. Delete `testuser`.
Expected: user removed from list.
Try logging in as `testuser` again.
Expected: "用户名或密码错误".

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: complete auth system — real login, admin user management"
```
