# JM AIGC STUDIO — 后端代理服务设计规格

**日期：** 2026-03-27
**目标：** 为云端部署添加 Express 代理层，保护 API Key，支持真实 AI 功能对外展示

---

## 1. 整体架构

```
访客浏览器
    │
    ├─ 静态前端 (React/Vite 构建产物)
    │      部署：Vercel / Netlify / Railway 静态托管
    │
    └─ API 请求 → /api/*
           │
           ▼
    Express 代理服务器  (server/)
           │  API Key 存在环境变量，不暴露给浏览器
           ├─ POST /api/breakdown  → DeepSeek API
           ├─ POST /api/chat       → DeepSeek API
           └─ POST /api/generate   → Gemini / 图片生成 API
           │
    部署：Railway / Render / Fly.io
```

开发环境：Vite dev server 通过 `proxy` 配置将 `/api/*` 转发到本地 Express（端口 3001），前端代码无需改变。

生产环境：前端打包静态文件，也可由 Express 直接 `serve` 省去两个服务，或分开部署。

---

## 2. 目录结构变更

```
AIGC/
├── src/                    # 前端，不变
├── server/
│   ├── index.ts            # Express 入口，挂载路由、CORS、错误处理
│   └── routes/
│       ├── breakdown.ts    # POST /api/breakdown  — 剧本拆解
│       ├── chat.ts         # POST /api/chat       — AI 提示词助手
│       └── generate.ts     # POST /api/generate   — 图片生成
├── .env.local              # 本地开发 Key（不提交）
├── .env.example            # 示例，提交到 git
└── vite.config.ts          # 新增 server.proxy 配置
```

---

## 3. 各模块设计

### 3.1 Express 入口 `server/index.ts`

- 监听 `PORT` 环境变量（默认 3001）
- 中间件：`cors`（允许前端域名）、`express.json`（限制 body 2MB）
- 挂载三条路由前缀 `/api`
- 统一错误处理中间件：捕获上游 API 错误，返回 `{ error: string }` + 对应状态码
- 生产模式下额外 serve `dist/` 静态文件（可选，用于单服务部署）

### 3.2 路由 `breakdown.ts`

- 接收：`{ script: string }`
- 转发至 DeepSeek，携带系统 prompt 和 `response_format: { type: "json_object" }`
- 返回：`{ scenes: ShotRow[] }`

### 3.3 路由 `chat.ts`

- 接收：`{ messages: Message[], systemPrompt?: string }`
- 转发至 DeepSeek chat completions
- 返回：`{ content: string }`

### 3.4 路由 `generate.ts`

- 接收：`{ prompt: string }`
- 转发至图片生成 API（gemini-3-pro-image-preview via chat completions）
- 解析响应中的 markdown 图片 / base64 / image_url，统一返回：`{ urls: string[] }`

### 3.5 前端 `src/lib/api.ts` 改造

所有 `fetch` 目标从第三方 URL 改为相对路径：

| 改前 | 改后 |
|------|------|
| `https://new.suxi.ai/v1/chat/completions` (breakdown) | `POST /api/breakdown` |
| `https://new.suxi.ai/v1/chat/completions` (chat) | `POST /api/chat` |
| `https://new.suxi.ai/v1/chat/completions` (generate) | `POST /api/generate` |

请求体简化：前端不再传 API Key、model 名称，由服务端统一管理。

### 3.6 Vite 开发代理 `vite.config.ts`

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

---

## 4. 环境变量

| 变量名 | 用途 |
|--------|------|
| `DEEPSEEK_API_KEY` | 剧本拆解、AI 对话 |
| `IMAGE_API_KEY` | 图片生成 |
| `IMAGE_BASE_URL` | 图片生成 API 基础地址（默认 new.suxi.ai） |
| `PORT` | Express 监听端口（默认 3001） |
| `CORS_ORIGIN` | 允许的前端域名（生产用） |

---

## 5. 部署方案

### 方案一：前后端合并（推荐 demo 场景）

Express 生产模式 serve `dist/` 静态文件，只需部署一个 Railway/Render 服务。

```
Railway (Node.js)
├── npm run build       → 生成 dist/
└── node server/index   → Express 同时托管前端 + 代理 API
```

### 方案二：前后端分离

- 前端：Vercel / Netlify（`npm run build` 自动部署）
- 后端：Railway / Render（`node server/index`）
- 前端设置 `VITE_API_BASE=https://your-backend.railway.app`

---

## 6. 不在本次范围内

- 用户认证 / 登录
- 数据库持久化
- 速率限制（可后续加，目前 demo 场景流量极低）
- HTTPS 证书（Railway/Render 自动处理）
