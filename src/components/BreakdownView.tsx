import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sparkles, Plus, X, GripVertical, ArrowRight, Loader2, Upload, FileText, ChevronDown, Wand2,
} from 'lucide-react';
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
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
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
            <button
              onClick={() => setShowOptimizeModal(true)}
              disabled={!scriptText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-purple-300 rounded-lg text-xs transition-colors border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Wand2 size={12} />
              AI 优化
            </button>
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
            <div className="flex items-center justify-between px-4 pt-3 pb-[72px] border-t border-white/[0.06] flex-shrink-0">
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
      {showOptimizeModal && (
        <ScriptOptimizeModal
          scriptText={scriptText}
          onApply={(optimized) => {
            setScriptText(optimized);
            setShowOptimizeModal(false);
          }}
          onClose={() => setShowOptimizeModal(false)}
        />
      )}
    </div>
  );
}
