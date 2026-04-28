# 选题界面改造：自媒体爆款 → 影片灵感选题

**日期：** 2026-04-28  
**状态：** 已审批，待实现

---

## 背景与目标

现有「选题」界面定位为短视频自媒体爆款研究工具：平台入口是 B站/小红书/抖音，AI 分析「爆款配方」，建议卡 tag 是「高成功率」「潜力黑马」，整体语言面向算法运营。

目标：在保留现有三栏 UI 布局和整体视觉风格的前提下，将功能定位切换为**影片灵感选题生成器**——帮助创作者围绕某个主题、情绪或议题，找到影视创作的切入角度，并生成具体可用的选题灵感卡片。支持短片、微电影、纪录片、品牌片等多元片种。

---

## 架构概览

三栏布局不变（左 3 / 中 6 / 右 3），数据流不变（前端 → `/api/topic-research` SSE → 前端渲染）。

改动范围：
1. **前端**：`TopicView.tsx`、`TopicVideoCard.tsx`、`TopicIdeaEditor.tsx`（仅改名/文案）
2. **后端**：`server/routes/topic-research.ts`（prompt 重写、返回字段重构）
3. **类型定义**：`VideoItem`、`TopicSuggestion`、`VideoSummary` 全部重命名并重构字段

---

## 详细设计

### 1. 搜索区（顶部）

| 元素 | 现在 | 改后 |
|---|---|---|
| 来源 toggle | B站 / 小红书 / 抖音 | 院线趋势 / 流媒体热门 / 国际影展 |
| toggle key | `bilibili` / `xiaohongshu` / `douyin` | `cinema` / `streaming` / `festival` |
| placeholder | 输入关键词、博主名或话题趋势… | 输入主题、情绪、人物原型或社会议题… |
| 分析按钮 | 开始分析 | 探索灵感 |
| loading 文案 1 | 正在联网搜索相关内容… | 正在检索影视参考… |
| loading 文案 2 | 正在分析爆款规律… | 正在提炼创作方向… |

---

### 2. 左侧栏

#### 2a. 上方指标卡（原「核心数据指标」）

改名为「题材温度」，三个数字卡内容：

| 指标 | 说明 |
|---|---|
| 近期参考作品数 | AI 返回的相关影片数量 |
| 主流情感基调 | 字符串，如「孤独」「反抗」「成长」 |
| 高频题材类型 | 字符串，如「公路片」「家庭剧情」|

对应 backend summary 字段：`{ filmCount: number, dominantMood: string, dominantGenre: string }`

#### 2b. 下方列表（原「热门视频列表」）

改名为「参考影片」，卡片组件 `TopicVideoCard` 重构为 `FilmReferenceCard`（或直接重命名）。

**卡片字段：**

```ts
interface FilmItem {
  title: string;           // 片名
  director: string;        // 导演
  year: number;            // 年份
  source: 'cinema' | 'streaming' | 'festival';
  externalUrl: string;     // 豆瓣 / IMDb 链接（可空）
  styleTags: string[];     // 如 ["冷峻现实主义", "非线性叙事"]
  relevanceReason: string; // 与当前主题的关联，2-3 句
  learnDimensions: string[]; // 适合借鉴的维度，如 ["结构", "视觉", "人物"]
}
```

**展开面板内容（替代原「爆款原因 + 代表评论 + 内容简介」）：**
- ✦ 为何参考：`relevanceReason`
- 风格标签：`styleTags`（badge 展示）
- 可借鉴维度：`learnDimensions`（badge 展示）

**来源 badge 颜色映射（替代平台 badge）：**
- 院线：蓝紫色调
- 流媒体：绿色调
- 影展：琥珀/金色调

---

### 3. 中间栏

#### 3a. 上方分析块（原「今日爆款配方」）

改名为「创作方向分析」，标题图标保留 `auto_awesome`。

AI 流式输出内容结构（三段落，用 `•` 分隔）：
- **叙事规律**：该主题在影视中常见的故事结构
- **视觉基调**：色彩、光线、景别、运镜倾向
- **情感内核**：驱动观众的核心情感张力

