<div align="center">

# JM AIGC STUDIO

**AI 驱动的影视创作工作流平台**

React · TypeScript · Express · Doubao AI · React Flow

</div>

---

## 功能概览

JM AIGC STUDIO 是一个面向影视创作的 AI 工作流平台，将剧本创作、分镜设计、资产管理、视频剪辑、字幕编辑整合在一个界面中。

### 六大工作区

| 模块 | 功能 |
|------|------|
| **资产管理** | 上传、分类、重命名、删除素材；AI 对话式生成人物 / 场景 / 其他素材 |
| **剧本拆解** | 粘贴剧本，AI 自动生成分镜表；支持导入文件、AI 优化 |
| **无限画布** | React Flow 无限画布，支持图片 / 视频 / 文本节点，节点间连线，画板分组 |
| **分镜管理** | 拖拽排序已勾选的分镜节点，管理镜头顺序 |
| **视频管理** | 管理已选视频片段，拖拽排序，预览合成顺序 |
| **字幕编辑** | 时间线字幕编辑，AI 自动生成字幕，导出 SRT / 视频 |

### AI 能力

- **图片生成** — Doubao SeedDream 模型，支持参考图、比例、分辨率控制
- **视频生成** — 基于图片节点生成视频
- **剧本拆解** — 将剧本文本自动拆分为带景别、描述的分镜列表
- **提示词优化** — AI 优化图片生成提示词
- **资产匹配** — 导入分镜时自动将资产库素材匹配到对应分镜节点
- **素材生成对话** — 多轮 AI 对话明确素材需求，一键提取提示词并生成图片
- **字幕生成** — 基于视频内容自动生成字幕
- **图片分析** — 分析图片内容，辅助描述生成

### 其他特性

- **实时协作** — WebSocket 多端同步，多人同时编辑同一项目
- **项目管理** — 首页新建/打开项目，自动保存，本地 + 服务端双重持久化
- **历史记录** — 所有生成内容自动记录，随时拖回画布复用
- **AI 助手面板** — 内置 AI 对话面板，支持自定义 Skill

---

## 技术栈

**前端**
- React 18 + TypeScript + Vite
- Tailwind CSS v4
- React Flow（无限画布）
- WebSocket 实时同步

**后端**
- Node.js + Express + TypeScript
- Aliyun OSS（图片存储）
- WebSocket Server

**AI 模型**（火山引擎 ARK）
- `doubao-pro-32k` — 文本对话、剧本拆解、提示词优化、资产匹配
- `doubao-seedream-4-5-251128` — 图片生成
- `doubao-video-*` — 视频生成

---

## 本地运行

### 前提条件

- Node.js 18+
- 火山引擎 ARK API Key（用于 AI 功能）
- Aliyun OSS（可选，用于图片持久化存储）

### 安装与启动

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入以下变量：
# IMAGE_API_KEY=your_ark_api_key
# OSS_REGION / OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET（可选）
# CORS_ORIGIN=http://localhost:3000

# 启动前端（端口 3000）
npm run dev

# 启动后端（端口 3001）
npm run server
```

前端访问：`http://localhost:3000`
后端 API：`http://localhost:3001`

---

## API 路由

| 路由 | 功能 |
|------|------|
| `POST /api/breakdown` | AI 剧本拆解 |
| `POST /api/chat` | AI 对话 |
| `POST /api/generate` | 图片生成 |
| `POST /api/video` | 视频生成 |
| `POST /api/analyze` | 图片内容分析 |
| `POST /api/optimize-prompt` | 提示词优化 |
| `POST /api/match-assets` | 分镜资产自动匹配 |
| `POST /api/asset-chat` | 素材生成对话 + 提示词提取 |
| `POST /api/subtitle-generate` | AI 字幕生成 |
| `POST /api/export-video` | 视频导出 |
| `WS /ws` | 实时协作 WebSocket |

---

## 部署

```bash
# 构建前端
npm run build

# 生产模式启动（Express 同时托管前端静态文件）
NODE_ENV=production npm run server
```

服务器默认端口 `3001`，可通过 `PORT` 环境变量修改。
