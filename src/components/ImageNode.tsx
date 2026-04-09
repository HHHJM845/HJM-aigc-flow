import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, useStore, type ReactFlowState } from '@xyflow/react';
import {
  Plus,
  Upload,
  Image as ImageIcon,
  ArrowUp,
  ChevronDown,
  Loader2,
  Download,
  Sparkles,
  X,
} from 'lucide-react';
import { generateImages } from '../lib/api';

const RATIO_SIZES: Record<string, { w: number; h: number }> = {
  '1:1':  { w: 380, h: 380 },
  '4:3':  { w: 380, h: 285 },
  '3:4':  { w: 380, h: 507 },
  '16:9': { w: 380, h: 214 },
  '9:16': { w: 380, h: 676 },
  '3:2':  { w: 380, h: 253 },
  '2:3':  { w: 380, h: 570 },
  '21:9': { w: 380, h: 163 },
};

const STYLE_PRESETS = ['写实', '动漫', '油画', '水彩', '赛博朋克', '中国水墨', '素描', '3D渲染', '皮克斯风格'] as const;

export default function ImageNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const isInStoryboard: boolean = Boolean(data.isInStoryboard);
  const onToggleStoryboard: ((id: string) => void) | undefined = data.onToggleStoryboard;
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState(data.ratio || '16:9');
  const [quality, setQuality] = useState('2K');
  const [generateCount, setGenerateCount] = useState(1);
  const [isCountOpen, setIsCountOpen] = useState(false);
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>(data.style ?? '');
  const [customStyle, setCustomStyle] = useState<string>('');
  const [optimizing, setOptimizing] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; promptPreset: string; styleTag: string | null }>>([]);
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
  const [mergedPrompt, setMergedPrompt] = useState('');
  const [userExtra, setUserExtra] = useState('');
  const [merging, setMerging] = useState(false);

  const handleOptimizePrompt = async () => {
    if (!data.shotDescription) return;
    const style = selectedStyle || customStyle;
    setOptimizing(true);
    try {
      const resp = await fetch('/api/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: data.shotDescription,
          style,
          label: data.label,
        }),
      });
      if (resp.ok) {
        const result = await resp.json() as { prompt: string };
        setPrompt(result.prompt);
      }
    } catch {
      // Silent fail
    } finally {
      setOptimizing(false);
    }
  };

  const mergePrompt = async (tplId: string, extra: string) => {
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    setMerging(true);
    try {
      const resp = await fetch('/api/templates/merge-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templatePrompt: tpl.promptPreset,
          userInput: extra,
          nodeType: 'image',
          shotDescription: data.shotDescription,
        }),
      });
      if (resp.ok) {
        const { mergedPrompt: mp } = await resp.json() as { mergedPrompt: string };
        setMergedPrompt(mp);
        setPrompt(mp);
      }
    } finally {
      setMerging(false);
    }
  };

  // 手动上传的参考图（多张）
  const [uploadedRefImages, setUploadedRefImages] = useState<string[]>([]);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  // 所有参考图：边连接的优先放第一位，再拼上手动上传的
  const allRefImages = [
    ...(data.referenceImage ? [data.referenceImage] : []),
    ...uploadedRefImages,
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectionNodeId = useStore((s: ReactFlowState) =>
    s.connection && 'nodeId' in s.connection ? s.connection.nodeId : null
  );
  const selectedCount = useStore((s: ReactFlowState) =>
    s.nodes.filter((n) => n.selected).length
  );
  const isOngoingConnection = connectionNodeId !== null;
  const showHandle = isHovered || isOngoingConnection;
  // 多选时不展开面板，只有单独选中才展开
  const showPanel = selected && selectedCount === 1;

  useEffect(() => {
    if (!showPanel) return;
    fetch('/api/templates?nodeType=image')
      .then(r => r.json())
      .then((list: Array<{ id: string; name: string; promptPreset: string; styleTag: string | null }>) => setTemplates(list))
      .catch(() => {});
  }, [showPanel]);

  const contents = Array.isArray(data.content) ? data.content : (data.content ? [data.content] : []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentContent = contents[currentIndex] || null;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        data.onUpdate?.(id, { content: [result] });
        setCurrentIndex(0);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? new FileList());
    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedRefImages(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeUploadedRef = (index: number) => {
    // index within uploadedRefImages (subtract edge-connected count)
    setUploadedRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!prompt || isGenerating) return;
    setIsGenerating(true);
    setGenError('');
    try {
      const images = await generateImages(prompt, generateCount, ratio, allRefImages.length > 0 ? allRefImages : undefined, quality);
      data.onUpdate?.(id, { content: images });
      setCurrentIndex(0);
      setPrompt('');
    } catch (err: any) {
      setGenError(err.message || '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const [isDragOver, setIsDragOver] = useState(false);

  const handleAssetDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/asset-src')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }
  };

  const handleAssetDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
  };

  const handleAssetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const assetSrc = e.dataTransfer.getData('application/asset-src');
    if (assetSrc) {
      data.onUpdate?.(id, { content: [assetSrc] });
      setCurrentIndex(0);
    }
  };

  const handleDownload = () => {
    if (!currentContent) return;
    const a = document.createElement('a');
    a.href = currentContent;
    a.download = `storyboard-${data.label || id}.png`;
    a.click();
  };

  const renderContent = () => {
    if (!currentContent) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
          <ImageIcon size={64} className="opacity-20" strokeWidth={1.5} />
        </div>
      );
    }
    return (
      <img
        src={currentContent}
        alt="Node content"
        className="object-cover w-full h-full pointer-events-none"
        referrerPolicy="no-referrer"
      />
    );
  };

  return (
    <div
      className={`relative w-full h-full min-w-[320px] min-h-[250px] flex flex-col bg-[#262626] rounded-2xl shadow-2xl transition-all duration-200 overflow-visible ${
        isInStoryboard
          ? 'ring-2 ring-inset ring-white/80'
          : selected
          ? 'ring-2 ring-inset ring-gray-500 shadow-[0_0_25px_rgba(255,255,255,0.05)]'
          : 'ring-1 ring-inset ring-white/5 hover:ring-white/10'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsRatioOpen(false);
      }}
    >
      {/* 分镜打勾按钮 */}
      {onToggleStoryboard && (isHovered || isInStoryboard) && (
        <button
          className="nodrag absolute top-2 right-2 z-30 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-150"
          style={
            isInStoryboard
              ? { background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }
              : { background: 'rgba(0,0,0,0.35)', border: '1.5px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(4px)' }
          }
          onClick={(e) => { e.stopPropagation(); onToggleStoryboard(id); }}
          title={isInStoryboard ? '从分镜中移除' : '加入分镜'}
        >
          {isInStoryboard && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      )}

      {/* 预选中环绕光效 */}
      <div className="absolute -inset-[2px] rounded-[18px] pointer-events-none target-glow opacity-0 transition-opacity duration-300 z-50 target-glow-mask">
        <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg_at_50%_50%,#3b82f6_0%,transparent_60%,#3b82f6_100%)] animate-[spin_2s_linear_infinite]" />
      </div>

      {/* 生成中流光边框 */}
      {isGenerating && (
        <>
          <div className="absolute -inset-[2px] rounded-[18px] pointer-events-none generating-glow-mask z-20">
            <div className="absolute inset-[-100%] animate-[gen-spin_2.5s_linear_infinite] bg-[conic-gradient(from_0deg_at_50%_50%,#a855f7_0%,#3b82f6_25%,#06b6d4_45%,transparent_60%,transparent_85%,#a855f7_100%)]" />
          </div>
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 animate-[gen-pulse_2s_ease-in-out_infinite] bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.18)_0%,transparent_65%)]" />
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 animate-[gen-pulse_2s_ease-in-out_infinite_1s] bg-[radial-gradient(ellipse_at_50%_100%,rgba(6,182,212,0.12)_0%,transparent_65%)]" />
        </>
      )}

      {/* 上传按钮 */}
      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 transition-opacity duration-200 z-10 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-1.5 bg-white/5 hover:bg-white/10 text-gray-200 rounded-full text-[12px] shadow-lg border border-white/5 transition-all"
        >
          <Upload size={14} />
          上传
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
      </div>

      {/* Label */}
      <div className="absolute -top-8 left-1 flex justify-between items-center shrink-0">
        <div className="text-[13px] text-gray-400 font-medium flex items-center gap-2">
          <ImageIcon size={14} className="text-gray-500" />
          {data.label || 'Image'}
        </div>
      </div>

      {/* 节点主体 */}
      <div className="flex-1 w-full bg-transparent relative group transition-all duration-300 rounded-2xl overflow-hidden min-h-0">
        <div className="absolute inset-0 flex items-center justify-center">
          {renderContent()}
        </div>

        {/* 生成进度条 */}
        {isGenerating && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden rounded-b-2xl">
            <div className="h-full bg-white/70 rounded-full animate-[shimmer_1.6s_ease-in-out_infinite]" style={{ width: '45%' }} />
          </div>
        )}

        {/* 右下角标签胶囊 */}
        {currentContent && (
          <button
            className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-black/55 backdrop-blur-md border border-white/10 rounded-full text-[12px] text-white font-medium shadow-lg hover:bg-black/75 transition-all nodrag"
            onClick={() => contents.length > 1 && setCurrentIndex((currentIndex + 1) % contents.length)}
          >
            <Sparkles size={12} className="text-white/70" />
            <span>{data.label || 'Image'}</span>
            {contents.length > 1 && (
              <>
                <span className="text-white/40 text-[10px]">{currentIndex + 1}/{contents.length}</span>
                <ChevronDown size={10} className="text-white/50" />
              </>
            )}
          </button>
        )}
      </div>

      {/* 连接点 */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`!w-8 !h-8 !bg-gray-500 hover:!bg-gray-400 !text-white !rounded-full !flex !items-center !justify-center !shadow-lg transition-all duration-150 ease-out origin-center !border-none !-right-10 !top-1/2 !-translate-y-1/2 ${
          showHandle ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
        onClick={(e) => data.onPlusClick?.(e, id)}
      >
        <Plus size={15} strokeWidth={3} className="pointer-events-none" />
      </Handle>

      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={`!w-3 !h-3 !bg-gray-500 !border-2 !border-[#1a1d24] transition-opacity duration-150 ${showHandle ? 'opacity-100' : 'opacity-0'} !-left-1.5 !top-1/2 !-translate-y-1/2`}
      />

      {/* 下方控制面板：多选时不展开 */}
      {showPanel && (
        <div
          className="nodrag absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[520px] bg-[#2e2e32] rounded-3xl p-5 shadow-2xl border border-white/5 flex flex-col gap-4 z-50"
          onMouseDown={(e) => e.stopPropagation()}
        >

          {/* 0. 模板选择条 */}
          {templates.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] text-gray-600 flex-shrink-0">模板</span>
              <button
                onClick={() => { setSelectedTplId(null); setMergedPrompt(''); }}
                className={`px-2.5 py-1 rounded-full text-[11px] flex-shrink-0 border transition-colors ${
                  !selectedTplId ? 'bg-white/8 text-gray-300 border-white/15' : 'text-gray-600 border-white/8 hover:text-gray-400'
                }`}
              >全部</button>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTplId(t.id); mergePrompt(t.id, userExtra); }}
                  className={`px-2.5 py-1 rounded-full text-[11px] flex-shrink-0 border transition-colors whitespace-nowrap ${
                    selectedTplId === t.id
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'text-gray-500 border-white/8 hover:text-gray-300'
                  }`}
                >
                  {selectedTplId === t.id && merging ? '✦ 融合中…' : `✦ ${t.name}`}
                </button>
              ))}
            </div>
          )}

          {/* 1. 提示词区域：有模板时显示融合框，无模板时显示普通输入 */}
          <div className="flex flex-col gap-1.5">
            {selectedTplId ? (
              <>
                <div className="bg-[#1a1a24] border border-indigo-500/25 rounded-xl px-3 py-2.5">
                  <div className="text-[10px] text-indigo-400 mb-1.5 flex items-center gap-1">✦ AI 融合提示词</div>
                  <textarea
                    value={mergedPrompt}
                    onChange={e => { setMergedPrompt(e.target.value); setPrompt(e.target.value); }}
                    className="w-full bg-transparent text-[13px] text-indigo-100 leading-relaxed resize-none outline-none min-h-[60px]"
                    placeholder="AI 融合中…"
                  />
                </div>
                <input
                  value={userExtra}
                  onChange={e => setUserExtra(e.target.value)}
                  onBlur={() => { if (selectedTplId) mergePrompt(selectedTplId, userExtra); }}
                  placeholder="+ 加入你的想法（可选）"
                  className="bg-white/[0.04] border border-white/[0.06] text-[12px] text-gray-400 placeholder-gray-700 rounded-lg px-3 py-2 outline-none focus:border-white/15"
                />
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">提示词</span>
                  <button
                    onClick={handleOptimizePrompt}
                    disabled={optimizing || !data.shotDescription}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-600/60 hover:bg-violet-600/80 disabled:opacity-40 text-[11px] text-white transition-colors"
                  >
                    {optimizing ? <Loader2 size={10} className="animate-spin" /> : <span>✨</span>}
                    {optimizing ? '优化中…' : 'AI优化'}
                  </button>
                </div>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                  placeholder="描述任何你想生成的内容"
                  className="flex-1 bg-transparent border-none text-[16px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[80px] py-1 leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* 2. 参考图区域（保持原有逻辑） */}
          <div className="flex items-center gap-2 flex-wrap">
            {allRefImages.map((img, i) => {
              const isEdgeConnected = data.referenceImage && i === 0;
              const uploadedIndex = data.referenceImage ? i - 1 : i;
              return (
                <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/10 group flex-shrink-0">
                  <img src={img} alt="参考图" className="w-full h-full object-cover" />
                  {isEdgeConnected && (
                    <div className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white/50 bg-black/40 py-0.5">链接</div>
                  )}
                  {!isEdgeConnected && (
                    <button
                      onClick={() => removeUploadedRef(uploadedIndex)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <X size={16} className="text-white" />
                    </button>
                  )}
                </div>
              );
            })}
            {allRefImages.length < 4 && (
              <button
                onClick={() => refImageInputRef.current?.click()}
                className="w-14 h-14 rounded-xl border-2 border-dashed border-white/15 hover:border-white/35 flex items-center justify-center text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
              >
                <Plus size={20} />
              </button>
            )}
            <input type="file" ref={refImageInputRef} className="hidden" accept="image/*" multiple onChange={handleRefImageUpload} />
          </div>

          {/* 3. 镜头描述（保持不变） */}
          {data.shotDescription && (
            <div className="bg-white/5 rounded-xl px-4 py-3">
              <p className="text-[11px] text-gray-500 mb-1 font-medium uppercase tracking-wide">镜头描述</p>
              <p className="text-[13px] text-gray-300 leading-relaxed select-text cursor-text" onMouseDown={e => e.stopPropagation()}>
                {data.shotDescription}
              </p>
            </div>
          )}

          {/* 4. 画风选择（保持不变） */}
          <div className="flex flex-wrap gap-1.5 items-center" onMouseDown={e => e.stopPropagation()}>
            {STYLE_PRESETS.map(style => (
              <button
                key={style}
                onClick={() => { const newStyle = selectedStyle === style ? '' : style; setSelectedStyle(newStyle); setCustomStyle(''); data.onUpdate?.(id, { style: newStyle }); }}
                className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                  selectedStyle === style ? 'bg-violet-600/80 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
                }`}
              >{style}</button>
            ))}
            <input
              value={customStyle}
              onChange={e => { setCustomStyle(e.target.value); setSelectedStyle(''); data.onUpdate?.(id, { style: e.target.value }); }}
              placeholder="自定义画风"
              className="flex-1 min-w-[80px] bg-white/5 border border-white/10 rounded-full px-3 py-0.5 text-[11px] text-white/70 placeholder-white/25 outline-none focus:border-white/30"
            />
          </div>

          {genError && <p className="text-red-400 text-[12px]">{genError}</p>}

          {/* 5. 底部控制栏（保持原有结构） */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 relative">
              <span className="text-[13px] text-gray-400 font-medium">SeeDream 4.5</span>
              <div className="w-[1px] h-3.5 bg-white/10" />
              <div className="relative">
                <button
                  onClick={() => setIsRatioOpen(!isRatioOpen)}
                  className="flex items-center gap-2 text-[13px] text-gray-300 hover:text-white transition-colors group px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <div className="w-3.5 h-3.5 border border-gray-500 rounded-sm group-hover:border-blue-400" />
                  <span>{ratio} · {quality}</span>
                  <ChevronDown size={12} className={`text-gray-600 transition-transform ${isRatioOpen ? 'rotate-180' : ''}`} />
                </button>
                {isRatioOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="px-4 py-2 text-[11px] text-gray-500 uppercase font-mono border-b border-white/5">比例</div>
                    {(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'] as const).map(r => (
                      <button key={r} onClick={() => { setRatio(r); const size = RATIO_SIZES[r] ?? { w: 380, h: 214 }; data.onUpdate?.(id, { ratio: r, _width: size.w, _height: size.h }); }}
                        className={`w-full px-4 py-2 text-left text-[13px] transition-colors flex items-center justify-between ${ratio === r ? 'text-white bg-white/10' : 'text-gray-300 hover:bg-white/10'}`}
                      >{r}{ratio === r && <span className="text-white/40 text-[10px]">✓</span>}</button>
                    ))}
                    <div className="px-4 py-2 text-[11px] text-gray-500 uppercase font-mono border-y border-white/5">画质</div>
                    {(['1K', '2K'] as const).map(q => (
                      <button key={q} onClick={() => setQuality(q)}
                        className={`w-full px-4 py-2 text-left text-[13px] transition-colors flex items-center justify-between ${quality === q ? 'text-white bg-white/10' : 'text-gray-300 hover:bg-white/10'}`}
                      >{q}{quality === q && <span className="text-white/40 text-[10px]">✓</span>}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentContent && (
                <button onClick={handleDownload} className="p-2 text-gray-400 hover:text-white transition-colors" title="下载图片">
                  <Download size={20} />
                </button>
              )}
              <div className="relative">
                <button onClick={() => setIsCountOpen(!isCountOpen)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-[13px] font-medium transition-colors border border-white/5"
                >{generateCount}x</button>
                {isCountOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
                    {[4, 3, 2, 1].map(num => (
                      <button key={num} onClick={() => { setGenerateCount(num); setIsCountOpen(false); }}
                        className={`px-4 py-2 text-center text-[13px] transition-colors ${generateCount === num ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                      >{num}x</button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt}
                className="p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} strokeWidth={3} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
