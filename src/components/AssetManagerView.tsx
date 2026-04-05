// src/components/AssetManagerView.tsx — Phase 2: server upload
import React, { useRef, useState } from 'react';
import type { AssetItem } from '../lib/storage';
import AssetGenerateDialog from './AssetGenerateDialog';

type FilterKey = 'all' | 'character' | 'scene' | 'other' | 'video';

interface Props {
  assets: AssetItem[];
  onAddAsset: (asset: AssetItem) => void;
  onDeleteAsset: (id: string) => void;
  onRenameAsset: (id: string, name: string) => void;
}

interface PendingFile {
  src: string;
  name: string;
  type: 'image' | 'video';
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: '全部' },
  { key: 'character', label: '角色模型' },
  { key: 'scene',     label: '环境场景' },
  { key: 'other',     label: '道具资源' },
  { key: 'video',     label: '视频剪辑' },
];

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} 小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return '昨日';
  return `${diffD} 天前`;
}

function typeBadge(asset: AssetItem): { label: string; cls: string } {
  if (asset.type === 'video')          return { label: 'Video',       cls: 'bg-[#8ab4f8]/90 text-[#1A1A1A]' };
  if (asset.category === 'character')  return { label: '3D Model',    cls: 'bg-[#8ab4f8]/90 text-[#1A1A1A]' };
  if (asset.category === 'scene')      return { label: 'Environment', cls: 'bg-[#9f9d9d] text-[#202020]' };
  if (asset.category === 'other')      return { label: 'Prop',        cls: 'bg-[#1a1a1a] text-[#b8b9b9]' };
  return { label: 'Image', cls: 'bg-white/10 text-[#e0e0e0]' };
}

