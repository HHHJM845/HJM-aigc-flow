# Backend Proxy 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加 Express 代理服务器，把 AI API Key 从浏览器移到服务端，支持云端部署。

**Architecture:** 前端调用相对路径 `/api/*`，开发时 Vite proxy 转发到 localhost:3001，生产时 Express 同时托管静态文件和代理路由。三条路由分别代理剧本拆解、AI 对话、图片生成。

**Tech Stack:** Express 4、tsx（运行 TypeScript）、dotenv、Vite proxy、Node.js 18+

---

## 文件变更一览

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/index.ts` | 新建 | Express 入口，挂载路由、CORS、错误处理、静态文件 |
| `server/routes/breakdown.ts` | 新建 | POST /api/breakdown → DeepSeek |
| `server/routes/chat.ts` | 新建 | POST /api/chat → DeepSeek |
| `server/routes/generate.ts` | 新建 | POST /api/generate → 图片 API |
| `vite.config.ts` | 修改 | 新增 server.proxy 配置 |
| `src/lib/api.ts` | 修改 | fetch 目标改为 /api/* 相对路径，移除 Key |
| `package.json` | 修改 | 新增 server:dev、server:start 脚本 |
| `.env.example` | 修改 | 更新为服务端环境变量说明 |
| `.env.local` | 修改 | 添加服务端 Key 变量 |

---

## Task 1：新增 package.json 脚本

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 在 scripts 里添加服务端启动命令**

打开 `package.json`，将 `scripts` 改为：

```json
"scripts": {
  "dev": "vite --port=3000 --host=0.0.0.0",
  "dev:server": "tsx watch server/index.ts",
  "dev:all": "concurrently \"npm run dev\" \"npm run dev:server\"",
  "build": "vite build",
  "start": "node --import tsx/esm server/index.ts",
  "preview": "vite preview",
  "clean": "rm -rf dist",
  "lint": "tsc --noEmit"
}
```

- [ ] **Step 2: 安装 concurrently（用于同时启动前后端）**

```bash
npm install --save-dev concurrently
```

预期输出：`added X packages`

- [ ] **Step 3: 验证 tsx 已安装**

```bash
npx tsx --version
```

预期输出：版本号，如 `4.x.x`。若报错则运行 `npm install --save-dev tsx`。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add server dev scripts and concurrently"
```

---

## Task 2：创建 Express 服务入口

**Files:**
- Create: `server/index.ts`

- [ ] **Step 1: 创建 server/ 目录和入口文件**

新建 `server/index.ts`，内容如下：

```typescript
import express from 'express';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import breakdownRouter from './routes/breakdown.js';
import chatRouter from './routes/chat.js';
import generateRouter from './routes/generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// ── 中间件 ──────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// CORS：开发时允许 Vite dev server，生产时允许指定域名
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowed = process.env.CORS_ORIGIN || 'http://localhost:3000';
  if (origin === allowed || allowed === '*') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── API 路由 ─────────────────────────────────────────
app.use('/api/breakdown', breakdownRouter);
app.use('/api/chat', chatRouter);
app.use('/api/generate', generateRouter);

// ── 生产：托管前端静态文件 ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── 统一错误处理 ─────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server error]', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: 验证语法（路由文件还未创建，先跳过实际运行）**

```bash
npx tsx --check server/index.ts 2>&1 || true
```

预期：报 "Cannot find module './routes/breakdown.js'" 属正常（路由未建），无 TypeScript 语法错误。

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: add express server entry with cors and error handling"
```

---

## Task 3：剧本拆解路由

**Files:**
- Create: `server/routes/breakdown.ts`

- [ ] **Step 1: 创建 breakdown 路由**

新建 `server/routes/breakdown.ts`：

```typescript
import { Router } from 'express';

const router = Router();

const BREAKDOWN_SYSTEM_PROMPT = `你是专业分镜师。将剧本拆解为分镜列表，只返回 JSON，格式：
{"scenes":[{"shot_type":"景别","description":"镜头内容"},...]}

