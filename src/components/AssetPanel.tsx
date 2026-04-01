import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Film } from 'lucide-react';
import type { AssetItem } from '../lib/storage';

type ActiveCategory = 'all' | 'character' | 'scene' | 'other';

interface PendingFile {
  src: string;
  name: string;
  type: 'image' | 'video';
}

interface Props {
  assets: AssetItem[];
  onUpload: (items: AssetItem[]) => void;
  onRemove: (id: string) => void;
}

const CATEGORIES: { key: ActiveCategory; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'character', label: '人物' },
  { key: 'scene', label: '场景' },
  { key: 'other', label: '其他' },
];

export default function AssetPanel({ assets, onUpload, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('all');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? new FileList()) as File[];
    const pending: PendingFile[] = [];
    let processed = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const src = ev.target?.result as string;
        const type: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
        pending.push({ src, name: file.name, type });
        processed++;
        if (processed === files.length) {
          setPendingFiles(prev => [...prev, ...pending]);
        }
      };
      reader.onerror = () => {
        processed++;
        if (processed === files.length) {
          setPendingFiles(prev => [...prev, ...pending]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSelectCategory = (category: 'character' | 'scene' | 'other') => {
    const file = pendingFiles[0];
    if (!file) return;
    onUpload([{
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: file.type,
      src: file.src,
      name: file.name,
      createdAt: Date.now(),
      category,
    }]);
    setPendingFiles(prev => prev.slice(1));
  };

  const handleDragStart = (e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.setData('application/asset-type', asset.type);
    e.dataTransfer.setData('application/asset-src', asset.src);
    e.dataTransfer.setData('application/asset-name', asset.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const counts: Record<ActiveCategory, number> = {
    all: assets.length,
    character: assets.filter(a => a.category === 'character').length,
    scene: assets.filter(a => a.category === 'scene').length,
    other: assets.filter(a => a.category === 'other').length,
  };

  const filteredAssets = activeCategory === 'all'
    ? assets
    : assets.filter(a => a.category === activeCategory);

  const currentPending = pendingFiles[0];

  return (
    <div className="absolute left-16 top-1/2 -translate-y-1/2 z-40 w-[500px] max-h-[85vh] bg-[#141414] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-white text-sm font-medium">资产库</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg text-xs transition-colors"
        >
          <Upload size={11} />
          上传
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
        />
      </div>

      {/* Body: sidebar + grid */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar */}
        <div className="flex flex-col gap-1.5 p-2 border-r border-white/[0.05] flex-shrink-0 w-[68px]">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs transition-colors ${
                activeCategory === key
                  ? 'bg-[#333] text-white border border-white/20'
                  : 'bg-transparent text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              <span>{label}</span>
              <span className={`text-[10px] mt-0.5 ${activeCategory === key ? 'text-gray-300' : 'text-gray-600'}`}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-xs text-center gap-2">
              <ImageIcon size={28} className="opacity-30" />
              <p>{activeCategory === 'all' ? '上传素材或从画布生成图片\n后将在这里显示' : '该分类暂无素材'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filteredAssets.map(asset => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={e => handleDragStart(e, asset)}
                  className="relative group rounded-xl overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing bg-black/30"
                >
                  {asset.type === 'image' ? (
                    <img
                      src={asset.src}
                      alt={asset.name}
                      className="w-full h-auto object-contain rounded-xl"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center bg-gray-800">
                      <Film size={24} className="text-gray-500" />
                    </div>
                  )}
                  {/* Type badge */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white/70 font-medium uppercase">
                    {asset.type === 'image' ? 'IMAGE' : 'VIDEO'}
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => onRemove(asset.id)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/70"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category selection overlay — shown when pendingFiles has items */}
      {currentPending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl">
          <div className="bg-[#1c1c1c] border border-white/10 rounded-xl p-4 shadow-2xl min-w-[180px]">
            <p className="text-gray-400 text-xs mb-1 text-center">选择分类</p>
            <p className="text-gray-500 text-[10px] mb-3 text-center truncate max-w-[160px]">{currentPending.name}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleSelectCategory('character')}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors"
              >
                <span>👤</span> 人物
              </button>
              <button
                onClick={() => handleSelectCategory('scene')}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors"
              >
                <span>🏞</span> 场景
              </button>
              <button
                onClick={() => handleSelectCategory('other')}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors"
              >
                <span>📦</span> 其他
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
