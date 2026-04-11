# UI 全局重设计 — Obsidian Atelier 设计系统迁移

**日期：** 2026-04-04
**状态：** 已批准，待实现
**参考来源：** Stitch 导出 HTML（剧本拆解页面）

---

## 一、背景与目标

将现有项目 UI 从当前设计语言迁移至 Obsidian Atelier 设计系统。用户将逐步提供各页面的 Stitch 导出设计稿，按方案 A（先建全局基础，再逐页改造）推进。

**目标：**
- 所有页面风格统一，基于同一套 token
- 保留全部现有功能，只替换视觉层
- 第一个完整实现页面：剧本拆解（`BreakdownView`）

---

## 二、全局设计 Token

### 2.1 Tailwind 颜色扩展

注入 `tailwind.config.js` 的 `theme.extend.colors`：

```js
{
  "background": "#0e0e0e",
  "surface": "#0e0e0e",
  "surface-dim": "#0e0e0e",
  "surface-bright": "#2c2c2c",
  "surface-container-lowest": "#000000",
  "surface-container-low": "#131313",
  "surface-container": "#191a1a",
  "surface-container-high": "#1f2020",
  "surface-container-highest": "#252626",
  "surface-variant": "#252626",
  "surface-tint": "#c6c6c7",

  "on-background": "#e7e5e4",
  "on-surface": "#e7e5e4",
  "on-surface-variant": "#acabaa",

  "primary": "#c6c6c7",
  "primary-dim": "#b8b9b9",
  "primary-fixed": "#e2e2e2",
  "primary-fixed-dim": "#d4d4d4",
  "on-primary": "#3f4041",
  "on-primary-fixed": "#3e4040",
  "on-primary-fixed-variant": "#5a5c5c",
  "primary-container": "#454747",
  "on-primary-container": "#d0d0d0",
  "inverse-primary": "#5e5f60",

  "secondary": "#9f9d9d",
  "secondary-dim": "#9f9d9d",
  "secondary-fixed": "#e4e2e1",
  "secondary-fixed-dim": "#d6d4d3",
  "on-secondary": "#202020",
  "on-secondary-fixed": "#3f3f3f",
  "on-secondary-fixed-variant": "#5c5b5b",
  "secondary-container": "#3b3b3b",
  "on-secondary-container": "#c1bfbe",

  "tertiary": "#fbf9f8",
  "tertiary-dim": "#edeaea",
  "tertiary-fixed": "#f5f3f3",
  "tertiary-fixed-dim": "#e7e5e4",
  "on-tertiary": "#5f5f5f",
  "on-tertiary-fixed": "#4a4949",
  "on-tertiary-fixed-variant": "#666666",
  "tertiary-container": "#edeaea",
  "on-tertiary-container": "#575757",

  "outline": "#767575",
  "outline-variant": "#484848",

  "error": "#ee7d77",
  "error-dim": "#bb5551",
  "error-container": "#7f2927",
  "on-error": "#490106",
  "on-error-container": "#ff9993",

  "inverse-surface": "#fcf9f8",
  "inverse-on-surface": "#565555"
}
```

### 2.2 字体家族

```js
fontFamily: {
  headline: ["Manrope", "sans-serif"],
  body: ["Manrope", "sans-serif"],
  label: ["Inter", "sans-serif"],
}
```

在 `index.html` 的 `<head>` 中引入：
```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;600;800&family=Inter:wght@300;400;600&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
```

### 2.3 圆角系统

```js
borderRadius: {
  DEFAULT: "1rem",
  lg: "2rem",
  xl: "3rem",
  full: "9999px",
}
```

### 2.4 全局 CSS 工具类

注入 `src/index.css`：

```css
/* Material Symbols */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
  font-size: 20px;
}

/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #0e0e0e; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #484848; border-radius: 10px; }

/* 发光按钮 */
.glow-button { box-shadow: 0 0 15px rgba(198, 198, 199, 0.2); }

/* 表格激活行 */
.active-row {
  background: linear-gradient(90deg, rgba(198,198,199,0.05) 0%, rgba(198,198,199,0) 100%);
  border-left: 2px solid #c6c6c7;
}
```

---

## 三、底部导航栏重设计（BottomTabBar）

### 3.1 现状

文字标签栏，贴底，宽条形，每个 tab 有图标 + 中文文字。

### 3.2 新设计

浮动胶囊式纯图标栏，居中悬浮，毛玻璃背景：

```
fixed bottom-8 left-1/2 -translate-x-1/2 z-50
bg-[#1A1A1A]/90 backdrop-blur-2xl
border border-white/10 rounded-full
px-4 py-3 shadow-2xl
flex items-center gap-2
```

