# 甲乙方审片协作流 + 分镜版本管理 设计文档

**日期**：2026-04-09  
**范围**：Phase 1（审片协作流）+ Phase 2（版本历史 UI）  
**实施顺序**：Phase 1 → Phase 2，Phase 2 复用 Phase 1 的快照数据结构

---

## 目标

1. 乙方工作室在分镜管理界面一键生成审片链接，发给甲方
2. 甲方打开链接看到专业分镜展示页，逐帧批注（通过/需修改），无需注册
3. 甲方提交批注后，工作室实时收到通知，批注直接显示在对应分镜行旁
4. 每次提交审片自动存一个版本快照，支持手动打标签，支持还原到历史版本
5. 审片链接底部展示获客水印，形成 B2B 自传播路径

---

## 架构总览

```
乙方（已登录）                    甲方（无需登录）
────────────────                  ────────────────
分镜管理界面
  ↓ 点击"提交审片"
  1. 创建 project_snapshot        
  2. 创建 project_share (token)   → 发送链接 /r/:token
  3. 返回链接 URL                 
                                  GET /api/review/:token
                                  ← snapshot.data（分镜+图片）
                                  
                                  POST /api/review/:token/annotate
                                  ← 批注写入 annotations 表
                                  ← WS broadcast → 乙方实时收到
                                  ← 写入 notifications 表（离线补发）
乙方收到 WS 推送
  → 分镜行显示批注气泡
  → 通知铃铛红点
```

---

## 数据模型

### 新增 SQLite 表（`server/index.ts`）

```sql
CREATE TABLE IF NOT EXISTS project_snapshots (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  data        TEXT NOT NULL,  -- JSON: { storyboardOrder, storyboardRows, imageNodes }
  label       TEXT,           -- 如 "v3·甲方确认版"，自动生成时填 "提交审片 · YYYY-MM-DD HH:mm"
  auto        INTEGER DEFAULT 0,  -- 1=提交审片时自动, 0=手动保存
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_shares (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,  -- → project_snapshots.id
  token       TEXT UNIQUE NOT NULL,  -- 12位随机 URL-safe 字符串
  expires_at  INTEGER NOT NULL,      -- created_at + 7天 (ms)
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS annotations (
  id          TEXT PRIMARY KEY,
  share_id    TEXT NOT NULL,   -- → project_shares.id
  row_index   INTEGER NOT NULL, -- 0-based，对应 storyboardOrder 中的位置
  status      TEXT NOT NULL,   -- "pending" | "approved" | "revision"
  comment     TEXT DEFAULT '',
  created_at  INTEGER NOT NULL,
  UNIQUE(share_id, row_index)  -- 每个镜头只有一条批注，重复提交用 INSERT OR REPLACE 覆盖
);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  share_id    TEXT NOT NULL,
  row_index   INTEGER NOT NULL,
  status      TEXT NOT NULL,
  comment     TEXT DEFAULT '',
  created_at  INTEGER NOT NULL,
  read        INTEGER DEFAULT 0  -- 0=未读, 1=已读
);
```

### 快照 data 字段结构

```ts
interface SnapshotData {
  storyboardOrder: string[];          // 分镜 ID 排列顺序
  storyboardRows: StoryboardRow[];    // 景别 + 描述
  imageNodes: {                       // 对应分镜的生成图片（按 storyboardOrder 顺序）
    rowId: string;                    // 对应 StoryboardRow.id
    imageUrl: string | null;          // 取自 canvas nodes 中 id=`storyboard-${rowId}` 的节点的 data.contents[0] ?? data.content，无则 null
  }[];
}
```

**快照构建逻辑**（服务端 `POST /api/projects/:id/snapshot`）：
从 `project.storyboardOrder` 遍历，每个 rowId 在 `project.nodes` 中找 `id === \`storyboard-${rowId}\`` 的节点，取 `node.data.contents?.[0] ?? node.data.content ?? null` 作为 imageUrl。

---

## 后端 API（Phase 1）

所有新路由追加到 `server/index.ts` 现有 Express 实例。

### 快照

