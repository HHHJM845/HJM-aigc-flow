// src/components/BreakdownView.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Loader2, Sparkles, Plus, X, GripVertical, Wand2 } from 'lucide-react';
import { breakdownScript, type StoryboardRow } from '../lib/api';
import { splitParagraphs, diffParagraphs, mergeRows } from '../lib/diff';
import ScriptOptimizeModal from './ScriptOptimizeModal';

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

const LENS_OPTIONS = [
  'Anamorphic 35mm f/1.4',
  'Standard Prime 50mm',
  'Telephoto 85mm f/1.8',
  'Wide Angle 24mm f/2.8',
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
      className={`border-b border-[#484848]/10 hover:bg-[#131313] transition-colors group cursor-pointer font-label ${
        isNew ? 'active-row' : ''
      }`}
    >
      {/* ID */}
      <td className="py-4 px-6 text-[#acabaa] font-light text-sm">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="text-[#484848] hover:text-[#acabaa] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical size={13} />
          </button>
          <span>{String(row.index).padStart(2, '0')}</span>
        </div>
      </td>
      {/* 景别 */}
      <td className="py-4 px-2">
        <input
          value={row.shotType}
          onChange={e => onUpdate(row.id, 'shotType', e.target.value)}
          className="px-2 py-0.5 rounded-sm bg-[#252626] text-[10px] text-[#e7e5e4] focus:outline-none w-16"
          placeholder="景别"
        />
      </td>
      {/* 描述 */}
      <td className="py-4 px-6">
        <textarea
          value={row.description}
          onChange={e => onUpdate(row.id, 'description', e.target.value)}
          className="w-full bg-transparent text-[#e7e5e4] text-sm focus:outline-none resize-none leading-relaxed"
          rows={2}
        />
      </td>
      {/* 删除 */}
      <td className="py-4 px-4 text-right">
        <button
          onClick={() => onDelete(row.id)}
          className="text-[#484848] hover:text-[#ee7d77] transition-colors opacity-0 group-hover:opacity-100"
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
  externalInitText?: string;
}

