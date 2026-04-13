import React, { useState, useEffect, useCallback } from 'react';
import { BookMarked, Trash2, Pencil } from 'lucide-react';
import TemplateFormDrawer, { type TemplateFormData } from './TemplateFormDrawer';

interface Template {
  id: string;
  name: string;
  genre: string;
  nodeType: 'image' | 'video';
  promptPreset: string;
  styleTag: string | null;
  compositionTip: string | null;
  cameraParams: string | null;
  durationHint: number | null;
  audioHint: string | null;
  createdAt: number;
}

const GENRES = ['全部', '古风武侠', '都市情感', '科幻奇幻', '微短剧爆款', '自定义'];

const GENRE_COLORS: Record<string, string> = {
  '古风武侠': 'bg-amber-500/12 text-amber-300 border-amber-500/30',
  '都市情感': 'bg-blue-500/12 text-blue-300 border-blue-500/30',
  '科幻奇幻': 'bg-violet-500/12 text-violet-300 border-violet-500/30',
  '微短剧爆款': 'bg-rose-500/12 text-rose-300 border-rose-500/30',
  '自定义': 'bg-white/8 text-gray-400 border-white/15',
};

export default function TemplateLibraryView() {
  const [nodeType, setNodeType] = useState<'image' | 'video'>('image');
  const [genre, setGenre] = useState('全部');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    const params = new URLSearchParams({ nodeType });
    if (genre !== '全部') params.set('genre', genre);
    const res = await fetch(`/api/templates?${params}`);
    if (res.ok) setTemplates(await res.json() as Template[]);
  }, [nodeType, genre]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSave = async (data: TemplateFormData, id?: string) => {
    const body = {
      ...data,
      durationHint: data.durationHint ? Number(data.durationHint) : null,
    };
    if (id) {
      await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    await fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个模板吗？')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    await fetchTemplates();
  };

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (t: Template) => { setEditing(t); setDrawerOpen(true); };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookMarked size={20} className="text-gray-400" />
          <h1 className="text-white font-semibold text-lg">模板库</h1>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl transition-colors"
        >
          + 新建模板
        </button>
      </div>

      {/* Node type tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit mb-5">
        {(['image', 'video'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setNodeType(t); setGenre('全部'); }}
            className={`px-5 py-1.5 rounded-lg text-sm transition-all ${
              nodeType === t ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'image' ? '图片模板' : '视频模板'}
          </button>
        ))}
      </div>

      {/* Genre filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        {GENRES.map(g => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            className={`px-3 py-1 rounded-full text-[11px] border transition-colors ${
              genre === g
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                : 'bg-white/5 text-gray-500 border-white/8 hover:text-gray-300'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {templates.map(t => (
          <div
            key={t.id}
            className="bg-[#252528] border border-white/12 rounded-2xl p-4 hover:border-white/22 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-[13px] text-white font-medium leading-tight">{t.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ml-2 ${GENRE_COLORS[t.genre] ?? GENRE_COLORS['自定义']}`}>
                {t.genre}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mb-3">
              {t.promptPreset}
            </p>
            {/* Meta tags */}
            <div className="flex flex-wrap gap-1 mb-3">
              {t.styleTag && <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-md text-gray-500 border border-white/8">{t.styleTag}</span>}
              {t.compositionTip && <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-md text-gray-500 border border-white/8">{t.compositionTip}</span>}
              {t.cameraParams && <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-md text-gray-500 border border-white/8">{t.cameraParams}</span>}
              {t.durationHint && <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-md text-gray-500 border border-white/8">{t.durationHint}s</span>}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => openEdit(t)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-500 hover:text-gray-200 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <Pencil size={11} /> 编辑
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={11} /> 删除
              </button>
            </div>
          </div>
        ))}

        {/* Add card */}
        <button
          onClick={openCreate}
          className="border-2 border-dashed border-white/10 hover:border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[130px] transition-colors group"
        >
          <span className="text-2xl text-gray-700 group-hover:text-gray-500 transition-colors">+</span>
          <span className="text-[12px] text-gray-600 group-hover:text-gray-400 transition-colors">新建模板</span>
        </button>
      </div>

      <TemplateFormDrawer
        open={drawerOpen}
        initial={editing ? {
          id: editing.id,
          name: editing.name,
          genre: editing.genre,
          nodeType: editing.nodeType,
          promptPreset: editing.promptPreset,
          styleTag: editing.styleTag ?? '',
          compositionTip: editing.compositionTip ?? '',
          cameraParams: editing.cameraParams ?? '',
          durationHint: editing.durationHint?.toString() ?? '',
          audioHint: editing.audioHint ?? '',
        } : undefined}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
