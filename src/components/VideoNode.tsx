import React, { useState, useRef } from 'react';
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
} from 'lucide-react';

const VIDEO_RATIO_SIZES: Record<string, { w: number; h: number }> = {
  '16:9': { w: 380, h: 214 },
  '4:3':  { w: 380, h: 285 },
  '1:1':  { w: 380, h: 380 },
  '3:4':  { w: 380, h: 507 },
  '9:16': { w: 380, h: 676 },
  '21:9': { w: 380, h: 163 },
};

export default function VideoNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [prompt, setPrompt] = useState<string>(data.initialPrompt || '');
  const [mode, setMode] = useState<'text' | 'image'>(data.referenceImage ? 'image' : 'text');
  const [duration, setDuration] = useState<number>(5);  // 4-12 或 -1(自动)
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p');
  const [ratio, setRatio] = useState<'16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'>(data.ratio || '16:9');
  const [audio, setAudio] = useState<'on' | 'off'>('on');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [generateCount, setGenerateCount] = useState(1);
  const [isCountOpen, setIsCountOpen] = useState(false);
  const [manualRefImage, setManualRefImage] = useState<string | null>(null);
  const [genError, setGenError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  const connectionNodeId = useStore((s: ReactFlowState) =>
    s.connection && 'nodeId' in s.connection ? s.connection.nodeId : null
  );
  const selectedCount = useStore((s: ReactFlowState) => s.nodes.filter((n) => n.selected).length);
  const isOngoingConnection = connectionNodeId !== null;
  const showHandle = isHovered || isOngoingConnection;
  const showPanel = selected && selectedCount === 1;

  const videoOrderUrls: string[] = Array.isArray(data.videoOrderUrls) ? data.videoOrderUrls : [];
  const onToggleVideo: ((nodeId: string, url: string, label: string) => void) | undefined = data.onToggleVideo;

  const contents = Array.isArray(data.content) ? data.content : (data.content ? [data.content] : []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentContent = contents[currentIndex] || null;
  const isInVideoOrder = currentContent ? videoOrderUrls.includes(currentContent) : false;

  // 图生视频模式下使用的参考图：连线参考图优先，其次手动上传
  const activeRefImage = mode === 'image' ? (data.referenceImage || manualRefImage) : undefined;

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        data.onUpdate?.(id, { content: [result] });
        setCurrentIndex(0);
        const video = document.createElement('video');
        video.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setManualRefImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt || isGenerating) return;
    setIsGenerating(true);
    setGenError('');
    try {
      const urls = await generateVideo(prompt, activeRefImage, duration, audio, resolution, ratio);
      data.onUpdate?.(id, { content: urls });
      setCurrentIndex(0);
      setPrompt('');
    } catch (err: any) {
      setGenError(err.message || '生成失败');
    } finally {
      setIsGenerating(false);
    }
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
      onMouseLeave={() => setIsHovered(false)}
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

      {/* 上传视频按钮 */}
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

      {/* 节点主体 */}
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

        {contents.length > 1 && (
          <div className="absolute top-2 right-2 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg flex items-center overflow-hidden">
            <select
              value={currentIndex}
              onChange={(e) => setCurrentIndex(Number(e.target.value))}
              className="appearance-none bg-transparent text-white text-xs font-medium pl-2 pr-5 py-1 outline-none cursor-pointer"
            >
              {contents.map((_, i) => (
                <option key={i} value={i} className="bg-[#1a1a1a]">{i + 1}</option>
              ))}
            </select>
            <ChevronDown size={10} className="text-gray-400 absolute right-1.5 pointer-events-none" />
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

      {/* 下方控制面板 */}
      {showPanel && (
        <div
          className="nodrag absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[520px] bg-[#2e2e32] rounded-3xl p-5 shadow-2xl border border-white/5 flex flex-col gap-4 z-50"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Tab 切换 */}
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

          {/* 图生视频：参考图区域 */}
          {mode === 'image' && (
            <div className="flex items-start gap-3">
              <button
                onClick={() => !activeRefImage && refImageInputRef.current?.click()}
                className={`w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center flex-shrink-0 overflow-hidden transition-colors ${
                  activeRefImage ? 'border-white/10' : 'border-white/20 hover:border-white/40'
                }`}
              >
                {activeRefImage ? (
                  <img src={activeRefImage} alt="参考图" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={20} className="text-gray-500" />
                )}
              </button>
              <input
                type="file"
                ref={refImageInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleRefImageUpload}
              />
              {activeRefImage && !data.referenceImage && (
                <button
                  onClick={() => setManualRefImage(null)}
                  className="text-[11px] text-gray-500 hover:text-red-400 transition-colors mt-1"
                >
                  移除
                </button>
              )}
            </div>
          )}

          {/* 提示词 */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
            }}
            placeholder="描述您的修改或生成需求..."
            className="w-full bg-transparent border-none text-[16px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[60px] py-1 leading-relaxed"
          />

          {genError && <p className="text-red-400 text-[12px]">{genError}</p>}

          {/* 展开的设置面板 */}
          {isSettingsOpen && (
            <div className="flex flex-col gap-4 bg-white/[0.03] rounded-2xl p-4">
              {/* 时长 */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">时长（秒）</span>
                <div className="flex flex-wrap gap-1.5">
                  {[4, 5, 6, 7, 8, 9, 10, 11, 12, -1].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                        duration === d ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {d === -1 ? '自动' : `${d}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 分辨率 */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">分辨率</span>
                <div className="flex gap-1.5">
                  {(['480p', '720p', '1080p'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setResolution(r)}
                      className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                        resolution === r ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* 宽高比 */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">宽高比</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setRatio(r);
                        const size = VIDEO_RATIO_SIZES[r] ?? { w: 380, h: 214 };
                        data.onUpdate?.(id, { ratio: r, _width: size.w, _height: size.h });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                        ratio === r ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* 音频 */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">音频</span>
                <div className="flex gap-1.5">
                  {(['on', 'off'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAudio(a)}
                      className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                        audio === a ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {a === 'on' ? '开启' : '关闭'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 底部控制栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 模型名 */}
              <span className="text-[13px] text-gray-300 font-medium">Seedance 1.5 Pro</span>
              <div className="w-[1px] h-3.5 bg-white/10" />
              {/* 参数摘要（点击展开设置） */}
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`flex items-center gap-1.5 text-[13px] transition-colors ${isSettingsOpen ? 'text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <span className="w-3.5 h-3.5 border border-current rounded-sm inline-block opacity-60" />
                <span>{ratio}</span>
                <span className="text-gray-600">·</span>
                <span>{resolution}</span>
                <span className="text-gray-600">·</span>
                <span>{duration === -1 ? '自动' : `${duration}s`}</span>
                <ChevronDown size={12} className={`text-gray-600 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* 下载 */}
              {currentContent && (
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = currentContent;
                    a.download = `video-${data.label || id}.mp4`;
                    a.click();
                  }}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="下载视频"
                >
                  <Download size={18} />
                </button>
              )}

              {/* 数量 */}
              <div className="relative">
                <button
                  onClick={() => setIsCountOpen(!isCountOpen)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-[13px] font-medium transition-colors border border-white/5"
                >
                  ×{generateCount}
                  <ChevronDown size={11} className="text-gray-600" />
                </button>
                {isCountOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
                    {[4, 3, 2, 1].map(num => (
                      <button
                        key={num}
                        onClick={() => { setGenerateCount(num); setIsCountOpen(false); }}
                        className={`px-4 py-2 text-center text-[13px] transition-colors ${generateCount === num ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                      >
                        ×{num}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 生成按钮 */}
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
