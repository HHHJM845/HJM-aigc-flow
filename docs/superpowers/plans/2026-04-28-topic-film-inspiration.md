# Topic Film Inspiration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将「选题」界面从自媒体爆款研究工具改造为影片灵感选题生成器，保留三栏 UI 布局，重构数据模型、AI prompt 和所有界面文案。

**Architecture:** 后端 `topic-research.ts` 重写两条 prompt（Pass 1 生成参考影片列表，Pass 2 生成创作方向分析 + 选题灵感），SSE 事件类型 `videos` → `films`，请求字段 `platforms` → `sources`。前端同步更新类型定义、SSE 处理逻辑、UI 文案和卡片渲染，不新建组件，不改布局。

**Tech Stack:** React + TypeScript（前端），Express + SSE + Doubao LLM（后端）

---

## File Map

| 文件 | 改动类型 | 内容 |
|---|---|---|
| `server/routes/topic-research.ts` | Modify | 重写 prompt、请求字段、SSE 事件类型、返回 JSON 结构 |
| `src/components/TopicVideoCard.tsx` | Modify | 重构类型定义和卡片渲染（FilmItem，来源 badge，展开面板） |
| `src/components/TopicView.tsx` | Modify | 更新类型、SSE 处理、来源 toggle、stats、所有文案、空状态卡 |
| `src/components/TopicIdeaEditor.tsx` | Modify | 仅改两处文案（标题、placeholder） |

---

## Task 1: 重写 Backend — 请求字段 + Pass 1 prompt（参考影片）

**Files:**
- Modify: `server/routes/topic-research.ts`

- [ ] **Step 1: 替换来源常量和请求字段**

将文件顶部的平台常量和校验逻辑全部替换：

```typescript
// 替换原来的 PLATFORM_NAMES
const SOURCE_NAMES: Record<string, string> = {
  cinema:    '院线趋势（近期上映及热映影片）',
  streaming: '流媒体热门（Netflix、爱奇艺、B站等平台）',
  festival:  '国际影展（戛纳、柏林、圣丹斯等）',
};

// 替换原来的 ALLOWED_PLATFORMS
const ALLOWED_SOURCES = new Set(['cinema', 'streaming', 'festival']);
```

在 `router.post('/', ...)` 处理函数中，将请求体解构从：
```typescript
const { keyword, platforms, projectId } = req.body as {
  keyword?: string;
  platforms?: string[];
  projectId?: string;
};
```
改为：
```typescript
const { keyword, sources, projectId } = req.body as {
  keyword?: string;
  sources?: string[];
  projectId?: string;
};
```

将后续所有用到 `platforms` / `selectedPlatforms` / `validPlatforms` / `ALLOWED_PLATFORMS` 的地方对应改为 `sources` / `selectedSources` / `validSources` / `ALLOWED_SOURCES`。

错误信息也同步更新：
- `'请至少选择一个平台'` → `'请至少选择一个来源'`
- `'请选择至少一个有效平台'` → `'请选择至少一个有效来源'`

- [ ] **Step 2: 重写 Pass 1 prompt（生成参考影片列表）**

将 `searchPrompt` 常量完整替换为：

```typescript
const sourceDesc = validSources
  .map(s => SOURCE_NAMES[s] ?? s)
  .join('、');

const searchPrompt = `你是资深电影策划和选题顾问，精通全球影视内容趋势与创作规律。请根据你的专业知识，围绕"${safeKeyword}"这一主题，从以下来源中筛选最具参考价值的影片：${sourceDesc}。

构建 6 部最具代表性的参考影片案例（可以是真实存在的影片，也可以是具有代表性的虚构案例），以纯 JSON 格式返回，不要有任何多余文字、注释或 markdown 代码块，直接返回 JSON：