每个 tab 项为 `w-12 h-12` 圆形按钮：
- **默认态**：`text-[#9f9d9d] hover:text-[#fbf9f8] hover:bg-white/5`
- **激活态**：`bg-[#c6c6c7] text-[#1A1A1A] rounded-full shadow-lg scale-110`

### 3.3 图标映射（Material Symbols）

| Tab | 图标名 |
|-----|--------|
| 首页 | `home` |
| 选题 | `lightbulb` |
| 资产管理 | `inventory_2` |
| 剧本拆解 | `description` |
| 无限画布 | `architecture` |
| 分镜管理 | `movie_edit` |
| 视频管理 | `video_library` |
| 字幕编辑 | `subtitles` |

激活态图标使用 `FILL=1`：`font-variation-settings: 'FILL' 1`

### 3.4 组件文件

`src/components/BottomTabBar.tsx` — 替换现有实现，保留 `activeTab` / `onTabChange` prop 接口不变。

---

## 四、剧本拆解页面（BreakdownView）

### 4.1 布局结构

三栏全屏，无顶部导航，底部留出导航栏空间：

```
┌─────────────────────────────────────────────────────────┐
│  脚本正文 w-[30%]  │  分镜列表 w-[45%]  │ 属性调整 w-[25%] │
│  bg-surface-       │  bg-surface        │ bg-surface-      │
│  container-low     │                    │ container        │
│                    │                    │                  │
│  border-r          │                    │ border-l         │
│  border-outline-   │                    │ border-outline-  │
│  variant/15        │                    │ variant/15       │
└─────────────────────────────────────────────────────────┘
```

### 4.2 左栏：脚本正文

- 头部：标题"脚本正文"（font-headline font-extrabold text-tertiary） + "导入剧本"按钮（rounded-full，surface-container-highest 背景）
- 内容区：滚动 Markdown 显示，Markdown 语法标记（`#`/`##`）用 `text-primary opacity-40` 弱化展示
- 实现：复用现有 `<textarea>` 内容，改为带语法着色的展示区

### 4.3 中栏：分镜列表

- 头部：标题 + 镜头计数 badge（`text-[10px] bg-surface-container-highest`）+ 排序/筛选图标按钮
- 列表：`<table>` 替代现有列表，列：`ID | 景别 | 分镜内容描述 | 时长`
- 表头：`text-[10px] uppercase tracking-widest font-label`，sticky top-0
- 每行：hover 背景变化，激活行显示 `active-row` 样式（左边框 + 渐变背景）
- 景别 badge：`px-2 py-0.5 rounded-sm bg-surface-container-highest text-[10px]`
- 保留现有 AI 拆解逻辑，时长字段如无数据显示 `—`

### 4.4 右栏：属性调整

- 画面比例：16:9 / 9:16 两格卡片选择器，选中态 `border-primary/20 bg-surface-container-highest`
- 镜头模组：`<select>` 下拉，`rounded-xl border-outline-variant/30`
- 视觉提示词：`<textarea>` h-32，描述当前分镜的 prompt
- 核心模型：列表式单选，带 `auto_awesome` 图标 + 选中态 `check_circle`
- 底部操作按钮："导入画布并生成节点"，`glow-button`，`bg-primary text-on-primary`，带 `animate-pulse` 小圆点

### 4.5 功能保留清单

- ✅ 导入文件（现有逻辑）
- ✅ AI 拆解（现有逻辑）
- ✅ AI 优化（现有逻辑）
- ✅ 导入画布并生成节点（现有逻辑）
- ✅ 分镜列表数据绑定

---

## 五、后续页面（待 Stitch 设计稿提供后补充）

- 选题分析（TopicView）
- 资产管理（AssetView）
- 无限画布（Canvas — 主要改侧边工具栏和面板）
- 分镜管理（StoryboardView）
- 视频管理（VideoView）
- 字幕编辑（SubtitleView）

每个页面收到设计稿后，在本文档追加对应章节，再开始实现。

---

## 六、实现顺序

1. `tailwind.config.js` — 注入颜色 token、字体、圆角
2. `src/index.html` — 引入 Google Fonts + Material Symbols
3. `src/index.css` — 注入全局工具类
4. `src/components/BottomTabBar.tsx` — 重写为胶囊图标栏
5. `src/components/BreakdownView.tsx` — 三栏布局重构
6. 后续页面按设计稿到达顺序处理

---

## 七、不在本次范围内

- 功能逻辑变更
- 后端 API 修改
- 选题分析以外页面（等设计稿）
- 响应式移动端适配（当前项目为桌面端）
