# Spec: 字幕编辑器

**日期**: 2026-04-02
**状态**: 待实现
**涉及文件**: `src/components/SubtitleView.tsx`（新建）、`src/lib/storage.ts`、`src/components/BottomTabBar.tsx`、`src/App.tsx`

---

## 一、功能概述

新增「字幕编辑」板块，作为独立 Tab 接在底部导航栏末尾。支持：
1. **手动编辑字幕**：对着视频和时间线自主添加字幕块、输入文字、拖拽调整时间码
2. **AI 生成字幕**：结合剧本拆解内容与视频关键帧，AI 生成人物对话字幕文本
3. **导出 SRT**：一键下载标准 SRT 字幕文件

---

## 二、数据层变更

**文件**: `src/lib/storage.ts`

### 新增类型

```typescript
export interface SubtitleEntry {
  id: string;
  startMs: number;   // 从拼接时间线起点算的毫秒数
  endMs: number;
  text: string;
}
```

### Project 新增字段

```typescript
export interface Project {
  // ...existing fields...
  subtitles: SubtitleEntry[];   // 新增，默认 []
}
```

现有项目无此字段时读取为 `[]`（向后兼容）。

---

## 三、底部导航栏变更

**文件**: `src/components/BottomTabBar.tsx`

`ActiveView` 类型新增 `'subtitle'`，tabs 数组末尾加一项：

```typescript
type ActiveView = 'canvas' | 'storyboard' | 'breakdown' | 'video' | 'subtitle';

{ key: 'subtitle', label: '字幕编辑' }
```

---

## 四、整体布局

```
┌─ TopBar: "字幕编辑" · 片段数 · 总时长   [✨ AI 生成字幕] [导出 SRT] ─┐
├──────────────────────────────────────────────────────────────────────┤
│  视频播放区（flex: 1.5）           │  字幕列表（270px）               │
│  ┌──────────────────────────────┐  │  ┌──────────────────────────┐   │
│  │                              │  │  │ 字幕列表 · N条        ＋ │   │
│  │     <video 16:9>             │  │  ├──────────────────────────┤   │
│  │                              │  │  │ 00:38:22 → 00:38:25      │   │
│  │  ┌──────────────────────┐    │  │  │ 张三：你好，今天天气…    │   │
│  │  │ 字幕叠加（底部4%）    │    │  │  ├──────────────────────────┤   │
│  │  └──────────────────────┘    │  │  │ 00:41:10 → 00:41:13      │   │
│  └──────────────────────────────┘  │  │ 李四：是啊…              │   │
│  [▶] 00:38:22 ─────────── 02:34:18 │  └──────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│  时间线（高度 210px）                                                  │
│  ┌ 刻度尺 ─────────────────────────────────────────────────────────┐  │
│  │ 视频帧缩略图轨（90px）                                           │  │
│  │ 字幕色块轨（48px）  [张三:…]  [李四:…]  [张三:…]               │  │
│  │ 播放头                                                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 五、视频播放与虚拟拼接

### 片段顺序
读取 `videoOrder: VideoOrderItem[]`，按顺序虚拟拼接。

### 累计偏移计算
```typescript
// 组件内计算，不存储
const clipOffsets: number[] = [];  // clipOffsets[i] = 前 i 个片段的总时长（ms）
```
- 每个 `<video>` 的 `onLoadedMetadata` 触发后记录 `duration`
- 播放切换：当前片段播放完（`onEnded`）自动切到下一个

### 当前全局时间
```typescript
const currentMs = clipOffsets[currentClipIndex] + videoElement.currentTime * 1000;
```

### 字幕叠加
渲染当前 `currentMs` 时刻处于 `startMs <= currentMs <= endMs` 的字幕，叠加在视频底部。

**点击字幕叠加区域可直接编辑文字**：点击后文字变为 `<textarea>`，失焦或按 Enter 确认，同步更新 `SubtitleEntry.text` 并同步到右侧列表。

```tsx
<div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 w-[90%] text-center">
  {isEditingOverlay ? (
    <textarea
      autoFocus
      className="bg-black/85 text-white px-5 py-2 rounded text-[17px] font-medium text-center w-full resize-none outline-none"
      value={activeSubtitle?.text}
      onChange={e => updateSubtitleText(activeSubtitle.id, e.target.value)}
      onBlur={() => setIsEditingOverlay(false)}
      rows={2}
    />
  ) : (
    <span
      className="inline-block bg-black/85 text-white px-5 py-2 rounded text-[17px] font-medium cursor-text"
      onClick={() => setIsEditingOverlay(true)}
    >
      {activeSubtitle?.text}
    </span>
  )}
