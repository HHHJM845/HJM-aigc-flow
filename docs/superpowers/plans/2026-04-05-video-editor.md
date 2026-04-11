# 视频剪辑界面 + FFmpeg 导出 实施计划

**日期**：2026-04-05
**优先级**：按阶段顺序执行，Phase 1 → 2 → 3

---

## Phase 1：集成 Stitch 剪辑 UI（纯前端，无破坏性）

> 目标：把 Stitch 导出的视频剪辑界面替换现有 SubtitleView，保留所有现有逻辑。

### 任务清单

- [ ] 用户粘贴 Stitch 导出的 HTML 代码
- [ ] 对照现有 `src/components/SubtitleView.tsx`（929行），将 Stitch 视觉风格移植进去
  - 保留现有功能：时间轴、视频播放、字幕轨、VideoOrderItem、SubtitleEntry
  - 新增 UI 元素：左侧工具栏（媒体/资产/特效/转场/文字图标）、右侧媒体库面板、音频轨道（视觉）
- [ ] 验证：视频预览、字幕编辑、时间轴拖动功能不受影响

**涉及文件**：
- `src/components/SubtitleView.tsx`

---

## Phase 2：资产上传改为服务端文件存储

> 目标：把 base64 存储改为真实文件上传，为 FFmpeg 处理打基础。
> ⚠️ 这是破坏性改动，需要迁移现有资产数据格式。

### 任务清单

- [ ] **服务端**：新增文件上传接口 `POST /api/upload`
  - 接收 multipart/form-data（图片、视频、音频）
  - 存储到服务器 `/home/HJM-aigc-flow/uploads/` 目录
  - 返回 `{ id, url, filename, size, type }`

- [ ] **服务端**：新增静态文件服务，`/uploads/` 目录可公开访问

- [ ] **前端 `AssetManagerView.tsx`**：
  - 上传时改为 `fetch('/api/upload', { method: 'POST', body: formData })`
  - 存储的 `asset.src` 改为服务端 URL（如 `/uploads/xxx.mp4`）而非 base64

- [ ] **`src/lib/storage.ts`**：
  - `AssetItem.src` 兼容旧 base64 格式（向后兼容读取，写入时用 URL）

- [ ] **`AssetPanel.tsx`**（画布内浮动面板）：同步改为文件上传

- [ ] 测试：上传图片/视频，确认在资产库、画布节点中正常显示

**涉及文件**：
- `server/index.ts` — 新增 `/api/upload` 路由
- `src/components/AssetManagerView.tsx`
- `src/components/AssetPanel.tsx`
- `src/lib/storage.ts`

**新增依赖**：
```bash
npm install multer @types/multer  # 服务端文件接收
```

---

## Phase 3：FFmpeg 服务端导出

> 目标：用户在剪辑界面点"导出"，服务器合并视频片段并烧录字幕，返回 MP4 下载链接。

### 任务清单

- [ ] **系统环境**：服务器安装 FFmpeg
  ```bash
  apt-get install -y ffmpeg
  ```

- [ ] **服务端**：安装 Node.js FFmpeg 库
  ```bash
  npm install fluent-ffmpeg @types/fluent-ffmpeg
  ```

- [ ] **服务端**：新增导出接口 `POST /api/export`
  - 接收参数（JSON）：
    ```json
    {
      "clips": [
        { "src": "/uploads/clip1.mp4", "trimStart": 0, "trimEnd": 5000 },
        { "src": "/uploads/clip2.mp4", "trimStart": 1000, "trimEnd": 8000 }
      ],
      "subtitles": [
        { "startMs": 0, "endMs": 3000, "text": "这里的景色" }
      ],
      "outputFormat": "mp4"
    }
    ```
  - 处理流程：
    1. 生成临时 SRT 文件
    2. 用 FFmpeg 逐段裁剪 → 拼接 → 烧字幕
    3. 输出到 `/tmp/export_xxx.mp4`
    4. 流式返回文件，响应 `Content-Disposition: attachment`

- [ ] **FFmpeg 命令参考**：
  ```
  # 拼接多段（需先生成 concat list）
  ffmpeg -f concat -safe 0 -i list.txt -c copy merged.mp4

  # 烧录字幕
  ffmpeg -i merged.mp4 -vf subtitles=subs.srt output.mp4
  ```

- [ ] **前端 `SubtitleView.tsx`**：
  - 导出按钮改为 `POST /api/export`，传入时间轴数据
  - 显示导出进度（轮询或 SSE）
  - 完成后触发浏览器下载

- [ ] 测试：2段视频 + 3条字幕，导出 MP4 验证

**涉及文件**：
- `server/index.ts` — 新增 `/api/export` 路由
- `src/components/SubtitleView.tsx` — 导出按钮逻辑

---

## 执行顺序建议

```
Phase 1（UI）→ Phase 2（上传）→ Phase 3（导出）
```

Phase 1 和 Phase 2 可以并行，但 Phase 3 依赖 Phase 2（需要服务端有真实文件路径）。

---

## 关键背景信息

- **项目路径**：`C:\Users\Administrator\Desktop\HJM-aigc-flow-main`（本地开发）
- **服务器**：Ubuntu，公网 IP 218.244.158.35，项目目录 `/home/HJM-aigc-flow`
- **pm2 进程名**：`aigc-flow`
- **后端入口**：`server/index.ts`（tsx 运行，端口 3001）
- **前端**：Vite + React + Tailwind v4，端口 3000
- **现有字幕组件**：`src/components/SubtitleView.tsx`（929行，已有时间轴+视频播放+字幕轨）
- **现有资产类型**：`AssetItem { id, type, src(base64), name, createdAt, category }`
- **git 分支**：`main`，已推送到 `https://github.com/HHHJM845/HJM-aigc-flow`