{
  "summary": {
    "filmCount": <影片数量，数字>,
    "dominantMood": "<主流情感基调，如：孤独、反抗、成长、希望>",
    "dominantGenre": "<高频题材类型，如：公路片、家庭剧情、伪纪录>"
  },
  "films": [
    {
      "title": "<片名>",
      "director": "<导演姓名>",
      "year": <上映年份，数字>,
      "source": "<cinema|streaming|festival>",
      "externalUrl": "<豆瓣或IMDb链接，找不到填空字符串>",
      "styleTags": ["<风格标签1>", "<风格标签2>"],
      "relevanceReason": "<与"${safeKeyword}"主题的关联，说明为何值得参考，2-3句>",
      "learnDimensions": ["<可借鉴维度，如：结构、视觉、人物、主题>"]
    }
  ]
}`;
```

- [ ] **Step 3: 更新 Pass 1 的类型定义和 SSE 发送**

将 `VideoData` 类型定义替换为：

```typescript
type FilmData = {
  summary: { filmCount: number; dominantMood: string; dominantGenre: string };
  films: {
    title: string; director: string; year: number;
    source: string; externalUrl: string;
    styleTags: string[]; relevanceReason: string; learnDimensions: string[];
  }[];
};
```

将 `tryParse` 返回类型和所有 `videoData` 变量名改为 `filmData`：
```typescript
const tryParse = (s: string): FilmData | null => {
  try { return JSON.parse(s) as FilmData; } catch { return null; }
};

let filmData: FilmData | null =
  tryParse(rawContent) ?? tryParse(repairMissingArrayBracket(rawContent));
```

将 JSON 截断修复逻辑中的 `videoData` → `filmData`，最后的 SSE 发送改为：
```typescript
if (!filmData!.films?.length) {
  sseWrite(res, {
    type: 'error',
    data: { message: '未找到相关影片参考，请尝试更换主题或来源' },
  });
  res.write('data: [DONE]\n\n');
  return res.end();
}

// Send Phase 1
sseWrite(res, { type: 'films', data: filmData });
```

- [ ] **Step 4: 提交**

```bash
git add server/routes/topic-research.ts
git commit -m "feat: rewrite topic-research backend Pass 1 — film references"
```

---

## Task 2: 重写 Backend — Pass 2 prompt（创作方向分析 + 选题灵感）

**Files:**
- Modify: `server/routes/topic-research.ts`

- [ ] **Step 1: 重写 Pass 2 的 videosText 和 insightPrompt**

将 `videosText` 生成逻辑替换为：

```typescript
const filmsText = filmData.films
  .map((f, i) =>
    `影片${i + 1}：《${f.title}》（${f.director}，${f.year}，来源：${f.source}）\n风格：${f.styleTags.join('、')}\n关联：${f.relevanceReason}`
  )
  .join('\n\n');
```

将 `insightPrompt` 完整替换为：

```typescript
const insightPrompt = `你是一位影视创作顾问，正在帮助创作者围绕"${safeKeyword}"这一主题找到创作方向。以下是相关参考影片的研究数据：

【参考影片数据】
${filmsText}

【任务一：创作方向分析】
基于以上参考影片，用简洁要点（每点一行，用•开头）分析该主题在影视创作中的规律，涵盖：
• 叙事规律：该主题常见的故事结构（线性/非线性、单线/群像、时间跨度等）
• 视觉基调：色彩、光线、景别、运镜的普遍倾向
• 情感内核：驱动观众的核心情感张力，以及最容易触发共鸣的情绪类型

请先输出创作方向分析内容，然后在结尾另起一行输出如下格式的 JSON（不要有其他文字）：
===SUGGESTIONS_JSON===
[
  {
    "title": "<选题标题，10-20字，有具体感，不是标题党>",
    "coreConflict": "<核心冲突，一句话点明戏剧张力>",
    "genreTag": "<片种：短片|纪录|品牌片|微电影>",
    "referenceStyle": "<风格锚点，如：侯孝贤 / 《童年往事》>"
  }
]
===END===

要求：给出 6-8 个选题建议，覆盖不同片种和角度，避免重复，每个选题都应有清晰的核心冲突。`;
```