// ── Main Component ────────────────────────────────────
export default function BreakdownView({ initialRows, onImport, externalInitText }: Props) {
  const [scriptText, setScriptText] = useState('');
  const [committedScript, setCommittedScript] = useState('');
  const [rows, setRows] = useState<StoryboardRow[]>(initialRows ?? []);
  const [isBreaking, setIsBreaking] = useState(false);
  const [error, setError] = useState('');
  const [changedSegments, setChangedSegments] = useState<string[]>([]);
  const [newlyUpdatedIds, setNewlyUpdatedIds] = useState<Set<string>>(new Set());
  const [cardRatio, setCardRatio] = useState('16:9');
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  // 右侧面板状态（视觉占位，后续接入 API 时通过 onImport 或新 prop 传递）
  // TODO: pass selectedLens and promptText to onImport when backend supports them
  const [selectedLens, setSelectedLens] = useState(LENS_OPTIONS[0]);
  const [promptText, setPromptText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (externalInitText) setScriptText(externalInitText);
  }, [externalInitText]);

  useEffect(() => {
    if (!committedScript || rows.length === 0) { setChangedSegments([]); return; }
    const { changed } = diffParagraphs(splitParagraphs(committedScript), splitParagraphs(scriptText));
    setChangedSegments(changed);
  }, [scriptText, committedScript, rows.length]);

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

  const handleFirstBreakdown = async () => {
    if (!scriptText.trim() || isBreaking) return;
    setIsBreaking(true); setError('');
    try {
      const result = await breakdownScript(scriptText);
      setRows(result); setCommittedScript(scriptText); setChangedSegments([]);
    } catch (err: any) {
      setError(err.message || '拆解失败，请重试');
    } finally { setIsBreaking(false); }
  };

  const handlePartialBreakdown = useCallback(async () => {
    if (changedSegments.length === 0 || isBreaking) return;
    setIsBreaking(true); setError('');
    try {
      const newRows = await breakdownScript(changedSegments.join('\n\n'));
      const merged = mergeRows(rows, newRows, changedSegments);
      setRows(merged);
      setNewlyUpdatedIds(new Set(newRows.map(r => r.id)));
      setCommittedScript(scriptText); setChangedSegments([]);
    } catch (err: any) {
      setError(err.message || '拆解失败，请重试');
    } finally { setIsBreaking(false); }
  }, [changedSegments, isBreaking, scriptText, rows]);

  const handleUpdateRow = (id: string, field: keyof StoryboardRow, value: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const handleDeleteRow = (id: string) =>
    setRows(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, index: i + 1 })));

  const handleAddRow = () =>
    setRows(prev => [...prev, { id: `row-${Date.now()}`, index: prev.length + 1, shotType: '', description: '', sourceSegment: '' }]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows(prev => {
      const oldIndex = prev.findIndex(r => r.id === active.id);
      const newIndex = prev.findIndex(r => r.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((r, i) => ({ ...r, index: i + 1 }));
    });
  };

  const handleImport = () => {
    const r = CARD_RATIOS.find(c => c.ratio === cardRatio) ?? CARD_RATIOS[0];
    onImport(rows, r.ratio, r.w, r.h);
  };

  const hasDiff = changedSegments.length > 0 && scriptText !== committedScript;
  const isFirstBreakdown = rows.length === 0;

  return (
    <div className="w-full h-full flex bg-[#0e0e0e] overflow-hidden font-body">

      {/* ══ 左栏：脚本正文 30% ══ */}
      <section className="w-[30%] h-full bg-[#131313] flex flex-col border-r border-[#484848]/15">
        <div className="p-6 flex flex-col h-full">
          {/* 头部 */}
          <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <h2 className="font-headline font-extrabold text-[#fbf9f8] tracking-tight text-base">脚本正文</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-[#252626] px-4 py-2 rounded-full text-xs font-semibold text-[#e7e5e4] hover:bg-[#2c2c2c] transition-all active:scale-95 font-label"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload_file</span>
                导入剧本
              </button>
              <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>

          {/* 操作按钮行 */}
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            {isFirstBreakdown && (
              <button
                onClick={handleFirstBreakdown}
                disabled={!scriptText.trim() || isBreaking}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#c6c6c7] text-[#1a1a1a] rounded-full text-xs font-semibold hover:bg-[#e2e2e2] transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-button font-label"
              >
                {isBreaking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isBreaking ? 'AI 拆解中...' : '✨ AI 拆解'}
              </button>
            )}
            <button
              onClick={() => setShowOptimizeModal(true)}
              disabled={!scriptText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252626] hover:bg-[#2c2c2c] text-[#acabaa] hover:text-[#fbf9f8] rounded-full text-xs transition-colors border border-[#484848]/30 disabled:opacity-40 font-label"
            >
              <Wand2 size={12} />
              AI 优化
            </button>
          </div>

          {/* Diff 提示 */}
          {hasDiff && !isFirstBreakdown && (
            <div className="flex items-center justify-between px-4 py-2 mb-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 flex-shrink-0">
              <span className="text-yellow-300/80 text-xs font-label">
                检测到 {changedSegments.length} 处变动
              </span>
              <button
                onClick={handlePartialBreakdown}
                disabled={isBreaking}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 text-black rounded-full text-xs font-semibold hover:bg-yellow-300 transition-all disabled:opacity-40 font-label"
              >
                {isBreaking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isBreaking ? '拆解中...' : '重新拆解变动部分'}
              </button>
            </div>
          )}

          {error && (
            <p className="text-[#ee7d77] text-xs mb-4 flex-shrink-0 font-label">{error}</p>
          )}

          {/* 脚本内容区 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            <textarea
              value={scriptText}
              onChange={e => setScriptText(e.target.value)}
              placeholder="在此粘贴剧本内容..."
              className="w-full h-full min-h-full bg-transparent text-[#e7e5e4] text-sm leading-loose focus:outline-none resize-none font-light"
            />
          </div>
        </div>
      </section>

      {/* ══ 中栏：分镜列表 45% ══ */}
      <section className="w-[45%] h-full bg-[#0e0e0e] flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#484848]/10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-headline font-bold text-[#fbf9f8] text-base">分镜列表</h2>
            {rows.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#252626] text-[#acabaa] font-label uppercase tracking-wide">
                {rows.length} SHOTS
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRow}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#acabaa] hover:text-[#fbf9f8] hover:bg-[#252626] transition-all"
              title="添加分镜"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#acabaa] text-sm font-label">完成 AI 拆解后，分镜将显示在这里</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* 固定表头 */}
            <table className="w-full table-fixed flex-shrink-0">
              <colgroup>
                <col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} />
                <col />
                <col style={{ width: '48px' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#484848]/10 text-[10px] text-[#acabaa] uppercase tracking-widest font-label">
                  <th className="py-4 px-6 font-medium text-left">ID</th>
                  <th className="py-4 px-2 font-medium text-left">景别</th>
                  <th className="py-4 px-6 font-medium text-left">分镜内容描述</th>
                  <th className="py-4 px-4 font-medium text-right">操作</th>
                </tr>
              </thead>
            </table>

            {/* 可滚动列表 */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: '80px' }} />
                    <col style={{ width: '80px' }} />
                    <col />
                    <col style={{ width: '48px' }} />
                  </colgroup>
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
                </table>
              </div>
            </DndContext>
          </div>
        )}
      </section>

      {/* ══ 右栏：属性调整 25% ══ */}
      <section className="w-[25%] h-full bg-[#191a1a] flex flex-col border-l border-[#484848]/15">
        <div className="p-6 flex flex-col h-full overflow-y-auto custom-scrollbar pb-32">
          <h2 className="font-headline font-bold text-[#fbf9f8] mb-8 text-base">属性调整</h2>

          {/* 画面比例 */}
          <div className="mb-8">
            <label className="text-[10px] text-[#acabaa] uppercase tracking-widest block mb-3 font-label">画面比例</label>
            <div className="grid grid-cols-2 gap-3">
              {['16:9', '9:16'].map(ratio => (
                <button
                  key={ratio}
                  onClick={() => setCardRatio(ratio)}
                  className={`rounded-xl p-4 flex flex-col items-center justify-center transition-all border ${
                    cardRatio === ratio
                      ? 'bg-[#252626] border-[#c6c6c7]/20'
                      : 'bg-[#0e0e0e] border-[#484848]/30 hover:bg-[#252626]'
                  }`}
                >
                  <div
                    className={`border rounded-sm mb-2 ${cardRatio === ratio ? 'border-[#c6c6c7]/40' : 'border-[#484848]/40'}`}
                    style={ratio === '16:9' ? { width: '28px', height: '16px' } : { width: '12px', height: '20px' }}
                  />
                  <span className={`text-xs font-semibold font-label ${cardRatio === ratio ? 'text-[#e7e5e4]' : 'text-[#acabaa]'}`}>
                    {ratio}
                  </span>
                </button>
              ))}
            </div>
            {/* 其他比例（下拉补充） */}
            <select
              value={cardRatio}
              onChange={e => setCardRatio(e.target.value)}
              className="mt-3 w-full bg-[#0e0e0e] border border-[#484848]/30 rounded-xl px-4 py-2.5 text-sm text-[#e7e5e4] focus:ring-1 focus:ring-[#c6c6c7]/40 outline-none font-label appearance-none"
            >
              {CARD_RATIOS.map(({ label, ratio }) => (
                <option key={ratio} value={ratio}>{label}</option>
              ))}
            </select>
          </div>

          {/* 镜头模组 */}
          <div className="mb-8">
            <label className="text-[10px] text-[#acabaa] uppercase tracking-widest block mb-3 font-label">镜头模组</label>
            <select
              value={selectedLens}
              onChange={e => setSelectedLens(e.target.value)}
              className="w-full bg-[#0e0e0e] border border-[#484848]/30 rounded-xl px-4 py-3 text-sm text-[#e7e5e4] focus:ring-1 focus:ring-[#c6c6c7]/40 outline-none font-label appearance-none"
            >
              {LENS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* 视觉提示词 */}
          <div className="mb-8">
            <label className="text-[10px] text-[#acabaa] uppercase tracking-widest block mb-3 font-label">视觉提示词</label>
            <textarea
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              placeholder="描述场景的视觉细节..."
              className="w-full bg-[#0e0e0e] border border-[#484848]/30 rounded-xl px-4 py-3 text-sm text-[#e7e5e4] focus:ring-1 focus:ring-[#c6c6c7]/40 outline-none h-32 resize-none leading-relaxed font-label placeholder-[#484848]"
            />
          </div>

          {/* 核心模型 */}
          <div className="mb-8">
            <label className="text-[10px] text-[#acabaa] uppercase tracking-widest block mb-3 font-label">核心模型</label>
            <div className="flex items-center justify-between p-3 bg-[#252626] rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#c6c6c7]" style={{ fontSize: '18px' }}>auto_awesome</span>
                <span className="text-xs font-medium text-[#e7e5e4] font-label">Visionary-V2 (Pro)</span>
              </div>
              <span className="material-symbols-outlined text-[#c6c6c7]" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
          </div>

          {/* 导入画布按钮 */}
          <div className="mt-auto pt-6">
            <button
              onClick={handleImport}
              disabled={rows.length === 0}
              className="w-full py-4 rounded-xl bg-[#c6c6c7] text-[#1a1a1a] font-bold tracking-tight glow-button flex items-center justify-center gap-2 hover:bg-[#e2e2e2] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed font-label"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_fix_high</span>
              导入画布并生成节点
              {rows.length > 0 && (
                <div className="w-2 h-2 rounded-full bg-[#1a1a1a] animate-pulse ml-1" />
              )}
            </button>
          </div>
        </div>
      </section>

      {showOptimizeModal && (
        <ScriptOptimizeModal
          scriptText={scriptText}
          onApply={(optimized) => { setScriptText(optimized); setShowOptimizeModal(false); }}
          onClose={() => setShowOptimizeModal(false)}
        />
      )}
    </div>
  );
}