```
POST /api/projects/:id/snapshot
  Body: { label?: string }
  → 构建 SnapshotData，存入 project_snapshots
  → 返回: { snapshotId, label, createdAt }

GET /api/projects/:id/snapshots
  → 返回快照列表（不含 data 字段）: [{ id, label, auto, createdAt }]

POST /api/snapshots/:snapshotId/restore
  → 将 snapshot.data 解包，更新 projects 表对应项目的 storyboardRows + nodes
  → 触发 WebSocket broadcast: { type: "project_update", projectId }
  → 返回: { ok: true }
```

### 审片链接

```
POST /api/projects/:id/share
  → 调用快照逻辑（auto=1，label="提交审片 · 日期"）
  → 生成 12 位 token：`crypto.randomBytes(9).toString('base64url')`（Node.js 内置，无需额外依赖）
  → 写入 project_shares（expires_at = now + 7*24*3600*1000）
  → 返回: { token, url: "/r/{token}", expiresAt }

GET /api/review/:token
  → 验证 token 存在且未过期，否则 410 Gone
  → 返回: { shareId, projectId, snapshotData: SnapshotData, expiresAt }

GET /api/review/:token/annotations
  → 公开路由，返回该 share 的所有批注: Annotation[]

POST /api/review/:token/annotate
  Body: { rowIndex: number, status: "approved"|"revision", comment?: string }
  → 校验 token 有效期
  → 写入 annotations 表
  → 写入 notifications 表（read=0）
  → WebSocket broadcast 给所有订阅该 projectId 的客户端:
    { type: "annotation_added", projectId, shareId, rowIndex, status, comment, createdAt }
  → 返回: { annotationId }
```

### 通知

```
GET /api/projects/:id/notifications
  → 返回未读通知列表（read=0），按 created_at 倒序

POST /api/notifications/:id/read
  → 标记单条通知为已读（read=1）

POST /api/projects/:id/notifications/read-all
  → 标记该项目所有通知为已读
```

### WebSocket 新增消息类型（`server/ws.ts`）

```jsonc
// 服务端 → 订阅该 projectId 的所有客户端
{
  "type": "annotation_added",
  "projectId": "proj_xxx",
  "shareId": "share_yyy",
  "rowIndex": 2,
  "status": "revision",
  "comment": "这里光线太暗，需要补光",
  "createdAt": 1712345678000
}
```

---

## 前端（Phase 1）

### 新文件

| 文件 | 说明 |
|------|------|
| `src/pages/ReviewPage.tsx` | 甲方审片页，完全独立 |
| `src/components/AnnotationBubble.tsx` | 分镜行旁的批注气泡 |
| `src/components/NotificationBell.tsx` | 顶部通知铃铛 + 下拉列表 |
| `src/components/ShareDialog.tsx` | 生成链接弹窗（含复制按钮） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | URL 路径判断，`/r/` 开头渲染 ReviewPage |
| `src/components/BreakdownView.tsx` | 顶部加"提交审片"按钮 + 版本下拉（Phase 2），分镜行加批注气泡 |
| `src/App.tsx` | 顶部加 NotificationBell，useSync 处理 annotation_added 消息 |

---

### 甲方审片页 `ReviewPage.tsx`

**路由**：`/r/:token`（`main.tsx` 判断 `pathname.startsWith('/r/')` 渲染此组件）

**布局**（左网格 + 右详情）：

```
┌─────────────────────────────────────────────────────────┐
│  [项目名称]                             共 N 镜 · 7天内有效 │  极简顶栏
├──────────────────┬──────────────────────────────────────┤
│                  │                                        │
│  左：缩略图网格    │  右：选中镜头详情                        │
│  (3列，可滚动)    │                                        │
│                  │  ┌────────────────────────────────┐   │
│  [01✓][02↩][03]  │  │  大图（或占位图标）               │   │
│  [04][05][06]    │  └────────────────────────────────┘   │
│  [07][08]        │  景别标签 · 描述文字                     │
│                  │                                        │
│  角标颜色：        │  ── 批注 ──────────────────────────    │
│  灰=待审          │  [ 输入批注内容（可选）              ]   │
│  绿=通过          │                                        │
│  橙=需修改        │  [  ✓ 标记通过  ]  [ ↩ 需要修改 ]       │
│                  │                                        │
│                  │  已有状态：● 待审核                      │
└──────────────────┴──────────────────────────────────────┘
  页脚：由 JM AIGC Studio 制作  ·  免费注册 →（小水印）
```

