import React, { useState, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Sparkles, Plus, X, GripVertical, ArrowRight, Loader2, Upload, FileText, ChevronDown } from 'lucide-react';
import { breakdownScript, type StoryboardRow } from '../lib/api';

const CARD_RATIOS: { label: string; ratio: string; w: number; h: number }[] = [
  { label: '16:9', ratio: '16:9', w: 380, h: 214 },
  { label: '4:3',  ratio: '4:3',  w: 380, h: 285 },
  { label: '1:1',  ratio: '1:1',  w: 380, h: 380 },
  { label: '3:4',  ratio: '3:4',  w: 380, h: 507 },
  { label: '9:16', ratio: '9:16', w: 380, h: 676 },
  { label: '3:2',  ratio: '3:2',  w: 380, h: 253 },
  { label: '2:3',  ratio: '2:3',  w: 380, h: 570 },
  { label: '21:9', ratio: '21:9', w: 380, h: 163 },
];

interface Props {
  initialRows?: StoryboardRow[];
  onClose: () => void;
  onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
}

function SortableRow({
  row,
  onUpdate,
  onDelete,
}: {
  row: StoryboardRow;
  onUpdate: (id: string, field: keyof StoryboardRow, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-white/5 hover:bg-white/[0.02] group">
      <td className="py-2 px-3 text-gray-500 text-sm">
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
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
        <button onClick={() => onDelete(row.id)} className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
          <X size={12} />
        </button>
      </td>
    </tr>
  );
}

export default function BreakdownModal({ initialRows, onClose, onImport }: Props) {
  const hasInitialRows = (initialRows?.length ?? 0) > 0;
  const [phase, setPhase] = useState<'input' | 'table'>(hasInitialRows ? 'table' : 'input');
  const [scriptText, setScriptText] = useState('');
  const [rows, setRows] = useState<StoryboardRow[]>(initialRows ?? []);
  const [isBreaking, setIsBreaking] = useState(false);
  const [error, setError] = useState('');
  const [cardRatio, setCardRatio] = useState('16:9');
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setScriptText((ev.target?.result as string) || '');
    reader.readAsText(file);
  };

  const handleBreakdown = async () => {
    if (!scriptText.trim() || isBreaking) return;
    setIsBreaking(true);
    setError('');
    try {
      const result = await breakdownScript(scriptText);
      setRows(result);
      setPhase('table');
    } catch (err: any) {
      setError(err.message || '拆解失败，请重试');
    } finally {
      setIsBreaking(false);
    }
  };

  const handleUpdateRow = (id: string, field: keyof StoryboardRow, value: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleDeleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, index: i + 1 })));
  };

  const handleAddRow = () => {
    setRows(prev => [...prev, { id: `row-${Date.now()}`, index: prev.length + 1, shotType: '', description: '' }]);
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

  return (
    <>
      {/* Subtle backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Floating panel */}
      <div
        className="fixed z-50 flex flex-col bg-[#141414] border border-white/[0.08] rounded-2xl shadow-2xl"
        style={{
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(780px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 88px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText size={15} className="text-gray-400" />
            <span className="text-white font-medium text-[14px]">剧本拆解</span>
            <span className="text-gray-600 text-xs">粘贴剧本，AI 自动生成分镜表</span>
          </div>
          <div className="flex items-center gap-2">
            {phase === 'table' && (
              <button
                onClick={() => setPhase('input')}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 rounded-lg text-xs transition-colors border border-white/5"
              >
                返回修改
              </button>
            )}
            <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/5">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        {phase === 'input' ? (
          <div className="flex flex-col gap-3 p-5 flex-shrink-0">
            <textarea
              value={scriptText}
              onChange={e => setScriptText(e.target.value)}
              placeholder="在此粘贴剧本内容..."
              className="w-full h-52 bg-[#1e1e1e] border border-white/5 rounded-xl p-4 text-gray-200 text-sm leading-relaxed focus:outline-none focus:border-white/10 resize-none"
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <div className="flex items-center justify-between">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-xs transition-colors border border-white/5"
              >
                <Upload size={12} />
                上传文件
              </button>
              <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
              <button
                onClick={handleBreakdown}
                disabled={!scriptText.trim() || isBreaking}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isBreaking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isBreaking ? 'AI 拆解中...' : '✨ AI 拆解'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Table - scrollable */}
            <div className="flex flex-col overflow-hidden flex-1 min-h-0">
              {/* Fixed thead */}
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
              {/* Scrollable tbody */}
              <div className="overflow-y-auto flex-1" style={{ maxHeight: '320px' }}>
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
                          <SortableRow key={row.id} row={row} onUpdate={handleUpdateRow} onDelete={handleDeleteRow} />
                        ))}
                      </tbody>
                    </SortableContext>
                  </DndContext>
                </table>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] flex-shrink-0">
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-gray-300 rounded-lg text-xs transition-colors border border-white/5"
              >
                <Plus size={12} />
                添加分镜
              </button>

              <div className="flex items-center gap-2">
                {/* 卡片比例选择 */}
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
    </>
  );
}
