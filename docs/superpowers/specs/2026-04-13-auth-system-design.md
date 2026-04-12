# 用户登录认证系统 — 设计规格

**日期：** 2026-04-13  
**范围：** 真实账号验证 + 管理员后台创建用户

---

## 1. 现状问题

`LoginView.tsx` 只检查用户名和密码非空即放行，无任何真实验证。没有后端 auth 路由，没有 users 表，任何人输入任意内容都能登录。

---

## 2. 目标

- 只有数据库中存在的账号才能登录
- 密码经过 bcrypt 哈希存储，不明文保存
- 管理员通过同一个登录页登录，进入后可在应用内创建/删除普通用户
- 登录态沿用现有 sessionStorage 机制（关闭浏览器标签即退出）

---

## 3. 数据库变更

在 `server/db.ts` 中新增 `users` 表：

```sql
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  created_at  INTEGER NOT NULL
);
```

### 管理员初始化（seed）

服务器启动时（`server/index.ts`）调用 `seedAdminUser()`：
- 检查 `users` 表中是否已有 `role='admin'` 的记录
- 若无，则用 `.env` 中的 `ADMIN_USERNAME`（默认 `admin`）和 `ADMIN_PASSWORD` 创建管理员账号
- `ADMIN_PASSWORD` 必须在 `.env` 中设置，服务器启动时若未设置则打印警告并跳过 seed

---

## 4. 后端

### 4.1 Session 管理

使用服务器内存 Map 存储 session，与 sessionStorage 生命周期对齐：

```ts
// server/auth.ts
const sessions = new Map<string, { userId: string; username: string; role: string }>();

export function createSession(userId: string, username: string, role: string): string
export function getSession(token: string): SessionData | null
export function deleteSession(token: string): void
```

Token 为 `crypto.randomUUID()` 生成的随机字符串，无过期时间（服务器重启自动清空）。

### 4.2 认证路由（`server/routes/auth.ts`）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 验证用户名+密码，返回 token + role |
| POST | `/api/auth/logout` | 删除 session token |
| GET  | `/api/auth/me` | 用 token 查询当前用户信息 |

**POST /api/auth/login**
- 请求体：`{ username, password }`
- 查 users 表，bcrypt.compare 验证密码
- 成功：创建 session，返回 `{ token, username, role }`
- 失败：返回 `401 { error: '用户名或密码错误' }`

**GET /api/auth/me**
- 请求头：`Authorization: Bearer <token>`
- 返回 `{ username, role }` 或 `401`

**POST /api/auth/logout**
- 请求头：`Authorization: Bearer <token>`
- 删除对应 session，返回 `200`

### 4.3 管理员路由（`server/routes/admin.ts`）

所有接口需验证 token 且 role 为 `admin`，否则返回 `403`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/admin/users` | 列出所有用户（不含 password_hash） |
| POST   | `/api/admin/users` | 创建新用户（username + password + role） |
| DELETE | `/api/admin/users/:id` | 删除用户（不能删除自己） |

---

## 5. 前端

### 5.1 `LoginView.tsx`

- 提交时调用 `POST /api/auth/login`
- 成功：将 `token` 和 `role` 存入 sessionStorage，调用 `onLogin(username, role)`
- 失败：显示"用户名或密码错误"错误提示
- 移除"在此注册"按钮（不开放自助注册）

### 5.2 `App.tsx`

- `onLogin` 回调签名改为 `(username: string, role: string) => void`
- 新增 `role` state，初始从 sessionStorage 读取
- 启动时若 sessionStorage 有 token，调用 `GET /api/auth/me` 验证：
  - 有效：正常进入应用
  - 无效（服务器重启后 session 丢失）：清除 sessionStorage，跳回登录页
- 登出时调用 `POST /api/auth/logout`，清除 sessionStorage
- 将 `role` 传给 `UserMenu`

### 5.3 `UserMenu.tsx`

- 接收 `role` prop
- 当 `role === 'admin'` 时，下拉菜单中显示「用户管理」选项
- 点击后触发 `onNavigateAdmin?.()` 回调

### 5.4 新建 `AdminView.tsx`

独立页面，`view` state 新增 `'admin'` 值（仅 admin 可访问）。

**页面结构：**
- 顶部返回按钮（回到首页）
- 「新建用户」表单：用户名输入框 + 密码输入框 + 角色选择（user/admin）+ 提交按钮
- 用户列表：显示 username、role、创建时间，每行右侧有「删除」按钮
- 不能删除当前登录的自己

---

## 6. 依赖

新增一个依赖：

| 包 | 用途 |
|----|------|
| `bcryptjs` | 密码哈希与验证（纯 JS，无需编译） |
| `@types/bcryptjs` | TypeScript 类型 |

---

## 7. `.env` 变更

新增两个环境变量：

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

需要同步更新 `.env.example`。

---

## 8. 文件变更一览

| 文件 | 操作 |
|------|------|
| `server/db.ts` | 新增 users 表 DDL + `seedAdminUser()` |
| `server/auth.ts` | **新建**：session 内存管理工具函数 |
| `server/routes/auth.ts` | **新建**：login / logout / me 接口 |
| `server/routes/admin.ts` | **新建**：用户 CRUD 接口 |
| `server/index.ts` | 注册 auth / admin 路由，启动时调用 seed |
| `src/components/LoginView.tsx` | 改为调用真实 API，移除注册按钮 |
| `src/components/AdminView.tsx` | **新建**：管理员用户管理页面 |
| `src/components/UserMenu.tsx` | 新增 role prop，admin 显示管理后台入口 |
| `src/App.tsx` | 新增 role state，启动验证 session，传 role |
| `.env` / `.env.example` | 新增 ADMIN_USERNAME / ADMIN_PASSWORD |
| `package.json` | 添加 bcryptjs 依赖 |