**状态说明**：
- 每个镜头只有一条批注记录（重复提交覆盖）
- 点"标记通过"或"需要修改"立即提交，批注内容可为空
- 页面加载时拉取已有批注，已标注的镜头显示对应状态

**链接过期处理**：全屏提示页，无任何操作按钮，仅显示"此审片链接已过期，请联系工作室获取新链接"

---

### 分镜管理界面改动（`BreakdownView.tsx`）

**顶部新增按钮**：
- `[提交审片 ↗]`：点击后调用 `POST /api/projects/:id/share`，弹出 `ShareDialog` 显示链接和复制按钮
- `ShareDialog` 包含：链接 URL、一键复制、过期时间提示

**分镜行新增**：
- 若该行有甲方批注，行右侧显示 `AnnotationBubble`（状态颜色 + hover 展开批注文字）

---

### 通知（`NotificationBell.tsx` + `App.tsx`）

- `App.tsx` 的 `useSync` 扩展处理 `annotation_added` 消息 → 本地 notifications state 新增一条
- `NotificationBell` 显示未读数红点，点击展开列表
- 每条通知显示：`镜头 03 · 需修改：光线太暗`，点击跳转到对应项目分镜管理并高亮该行
- 进入应用时拉取 `GET /api/projects/:id/notifications` 补全离线期间的批注

---

## 前端 Phase 2：版本历史 UI

### 顶部版本下拉（`BreakdownView.tsx`）

触发器：`[⟲ v3·甲方确认版 ▾]`，点击展开：

```
┌─────────────────────────────┐
│ 版本历史                     │
│ ● v3 · 甲方确认版    当前    │
│   v2 · 第二轮修改   ↩ 还原  │
│   v1 · 初稿         ↩ 还原  │
│ ─────────────────────────  │
│ + 保存当前为快照              │
└─────────────────────────────┘
```

**还原流程**：
1. 点"↩ 还原"
2. 若当前分镜与最新快照有差异 → 弹确认框：
   - `[先保存当前再还原]` → 调用 `POST /api/projects/:id/snapshot`，再调用 restore
   - `[直接还原（放弃当前修改）]` → 直接调用 restore
   - `[取消]`
3. 还原后：顶部版本标签更新，分镜列表刷新

**保存快照**：
- "保存当前为快照"弹输入框：`[输入版本备注，如"v2·第二轮修改"]`
- 调用 `POST /api/projects/:id/snapshot`，label 为用户输入

---

## 范围边界

**本 spec 包含：**
- 版本快照存储与还原
- 审片链接生成（7天有效）
- 甲方展示页（匿名批注）
- 实时 + 离线通知
- 获客水印

**本 spec 不包含（后续迭代）：**
- 多版本链接管理（查看历史发出的所有链接）
- 批注的线程回复（乙方回复甲方批注）
- 快照数据中图片 URL 化（当前仍为 base64，大项目可能较慢）
- 甲方身份识别（当前匿名，后续可选填名字）

---

## 实施顺序

```
Phase 1（审片协作流）
  Task 1: 新增 4 张 SQLite 表
  Task 2: 快照 API（POST snapshot / GET snapshots）
  Task 3: 审片链接 API（POST share / GET review/:token / POST annotate）
  Task 4: 通知 API + WebSocket annotation_added 消息
  Task 5: ReviewPage.tsx（甲方审片页）
  Task 6: BreakdownView 顶部"提交审片"按钮 + ShareDialog
  Task 7: AnnotationBubble（分镜行批注气泡）
  Task 8: NotificationBell + App.tsx 接入

Phase 2（版本历史 UI）
  Task 9: GET /api/projects/:id/snapshots + POST /api/snapshots/:id/restore
  Task 10: BreakdownView 版本下拉菜单 + 还原确认框
```
