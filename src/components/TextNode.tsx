import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, useStore, type ReactFlowState } from '@xyflow/react';
import { Plus, Type, ArrowUp, ChevronDown, Copy, Download, Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { analyzeImageToPrompt, generateText } from '../lib/api';

const TEXT_MODELS = ['DeepSeek-V3', 'DeepSeek-R1'];

export default function TextNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('DeepSeek-V3');
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const connectionNodeId = useStore((s: ReactFlowState) =>
    s.connection && 'nodeId' in s.connection ? s.connection.nodeId : null
  );
  const selectedCount = useStore((s: ReactFlowState) => s.nodes.filter(n => n.selected).length);
  const isOngoingConnection = connectionNodeId !== null;
  const showHandle = isHovered || isOngoingConnection;
  const isTargetGlow = isOngoingConnection && isHovered && connectionNodeId !== id;
  const showPanel = selected && selectedCount === 1;

  const hasContent = !!data.content;
  const hasSourceImage = !!data.sourceImage;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateText(prompt.trim());
      data.onUpdate?.(id, { content: result });
      setPrompt('');
    } catch (e: any) {
      setError(e.message || '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!data.sourceImage || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeImageToPrompt(data.sourceImage);
      data.onUpdate?.(id, { content: result });
    } catch (e: any) {
      setError(e.message || '分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      className="relative"
      style={{ width: '100%', height: '100%', minWidth: 360, minHeight: 220 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsModelOpen(false); }}
    >
      {/* Label + actions */}
      <div className="absolute -top-8 left-0 right-0 flex items-center justify-between pointer-events-none">
        <div className="text-[13px] text-gray-400 font-medium flex items-center gap-2 pointer-events-auto">
          <Type size={13} className="text-gray-500" />
          {hasSourceImage ? '图生文' : (data.label || '文本')}
        </div>
        {hasContent && (isHovered || selected) && (
          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              onClick={() => data.content && navigator.clipboard.writeText(data.content)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-gray-400 hover:text-gray-200 border border-white/8 transition-all"
            >
              <Copy size={11} /> 复制
            </button>
            <button
              onClick={() => {
                if (!data.content) return;
                const blob = new Blob([data.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'text.txt'; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-gray-400 hover:text-gray-200 border border-white/8 transition-all"
            >
              <Download size={11} /> 下载
            </button>
          </div>
        )}
      </div>

      {/* 节点主体卡片：absolute inset-0 精确填充节点区域，消除双滚动条 */}
      <div
        className={`absolute inset-0 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col bg-[#1c1c1c] ${
          selected
            ? 'ring-2 ring-inset ring-gray-500 shadow-[0_0_25px_rgba(255,255,255,0.05)]'
            : 'ring-1 ring-inset ring-white/5 hover:ring-white/10'
        }`}
      >
        {/* 连接目标光效 */}
        <div className={`absolute -inset-[2px] rounded-[18px] pointer-events-none transition-opacity duration-300 z-50 target-glow target-glow-mask ${isTargetGlow ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg_at_50%_50%,#3b82f6_0%,transparent_60%,#3b82f6_100%)] animate-[spin_2s_linear_infinite]" />
        </div>

        {/* 内容区：非编辑可拖拽，双击进编辑 */}
        <div
          className={`flex-1 overflow-y-auto p-5 min-h-0 ${isEditing ? 'cursor-text nodrag' : 'cursor-grab active:cursor-grabbing'}`}
          onDoubleClick={() => setIsEditing(true)}
          onWheel={e => e.stopPropagation()}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={data.content || ''}
              onChange={e => data.onUpdate?.(id, { content: e.target.value })}
              onBlur={() => setIsEditing(false)}
              onMouseDown={e => e.stopPropagation()}
              className="w-full h-full bg-transparent border-none text-[15px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none leading-relaxed nodrag"
              style={{ minHeight: 120 }}
              placeholder="输入文字..."
            />
          ) : hasContent ? (
            <p className="text-[15px] text-gray-200 leading-relaxed whitespace-pre-wrap pointer-events-none select-none">{data.content}</p>
          ) : (
            <p className="text-[14px] text-gray-600 select-none pointer-events-none">双击编辑文字...</p>
          )}
        </div>
      </div>

      {/* 浮动控制面板（选中单个时出现，与图片/视频节点风格一致） */}
      {showPanel && (
        <div
          className="nodrag absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[480px] bg-[#2e2e32] rounded-3xl p-5 shadow-2xl border border-white/5 flex flex-col gap-4 z-50"
          onMouseDown={e => e.stopPropagation()}
        >
          {hasSourceImage ? (
            /* 图生文模式 */
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                  <img src={data.sourceImage} alt="参考图" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-[13px] text-gray-300 font-medium">图生文</p>
                  <p className="text-[12px] text-gray-500">分析图片，生成 AI 提示词</p>
                </div>
              </div>
              {error && <p className="text-[12px] text-red-400">{error}</p>}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-[13px] text-gray-300 hover:text-white transition-all disabled:opacity-50"
              >
                {isAnalyzing
                  ? <><Loader2 size={13} className="animate-spin" /> 分析中...</>
                  : hasContent
                    ? <><RotateCcw size={13} /> 重新生成</>
                    : <><Sparkles size={13} /> 生成提示词</>
                }
              </button>
            </div>
          ) : (
            /* 文本生成模式 */
            <>
              {/* 提示词输入 */}
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="描述任何你想要生成的内容"
                className="w-full bg-transparent border-none text-[16px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[70px] py-1 leading-relaxed"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
                }}
              />

              {error && <p className="text-[12px] text-red-400">{error}</p>}

              {/* 底部控制栏 */}
              <div className="flex items-center justify-between">
                {/* 模型选择 */}
                <div className="relative">
                  <button
                    onClick={() => setIsModelOpen(v => !v)}
                    className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-200 transition-colors font-medium"
                  >
                    {model}
                    <ChevronDown size={12} className={`transition-transform ${isModelOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isModelOpen && (
                    <div className="absolute bottom-full mb-2 left-0 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 min-w-[150px]">
                      {TEXT_MODELS.map(m => (
                        <button
                          key={m}
                          onClick={() => { setModel(m); setIsModelOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-[13px] hover:bg-white/8 transition-colors flex items-center justify-between ${m === model ? 'text-white' : 'text-gray-400'}`}
                        >
                          {m}
                          {m === model && <span className="text-blue-400 text-[10px]">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 发送 */}
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className="p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating
                    ? <Loader2 size={20} className="animate-spin" />
                    : <ArrowUp size={20} strokeWidth={3} />
                  }
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`!w-8 !h-8 !bg-gray-500 hover:!bg-gray-400 !text-white !rounded-full !flex !items-center !justify-center !shadow-lg transition-all duration-150 ease-out origin-center !border-none !-right-10 !top-1/2 !-translate-y-1/2 ${showHandle ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
        onClick={e => data.onPlusClick?.(e, id)}
      >
        <Plus size={15} strokeWidth={3} className="pointer-events-none" />
      </Handle>

      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={`!w-3 !h-3 !bg-gray-500 !border-2 !border-[#1a1d24] transition-opacity duration-150 ${showHandle ? 'opacity-100' : 'opacity-0'} !-left-1.5 !top-1/2 !-translate-y-1/2`}
      />
    </div>
  );
}