空状态占位文字改为：「探索一个主题，AI 将为你提炼影视创作方向…」

#### 3b. 下方选题卡（原「选题建议」）

网格保留 2×N 布局，每张卡字段：

```ts
interface FilmIdeaSuggestion {
  title: string;          // 选题标题，10-20 字，有具体感
  coreConflict: string;   // 核心冲突，一句话点明戏剧张力（替代 reason）
  genreTag: string;       // 片种：短片 / 纪录 / 品牌片 / 微电影
  referenceStyle: string; // 风格锚点，如"侯孝贤 / 《路边野餐》"
}
```

**卡片 UI 变化：**
- 左上 badge：`genreTag`（替代「高成功率」等 tag）
- 标题：`title`
- 正文：`coreConflict`（替代 reason）
- 右下小字：`参考风格：${referenceStyle}`（新增）
- 「采用该建议」按钮保留，行为不变（追加到导演手记）

**空状态骨架卡** 替换为影片灵感示例：
```
{ genreTag: '短片',   title: '父亲的最后一卷胶片',  coreConflict: '儿子整理遗物时发现从未冲洗的胶卷，面对是否打开的两难' }
{ genreTag: '纪录',   title: '消失的方言',          coreConflict: '一个孩子试图用录音机记录只剩三位老人会说的语言' }
{ genreTag: '品牌片', title: '凌晨四点的城市工人',  coreConflict: '他们在城市沉睡时劳动，却在城市醒来后隐形' }
{ genreTag: '微电影', title: '最后一次见她',         coreConflict: '男人准备好了道歉，却发现她早已不在意' }
```

---

### 4. 右侧栏（导演手记）

`TopicIdeaEditor` 组件只改文案：
- 标题：「草稿编辑器」→「导演手记」
- 空状态提示：「在这里记录你的创作思路，采用灵感后自动追加…」
- 「导入到分镜拆解」按钮保留，行为不变

---

### 5. Backend（`server/routes/topic-research.ts`）

#### Pass 1 prompt 重写

角色从「短视频内容研究专家」改为「资深电影策划和选题顾问」。

任务：根据用户输入的主题，从指定来源（院线趋势/流媒体热门/国际影展）中构建 6 部最具参考价值的影片案例。

返回 JSON 结构：
```json
{
  "summary": {
    "filmCount": 6,
    "dominantMood": "孤独",
    "dominantGenre": "公路片"
  },
  "films": [
    {
      "title": "片名",
      "director": "导演",
      "year": 2023,
      "source": "festival",
      "externalUrl": "",
      "styleTags": ["手持长镜头", "冷色调"],
      "relevanceReason": "与主题的关联…",
      "learnDimensions": ["结构", "视觉"]
    }
  ]
}
```

SSE 事件类型：`films`（替代 `videos`），数据格式如上。

#### Pass 2 prompt 重写

角色：影视创作顾问。任务：基于参考影片数据，输出创作方向分析 + 选题灵感。

输出格式不变（`===SUGGESTIONS_JSON===` 分隔符保留），但 JSON 内容改为：
```json
[
  {
    "title": "选题标题",
    "coreConflict": "核心冲突一句话",
    "genreTag": "短片",
    "referenceStyle": "侯孝贤 / 《童年往事》"
  }
]
```

项目上下文保存字段不变（`keyword` + `topicInsight`）。

---

## 不改动的部分

- 三栏布局和比例（col-span-3 / 6 / 3）
- 整体配色（黑底 `#1c1c1e`、文字 `#e0e0e0`）
- SSE 流式渲染机制
- `TopicIdeaEditor` 交互逻辑
- 「导入到分镜拆解」流程
- 项目上下文保存逻辑

---

## 数据流

```
用户输入主题 + 选择来源
  → POST /api/topic-research { keyword, sources: ['cinema','festival'], projectId }
  → SSE: { type: 'films', data: { summary, films[] } }       ← 前端渲染左侧
  → SSE: { type: 'insight_chunk', data: string }             ← 前端流式渲染中间上方
  → SSE: { type: 'suggestions', data: FilmIdeaSuggestion[] } ← 前端渲染中间下方卡片
  → SSE: [DONE]
```
