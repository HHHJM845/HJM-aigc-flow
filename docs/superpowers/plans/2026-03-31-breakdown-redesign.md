# 剧本拆解重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构剧本拆解为左右分栏全页视图，支持二次编辑剧本后高亮 diff、用户确认后局部重拆分镜。

**Architecture:** 新建 `BreakdownView` 组件替代 `BreakdownModal` 的 fullPage 模式；新建 `src/lib/diff.ts` 提供段落级 LCS diff；服务端 `/api/breakdown` prompt 更新以返回 `sourceSegment` 字段；`App.tsx` 改用 `BreakdownView`。

**Tech Stack:** React 18, TypeScript, @dnd-kit/sortable, Express + DeepSeek API

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/api.ts` | 修改 | `StoryboardRow` 增加 `sourceSegment?: string` |
| `server/routes/breakdown.ts` | 修改 | prompt 要求返回 `source_segment`，response mapping 加字段 |
| `src/lib/diff.ts` | 新建 | 段落级 LCS diff 工具函数 |
| `src/components/BreakdownView.tsx` | 新建 | 左右分栏主组件，含 diff 高亮、重拆逻辑 |
| `src/App.tsx` | 修改 | 替换 `<BreakdownModal fullPage>` 为 `<BreakdownView>` |

---

## Task 1: 更新 StoryboardRow 类型 + 服务端 prompt

**Files:**
- Modify: `src/lib/api.ts:1-6`
- Modify: `server/routes/breakdown.ts:5-14`, `server/routes/breakdown.ts:73-81`

- [ ] **Step 1: 更新 `src/lib/api.ts` 中的 `StoryboardRow` 接口**

将 `src/lib/api.ts` 第1-6行替换为：

```ts
export interface StoryboardRow {
  id: string;
  index: number;
  shotType: string;
  description: string;
  sourceSegment?: string; // 对应的原文段落文本，用于 diff 映射
}
```

- [ ] **Step 2: 更新服务端 breakdown prompt**

将 `server/routes/breakdown.ts` 的 `BREAKDOWN_SYSTEM_PROMPT` 替换为：

```ts
const BREAKDOWN_SYSTEM_PROMPT = `你是专业分镜师。将剧本拆解为分镜列表，只返回 JSON，格式：
{"scenes":[{"shot_type":"景别","description":"镜头内容","source_segment":"对应的原文段落原文"},...]}

规则：
1. "场X 地点"行是场景标题，不是分镜，跳过
2. "△"开头的每一行 = 一个独立分镜
3. 对白行（人名：台词）= 一个独立分镜
4. shot_type 只填景别词，如：特写、近景、中近景、中景、全景、远景、大全景、航拍
5. description 用一句话描述画面动作，不超过60字
6. source_segment 填写该分镜对应的原文段落内容（可以是多行，保持原文）
7. 禁止输出 JSON 以外的任何文字`;
```

- [ ] **Step 3: 更新服务端 response mapping，加上 `sourceSegment`**

将 `server/routes/breakdown.ts` 第73-81行的 `scenes` map 替换为：

```ts
const scenes = rawArr.map((item, i) => {
  const o = item as Record<string, unknown>;
  return {
    id: `row-${Date.now()}-${i}`,
    index: i + 1,
    shotType: String(o.shot_type ?? o.shotType ?? o['景别'] ?? ''),
    description: String(o.description ?? o.content ?? o['镜头内容'] ?? o['描述'] ?? ''),
    sourceSegment: String(o.source_segment ?? o.sourceSegment ?? ''),
  };
});
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts server/routes/breakdown.ts
git commit -m "feat: add sourceSegment to StoryboardRow and breakdown API"
```

---

## Task 2: 新建段落 diff 工具 `src/lib/diff.ts`

**Files:**
- Create: `src/lib/diff.ts`

- [ ] **Step 1: 新建 `src/lib/diff.ts`**

```ts
/**
 * 将文本按双换行分段，过滤空段落
 */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
}