</div>
```

---

## 六、时间线组件

### 帧缩略图提取
- 每个片段加载后，用 Canvas API 每隔固定像素宽度截一帧
- `videoEl.currentTime = targetSec` → `ctx.drawImage(videoEl, ...)` → `canvas.toDataURL()`
- 截帧异步完成后渲染为 `<img>` 填充缩略图格

### 字幕色块交互

| 操作 | 行为 |
|------|------|
| 点击时间线空白处 | 在该时间位置新建字幕块（默认 3 秒），右侧列表自动聚焦新条目输入框 |
| 点击「＋」按钮 | 在 currentMs 位置新建字幕块，同上 |
| 拖拽色块整体左右 | 同步移动 `startMs` + `endMs` |
| 拖拽色块左边缘 | 调整 `startMs`（不超过 `endMs - 500ms`） |
| 拖拽色块右边缘 | 调整 `endMs`（不低于 `startMs + 500ms`） |
| 点击色块 | 右侧列表高亮对应条目，视频跳转到 `startMs` |
| 点击刻度尺 | 播放头跳转，视频 seek 到对应时间 |

### 时间 ↔ 像素换算
```typescript
const msPerPx = totalMs / timelineWidthPx;
const pxFromMs = (ms: number) => ms / msPerPx;
const msFromPx = (px: number) => px * msPerPx;
```

---

## 七、AI 生成字幕流程

### 触发
点击顶部「✨ AI 生成字幕」按钮。

### 步骤
1. **截取关键帧**：每个视频片段截取 2 帧（片段时长的 25% 和 75% 处），base64 编码
2. **读取剧本**：从 `storyboardRows` 拼接场景描述文字
3. **调用 `/api/chat`**：
```typescript
{
  systemPrompt: `你是专业的影视字幕编辑。根据以下剧本内容和视频画面，
生成对应的人物对话字幕。每行一句，格式严格为"角色名：台词"，不要包含序号、时间码或其他内容。`,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: `剧本内容：\n${storyboardText}` },
        ...frameImages.map(b64 => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }))
      ]
    }
  ]
}
```
4. **解析响应**：按换行分割，过滤空行，每行生成一条 `SubtitleEntry`（`startMs = 0, endMs = 3000`）
5. **追加到 `subtitles`**：新条目出现在列表底部，等待用户拖拽定位

---

## 八、SRT 导出

```typescript
function exportSRT(subtitles: SubtitleEntry[], projectName: string) {
  const sorted = [...subtitles].sort((a, b) => a.startMs - b.startMs);
  const lines = sorted.map((s, i) => {
    const start = msToSRTTime(s.startMs);
    const end = msToSRTTime(s.endMs);
    return `${i + 1}\n${start} --> ${end}\n${s.text}`;
  });
  const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `字幕_${projectName}.srt`;
  a.click();
}

function msToSRTTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const ms_ = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms_).padStart(3,'0')}`;
}
```

---

## 九、不在范围内

- 语音识别（ASR）自动识别视频中的说话内容
- 字幕样式自定义（字体、颜色、位置）
- 多字幕轨道
- VTT / ASS 格式导出
- 字幕翻译

---

## 十、文件变更清单

| 文件 | 操作 |
|------|------|
| `src/lib/storage.ts` | 修改：新增 `SubtitleEntry` 类型和 `Project.subtitles` 字段 |
| `src/components/BottomTabBar.tsx` | 修改：新增 `'subtitle'` tab |
| `src/components/SubtitleView.tsx` | 新建：完整字幕编辑器视图 |
| `src/App.tsx` | 修改：接入 `SubtitleView`，传入 `videoOrder`、`storyboardRows`、`subtitles`、`onSaveSubtitles` |
