# 实时多端同步设计文档

**日期**：2026-04-01
**状态**：待实现

---

## 背景

当前项目数据存储在浏览器 `localStorage` 中，每台设备各自独立，无法共享。生成的图片/视频虽然已上传至阿里云 OSS（永久 URL），但项目结构（节点、画布、分镜、历史记录）仅存在本地，不同设备无法互相看到对方的操作。

## 目标

- 所有设备共享同一个工作区（项目列表完全一致）
- 一台设备的操作实时同步到其他所有在线设备
- 生成历史记录存储在服务器，所有设备共享，可从历史面板恢复图片到节点
- 多人同时编辑时，后写入的数据覆盖先写入的（Last Write Wins）

## 不在范围内

- 用户账号/登录系统
- 节点级别锁定机制
- 离线编辑冲突合并

---

## 架构概览

```
浏览器 A ──┐
浏览器 B ──┼── WebSocket ──► Express 服务器
浏览器 C ──┘                    │
                         ┌──────┴──────┐
                         │   SQLite    │  projects + history 表
                         └─────────────┘
```

**核心原则**：
- 服务器 SQLite 是唯一数据源（Single Source of Truth）
- `localStorage` 降级为离线缓存，WebSocket 断开时保底可用
- 客户端做乐观更新：本地立即生效，同时发送到服务器，服务器广播给其他客户端

---

## 服务端设计

### 新增文件

#### `server/db.ts` — SQLite 数据层

使用 `better-sqlite3`（同步 API，无需 async/await）。

**表结构：**

```sql
CREATE TABLE IF NOT EXISTS projects (
  id        TEXT PRIMARY KEY,
  data      TEXT NOT NULL,      -- 完整 Project 对象的 JSON 字符串
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id        TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  type      TEXT NOT NULL,      -- 'image' | 'video'
  src       TEXT NOT NULL,      -- 阿里云 OSS URL
  nodeLabel TEXT,
  createdAt INTEGER NOT NULL
);
```

**暴露方法：**
- `getAllProjects(): Project[]`
- `saveProject(project: Project): void`
- `deleteProject(id: string): void`
- `getHistory(projectId: string): HistoryItem[]`
- `addHistory(item: HistoryItem & { projectId: string }): void`

#### `server/ws.ts` — WebSocket 服务器

使用 `ws` 包，挂载在现有 HTTP server 上（共享端口，无需新端口）。

**连接管理：**
- 每个客户端连接时分配唯一 `clientId`
- 维护 `Map<clientId, WebSocket>` 用于广播

**消息协议：**

| 消息类型 | 方向 | payload | 说明 |
|---|---|---|---|
| `init` | 服务器→客户端 | `{ projects, history }` | 连接成功后下发全量数据 |
| `project_save` | 客户端→服务器 | `{ project: Project }` | 保存项目（全量覆盖） |
| `project_update` | 服务器→其他客户端 | `{ project: Project }` | 广播项目变更 |
| `project_delete` | 客户端→服务器 | `{ id: string }` | 删除项目 |
| `project_deleted` | 服务器→其他客户端 | `{ id: string }` | 广播项目删除 |
| `history_add` | 客户端→服务器 | `{ item: HistoryItem, projectId: string }` | 新增生成历史 |
| `history_broadcast` | 服务器→所有客户端 | `{ item: HistoryItem, projectId: string }` | 广播新历史条目 |

**广播逻辑：**
- 收到客户端消息后，先写 SQLite，再广播给**除发送方外**的所有客户端
- `history_broadcast` 广播给**包括发送方**的所有客户端（保证历史面板全局一致）

#### 修改 `server/index.ts`

- 启动时初始化 SQLite（`db.ts`）
- 创建 HTTP server，挂载 WebSocket（`ws.ts`）
- WebSocket 与现有 Express 路由共享同一端口

---

## 前端设计

### 新增文件

#### `src/hooks/useSync.ts`

管理 WebSocket 生命周期，暴露同步后的数据和操作方法。

```typescript
interface UseSyncReturn {
  projects: Project[];
  allHistory: Map<string, HistoryItem[]>; // key = projectId，存全部项目的历史
  connected: boolean;
  saveProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  addHistory: (item: HistoryItem, projectId: string) => void;
  getProjectHistory: (projectId: string) => HistoryItem[]; // 按项目过滤的便捷方法
}
```

**内部逻辑：**
- 组件挂载时建立 WebSocket 连接（`ws://` 同域同端口）
- 收到 `init` 消息：用服务器数据替换本地 state（localStorage 作为初始 fallback）
- 收到 `project_update`：更新本地 projects state
- 收到 `project_deleted`：从本地 projects state 移除
- 收到 `history_broadcast`：追加到本地 history state
- 断线时：`connected = false`，继续使用本地 state（localStorage 缓存），每 3 秒尝试重连
- 重连成功：重新拉取 `init` 数据，与本地合并（服务器优先）

### 修改文件

#### `src/lib/storage.ts`

- `loadProjects()` / `saveProject()` / `deleteProject()` 保留原有接口不变
- 改为：优先从内存（useSync 提供）读取，localStorage 只在 WebSocket 未连接时使用
- 保存时同时写 localStorage（离线缓存）

#### `src/App.tsx`

- 顶层引入 `useSync`，获取 `projects`、`saveProject`、`deleteProject`、`addHistory`
- 将 `saveProject`、`addHistory` 通过 props 向下传递给 Flow 组件
- 原有的 localStorage 直接读写替换为 useSync 提供的方法
- 显示连接状态指示器（右上角小圆点：绿色=已连接，灰色=离线）

#### 各 Node 组件（`ImageNode.tsx`、`VideoNode.tsx`）

- 图片/视频生成成功后，除了更新节点内容，还需调用 `addHistory`
- 接口不变（已有 onSave 回调），在回调中追加 addHistory 调用

#### `src/components/HistoryPanel.tsx`（如存在）或相关历史面板

- 数据来源从 `project.generationHistory`（本地）改为 `useSync` 提供的 `history`
- 点击历史图片恢复到节点的交互逻辑不变

---

## 数据流示意

### 生成图片并同步

```
电脑A：用户点击"生成"
  → 调用 /api/generate → 图片上传 OSS → 得到 URL
  → 本地立即更新节点内容（乐观更新）
  → WS 发送 project_save（含新节点数据）
  → WS 发送 history_add（含新图片 URL）
        ↓
    服务器接收
  → SQLite 写入 projects 表
  → SQLite 写入 history 表
  → 广播 project_update 给电脑B、C
  → 广播 history_broadcast 给所有人
        ↓
电脑B、C：实时收到消息
  → 更新本地 projects state → 画布上看到新图片
  → 追加 history state → 历史面板看到新条目
```

### 新设备连接（或刷新页面）

```
新设备打开页面
  → 建立 WebSocket 连接
  → 服务器发送 init { projects, history }
  → 客户端用服务器数据覆盖本地 state
  → 立即看到所有最新项目和历史
```

---

## 依赖新增

```json
// server（生产依赖）
"better-sqlite3": "^9.x",
"ws": "^8.x"

// server（开发依赖，类型）
"@types/better-sqlite3": "^7.x",
"@types/ws": "^8.x"
```

---

## 不需要改动的部分

- `/api/breakdown`、`/api/chat`、`/api/generate`、`/api/video`、`/api/analyze` 路由逻辑不变
- 阿里云 OSS 上传逻辑不变（`server/oss.ts`）
- 所有 UI 组件样式和交互不变（除历史面板数据来源）
- ReactFlow 画布交互逻辑不变