/**
 * LCS-based paragraph diff.
 * 返回在 newParagraphs 中相对于 oldParagraphs 新增或修改的段落。
 * 策略：完全相同的段落视为未变，其余视为变动。
 */
export function diffParagraphs(
  oldParagraphs: string[],
  newParagraphs: string[]
): { changed: string[]; unchangedSet: Set<string> } {
  const oldSet = new Set(oldParagraphs);
  const changed: string[] = [];
  const unchangedSet = new Set<string>();

  for (const p of newParagraphs) {
    if (oldSet.has(p)) {
      unchangedSet.add(p);
    } else {
      changed.push(p);
    }
  }

  return { changed, unchangedSet };
}

/**
 * 合并重拆结果到现有 rows。
 * - 找到 sourceSegment 属于 changedSegments 的旧 rows，用新 rows 替换
 * - 纯新增段落（旧 rows 里没有对应 sourceSegment）的新 rows 追加到末尾
 * - 重新编号 index
 */
export function mergeRows<T extends { id: string; index: number; sourceSegment?: string }>(
  existingRows: T[],
  newRows: T[],
  changedSegments: string[]
): T[] {
  const changedSet = new Set(changedSegments);

  // 保留 sourceSegment 不在 changedSegments 里的旧 rows
  const keptRows = existingRows.filter(r => !changedSet.has(r.sourceSegment ?? ''));

  // 新 rows 里，sourceSegment 已在旧 rows 中有对应的 → 替换；否则 → 追加
  const existingSegments = new Set(existingRows.map(r => r.sourceSegment ?? ''));
  const replacementRows = newRows.filter(r => existingSegments.has(r.sourceSegment ?? '') || changedSet.has(r.sourceSegment ?? ''));
  const appendRows = newRows.filter(r => !existingSegments.has(r.sourceSegment ?? '') && !changedSet.has(r.sourceSegment ?? ''));

  const merged = [...keptRows, ...replacementRows, ...appendRows];
  return merged.map((r, i) => ({ ...r, index: i + 1 }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/diff.ts
git commit -m "feat: add paragraph diff utility"
```

---

## Task 3: 新建 `BreakdownView` 组件

**Files:**
- Create: `src/components/BreakdownView.tsx`

这是最核心的组件。左右分栏：左侧 `ScriptEditor`，右侧 `StoryboardTable`。

- [ ] **Step 1: 新建 `src/components/BreakdownView.tsx`**

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sparkles, Plus, X, GripVertical, ArrowRight, Loader2, Upload, FileText, ChevronDown,
} from 'lucide-react';
import { breakdownScript, type StoryboardRow } from '../lib/api';
import { splitParagraphs, diffParagraphs, mergeRows } from '../lib/diff';

// ── 比例选项 ─────────────────────────────────────────
const CARD_RATIOS = [
  { label: '16:9', ratio: '16:9', w: 380, h: 214 },
  { label: '4:3',  ratio: '4:3',  w: 380, h: 285 },
  { label: '1:1',  ratio: '1:1',  w: 380, h: 380 },
  { label: '3:4',  ratio: '3:4',  w: 380, h: 507 },
  { label: '9:16', ratio: '9:16', w: 380, h: 676 },
  { label: '3:2',  ratio: '3:2',  w: 380, h: 253 },
  { label: '2:3',  ratio: '2:3',  w: 380, h: 570 },
  { label: '21:9', ratio: '21:9', w: 380, h: 163 },
];

// ── SortableRow ───────────────────────────────────────
function SortableRow({
  row, onUpdate, onDelete, isNew,
}: {
  row: StoryboardRow;
  onUpdate: (id: string, field: keyof StoryboardRow, value: string) => void;
  onDelete: (id: string) => void;
  isNew: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-white/5 hover:bg-white/[0.02] group transition-all ${
        isNew ? 'outline outline-1 outline-blue-400/60 bg-blue-400/5' : ''
      }`}
    >
      <td className="py-2 px-3 text-gray-500 text-sm">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical size={13} />
          </button>
          <span className="text-gray-500 text-xs">{row.index}</span>
        </div>
      </td>
      <td className="py-2 px-3">
        <input
          value={row.shotType}
          onChange={e => onUpdate(row.id, 'shotType', e.target.value)}
          className="w-full bg-transparent text-gray-300 text-xs focus:outline-none"
          placeholder="景别"
        />
      </td>
      <td className="py-2 px-3">
        <textarea
          value={row.description}
          onChange={e => onUpdate(row.id, 'description', e.target.value)}
          className="w-full bg-transparent text-gray-200 text-xs focus:outline-none resize-none leading-relaxed"
          rows={2}
        />
      </td>
      <td className="py-2 px-3 text-center">
        <button
          onClick={() => onDelete(row.id)}
          className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          <X size={12} />
        </button>
      </td>
    </tr>
  );
}

