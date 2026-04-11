import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateVideo } from '../lib/api';
import { Handle, Position, useStore, type ReactFlowState } from '@xyflow/react';
import {
  Plus,
  Upload,
  Video,
  ArrowUp,
  ChevronDown,
  Play,
  Loader2,
  Download,
  Image as ImageIcon,
  Palette,
  X,
} from 'lucide-react';

const VIDEO_RATIO_SIZES: Record<string, { w: number; h: number }> = {
  '16:9': { w: 380, h: 214 },
  '4:3':  { w: 380, h: 285 },
  '1:1':  { w: 380, h: 380 },
  '3:4':  { w: 380, h: 507 },
  '9:16': { w: 380, h: 676 },
  '21:9': { w: 380, h: 163 },
};

export default function VideoNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  // ── Hover & panel visibility ───────────────────────
  const [isHovered, setIsHovered] = useState(false);

  // ── Mode tab ───────────────────────────────────────
  const [mode, setMode] = useState<'text' | 'image'>(data.referenceImage ? 'image' : 'text');

  // ── Prompt（最终发给生成 API 的内容，可直接输入或由 AI 优化填入） ──
  const [prompt, setPrompt] = useState<string>(data.initialPrompt || '');

  // ── 画面描述（用户原始输入，AI 优化的来源） ─────────
  const [shotDescription, setShotDescription] = useState<string>(data.shotDescription ?? '');

  // ── Settings ───────────────────────────────────────
  const [ratio, setRatio] = useState<string>(data.ratio || '16:9');
  const [duration, setDuration] = useState<number>(5);
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p');
  const [audio, setAudio] = useState<'on' | 'off'>('on');

  // ── Dropdowns open state ───────────────────────────
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [isDurationOpen, setIsDurationOpen] = useState(false);
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [isCountOpen, setIsCountOpen] = useState(false);

  // ── Generation controls ────────────────────────────
  const [generateCount, setGenerateCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [optimizing, setOptimizing] = useState(false);

  // ── Panel expand state ─────────────────────────────
  const [expandedPanel, setExpandedPanel] = useState<'style' | null>(null);

  // ── Style templates ────────────────────────────────
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    promptPreset: string;
    cameraParams: string | null;
    durationHint: number | null;
  }>>([]);
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null);

  // ── Reference image (image-to-video mode) ─────────
  const [manualRefImage, setManualRefImage] = useState<string | null>(null);
  const activeRefImage = mode === 'image' ? (data.referenceImage || manualRefImage) : undefined;

  // ── File inputs ────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  // ── React Flow store ───────────────────────────────
  const connectionNodeId = useStore((s: ReactFlowState) =>
    s.connection && 'nodeId' in s.connection ? s.connection.nodeId : null
  );
  const selectedCount = useStore((s: ReactFlowState) => s.nodes.filter((n) => n.selected).length);
  const isOngoingConnection = connectionNodeId !== null;
  const showHandle = isHovered || isOngoingConnection;
  const showPanel = selected && selectedCount === 1;

  // ── Multi-video display ────────────────────────────
  const videoOrderUrls: string[] = Array.isArray(data.videoOrderUrls) ? data.videoOrderUrls : [];
  const onToggleVideo: ((nodeId: string, url: string, label: string) => void) | undefined = data.onToggleVideo;
  const contents = Array.isArray(data.content) ? data.content : (data.content ? [data.content] : []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentContent = contents[currentIndex] || null;
  const isInVideoOrder = currentContent ? videoOrderUrls.includes(currentContent) : false;

  // ── Sync external data ─────────────────────────────
  useEffect(() => {
    if (data.ratio) setRatio(data.ratio);
  }, [data.ratio]);

  useEffect(() => {
    setShotDescription(data.shotDescription ?? '');
  }, [data.shotDescription]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [data.content]);

  // ── Template loading: fetch on every style panel open ──
  useEffect(() => {
    if (!showPanel || expandedPanel !== 'style') return;
    fetch('/api/templates?nodeType=video')
      .then(r => r.json())
      .then((list: Array<{ id: string; name: string; promptPreset: string; cameraParams: string | null; durationHint: number | null }>) =>
        setTemplates(list))
      .catch(() => {});
  }, [showPanel, expandedPanel]);

  // ── Toggle style panel ─────────────────────────────
  const togglePanel = useCallback(() => {
    setExpandedPanel(prev => prev === 'style' ? null : 'style');
  }, []);

  // ── Template select ────────────────────────────────
  const handleSelectTemplate = (tplId: string) => {
    setSelectedTplId(prev => prev === tplId ? null : tplId);
  };

  const selectedTpl = templates.find(t => t.id === selectedTplId) ?? null;
  // 必须有用户填写的画面描述才能触发 AI 优化
  const canOptimize = !!shotDescription.trim();

  // ── 画面描述 blur 保存 ─────────────────────────────
  const handleShotDescBlur = () => {
    data.onUpdate?.(id, { shotDescription });
  };

  // ── AI optimize：画面描述 + 选中风格模板 → 融合写入 prompt ──
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
          nodeType: 'video',
        }),
      });
      if (resp.ok) {
        const result = await resp.json() as { prompt: string };
        setPrompt(result.prompt);
      }
    } catch { /* silent */ }
    finally { setOptimizing(false); }
  };

  // ── File handlers ──────────────────────────────────
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      data.onUpdate?.(id, { content: [event.target?.result as string] });
      setCurrentIndex(0);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setManualRefImage(event.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Generate ───────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt || isGenerating) return;
    setIsGenerating(true);
    setGenError('');
    try {
      const urls = await generateVideo(
        prompt,
        activeRefImage,
        duration === -1 ? 5 : duration,
        audio,
        resolution,
        ratio as '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'
      );
      data.onUpdate?.(id, { content: urls });
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
    a.download = `video-${data.label || id}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Close all dropdowns helper ─────────────────────
  const closeAllDropdowns = () => {
    setIsRatioOpen(false);
    setIsDurationOpen(false);
    setIsResolutionOpen(false);
    setIsAudioOpen(false);
    setIsCountOpen(false);
  };

  return (
    <div
      className={`relative w-full h-full min-w-[360px] min-h-[250px] flex flex-col bg-[#262626] rounded-2xl shadow-2xl transition-all duration-200 overflow-visible ${
        isInVideoOrder
          ? 'ring-2 ring-inset ring-white/80'
          : selected
            ? 'ring-2 ring-inset ring-gray-500 shadow-[0_0_25px_rgba(255,255,255,0.05)]'
            : 'ring-1 ring-inset ring-white/5 hover:ring-white/10'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); closeAllDropdowns(); }}
    >
      {/* 视频收录打勾按钮 */}
      {onToggleVideo && (isHovered || isInVideoOrder) && currentContent && (
        <button
          className="nodrag absolute top-2 right-2 z-30 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-150"
          style={
            isInVideoOrder
              ? { background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }
              : { background: 'rgba(0,0,0,0.35)', border: '1.5px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(4px)' }
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggleVideo(id, currentContent, data.label || id);
          }}
          title={isInVideoOrder ? '从视频管理中移除' : '加入视频管理'}
        >
          {isInVideoOrder && (
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
            <div className="absolute inset-[-100%] animate-[gen-spin_2.5s_linear_infinite] bg-[conic-gradient(from_0deg_at_50%_50%,#f97316_0%,#ec4899_25%,#a855f7_45%,transparent_60%,transparent_85%,#f97316_100%)]" />
          </div>
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 animate-[gen-pulse_2s_ease-in-out_infinite] bg-[radial-gradient(ellipse_at_50%_0%,rgba(249,115,22,0.15)_0%,transparent_65%)]" />
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 animate-[gen-pulse_2s_ease-in-out_infinite_1s] bg-[radial-gradient(ellipse_at_50%_100%,rgba(168,85,247,0.12)_0%,transparent_65%)]" />
        </>
      )}

      {/* 上传视频按钮（悬浮时显示在节点上方） */}
      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 transition-opacity duration-200 z-10 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-1.5 bg-white/5 hover:bg-white/10 text-gray-200 rounded-full text-[12px] shadow-lg border border-white/5 transition-all"
        >
          <Upload size={14} />
          上传
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />
      </div>

      {/* Label */}
      <div className="absolute -top-8 left-1 flex justify-between items-center shrink-0">
        <div className="text-[13px] text-gray-400 font-medium flex items-center gap-2">
          <Video size={14} className="text-gray-500" />
          {data.label || 'Video'}
        </div>
      </div>

      {/* 节点主体视频区 */}
      <div className="flex-1 w-full bg-transparent relative group transition-all duration-300 rounded-2xl overflow-hidden min-h-0">
        {currentContent ? (
          <video
            src={currentContent}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay muted loop
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 pointer-events-none">
            <div className="w-16 h-12 rounded-xl border-[3px] border-gray-500/20 flex items-center justify-center">
              <Play size={24} className="opacity-20 ml-1" fill="currentColor" />
            </div>
          </div>
        )}

        {/* 多视频切换 */}
        {contents.length > 1 && (
          <div className="absolute top-2 right-2 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg flex items-center overflow-hidden">
            <select
              value={currentIndex}
              onChange={(e) => setCurrentIndex(Number(e.target.value))}
              className="appearance-none bg-transparent text-white text-xs font-medium pl-2 pr-5 py-1 outline-none cursor-pointer"
            >
              {contents.map((_: string, i: number) => (
                <option key={i} value={i} className="bg-[#1a1a1a]">{i + 1}</option>
              ))}
            </select>
            <ChevronDown size={10} className="text-gray-400 absolute right-1.5 pointer-events-none" />
          </div>
        )}

        {/* 生成进度条 */}
        {isGenerating && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden rounded-b-2xl">
            <div className="h-full bg-white/70 rounded-full animate-[shimmer_1.6s_ease-in-out_infinite]" style={{ width: '45%' }} />
          </div>
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

            {/* Tab 切换：文生视频 / 图生视频 */}
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 self-start">
              {(['text', 'image'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    mode === m ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {m === 'text' ? '文生视频' : '图生视频'}
                </button>
              ))}
            </div>

            {/* 参考图（独立区域，仅图生视频模式显示） */}
            {mode === 'image' && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">参考图</span>
                <div className="flex items-center gap-2">
                  {activeRefImage ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 group flex-shrink-0">
                      <img src={activeRefImage} alt="参考图" className="w-full h-full object-cover" />
                      {data.referenceImage && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-center text-[8px] text-white/70 py-0.5">链接</div>
                      )}
                      {!data.referenceImage && (
                        <button
                          onClick={() => setManualRefImage(null)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <X size={14} className="text-white" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => refImageInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 flex items-center justify-center flex-shrink-0 transition-colors"
                    >
                      <ImageIcon size={20} className="text-gray-500" />
                    </button>
                  )}
                  <input
                    type="file"
                    ref={refImageInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleRefImageUpload}
                  />
                  <span className="text-[11px] text-gray-600">
                    {activeRefImage ? '参考图已就绪，可连线图片节点替换' : '上传或连线图片节点作为参考'}
                  </span>
                </div>
              </div>
            )}

            {/* 最终提示词（AI 优化后写入，或直接输入，Enter 生成） */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              placeholder="最终提示词…（Enter 生成，Shift+Enter 换行）"
              className="w-full bg-transparent text-[14px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[56px] leading-relaxed"
            />

            {/* 画面描述（原始输入，AI 优化的来源） */}
            <div className="flex items-start gap-2">
              <div className="w-[3px] self-stretch bg-white/10 rounded-full flex-shrink-0 mt-1" />
              <div className="flex-1 flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">画面描述</span>
                <textarea
                  value={shotDescription}
                  onChange={e => setShotDescription(e.target.value)}
                  onBlur={handleShotDescBlur}
                  placeholder="输入画面描述，选择风格模板后点 AI 优化自动生成提示词…"
                  className="w-full bg-transparent text-[13px] text-gray-400 placeholder-gray-700 focus:outline-none resize-none min-h-[36px] leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* ── 底部工具栏（两行） ── */}
          <div className="flex flex-col border-t border-white/[0.06]">

            {/* 第一行：Seedance / 比例 / 时长 / 分辨率 / 音频 / 风格图标 */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.04] flex-wrap">

              {/* 模型（静态标签） */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-full text-[12px] text-gray-400">
                <Video size={12} />
                Seedance
              </div>

              {/* 比例 */}
              <div className="relative">
                <button
                  onClick={() => { setIsRatioOpen(v => !v); setIsDurationOpen(false); setIsResolutionOpen(false); setIsAudioOpen(false); setIsCountOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
                >
                  {ratio}
                  <ChevronDown size={10} className="text-gray-600" />
                </button>
                {isRatioOpen && (
                  <div className="absolute top-full left-0 mt-2 w-24 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {(['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => {
                          setRatio(r);
                          const s = VIDEO_RATIO_SIZES[r] ?? { w: 380, h: 214 };
                          data.onUpdate?.(id, { ratio: r, _width: s.w, _height: s.h });
                          setIsRatioOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex justify-between items-center ${ratio === r ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/[0.08]'}`}
                      >
                        {r}
                        {ratio === r && <span className="text-white/40 text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 时长 */}
              <div className="relative">
                <button
                  onClick={() => { setIsDurationOpen(v => !v); setIsRatioOpen(false); setIsResolutionOpen(false); setIsAudioOpen(false); setIsCountOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
                >
                  {duration === -1 ? '自动' : `${duration}s`}
                  <ChevronDown size={10} className="text-gray-600" />
                </button>
                {isDurationOpen && (
                  <div className="absolute top-full left-0 mt-2 w-20 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {[4, 5, 6, 7, 8, 9, 10, 11, 12, -1].map(d => (
                      <button
                        key={d}
                        onClick={() => { setDuration(d); setIsDurationOpen(false); }}
                        className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex justify-between items-center ${duration === d ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/[0.08]'}`}
                      >
                        {d === -1 ? '自动' : `${d}s`}
                        {duration === d && <span className="text-white/40 text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 分辨率 */}
              <div className="relative">
                <button
                  onClick={() => { setIsResolutionOpen(v => !v); setIsRatioOpen(false); setIsDurationOpen(false); setIsAudioOpen(false); setIsCountOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
                >
                  {resolution}
                  <ChevronDown size={10} className="text-gray-600" />
                </button>
                {isResolutionOpen && (
                  <div className="absolute top-full left-0 mt-2 w-24 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {(['480p', '720p', '1080p'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => { setResolution(r); setIsResolutionOpen(false); }}
                        className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex justify-between items-center ${resolution === r ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/[0.08]'}`}
                      >
                        {r}
                        {resolution === r && <span className="text-white/40 text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 音频 */}
              <div className="relative">
                <button
                  onClick={() => { setIsAudioOpen(v => !v); setIsRatioOpen(false); setIsDurationOpen(false); setIsResolutionOpen(false); setIsCountOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
                >
                  {audio === 'on' ? '音频开' : '音频关'}
                  <ChevronDown size={10} className="text-gray-600" />
                </button>
                {isAudioOpen && (
                  <div className="absolute top-full left-0 mt-2 w-24 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {(['on', 'off'] as const).map(a => (
                      <button
                        key={a}
                        onClick={() => { setAudio(a); setIsAudioOpen(false); }}
                        className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex justify-between items-center ${audio === a ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/[0.08]'}`}
                      >
                        {a === 'on' ? '开启' : '关闭'}
                        {audio === a && <span className="text-white/40 text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1" />

              {/* 风格图标 */}
              <button
                onClick={togglePanel}
                title="风格模板"
                className={`w-[32px] h-[32px] rounded-full flex items-center justify-center border transition-all ${
                  expandedPanel === 'style'
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                    : 'bg-white/[0.05] border-white/[0.08] text-gray-500 hover:text-gray-300 hover:bg-white/[0.09]'
                }`}
              >
                <Palette size={14} />
              </button>
            </div>

            {/* 第二行：AI优化 / 数量 / 下载 / 生成 */}
            <div className="flex items-center gap-2 px-3 py-2.5">

              {/* AI优化 */}
              <button
                onClick={handleOptimizePrompt}
                disabled={!canOptimize || optimizing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-600/50 hover:bg-orange-600/70 disabled:opacity-30 text-[12px] text-orange-200 border border-orange-500/30 transition-all"
              >
                {optimizing ? <Loader2 size={11} className="animate-spin" /> : <span>✨</span>}
                {optimizing ? '优化中…' : 'AI 优化提示词'}
              </button>

              <div className="flex-1" />

              {/* 数量 */}
              <div className="relative">
                <button
                  onClick={() => { setIsCountOpen(v => !v); setIsRatioOpen(false); setIsDurationOpen(false); setIsResolutionOpen(false); setIsAudioOpen(false); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
                >
                  {generateCount}x
                  <ChevronDown size={10} className="text-gray-600" />
                </button>
                {isCountOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {[4, 3, 2, 1].map(n => (
                      <button
                        key={n}
                        onClick={() => { setGenerateCount(n); setIsCountOpen(false); }}
                        className={`w-full px-4 py-2 text-center text-[12px] transition-colors ${generateCount === n ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5'}`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 下载 */}
              {currentContent && (
                <button
                  onClick={handleDownload}
                  title="下载视频"
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-gray-500 hover:text-gray-200 transition-colors"
                >
                  <Download size={16} />
                </button>
              )}

              {/* 生成按钮 */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-[13px] font-medium shadow-lg shadow-orange-900/40 transition-all active:scale-95"
              >
                {isGenerating
                  ? <Loader2 size={14} className="animate-spin" />
                  : <ArrowUp size={14} strokeWidth={2.5} />
                }
                {isGenerating ? '生成中…' : '生成'}
              </button>
            </div>
          </div>

          {/* ── 展开面板区（风格，在工具栏下方展开） ── */}
          {expandedPanel !== null && (
            <div className="border-t border-white/[0.06] bg-[#1a1a1c] px-4 py-3 flex flex-col gap-3">
              {expandedPanel === 'style' && (
                <div className="flex flex-wrap gap-1.5">
                  {templates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`px-3 py-1 rounded-full text-[12px] border transition-all ${
                        selectedTplId === tpl.id
                          ? 'bg-orange-500/20 border-orange-400 text-orange-200 font-semibold'
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
                    className="px-3 py-1 rounded-full text-[12px] border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors"
                  >
                    + 自定义
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 生成错误 */}
          {genError && <p className="px-4 pb-3 text-red-400 text-[12px]">{genError}</p>}
        </div>
      )}
    </div>
  );
}