规则：
1. "场X 地点"行是场景标题，不是分镜，跳过
2. "△"开头的每一行 = 一个独立分镜
3. 对白行（人名：台词）= 一个独立分镜
4. shot_type 只填景别词，如：特写、近景、中近景、中景、全景、远景、大全景、航拍
5. description 用一句话描述画面动作，不超过60字
6. 禁止输出 JSON 以外的任何文字`;

router.post('/', async (req, res, next) => {
  try {
    const { script } = req.body as { script: string };
    if (!script?.trim()) {
      return res.status(400).json({ error: '请提供剧本内容' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY' });

    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: BREAKDOWN_SYSTEM_PROMPT },
          { role: 'user', content: script },
        ],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: `上游 API 错误: ${text}` });
    }

    const json = await upstream.json() as { choices: { message: { content: string } }[] };
    const raw = json.choices?.[0]?.message?.content || '{"scenes":[]}';

    // 提取 JSON：去掉 <think> 标签和 markdown 围栏
    let cleaned = raw
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<think>[\s\S]*/gi, '')
      .replace(/```[a-zA-Z]*\n?/g, '')
      .replace(/```/g, '');

    const objStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');
    const useObj = objStart !== -1 && (arrStart === -1 || objStart < arrStart);
    if (useObj) {
      const end = cleaned.lastIndexOf('}');
      if (end > objStart) cleaned = cleaned.slice(objStart, end + 1);
    } else if (arrStart !== -1) {
      const end = cleaned.lastIndexOf(']');
      if (end > arrStart) cleaned = cleaned.slice(arrStart, end + 1);
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const rawArr: unknown[] = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed.scenes) ? (parsed.scenes as unknown[])
      : Array.isArray(parsed.shots) ? (parsed.shots as unknown[])
      : [];

    const scenes = rawArr.map((item, i) => {
      const o = item as Record<string, unknown>;
      return {
        id: `row-${Date.now()}-${i}`,
        index: i + 1,
        shotType: String(o.shot_type ?? o.shotType ?? o['景别'] ?? ''),
        description: String(o.description ?? o.content ?? o['镜头内容'] ?? o['描述'] ?? ''),
      };
    });

    res.json({ scenes });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/breakdown.ts
git commit -m "feat: add breakdown proxy route"
```

---

## Task 4：AI 对话路由

**Files:**
- Create: `server/routes/chat.ts`

- [ ] **Step 1: 创建 chat 路由**

新建 `server/routes/chat.ts`：

```typescript
import { Router } from 'express';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { messages, systemPrompt } = req.body as {
      messages: { role: string; content: string }[];
      systemPrompt?: string;
    };

    if (!messages?.length) {
      return res.status(400).json({ error: '请提供消息内容' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY' });

    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: allMessages,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: `上游 API 错误: ${text}` });
    }

    const json = await upstream.json() as { choices: { message: { content: string } }[] };
    const raw = json.choices?.[0]?.message?.content || '';
    const content = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    res.json({ content });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/chat.ts
git commit -m "feat: add chat proxy route"
```

---

## Task 5：图片生成路由

**Files:**
- Create: `server/routes/generate.ts`

- [ ] **Step 1: 创建 generate 路由**

新建 `server/routes/generate.ts`：

```typescript
import { Router } from 'express';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { prompt } = req.body as { prompt: string };
    if (!prompt?.trim()) {
      return res.status(400).json({ error: '请提供提示词' });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    const baseUrl = process.env.IMAGE_BASE_URL || 'https://new.suxi.ai';
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: `上游 API 错误: ${text}` });
    }

    const json = await upstream.json() as {
      choices: { message: { content: unknown } }[];
    };

    const urls: string[] = [];
    for (const choice of json.choices ?? []) {
      const content = choice.message?.content;
      if (!content) continue;

      if (Array.isArray(content)) {
        for (const part of content as { type?: string; image_url?: { url: string }; inline_data?: { mime_type: string; data: string } }[]) {
          if (part.inline_data?.data) {
            urls.push(`data:${part.inline_data.mime_type ?? 'image/png'};base64,${part.inline_data.data}`);
          } else if (part.image_url?.url) {
            urls.push(part.image_url.url);
          }
        }
      } else if (typeof content === 'string') {
        const mdMatches = [...content.matchAll(/!\[.*?\]\((data:[^)]+)\)/g)];
        if (mdMatches.length > 0) {
          mdMatches.forEach(m => urls.push(m[1]));
        } else if (content.startsWith('data:') || content.startsWith('http')) {
          urls.push(content);
        }
      }
    }

    if (urls.length === 0) {
      return res.status(502).json({ error: 'API 未返回图片数据，请检查模型或提示词' });
    }

    res.json({ urls });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/generate.ts
git commit -m "feat: add image generation proxy route"
```

---

## Task 6：Vite 代理配置

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: 添加 proxy 配置**

将 `vite.config.ts` 的 `server` 块改为：

```typescript
server: {
  port: 3000,
  host: '0.0.0.0',
  hmr: process.env.DISABLE_HMR !== 'true',
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
},
```

完整文件变为：

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add vite proxy for /api to express server"
```

---

## Task 7：改造前端 api.ts

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: 重写 api.ts**

将 `src/lib/api.ts` 替换为以下内容（移除所有 Key 相关代码，改用相对路径）：

```typescript
export interface StoryboardRow {
  id: string;
  index: number;
  shotType: string;
  description: string;
}

// ── 剧本拆解 ─────────────────────────────────────────
export async function breakdownScript(scriptText: string): Promise<StoryboardRow[]> {
  const res = await fetch('/api/breakdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script: scriptText }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { scenes } = await res.json() as { scenes: StoryboardRow[] };
  return scenes;
}

// ── AI 提示词对话 ────────────────────────────────────
export async function chatForPrompt(
  shotDescription: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const systemPrompt = `你是专业的AI图片提示词工程师。根据以下镜头描述和用户需求，生成适合AI图片生成的英文提示词。镜头描述：${shotDescription}`;

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { content } = await res.json() as { content: string };
  return content;
}

// ── 图片生成 ─────────────────────────────────────────
export async function generateImages(
  prompt: string,
  _n: number,
  _ratio: string
): Promise<string[]> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { urls } = await res.json() as { urls: string[] };
  return urls;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: refactor api.ts to use /api/* proxy routes, remove client-side keys"
```

---

## Task 8：更新环境变量文件

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`

- [ ] **Step 1: 更新 .env.example**

将 `.env.example` 替换为：

```bash
# DeepSeek API（剧本拆解 + AI 对话）
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 图片生成 API
IMAGE_API_KEY=your_image_api_key_here
IMAGE_BASE_URL=https://new.suxi.ai

# 服务器配置
PORT=3001
CORS_ORIGIN=http://localhost:3000

# 生产环境部署后将 CORS_ORIGIN 改为前端域名，如：
# CORS_ORIGIN=https://your-app.vercel.app
```

- [ ] **Step 2: 更新 .env.local，添加服务端变量**

在 `.env.local` 中添加（保留已有内容，补充新变量）：

```bash
DEEPSEEK_API_KEY=<你的 DeepSeek Key>
DEEPSEEK_BASE_URL=https://api.deepseek.com

IMAGE_API_KEY=<你的图片 API Key>
IMAGE_BASE_URL=https://new.suxi.ai

PORT=3001
CORS_ORIGIN=http://localhost:3000
```

**注意：** `.env.local` 已在 `.gitignore` 中，不会提交。

- [ ] **Step 3: Commit .env.example**

```bash
git add .env.example
git commit -m "chore: update env.example for server-side api keys"
```

---

## Task 9：本地联调验证

- [ ] **Step 1: 确认 .env.local 里的 Key 已填写**

检查 `.env.local` 中 `DEEPSEEK_API_KEY` 和 `IMAGE_API_KEY` 是否有真实值。

- [ ] **Step 2: 启动 Express 服务器**

```bash
npm run dev:server
```

预期输出：`[server] running on http://localhost:3001`

- [ ] **Step 3: 新开终端，启动前端**

```bash
npm run dev
```

预期：Vite 启动在 http://localhost:3000

- [ ] **Step 4: 验证剧本拆解**

打开 http://localhost:3000，粘贴剧本，点击"AI 拆解"。
预期：成功返回分镜表，浏览器 Network 面板中请求路径为 `/api/breakdown`，无 API Key 暴露。

- [ ] **Step 5: 验证图片生成**

导入分镜进画布，在节点中填写提示词并点击生成。
预期：图片正常显示，请求路径为 `/api/generate`。

- [ ] **Step 6: Commit 完成标记**

```bash
git commit --allow-empty -m "chore: backend proxy integration complete"
```

---

## 后续：生产部署（Railway 单服务）

1. 将项目推送到 GitHub
2. 在 Railway 新建项目，连接 GitHub 仓库
3. 设置环境变量：`DEEPSEEK_API_KEY`、`IMAGE_API_KEY`、`NODE_ENV=production`、`CORS_ORIGIN=*`（或前端域名）
4. 构建命令：`npm run build`
5. 启动命令：`npm run start`
6. Railway 自动分配域名，访问即可