// ── Props ─────────────────────────────────────────────
interface Props {
  initialRows?: StoryboardRow[];
  onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
}

// ── Main Component ────────────────────────────────────
export default function BreakdownView({ initialRows, onImport }: Props) {
  const [scriptText, setScriptText] = useState('');
  const [committedScript, setCommittedScript] = useState('');
  const [rows, setRows] = useState<StoryboardRow[]>(initialRows ?? []);
  const [isBreaking, setIsBreaking] = useState(false);
  const [error, setError] = useState('');
  const [changedSegments, setChangedSegments] = useState<string[]>([]);
  const [newlyUpdatedIds, setNewlyUpdatedIds] = useState<Set<string>>(new Set());
  const [cardRatio, setCardRatio] = useState('16:9');
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Compute diff whenever scriptText changes and rows exist
  useEffect(() => {
    if (!committedScript || rows.length === 0) {
      setChangedSegments([]);
      return;
    }
    const oldParas = splitParagraphs(committedScript);
    const newParas = splitParagraphs(scriptText);
    const { changed } = diffParagraphs(oldParas, newParas);
    setChangedSegments(changed);
  }, [scriptText, committedScript, rows.length]);

  // Clear blue highlight after 3 seconds
  useEffect(() => {
    if (newlyUpdatedIds.size === 0) return;
    const timer = setTimeout(() => setNewlyUpdatedIds(new Set()), 3000);
    return () => clearTimeout(timer);
  }, [newlyUpdatedIds]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setScriptText((ev.target?.result as string) || '');
    reader.readAsText(file);
  };

  // 首次拆解
  const handleFirstBreakdown = async () => {
    if (!scriptText.trim() || isBreaking) return;
    setIsBreaking(true);
    setError('');
    try {
      const result = await breakdownScript(scriptText);
      setRows(result);
      setCommittedScript(scriptText);
      setChangedSegments([]);
    } catch (err: any) {
      setError(err.message || '拆解失败，请重试');
    } finally {
      setIsBreaking(false);
    }
  };

  // 局部重拆变动部分
  const handlePartialBreakdown = useCallback(async () => {
    if (changedSegments.length === 0 || isBreaking) return;
    setIsBreaking(true);
    setError('');
    try {
      const segmentText = changedSegments.join('\n\n');
      const newRows = await breakdownScript(segmentText);
      setRows(prev => {
        const merged = mergeRows(prev, newRows, changedSegments);
        const updatedIds = new Set(newRows.map(r => r.id));
        setNewlyUpdatedIds(updatedIds);
        return merged;
      });
      setCommittedScript(scriptText);
      setChangedSegments([]);
    } catch (err: any) {
      setError(err.message || '拆解失败，请重试');
    } finally {
      setIsBreaking(false);
    }
  }, [changedSegments, isBreaking, scriptText]);

  const handleUpdateRow = (id: string, field: keyof StoryboardRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDeleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, index: i + 1 })));
  };

  const handleAddRow = () => {
    setRows(prev => [...prev, {
      id: `row-${Date.now()}`,
      index: prev.length + 1,
      shotType: '',
      description: '',
      sourceSegment: '',
    }]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows(prev => {
      const oldIndex = prev.findIndex(r => r.id === active.id);
      const newIndex = prev.findIndex(r => r.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((r, i) => ({ ...r, index: i + 1 }));
    });
  };

  const hasDiff = changedSegments.length > 0 && scriptText !== committedScript;
  const isFirstBreakdown = rows.length === 0;

  // Build highlight ranges for the textarea overlay
  // We highlight changed paragraphs with a yellow tint by rendering a backdrop div
  const highlightedScript = (() => {
    if (!hasDiff) return null;
    const changedSet = new Set(changedSegments);
    return splitParagraphs(scriptText).map((para, i) => (
      <span
        key={i}
        className={changedSet.has(para) ? 'bg-yellow-400/20 rounded' : ''}
      >
        {para}{'\n\n'}
      </span>
    ));
  })();

  return (
    <div className="w-full h-full flex bg-[#0c0c0c] overflow-hidden">
      {/* ── 左侧：剧本编辑器 ── */}
      <div className="flex flex-col w-1/2 border-r border-white/[0.06] min-h-0">
        {/* 左侧 Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText size={15} className="text-gray-400" />
            <span className="text-white font-medium text-[14px]">剧本编辑器</span>
            <span className="text-gray-600 text-xs">粘贴剧本，AI 自动生成分镜表</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-xs transition-colors border border-white/5"
            >
              <Upload size={12} />
              导入文件
            </button>
            <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
            {isFirstBreakdown && (
              <button
                onClick={handleFirstBreakdown}
                disabled={!scriptText.trim() || isBreaking}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isBreaking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isBreaking ? 'AI 拆解中...' : '✨ AI 拆解'}
              </button>
            )}
          </div>
        </div>

        {/* 文本编辑区 */}
        <div className="relative flex-1 min-h-0">
          <textarea
            value={scriptText}
            onChange={e => setScriptText(e.target.value)}
            placeholder="在此粘贴剧本内容..."
            className="absolute inset-0 w-full h-full bg-transparent text-gray-200 text-sm leading-relaxed p-5 focus:outline-none resize-none"
            style={{ fontFamily: 'inherit' }}
          />
        </div>

        {/* Diff 提示栏 */}
        {hasDiff && !isFirstBreakdown && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-yellow-400/20 bg-yellow-400/5 flex-shrink-0">
            <span className="text-yellow-300/80 text-xs">
              检测到 {changedSegments.length} 处变动
            </span>
            <button
              onClick={handlePartialBreakdown}
              disabled={isBreaking}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-yellow-400 text-black rounded-lg text-xs font-medium hover:bg-yellow-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isBreaking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {isBreaking ? '拆解中...' : '重新拆解变动部分'}
            </button>
          </div>
        )}

        {error && (
          <div className="px-5 py-2 border-t border-red-400/20 flex-shrink-0">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* ── 右侧：分镜列表 ── */}
      <div className="flex flex-col w-1/2 min-h-0">
        {/* 右侧 Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] flex-shrink-0">
          <span className="text-white font-medium text-[14px]">
            分镜列表
            {rows.length > 0 && (
              <span className="ml-2 text-gray-500 text-xs font-normal">{rows.length} 条</span>
            )}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-600 text-sm">完成 AI 拆解后，分镜将显示在这里</p>
          </div>
        ) : (
          <>
            {/* 固定表头 */}
            <table className="w-full table-fixed flex-shrink-0">
              <colgroup>
                <col style={{ width: '56px' }} />
                <col style={{ width: '90px' }} />
                <col />
                <col style={{ width: '36px' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="py-2.5 px-3 text-[11px] text-gray-600 font-medium">镜头号</th>
                  <th className="py-2.5 px-3 text-[11px] text-gray-600 font-medium">景别</th>
                  <th className="py-2.5 px-3 text-[11px] text-gray-600 font-medium">镜头内容</th>
                  <th className="py-2.5 px-3" />
                </tr>
              </thead>
            </table>

            {/* 可滚动 tbody */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '56px' }} />
                  <col style={{ width: '90px' }} />
                  <col />
                  <col style={{ width: '36px' }} />
                </colgroup>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {rows.map(row => (
                        <SortableRow
                          key={row.id}
                          row={row}
                          onUpdate={handleUpdateRow}
                          onDelete={handleDeleteRow}
                          isNew={newlyUpdatedIds.has(row.id)}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] flex-shrink-0">
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-gray-300 rounded-lg text-xs transition-colors border border-white/5"
              >
                <Plus size={12} />
                添加分镜
              </button>

              <div className="flex items-center gap-2">
                {/* 比例选择 */}
                <div className="relative">
                  <button
                    onClick={() => setIsRatioOpen(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 rounded-lg text-xs transition-colors border border-white/5"
                  >
                    <div className="w-3 h-3 border border-gray-500 rounded-sm" />
                    {cardRatio}
                    <ChevronDown size={10} className={`text-gray-600 transition-transform ${isRatioOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isRatioOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-32 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                      <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase font-mono border-b border-white/5">卡片比例</div>
                      {CARD_RATIOS.map(({ label, ratio }) => (
                        <button
                          key={ratio}
                          onClick={() => { setCardRatio(ratio); setIsRatioOpen(false); }}
                          className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${cardRatio === ratio ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/10'}`}
                        >
                          {label}
                          {cardRatio === ratio && <span className="text-white/40 text-[10px]">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    const r = CARD_RATIOS.find(c => c.ratio === cardRatio) ?? CARD_RATIOS[0];
                    onImport(rows, r.ratio, r.w, r.h);
                  }}
                  disabled={rows.length === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  导入画布并生成节点
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BreakdownView.tsx
git commit -m "feat: add BreakdownView component with diff highlight and partial re-breakdown"
```

---

## Task 4: 更新 App.tsx 使用 BreakdownView

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 在 `src/App.tsx` 顶部 import 区域，添加 `BreakdownView` import，移除 `BreakdownModal` import（如果 BreakdownModal 不再在其他地方使用）**

找到这一行：
```ts
import BreakdownModal from './components/BreakdownModal';
```
替换为：
```ts
import BreakdownView from './components/BreakdownView';
```

- [ ] **Step 2: 找到 breakdown view div（约在 App.tsx 的 JSX 区域），将 `<BreakdownModal ... fullPage />` 替换为 `<BreakdownView>`**

找到：
```tsx
      {/* Breakdown view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'breakdown' ? 1 : 0,
          transform: activeView === 'breakdown' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'breakdown' ? 'auto' : 'none',
        }}
      >
        <BreakdownModal
          initialRows={storyboardRows}
          onClose={() => setActiveView('canvas')}
          onImport={handleImportFromBreakdown}
          fullPage
        />
      </div>
```

替换为：
```tsx
      {/* Breakdown view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'breakdown' ? 1 : 0,
          transform: activeView === 'breakdown' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'breakdown' ? 'auto' : 'none',
        }}
      >
        <BreakdownView
          initialRows={storyboardRows}
          onImport={handleImportFromBreakdown}
        />
      </div>
```

- [ ] **Step 3: 验证构建无报错**

```bash
npx vite build 2>&1 | tail -5
```

预期输出包含 `✓ built in`，无 ERROR。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace BreakdownModal with BreakdownView in breakdown tab"
```

---

## Task 5: 验证并推送

- [ ] **Step 1: 构建最终产物确认无报错**

```bash
npx vite build 2>&1 | tail -8
```

预期：`✓ built in X.XXs`

- [ ] **Step 2: 推送到 GitHub**

```bash
git push origin main
```

- [ ] **Step 3: 部署到服务器**

在服务器 Workbench 执行：
```bash
cd /home/HJM-aigc-flow && git pull origin main --rebase && npm install && npm run build && pm2 restart aigc-flow
```
