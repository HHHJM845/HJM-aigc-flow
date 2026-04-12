import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Palette,
  Users,
  FolderPlus,
  Check,
} from 'lucide-react';
import { generateImages } from '../lib/api';
import type { AssetItem } from '../lib/storage';

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

export default function ImageNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  // ── Panel expand state ─────────────────────────────
  const [expandedPanel, setExpandedPanel] = useState<'style' | 'asset' | null>(null);

  // ── Prompt & shot description ──────────────────────
  const [prompt, setPrompt] = useState('');
  const [shotDescription, setShotDescription] = useState<string>(data.shotDescription ?? '');

  // ── Style template ─────────────────────────────────
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; promptPreset: string; styleTag: string | null; genre: string }>>([]);
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null);

  // ── Asset panel ────────────────────────────────────
  const [assetCategory, setAssetCategory] = useState<'character' | 'scene' | 'other'>('character');
  const [savedToAsset, setSavedToAsset] = useState(false);

  const handleSaveToAsset = () => {
    if (!currentContent || !data.onAddAsset) return;
    const newAsset: AssetItem = {
      id: `asset_${Date.now()}`,
      type: 'image',
      src: currentContent,
      name: `生成图 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: Date.now(),
      category: assetCategory,
    };
    data.onAddAsset(newAsset);
    setSavedToAsset(true);
    setTimeout(() => setSavedToAsset(false), 2000);
  };

  // ── Generation controls ────────────────────────────
  const [ratio, setRatio] = useState(data.ratio || '16:9');
  const [quality, setQuality] = useState<'1K' | '2K'>('2K');
  const [generateCount, setGenerateCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [optimizing, setOptimizing] = useState(false);

  // ── Dropdowns open state ───────────────────────────
  const [isCountOpen, setIsCountOpen] = useState(false);
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [isQualityOpen, setIsQualityOpen] = useState(false);

  // ── Reference images ───────────────────────────────
  const [uploadedRefImages, setUploadedRefImages] = useState<string[]>([]);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const allRefImages = [
    ...(data.referenceImage ? [data.referenceImage] : []),
    ...uploadedRefImages,
  ];

  // ── File inputs ────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── React Flow store ───────────────────────────────
  const connectionNodeId = useStore((s: ReactFlowState) =>
    s.connection && 'nodeId' in s.connection ? s.connection.nodeId : null
  );
  const selectedCount = useStore((s: ReactFlowState) =>
    s.nodes.filter((n) => n.selected).length
  );
  const isOngoingConnection = connectionNodeId !== null;
  const [isHovered, setIsHovered] = useState(false);
  const showHandle = isHovered || isOngoingConnection;
  const showPanel = selected && selectedCount === 1;

  // ── Multi-image display ────────────────────────────
  const contents = Array.isArray(data.content) ? data.content : (data.content ? [data.content] : []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentContent = contents[currentIndex] || null;

  // ── Assets (injected via data) ─────────────────────
  const assets: AssetItem[] = data.assets ?? [];

  // ── Sync external data changes ────────────────────
  useEffect(() => {
    setShotDescription(data.shotDescription ?? '');
  }, [data.shotDescription]);

  useEffect(() => {
    if (data.ratio) setRatio(data.ratio);
  }, [data.ratio]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [data.content]);

  // ── Template loading：每次展开风格面板时重新拉取，确保新增模板即时可见 ──
  useEffect(() => {
    if (!showPanel || expandedPanel !== 'style') return;
    fetch('/api/templates?nodeType=image')
      .then(r => r.json())
      .then((list: Array<{ id: string; name: string; promptPreset: string; styleTag: string | null; genre: string }>) =>
        setTemplates(list))
      .catch(() => {});
  }, [showPanel, expandedPanel]);



  // ── Toggle expand panel ────────────────────────────
  const togglePanel = useCallback((panel: 'style' | 'asset') => {
    setExpandedPanel(prev => prev === panel ? null : panel);
  }, []);

  // ── Shot description save on blur ──────────────────
  const handleShotDescBlur = () => {
    data.onUpdate?.(id, { shotDescription });
  };

  // ── AI optimize ────────────────────────────────────
  const selectedTpl = templates.find(t => t.id === selectedTplId) ?? null;
  const canOptimize = !!shotDescription.trim() || !!selectedTpl;

  const handleOptimizePrompt = async () => {
    if (!canOptimize || optimizing) return;
    setOptimizing(true);
    try {
      const resp = await fetch('/api/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: shotDescription,
          style: selectedTpl?.promptPreset ?? '',
          label: data.label,
        }),
      });
      if (resp.ok) {
        const result = await resp.json() as { prompt: string };
        setPrompt(result.prompt);
      }
    } catch { /* silent */ }
    finally { setOptimizing(false); }
  };

  // ── Template select ────────────────────────────────
  const handleSelectTemplate = (tplId: string) => {
    if (selectedTplId === tplId) {
      setSelectedTplId(null);
      return;
    }
    setSelectedTplId(tplId);
  };

  // ── File upload ────────────────────────────────────
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      data.onUpdate?.(id, { content: [ev.target?.result as string] });
      setCurrentIndex(0);
    };
    reader.readAsDataURL(file);
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedRefImages(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeUploadedRef = (index: number) => {
    setUploadedRefImages(prev => prev.filter((_, i) => i !== index));
  };

  // ── Asset click → add as reference ────────────────
  const handleAssetClick = (src: string) => {
    if (uploadedRefImages.includes(src)) {
      setUploadedRefImages(prev => prev.filter(s => s !== src));
    } else if (allRefImages.length < 4) {
      setUploadedRefImages(prev => [...prev, src]);
    }
  };

  // ── Asset category filter ──────────────────────────
  const categoryMap: Record<'character' | 'scene' | 'other', string> = {
    character: '角色', scene: '场景', other: '道具',
  };
  const filteredAssets = assets.filter(a => {
    if (assetCategory === 'character') return a.category === 'character';
    if (assetCategory === 'scene') return a.category === 'scene';
    return a.category === 'other' || !a.category;
  });

  // ── Generate ───────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt || isGenerating) return;
    setIsGenerating(true);
    setGenError('');
    try {
      const images = await generateImages(
        prompt,
        generateCount,
        ratio,
        allRefImages.length > 0 ? allRefImages : undefined,
        quality,
      );
      data.onUpdate?.(id, { content: images });
      setCurrentIndex(0);
      setPrompt('');
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Download ───────────────────────────────────────
  const handleDownload = () => {
    if (!currentContent) return;
    const a = document.createElement('a');
    a.href = currentContent;
    a.download = `image-${data.label || id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Drag & drop asset into node ────────────────────
  const [isDragOver, setIsDragOver] = useState(false);

  const handleAssetDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/asset-src')) {
      e.preventDefault(); e.stopPropagation(); setIsDragOver(true);
    }
  };
  const handleAssetDragLeave = () => setIsDragOver(false);
  const handleAssetDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const src = e.dataTransfer.getData('application/asset-src');
    if (src) { data.onUpdate?.(id, { content: [src] }); setCurrentIndex(0); }
  };

  return (
    <div
      className={`relative w-full h-full min-w-[320px] min-h-[250px] flex flex-col bg-[#262626] rounded-2xl shadow-2xl transition-all duration-200 overflow-visible ${
        (data.isInStoryboard as boolean | undefined)
          ? 'ring-2 ring-inset ring-white/80'
          : selected
          ? 'ring-2 ring-inset ring-gray-500 shadow-[0_0_25px_rgba(255,255,255,0.05)]'
          : 'ring-1 ring-inset ring-white/5 hover:ring-white/10'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsRatioOpen(false); setIsQualityOpen(false); setIsCountOpen(false); }}
      onDragOver={handleAssetDragOver}
      onDragLeave={handleAssetDragLeave}
      onDrop={handleAssetDrop}
    >
      {/* 分镜打勾按钮 */}
      {data.onToggleStoryboard && (isHovered || data.isInStoryboard) && (
        <button
          className="nodrag absolute top-2 right-2 z-30 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-150"
          style={
            data.isInStoryboard
              ? { background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }
              : { background: 'rgba(0,0,0,0.35)', border: '1.5px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(4px)' }
          }
          onClick={(e) => { e.stopPropagation(); (data.onToggleStoryboard as (id: string) => void)(id); }}
          title={data.isInStoryboard ? '从分镜中移除' : '加入分镜'}
        >
          {data.isInStoryboard && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      )}

      {/* 预选中光效 */}
      <div className="absolute -inset-[2px] rounded-[18px] pointer-events-none target-glow opacity-0 transition-opacity duration-300 z-50 target-glow-mask">
        <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg_at_50%_50%,#3b82f6_0%,transparent_60%,#3b82f6_100%)] animate-[spin_2s_linear_infinite]" />
      </div>

      {/* 生成流光边框 */}
      {isGenerating && (
        <>
          <div className="absolute -inset-[2px] rounded-[18px] pointer-events-none generating-glow-mask z-20">
            <div className="absolute inset-[-100%] animate-[gen-spin_2.5s_linear_infinite] bg-[conic-gradient(from_0deg_at_50%_50%,#a855f7_0%,#3b82f6_25%,#06b6d4_45%,transparent_60%,transparent_85%,#a855f7_100%)]" />
          </div>
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 animate-[gen-pulse_2s_ease-in-out_infinite] bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.18)_0%,transparent_65%)]" />
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 animate-[gen-pulse_2s_ease-in-out_infinite_1s] bg-[radial-gradient(ellipse_at_50%_100%,rgba(6,182,212,0.12)_0%,transparent_65%)]" />
        </>
      )}

      {/* Label */}
      <div className="absolute -top-8 left-1 flex items-center gap-2 shrink-0">
        <div className="text-[13px] text-gray-400 font-medium flex items-center gap-2">
          <ImageIcon size={14} className="text-gray-500" />
          {data.label || 'Image'}
        </div>
      </div>

      {/* 节点主体图片区 */}
      <div
        className={`flex-1 w-full bg-transparent relative group transition-all duration-300 rounded-2xl overflow-hidden min-h-0 ${isDragOver ? 'ring-2 ring-inset ring-violet-400' : ''}`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {currentContent ? (
            <img
              src={currentContent}
              alt="Node content"
              className="object-cover w-full h-full pointer-events-none"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
              <ImageIcon size={64} className="opacity-20" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* 生成进度条 */}
        {isGenerating && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden rounded-b-2xl">
            <div className="h-full bg-white/70 rounded-full animate-[shimmer_1.6s_ease-in-out_infinite]" style={{ width: '45%' }} />
          </div>
        )}

        {/* 多图切换胶囊 */}
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
        onClick={(e) => (data.onPlusClick as ((e: React.MouseEvent, id: string) => void) | undefined)?.(e, id)}
      >
        <Plus size={15} strokeWidth={3} className="pointer-events-none" />
      </Handle>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={`!w-3 !h-3 !bg-gray-500 !border-2 !border-[#1a1d24] transition-opacity duration-150 ${showHandle ? 'opacity-100' : 'opacity-0'} !-left-1.5 !top-1/2 !-translate-y-1/2`}
      />

      {/* ── 下方控制面板 ── */}
      {showPanel && (
        <div
          className="nodrag absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[460px] bg-[#1c1c1e] rounded-3xl shadow-2xl border border-white/[0.07] flex flex-col overflow-hidden z-50"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* ── 输入区 ── */}
          <div className="px-4 pt-4 pb-3 flex flex-col gap-2.5">

            {/* 上传按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-white/20 hover:border-white/35 rounded-full text-[12px] text-gray-500 hover:text-gray-300 transition-all"
              >
                <Upload size={13} />
                上传图片
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
            </div>

            {/* 参考图（独立区域） */}
            {allRefImages.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">参考图</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {allRefImages.map((img, i) => {
                    const isEdgeConnected = data.referenceImage && i === 0;
                    const uploadedIndex = data.referenceImage ? i - 1 : i;
                    return (
                      <div key={i} className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10 group flex-shrink-0">
                        <img src={img} alt="参考图" className="w-full h-full object-cover" />
                        {isEdgeConnected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <span className="text-[8px] text-white/70">链</span>
                          </div>
                        )}
                        {!isEdgeConnected && (
                          <button
                            onClick={() => removeUploadedRef(uploadedIndex)}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <X size={10} className="text-white" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {allRefImages.length < 4 && (
                    <button
                      onClick={() => refImageInputRef.current?.click()}
                      className="w-10 h-10 rounded-lg border border-dashed border-white/15 hover:border-white/30 flex items-center justify-center text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 提示词（全宽） */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              placeholder="描述你想要的画面…（Enter 生成，Shift+Enter 换行）"
              className="w-full bg-transparent text-[14px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[72px] leading-relaxed"
            />

            {/* 镜头描述（可编辑） */}
            <div className="flex items-start gap-2">
              <div className="w-[3px] self-stretch bg-white/10 rounded-full flex-shrink-0 mt-1" />
              <div className="flex-1 flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">镜头描述</span>
                <textarea
                  value={shotDescription}
                  onChange={e => setShotDescription(e.target.value)}
                  onBlur={handleShotDescBlur}
                  placeholder="添加镜头描述…"
                  className="w-full bg-transparent text-[13px] text-gray-400 placeholder-gray-700 focus:outline-none resize-none min-h-[36px] leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* ── 底部工具栏（两行） ── */}
          <div className="flex flex-col border-t border-white/[0.06]">

            {/* 第一行：模型 / 比例 / 清晰度 / 风格 / 资产 */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.04]">

              {/* 模型 */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-full text-[12px] text-gray-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                SeeDream
              </div>

              {/* 比例 */}
              <div className="relative">
                <button
                  onClick={() => { setIsRatioOpen(v => !v); setIsQualityOpen(false); setIsCountOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                  {ratio}
                  <ChevronDown size={10} className="text-gray-600" />
                </button>
                {isRatioOpen && (
                  <div className="absolute top-full left-0 mt-2 w-32 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {(['1:1','4:3','3:4','16:9','9:16','3:2','2:3','21:9'] as const).map(r => (
                      <button key={r} onClick={() => { setRatio(r); const s = RATIO_SIZES[r] ?? {w:380,h:214}; data.onUpdate?.(id,{ratio:r,_width:s.w,_height:s.h}); setIsRatioOpen(false); }}
                        className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex justify-between items-center ${ratio===r?'text-white bg-white/10':'text-gray-400 hover:bg-white/[0.08]'}`}
                      >{r}{ratio===r&&<span className="text-white/40 text-[10px]">✓</span>}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* 清晰度 */}
              <div className="relative">
                <button
                  onClick={() => { setIsQualityOpen(v => !v); setIsRatioOpen(false); setIsCountOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
                >
                  {quality}
                  <ChevronDown size={10} className="text-gray-600" />
                </button>
                {isQualityOpen && (
                  <div className="absolute top-full left-0 mt-2 w-20 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {(['1K','2K'] as const).map(q => (
                      <button key={q} onClick={() => { setQuality(q); setIsQualityOpen(false); }}
                        className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex justify-between items-center ${quality===q?'text-white bg-white/10':'text-gray-400 hover:bg-white/[0.08]'}`}
                      >{q}{quality===q&&<span className="text-white/40 text-[10px]">✓</span>}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1" />

              {/* 风格图标 */}
              <button
                onClick={() => togglePanel('style')}
                title="风格模板"
                className={`w-[32px] h-[32px] rounded-full flex items-center justify-center border transition-all ${
                  expandedPanel === 'style'
                    ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                    : 'bg-white/[0.05] border-white/[0.08] text-gray-500 hover:text-gray-300 hover:bg-white/[0.09]'
                }`}
              >
                <Palette size={14} />
              </button>

              {/* 资产图标 */}
              <button
                onClick={() => togglePanel('asset')}
                title="资产"
                className={`w-[32px] h-[32px] rounded-full flex items-center justify-center border transition-all ${
                  expandedPanel === 'asset'
                    ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                    : 'bg-white/[0.05] border-white/[0.08] text-gray-500 hover:text-gray-300 hover:bg-white/[0.09]'
                }`}
              >
                <Users size={14} />
              </button>
            </div>

            {/* 第二行：AI优化 / 数量 / 下载 / 生成 */}
            <div className="flex items-center gap-2 px-3 py-2.5">

              {/* AI优化 */}
              <button
                onClick={handleOptimizePrompt}
                disabled={!canOptimize || optimizing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600/50 hover:bg-violet-600/70 disabled:opacity-30 text-[12px] text-violet-200 border border-violet-500/30 transition-all"
              >
                {optimizing ? <Loader2 size={11} className="animate-spin" /> : <span>✨</span>}
                {optimizing ? '优化中…' : 'AI 优化提示词'}
              </button>

              <div className="flex-1" />

              {/* 数量 */}
              <div className="relative">
                <button
                  onClick={() => { setIsCountOpen(v => !v); setIsRatioOpen(false); setIsQualityOpen(false); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
                >
                  {generateCount}x
                  <ChevronDown size={10} className="text-gray-600" />
                </button>
                {isCountOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {[4,3,2,1].map(n => (
                      <button key={n} onClick={() => { setGenerateCount(n); setIsCountOpen(false); }}
                        className={`w-full px-4 py-2 text-center text-[12px] transition-colors ${generateCount===n?'text-white bg-white/10':'text-gray-400 hover:bg-white/5'}`}
                      >{n}x</button>
                    ))}
                  </div>
                )}
              </div>

              {/* 下载 */}
              {currentContent && (
                <button onClick={handleDownload} title="下载图片" className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-gray-500 hover:text-gray-200 transition-colors">
                  <Download size={16} />
                </button>
              )}

              {/* 生成按钮 */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-medium shadow-lg shadow-violet-900/40 transition-all active:scale-95"
              >
                {isGenerating
                  ? <Loader2 size={14} className="animate-spin" />
                  : <ArrowUp size={14} strokeWidth={2.5} />
                }
                {isGenerating ? '生成中…' : '生成'}
              </button>

            </div>
          </div>

          {/* ── 展开面板区（风格 / 资产，在工具栏下方展开） ── */}
          {expandedPanel !== null && (
            <div className="border-t border-white/[0.06] bg-[#1a1a1c] px-4 py-3 flex flex-col gap-3">

              {/* 风格模板面板：pill 列表 */}
              {expandedPanel === 'style' && (
                <div className="flex flex-wrap gap-1.5">
                  {templates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`px-3 py-1 rounded-full text-[12px] border transition-all ${
                        selectedTplId === tpl.id
                          ? 'bg-violet-500/20 border-violet-400 text-violet-200 font-semibold'
                          : 'text-gray-400 border-white/10 hover:text-gray-200 hover:border-white/25 hover:bg-white/[0.05]'
                      }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <span className="text-[12px] text-gray-600">暂无模板</span>
                  )}
                  {/* + 自定义 → 跳转模板库 */}
                  <button
                    onClick={() => (data.onNavigateToTemplates as (() => void) | undefined)?.()}
                    className="px-3 py-1 rounded-full text-[12px] border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors"
                  >
                    + 自定义
                  </button>
                </div>
              )}

              {/* 资产面板 */}
              {expandedPanel === 'asset' && (
                <>
                  {/* 分类 Tab + 存入资产库按钮 */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {(['character', 'scene', 'other'] as const).map(cat => (
                        <button
                          key={cat}
                          onClick={() => setAssetCategory(cat)}
                          className={`px-4 py-1.5 rounded-full text-[12px] transition-colors ${
                            assetCategory === cat
                              ? 'bg-white/10 text-gray-200 font-semibold'
                              : 'text-gray-600 hover:text-gray-400'
                          }`}
                        >
                          {categoryMap[cat]}
                        </button>
                      ))}
                    </div>
                    {/* 存入资产库 */}
                    <button
                      onClick={handleSaveToAsset}
                      disabled={!currentContent || savedToAsset}
                      title="将当前图片存入资产库"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all border ${
                        savedToAsset
                          ? 'border-violet-500/50 text-violet-400 bg-violet-500/10'
                          : currentContent
                          ? 'border-white/15 text-gray-400 hover:border-violet-500/50 hover:text-violet-400 hover:bg-violet-500/10'
                          : 'border-white/[0.06] text-gray-700 cursor-not-allowed'
                      }`}
                    >
                      {savedToAsset ? <Check size={12} /> : <FolderPlus size={12} />}
                      {savedToAsset ? '已存入' : '存入资产库'}
                    </button>
                  </div>

                  {/* 资产网格 */}
                  <div className="grid grid-cols-4 gap-2">
                    {filteredAssets.map(asset => {
                      const isSelected = uploadedRefImages.includes(asset.src);
                      return (
                        <button
                          key={asset.id}
                          onClick={() => handleAssetClick(asset.src)}
                          className={`rounded-xl aspect-square bg-white/[0.05] border overflow-hidden flex flex-col items-center justify-center gap-1 transition-all ${
                            isSelected
                              ? 'border-violet-400 ring-1 ring-violet-400'
                              : 'border-white/[0.07] hover:border-white/20'
                          }`}
                        >
                          {asset.src ? (
                            <img src={asset.src} alt={asset.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={20} className="text-gray-600" />
                          )}
                        </button>
                      );
                    })}
                    {/* + 创建 */}
                    <button className="rounded-xl aspect-square border-[1.5px] border-dashed border-white/10 flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-gray-400 hover:border-white/20 transition-all">
                      <Plus size={20} />
                      <span className="text-[10px]">创建</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 生成错误 */}
          {genError && <p className="px-4 pb-3 text-red-400 text-[12px]">{genError}</p>}

          {/* 隐藏 input */}
          <input type="file" ref={refImageInputRef} className="hidden" accept="image/*" multiple onChange={handleRefImageUpload} />
        </div>
      )}
    </div>
  );
}