- [ ] **Step 2: 更新 SSE suggestions 的类型注释**

在 `sseWrite(res, { type: 'suggestions', data: suggestions });` 前，确认 `suggestions` 是从 JSON.parse 来的，不需要额外改动，结构已由 prompt 约束。

- [ ] **Step 3: 更新项目上下文保存前的变量名**

将：
```typescript
const insightText = fullText.split('===SUGGESTIONS_JSON===')[0].trim();
upsertProjectContext(projectId, {
  keyword: safeKeyword,
  topicInsight: insightText.slice(0, 300),
});
```
保持不变（字段名不变），但确认引用的是 `filmData` 而不是 `videoData`（上一个 Task 已改）。

- [ ] **Step 4: 提交**

```bash
git add server/routes/topic-research.ts
git commit -m "feat: rewrite topic-research backend Pass 2 — film insight + idea suggestions"
```

---

## Task 3: 重构 TopicVideoCard — FilmItem 类型和卡片渲染

**Files:**
- Modify: `src/components/TopicVideoCard.tsx`

- [ ] **Step 1: 替换整个文件内容**

用以下内容完全替换 `src/components/TopicVideoCard.tsx`：

```typescript
// src/components/TopicVideoCard.tsx
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

export interface FilmItem {
  title: string;
  director: string;
  year: number;
  source: 'cinema' | 'streaming' | 'festival';
  externalUrl: string;
  styleTags: string[];
  relevanceReason: string;
  learnDimensions: string[];
}

const SOURCE_LABEL: Record<string, { label: string; cls: string }> = {
  cinema:    { label: '院线',   cls: 'bg-violet-500/20 text-violet-300' },
  streaming: { label: '流媒体', cls: 'bg-emerald-500/20 text-emerald-300' },
  festival:  { label: '影展',   cls: 'bg-amber-500/20 text-amber-300' },
};

export interface Props {
  film: FilmItem;
}

export default function TopicVideoCard({ film }: Props) {
  const [expanded, setExpanded] = useState(false);
  const s = SOURCE_LABEL[film.source] ?? SOURCE_LABEL.cinema;

  return (
    <div className="group relative bg-[#1c1c1e] p-3 rounded-lg border border-white/10 hover:border-[#c6c6c7]/40 transition-all">
      <div className="flex gap-3">
        {/* Icon placeholder (no thumbnail for films) */}
        <div className="w-14 h-16 rounded bg-[#2a2a2e] overflow-hidden flex-shrink-0 flex items-center justify-center">
          <span className="material-symbols-outlined text-[#484848] text-2xl">movie</span>
        </div>

        {/* Info */}
        <div className="flex flex-col justify-between py-1 flex-1 min-w-0">
          <div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mb-1.5 inline-block ${s.cls}`}>
              {s.label}
            </span>
            <div className="text-xs font-bold leading-snug line-clamp-2 text-[#e7e5e4]" title={film.title}>
              《{film.title}》
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">{film.director} · {film.year}</div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {film.externalUrl && (
              <a
                href={film.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#acabaa] flex items-center gap-0.5 hover:text-white transition-colors"
              >
                <ExternalLink size={9} /> 详情
              </a>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[10px] font-bold text-[#c6c6c7] px-2 py-1 rounded bg-[#c6c6c7]/10 hover:bg-[#c6c6c7] hover:text-[#3f4041] transition-all"
              style={{ fontFamily: 'Inter' }}
            >
              创作分析
            </button>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-3 p-3 rounded-xl bg-[#111113] border border-white/10 space-y-3">
          <div>
            <p className="text-[11px] text-[#c6c6c7] font-medium mb-1" style={{ fontFamily: 'Inter' }}>✦ 为何参考</p>
            <p className="text-xs text-[#acabaa] leading-relaxed">{film.relevanceReason}</p>
          </div>
          {film.styleTags.length > 0 && (
            <div>
              <p className="text-[11px] text-[#767575] font-medium mb-1.5" style={{ fontFamily: 'Inter' }}>风格标签</p>
              <div className="flex flex-wrap gap-1">
                {film.styleTags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/[0.08]">{tag}</span>
                ))}
              </div>
            </div>
          )}
          {film.learnDimensions.length > 0 && (
            <div>
              <p className="text-[11px] text-[#767575] font-medium mb-1.5" style={{ fontFamily: 'Inter' }}>可借鉴维度</p>
              <div className="flex flex-wrap gap-1">
                {film.learnDimensions.map((dim, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">{dim}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/TopicVideoCard.tsx
git commit -m "feat: rewrite TopicVideoCard as FilmReferenceCard — FilmItem type + new expand panel"
```

---

## Task 4: 更新 TopicView — 类型、SSE 处理、来源 toggle、stats

**Files:**
- Modify: `src/components/TopicView.tsx`

- [ ] **Step 1: 替换类型定义和常量**

将文件顶部的 import 和类型定义部分替换：

```typescript
// src/components/TopicView.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import TopicVideoCard, { type FilmItem } from './TopicVideoCard';
import TopicIdeaEditor from './TopicIdeaEditor';

export interface FilmIdeaSuggestion {
  title: string;
  coreConflict: string;
  genreTag: string;
  referenceStyle: string;
}

export interface FilmSummary {
  filmCount: number;
  dominantMood: string;
  dominantGenre: string;
}

interface FilmResults {
  summary: FilmSummary;
  films: FilmItem[];
  insight: string;
  suggestions: FilmIdeaSuggestion[];
}

type Source = 'cinema' | 'streaming' | 'festival';

const SOURCES: { key: Source; label: string }[] = [
  { key: 'cinema',    label: '院线趋势' },
  { key: 'streaming', label: '流媒体热门' },
  { key: 'festival',  label: '国际影展' },
];
```

删除原来的 `TopicSuggestion`、`VideoSummary`、`VideoItem`（已从 TopicVideoCard 删除）、`Platform`、`PLATFORMS`、`SUGGESTION_TAGS` 定义。

- [ ] **Step 2: 更新组件状态和 toggle 函数**

在组件函数内，将状态和 toggle 函数替换：

```typescript
const [sources, setSources] = useState<Source[]>(['cinema', 'streaming', 'festival']);
// （其他 state 不变：keyword, loading, loadingMsg, results, error, draft）

const toggleSource = (s: Source) => {
  setSources(prev =>
    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
  );
};
```

将 `results` 状态类型改为 `FilmResults | null`，初始值保持 `null`。

- [ ] **Step 3: 更新 handleAnalyze — 请求体和 SSE 处理**

将 `handleAnalyze` 函数中的请求体从：
```typescript
body: JSON.stringify({ keyword: kw, platforms, projectId }),
```
改为：
```typescript
body: JSON.stringify({ keyword: kw, sources, projectId }),
```

将加载文案更新：
```typescript
setLoadingMsg('正在检索影视参考…');
// ... 在收到 films 事件后：
setLoadingMsg('正在提炼创作方向…');
```

将 SSE 消息处理从 `videos` → `films`：
```typescript
if (msg.type === 'films') {
  const d = msg.data as { summary: FilmSummary; films: FilmItem[] };
  setResults({ summary: d.summary, films: d.films, insight: '', suggestions: [] });
  setLoadingMsg('正在提炼创作方向…');
} else if (msg.type === 'insight_chunk') {
  insightAccum += msg.data as string;
  setResults(prev => prev ? { ...prev, insight: insightAccum } : null);
} else if (msg.type === 'suggestions') {
  const suggestions = msg.data as FilmIdeaSuggestion[];
  setResults(prev => prev ? { ...prev, suggestions } : null);
} else if (msg.type === 'error') {
  throw new Error((msg.data as { message: string }).message);
}
```

- [ ] **Step 4: 更新 handleAdopt（字段 title 不变）**

`handleAdopt` 函数已接收 `title: string`，不需要改动。

- [ ] **Step 5: 更新渲染 — 搜索区**

将顶部来源 toggle 区域从：
```tsx
{PLATFORMS.map(({ key, label }) => (
  <button key={key} onClick={() => togglePlatform(key)} ...>
```
改为：
```tsx
{SOURCES.map(({ key, label }) => (
  <button
    key={key}
    onClick={() => toggleSource(key)}
    className={`px-7 py-2 rounded-full text-sm transition-all ${
      sources.includes(key)
        ? 'bg-[#e0e0e0]/10 text-[#e0e0e0] border border-[#e0e0e0]/20'
        : 'text-white/40 hover:text-[#e0e0e0]'
    }`}
    style={{ fontFamily: 'Inter' }}
  >
    {label}
  </button>
))}
```

将搜索框 placeholder 改为：
```tsx
placeholder="输入主题、情绪、人物原型或社会议题..."
```

将分析按钮文字改为：
```tsx
{loading ? (loadingMsg || '探索中…') : '探索灵感'}
```

将 `platforms.length === 0` 的校验改为：
```typescript
if (sources.length === 0) { setError('请至少选择一个来源'); return; }
```

- [ ] **Step 6: 更新渲染 — 左侧 stats 区域**

将「核心数据指标」卡片区域替换为：

```tsx
<div className="flex-shrink-0 rounded-xl p-5 space-y-4" style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.10)' }}>
  <h3 className="text-[10px] uppercase tracking-widest text-white/40" style={{ fontFamily: 'Inter' }}>题材温度</h3>
  <div className="p-3 bg-[#111113] rounded-lg border border-white/[0.08]">
    <p className="text-[10px] text-white/40 mb-1" style={{ fontFamily: 'Inter' }}>近期参考作品数</p>
    <span className="text-2xl font-bold text-[#e0e0e0]" style={{ fontFamily: 'Manrope' }}>
      {results?.summary ? results.summary.filmCount : '—'}
    </span>
  </div>
  <div className="p-3 bg-[#111113] rounded-lg border border-white/[0.08]">
    <p className="text-[10px] text-white/40 mb-1" style={{ fontFamily: 'Inter' }}>主流情感基调</p>
    <span className="text-lg font-bold text-[#e0e0e0]" style={{ fontFamily: 'Manrope' }}>
      {results?.summary ? results.summary.dominantMood : '—'}
    </span>
  </div>
  <div className="p-3 bg-[#111113] rounded-lg border border-white/[0.08]">
    <p className="text-[10px] text-white/40 mb-1" style={{ fontFamily: 'Inter' }}>高频题材类型</p>
    <span className="text-lg font-bold text-[#e0e0e0]" style={{ fontFamily: 'Manrope' }}>
      {results?.summary ? results.summary.dominantGenre : '—'}
    </span>
  </div>
</div>
```

- [ ] **Step 7: 更新渲染 — 左侧列表区域**

将列表区域标题从「热门视频列表」改为「参考影片」：
```tsx
<h3 className="text-[10px] uppercase tracking-widest text-white/40" style={{ fontFamily: 'Inter' }}>参考影片</h3>
```

空状态提示改为：
```tsx
<p className="text-white/20 text-xs text-center" style={{ fontFamily: 'Inter' }}>输入主题后<br />参考影片将显示在这里</p>
```

列表渲染从：
```tsx
{results?.videos?.map((v, i) => (
  <TopicVideoCard key={i} video={v} />
))}
```
改为：
```tsx
{results?.films?.map((f, i) => (
  <TopicVideoCard key={i} film={f} />
))}
```

- [ ] **Step 8: 提交**

```bash
git add src/components/TopicView.tsx
git commit -m "feat: update TopicView — source toggle, FilmResults types, SSE handler, stats"
```

---

## Task 5: 更新 TopicView — 中间栏文案和选题卡片

**Files:**
- Modify: `src/components/TopicView.tsx`

- [ ] **Step 1: 更新中间上方「创作方向分析」块**

将中间分析块的标题从：
```tsx
{hasResults ? 'AI 洞察报告' : '今日爆款配方'}
```
改为：
```tsx
{hasResults ? 'AI 创作方向分析' : '创作方向分析'}
```

将空状态的默认占位文字替换（`results?.insight || loading` 为 false 时）：

```tsx
<p className="text-lg leading-relaxed text-[#e0e0e0]/90 font-light italic" style={{ fontFamily: 'Manrope' }}>
  探索一个主题，AI 将为你提炼影视创作方向，包括叙事规律、视觉基调与情感内核。
</p>
```

删除原来空状态下的 hashtag 展示部分（`#视觉对比` 等）。

- [ ] **Step 2: 替换有数据时的选题卡片渲染**

将 `results?.suggestions && results.suggestions.length > 0` 为 true 时的卡片 grid 替换：

```tsx
<div className="grid grid-cols-2 gap-4">
  {results.suggestions.map((s, i) => (
    <div
      key={i}
      className="rounded-xl p-5 flex flex-col justify-between group hover:border-[#e0e0e0]/20 transition-all"
      style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <div>
        <div className="flex justify-between items-start mb-4">
          <span className="bg-[#e0e0e0]/10 text-[#e0e0e0] px-2 py-0.5 rounded text-[10px] font-bold" style={{ fontFamily: 'Inter' }}>
            {s.genreTag}
          </span>
          <span className="material-symbols-outlined text-white/20 group-hover:text-[#e0e0e0] transition-colors text-[18px]">movie_creation</span>
        </div>
        <h4 className="font-bold text-[#e0e0e0] mb-2 text-sm" style={{ fontFamily: 'Manrope' }}>{s.title}</h4>
        <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2" style={{ fontFamily: 'Inter' }}>{s.coreConflict}</p>
      </div>
      <div>
        <p className="text-[10px] text-white/20 mt-3 mb-3" style={{ fontFamily: 'Inter' }}>参考风格：{s.referenceStyle}</p>
        <button
          onClick={() => handleAdopt(s.title)}
          className="w-full py-2 bg-[#1a1a1a] hover:bg-[#e0e0e0] hover:text-[#1a1a1a] rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-2 text-[#e0e0e0]"
          style={{ fontFamily: 'Inter' }}
        >
          <span className="material-symbols-outlined text-[16px]">add_task</span>
          采用该建议
        </button>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: 替换空状态骨架卡片**

将 `suggestions.length === 0`（或无 results）时的骨架卡片 grid 替换：

```tsx
<div className="grid grid-cols-2 gap-4">
  {[
    { genreTag: '短片',   icon: 'movie',          title: '父亲的最后一卷胶片',  coreConflict: '儿子整理遗物时发现从未冲洗的胶卷，面对是否打开的两难' },
    { genreTag: '纪录',   icon: 'video_camera_front', title: '消失的方言',      coreConflict: '一个孩子试图用录音机记录只剩三位老人会说的语言' },
    { genreTag: '品牌片', icon: 'campaign',        title: '凌晨四点的城市工人',  coreConflict: '他们在城市沉睡时劳动，却在城市醒来后隐形' },
    { genreTag: '微电影', icon: 'theaters',        title: '最后一次见她',        coreConflict: '男人准备好了道歉，却发现她早已不在意' },
  ].map(({ genreTag, icon, title, coreConflict }) => (
    <div
      key={title}
      className="rounded-xl p-5 flex flex-col justify-between opacity-40"
      style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <div>
        <div className="flex justify-between items-start mb-4">
          <span className="bg-[#e0e0e0]/10 text-[#e0e0e0] px-2 py-0.5 rounded text-[10px] font-bold" style={{ fontFamily: 'Inter' }}>{genreTag}</span>
          <span className="material-symbols-outlined text-white/20 text-[18px]">{icon}</span>
        </div>
        <h4 className="font-bold text-[#e0e0e0] mb-2 text-sm" style={{ fontFamily: 'Manrope' }}>{title}</h4>
        <p className="text-[11px] text-white/40 leading-relaxed" style={{ fontFamily: 'Inter' }}>{coreConflict}</p>
      </div>
      <div className="mt-5 w-full py-2 bg-[#1a1a1a] rounded-lg text-[11px] font-semibold text-center text-white/40" style={{ fontFamily: 'Inter' }}>
        {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : '探索后解锁'}
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 4: 提交**

```bash
git add src/components/TopicView.tsx
git commit -m "feat: update TopicView center column — film idea cards + empty state"
```

---

## Task 6: 更新 TopicIdeaEditor — 文案改名

**Files:**
- Modify: `src/components/TopicIdeaEditor.tsx`

- [ ] **Step 1: 改标题和 placeholder**

将标题从「我的选题想法」改为「导演手记」：
```tsx
<h3 className="text-[#e0e0e0] font-bold text-base flex items-center gap-2" style={{ fontFamily: 'Manrope' }}>
  <span className="material-symbols-outlined text-[#e0e0e0]">edit_note</span>
  导演手记
</h3>
```
（图标从 `lightbulb` 改为 `edit_note`，更贴合「手记」语义）

将 textarea placeholder 从「在这里记录你的灵感碎片...」改为：
```tsx
placeholder="在这里记录你的创作思路，采用灵感后自动追加…"
```

- [ ] **Step 2: 提交**

```bash
git add src/components/TopicIdeaEditor.tsx
git commit -m "feat: rename TopicIdeaEditor to 导演手记, update placeholder"
```

---

## Task 7: 端到端验证

**Files:**
- 无代码改动，仅验证

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

确认前端和后端均启动成功，无 TypeScript 编译报错。

- [ ] **Step 2: 检查来源 toggle**

打开浏览器，进入选题页面，确认：
- Toggle 显示「院线趋势」「流媒体热门」「国际影展」（不再是 B站/小红书/抖音）
- 三个 toggle 默认全部选中
- 点击任一 toggle 可取消选中，UI 状态正确更新
- 搜索框 placeholder 为「输入主题、情绪、人物原型或社会议题...」
- 按钮文字为「探索灵感」

- [ ] **Step 3: 检查空状态**

在未搜索时确认：
- 左侧 stats 显示三个「—」占位
- 左侧列表显示「输入主题后 / 参考影片将显示在这里」
- 中间上方显示「探索一个主题，AI 将为你提炼影视创作方向…」
- 中间下方显示 4 张半透明骨架卡，片种 tag 为「短片」「纪录」「品牌片」「微电影」
- 右侧标题为「导演手记」

- [ ] **Step 4: 触发搜索并验证结果**

输入关键词（如「父子关系」），点击「探索灵感」：

1. loading 文案依次出现「正在检索影视参考…」→「正在提炼创作方向…」
2. 左侧：stats 显示 filmCount（数字）、dominantMood（如「隔阂」）、dominantGenre（如「家庭剧情」）
3. 左侧列表：出现影片卡，显示片名（带书名号）、导演、年份、来源 badge（颜色对应院线/流媒体/影展）
4. 点击「创作分析」展开面板，显示「为何参考」段落、风格标签 badge、可借鉴维度 badge
5. 中间上方：流式输出叙事规律/视觉基调/情感内核三段落分析
6. 中间下方：出现灵感卡片，每张有片种 tag、选题标题、核心冲突、参考风格小字
7. 点击「采用该建议」→ 标题追加到右侧「导演手记」文本框

- [ ] **Step 5: 验证无控制台报错**

打开浏览器 DevTools Console，确认无 TypeScript 类型错误警告或 undefined 访问报错。

- [ ] **Step 6: 最终提交**

```bash
git add .
git commit -m "chore: verified film inspiration topic redesign end-to-end"
```
