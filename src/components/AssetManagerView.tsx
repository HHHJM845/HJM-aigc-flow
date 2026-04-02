// src/components/AssetManagerView.tsx
import React, { useRef, useState } from 'react';
import { Upload, Sparkles, X, Image as ImageIcon } from 'lucide-react';
import type { AssetItem } from '../lib/storage';
import AssetGenerateDialog from './AssetGenerateDialog';

type ActiveCategory = 'all' | 'character' | 'scene' | 'other';

interface Props {
  assets: AssetItem[];
  onAddAsset: (asset: AssetItem) => void;
  onDeleteAsset: (id: string) => void;
  onRenameAsset: (id: string, name: string) => void;
}

interface PendingFile {
  src: string;
  name: string;
}

const CATEGORIES: { key: ActiveCategory; label: string; icon?: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'character', label: '👤 人物' },
  { key: 'scene', label: '🏙 场景' },
  { key: 'other', label: '📦 其他' },
];

export default function AssetManagerView({ assets, onAddAsset, onDeleteAsset, onRenameAsset }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  const counts: Record<ActiveCategory, number> = {
    all: assets.length,
    character: assets.filter(a => a.category === 'character').length,
    scene: assets.filter(a => a.category === 'scene').length,
    other: assets.filter(a => a.category === 'other').length,
  };

  const filteredAssets = activeCategory === 'all'
    ? assets
    : assets.filter(a => a.category === activeCategory);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPendingFile({ src: ev.target?.result as string, name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSelectCategory = (category: 'character' | 'scene' | 'other') => {
    if (!pendingFile) return;
    onAddAsset({
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'image',
      src: pendingFile.src,
      name: pendingFile.name,
      createdAt: Date.now(),
      category,
    });
    setPendingFile(null);
  };

  return (
    <div className="w-full h-full bg-[#0d0d0d] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        {/* Category tabs */}
        <div className="flex items-center gap-1 flex-1">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                activeCategory === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-gray-500 border-white/[0.08] hover:text-gray-300'
              }`}
            >
              {label}
              <span className={`text-xs ${activeCategory === key ? 'text-blue-200' : 'text-gray-600'}`}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Right-side buttons */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg text-sm transition-colors border border-white/[0.08]"
        >
          <Upload size={14} />
          上传素材
        </button>
        <button
          onClick={() => setShowGenerateDialog(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
        >
          <Sparkles size={14} />
          生成新素材
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 text-sm gap-3">
            <ImageIcon size={36} className="opacity-20" />
            <p>{activeCategory === 'all' ? '上传素材或生成新素材后将在这里显示' : '该分类暂无素材'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                className="relative group rounded-xl overflow-hidden border border-white/[0.08] bg-[#1c1c1c]"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={asset.src}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {/* Delete button */}
                <button
                  onClick={() => onDeleteAsset(asset.id)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                >
                  <X size={10} className="text-white" />
                </button>
                {/* Name — click to rename */}
                <div className="px-1.5 py-1 bg-black/40">
                  {editingId === asset.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => {
                        onRenameAsset(asset.id, editingName.trim() || asset.name);
                        setEditingId(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          onRenameAsset(asset.id, editingName.trim() || asset.name);
                          setEditingId(null);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full bg-transparent text-[10px] text-white/80 outline-none border-b border-white/30 leading-snug"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <p
                      className="text-[10px] text-white/40 truncate cursor-pointer hover:text-white/70 leading-snug"
                      title={`${asset.name} (点击重命名)`}
                      onClick={() => { setEditingId(asset.id); setEditingName(asset.name); }}
                    >
                      {asset.name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category selection overlay for upload */}
      {pendingFile && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1c1c1c] border border-white/10 rounded-xl p-4 shadow-2xl min-w-[180px]">
            <p className="text-gray-400 text-xs mb-1 text-center">选择分类</p>
            <p className="text-gray-500 text-[10px] mb-3 text-center truncate max-w-[160px]">{pendingFile.name}</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleSelectCategory('character')}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors">
                <span>👤</span> 人物
              </button>
              <button onClick={() => handleSelectCategory('scene')}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors">
                <span>🏞</span> 场景
              </button>
              <button onClick={() => handleSelectCategory('other')}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors">
                <span>📦</span> 其他
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate dialog */}
      {showGenerateDialog && (
        <AssetGenerateDialog
          open={showGenerateDialog}
          onClose={() => setShowGenerateDialog(false)}
          onAddAsset={onAddAsset}
        />
      )}
    </div>
  );
}
