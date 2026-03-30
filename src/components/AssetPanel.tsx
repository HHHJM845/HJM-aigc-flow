import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon, Film } from 'lucide-react';
import type { AssetItem } from '../lib/storage';

interface Props {
  assets: AssetItem[];
  onUpload: (items: AssetItem[]) => void;
  onRemove: (id: string) => void;
}

export default function AssetPanel({ assets, onUpload, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? new FileList()) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const src = ev.target?.result as string;
        const type: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
        onUpload([{
          id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type,
          src,
          name: file.name,
          createdAt: Date.now(),
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleDragStart = (e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.setData('application/asset-type', asset.type);
    e.dataTransfer.setData('application/asset-src', asset.src);
    e.dataTransfer.setData('application/asset-name', asset.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="absolute left-16 top-1/2 -translate-y-1/2 z-40 w-[280px] max-h-[70vh] bg-[#141414] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
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

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-xs text-center gap-2">
            <ImageIcon size={28} className="opacity-30" />
            <p>上传素材或从画布生成图片<br />后将在这里显示</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={e => handleDragStart(e, asset)}
                className="relative group rounded-xl overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing aspect-video bg-black/30"
              >
                {asset.type === 'image' ? (
                  <img src={asset.src} alt={asset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
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
  );
}