export default function AssetManagerView({ assets, onAddAsset, onDeleteAsset, onRenameAsset }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

  const filteredAssets = assets.filter(a => {
    if (activeFilter === 'all')       return true;
    if (activeFilter === 'video')     return a.type === 'video';
    return a.category === activeFilter;
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const isVideo = file.type.startsWith('video');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'unknown' }));
        alert(`上传失败：${err.error}`);
        return;
      }
      const data = await resp.json() as { url: string; filename: string; type: string };
      if (isVideo) {
        // Videos don't need category selection — add directly
        onAddAsset({
          id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: 'video',
          src: data.url,
          name: file.name,
          createdAt: Date.now(),
          category: 'other',
        });
      } else {
        setPendingFile({ src: data.url, name: file.name, type: 'image' });
      }
    } catch (err) {
      alert(`上传出错：${String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectCategory = (category: 'character' | 'scene' | 'other') => {
    if (!pendingFile) return;
    onAddAsset({
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: pendingFile.type,
      src: pendingFile.src,
      name: pendingFile.name,
      createdAt: Date.now(),
      category,
    });
    setPendingFile(null);
  };

  return (
    <div className="w-full h-full bg-[#0e0e0e] flex flex-col relative overflow-hidden">
      <main className="flex-1 px-6 md:px-16 lg:px-24 py-12 overflow-y-auto pb-32">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-[#e0e0e0] mb-3" style={{ fontFamily: 'Manrope' }}>资产库</h1>
            <p className="text-white/40 text-base" style={{ fontFamily: 'Inter' }}>管理项目中的所有 3D 模型、媒体素材及剧本文档</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => !uploading && fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-[#111] text-[#e0e0e0] border border-white/[0.06] px-6 py-3 rounded-full flex items-center gap-2 hover:bg-[#1a1a1a] transition-all text-sm disabled:opacity-50"
              style={{ fontFamily: 'Inter' }}
            >
              <span className="material-symbols-outlined text-[18px]">upload</span>
              {uploading ? '上传中…' : '上传'}
            </button>
            <button
              onClick={() => setShowGenerateDialog(true)}
              className="bg-[#e0e0e0] text-[#1a1a1a] px-8 py-3 rounded-full flex items-center gap-2 hover:bg-white transition-all text-sm font-bold"
              style={{ fontFamily: 'Inter' }}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
              新建资产
            </button>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
        </header>

        {/* Pill Filters */}
        <div className="flex flex-wrap gap-2.5 mb-10 items-center border-b border-white/[0.06] pb-8">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-6 py-2 rounded-full text-xs transition-all ${
                activeFilter === key
                  ? 'bg-[#8ab4f8]/10 border border-[#8ab4f8]/20 text-[#8ab4f8] font-bold tracking-wide'
                  : 'bg-[#0f0f0f] border border-white/[0.06] text-white/40 hover:border-white/[0.10]'
              }`}
              style={{ fontFamily: 'Inter' }}
            >
              {label}
            </button>
          ))}
          <div className="h-5 w-px bg-white/[0.06] mx-3" />
          <button className="flex items-center gap-2 text-xs text-white/30 hover:text-white transition-colors" style={{ fontFamily: 'Inter' }}>
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            更多筛选
          </button>
        </div>

        {/* Asset Grid */}
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/40 text-sm gap-3">
            <span className="material-symbols-outlined text-5xl opacity-20">inventory_2</span>
            <p>{activeFilter === 'all' ? '上传素材或生成新素材后将在这里显示' : '该分类暂无素材'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
            {filteredAssets.map(asset => {
              const badge = typeBadge(asset);
              const shortId = asset.id.slice(-6).toUpperCase();
              return (
                <div
                  key={asset.id}
                  className="group relative bg-[#111] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-[#8ab4f8]/30 transition-all duration-500 flex flex-col shadow-lg shadow-black/20"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video relative bg-black overflow-hidden">
                    {asset.type === 'image' ? (
                      <img
                        src={asset.src}
                        alt={asset.name}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#0f0f0f]">
                        <span className="material-symbols-outlined text-5xl text-white/20">videocam</span>
                      </div>
                    )}
                    {/* Type badge */}
                    <div className={`absolute top-4 left-4 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-tighter shadow-xl ${badge.cls}`}>
                      {badge.label}
                    </div>
                    {/* ID badge */}
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-[#e0e0e0] text-[10px] px-2.5 py-1 rounded-lg border border-white/10 uppercase tracking-tighter" style={{ fontFamily: 'Inter' }}>
                      ID: {shortId}
                    </div>
                    {/* Delete on hover */}
                    <button
                      onClick={() => onDeleteAsset(asset.id)}
                      className="absolute top-4 right-4 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                    >
                      <span className="material-symbols-outlined text-[16px] text-white">close</span>
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-5 flex-1">
                    {editingId === asset.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => { onRenameAsset(asset.id, editingName.trim() || asset.name); setEditingId(null); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { onRenameAsset(asset.id, editingName.trim() || asset.name); setEditingId(null); }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full bg-transparent text-sm text-[#e0e0e0] font-bold outline-none border-b border-[#8ab4f8]/50 leading-snug mb-1"
                        style={{ fontFamily: 'Manrope' }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <h4
                        className="text-[#e0e0e0] font-bold text-sm mb-1 group-hover:text-[#8ab4f8] transition-colors cursor-pointer truncate"
                        style={{ fontFamily: 'Manrope' }}
                        title={`${asset.name} (点击重命名)`}
                        onClick={() => { setEditingId(asset.id); setEditingName(asset.name); }}
                      >
                        {asset.name}
                      </h4>
                    )}
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-[10px] text-white/40" style={{ fontFamily: 'Inter' }}>
                        修改于 {relativeTime(asset.createdAt)}
                      </span>
                      <div className="flex gap-3">
                        <span className="material-symbols-outlined text-white/40 text-[18px] hover:text-[#8ab4f8] cursor-pointer transition-colors">
                          {asset.type === 'video' ? 'slow_motion_video' : 'download'}
                        </span>
                        <span className="material-symbols-outlined text-white/40 text-[18px] hover:text-[#8ab4f8] cursor-pointer transition-colors">
                          more_horiz
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Category selection overlay for upload */}
      {pendingFile && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl min-w-[200px]">
            <p className="text-white/40 text-xs mb-1 text-center" style={{ fontFamily: 'Inter' }}>选择分类</p>
            <p className="text-[#767575] text-[10px] mb-4 text-center truncate max-w-[180px]">{pendingFile.name}</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleSelectCategory('character')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-[#e0e0e0] transition-colors">
                <span className="material-symbols-outlined text-[18px]">person</span> 角色模型
              </button>
              <button onClick={() => handleSelectCategory('scene')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-[#e0e0e0] transition-colors">
                <span className="material-symbols-outlined text-[18px]">landscape</span> 环境场景
              </button>
              <button onClick={() => handleSelectCategory('other')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-[#e0e0e0] transition-colors">
                <span className="material-symbols-outlined text-[18px]">category</span> 道具资源
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
