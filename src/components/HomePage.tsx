import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Pencil, MoreHorizontal } from 'lucide-react';
import { type Project } from '../lib/storage';

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return '刚刚';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} 分钟前`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} 小时前`;
  if (d < 86_400_000 * 2) return '昨日';
  return `${Math.floor(d / 86_400_000)} 天前`;
}

interface Props {
  projects: Project[];
  onNewProject: (initialScript?: string) => void;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onGoToSkills?: () => void;
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
  onRename,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startEditing = () => {
    setNameInput(project.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleNameClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      startEditing();
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        onOpen();
      }, 220);
    }
  };

  const commitEdit = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== project.name) onRename(trimmed);
    setEditing(false);
  };

  const cancelEdit = () => { setNameInput(project.name); setEditing(false); };

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  return (
    <div
      className="group relative aspect-[4/5] bg-[#111] rounded-2xl overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/60 border border-white/[0.05]"
    >
      {/* Thumbnail — top 62% */}
      <button
        onClick={onOpen}
        className="relative h-[62%] w-full bg-[#111] overflow-hidden flex-shrink-0"
      >
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[#222] text-5xl">movie_creation</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[#3a3a3a] text-[12px]">folder</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-[#4a4a4a] font-bold" style={{ fontFamily: 'Inter' }}>
            {project.name.slice(0, 14).replace(/\s+/g, '_').toUpperCase() || 'PROJECT'}
          </span>
        </div>
      </button>

      {/* Info — bottom */}
      <div className="p-5 flex flex-col justify-between flex-grow">
        <div>
          {editing ? (
            <input
              ref={inputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
              }}
              className="w-full bg-white/10 text-[#fbf9f8] text-sm font-bold rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-white/30"
              onClick={e => e.stopPropagation()}
              style={{ fontFamily: 'Manrope' }}
            />
          ) : (
            <h3
              className="text-[#fbf9f8] font-bold truncate group-hover:text-[#c6c6c7] transition-colors text-base cursor-pointer select-none"
              onClick={handleNameClick}
              style={{ fontFamily: 'Manrope' }}
            >
              {project.name}
            </h3>
          )}
          <p className="text-[#3d3d3d] text-xs mt-1.5" style={{ fontFamily: 'Inter' }}>
            {timeAgo(project.updatedAt)}编辑
          </p>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="w-6 h-6 rounded-full border border-[#222] bg-[#181818]" />
          <div className="relative" ref={menuRef}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-[#acabaa]/40 hover:text-[#fbf9f8] transition-colors text-[20px]">more_horiz</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-8 bg-[#242424] border border-white/10 rounded-xl py-1 shadow-xl z-20 min-w-[110px]">
                <button
                  onClick={() => { setMenuOpen(false); startEditing(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors"
                  style={{ fontFamily: 'Inter' }}
                >
                  <Pencil size={11} /> 重命名
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-white/5 text-xs transition-colors"
                  style={{ fontFamily: 'Inter' }}
                >
                  <Trash2 size={11} /> 删除项目
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage({ projects, onNewProject, onOpenProject, onDeleteProject, onRenameProject, onGoToSkills }: Props) {
  const [inputText, setInputText] = useState('');

  const handleSubmit = () => {
    onNewProject(inputText.trim() || undefined);
    setInputText('');
  };

  const quickActions = [
    { label: '剧本拆解分镜', onClick: () => onNewProject() },
    { label: '提示词全能优化', onClick: () => onNewProject() },
    { label: '批量统一分镜光影', onClick: () => onNewProject() },
    { label: '技能社区', onClick: () => onGoToSkills?.() },
  ];

  return (
    <div className="relative min-h-screen flex flex-col justify-between items-center py-12 bg-black overflow-x-hidden">

      {/* Hero */}
      <section className="flex-grow w-full max-w-screen-2xl px-12 flex flex-col items-center justify-center text-center">
        <h1
          className="text-6xl md:text-7xl font-extrabold tracking-tighter text-[#fbf9f8] mb-16"
          style={{ fontFamily: 'Manrope' }}
        >
          灵感从这里开始！
        </h1>

        {/* Input */}
        <div className="relative w-full max-w-4xl mb-10">
          <div className="flex items-center bg-[#141414] rounded-full px-8 py-5 border border-[#2a2a2a] focus-within:border-[#3a3a3a] transition-colors duration-300">
            <span className="material-symbols-outlined text-[#3a3a3a] mr-4 text-xl">auto_awesome</span>
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="输入你想创作的场景或关键词..."
              className="bg-transparent border-none focus:ring-0 text-xl w-full text-[#e0dfdf] placeholder:text-[#333] font-medium focus:outline-none"
              style={{ fontFamily: 'Manrope' }}
            />
            <button
              onClick={handleSubmit}
              className="bg-[#f5f4f4] text-black font-bold px-9 py-3 rounded-full text-sm hover:bg-white active:scale-95 transition-all flex-shrink-0"
              style={{ fontFamily: 'Inter' }}
            >
              立即生成
            </button>
          </div>
        </div>

        {/* Action pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {quickActions.map(({ label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="px-6 py-2.5 rounded-full bg-[#141414] text-sm font-medium text-[#555] hover:text-[#aaa] hover:bg-[#1a1a1a] transition-all border border-[#222]"
              style={{ fontFamily: 'Manrope' }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Recent Projects */}
      <section className="w-full max-w-[1600px] px-12 mt-12 mb-6">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#e8e7e7] tracking-tight" style={{ fontFamily: 'Manrope' }}>最近项目</h2>
            <p className="text-[#333] text-sm mt-1" style={{ fontFamily: 'Inter' }}>继续你的创意旅程</p>
          </div>
          {projects.length > 4 && (
            <button
              className="group text-[#333] text-sm font-medium flex items-center gap-1.5 hover:text-[#666] transition-colors"
              style={{ fontFamily: 'Inter' }}
            >
              查看全部
              <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {/* New project card */}
          <button
            onClick={() => onNewProject()}
            className="group relative aspect-[4/5] bg-[#0d0d0d] rounded-2xl border border-dashed border-[#222] hover:border-[#333] flex flex-col items-center justify-center transition-all duration-500"
          >
            <div className="w-14 h-14 rounded-full bg-[#171717] border border-[#222] flex items-center justify-center mb-5 group-hover:scale-105 group-hover:border-[#333] transition-all duration-500">
              <span className="material-symbols-outlined text-[#333] text-2xl group-hover:text-[#555] transition-colors">add</span>
            </div>
            <span className="text-base font-bold text-[#333] group-hover:text-[#666] transition-colors" style={{ fontFamily: 'Manrope' }}>
              新建项目
            </span>
            <span className="text-[#252525] text-xs mt-1.5 font-medium group-hover:text-[#3a3a3a] transition-colors" style={{ fontFamily: 'Inter' }}>
              从空白画布开始
            </span>
          </button>

          {/* Existing project cards */}
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => onOpenProject(project)}
              onDelete={() => onDeleteProject(project.id)}
              onRename={name => onRenameProject?.(project.id, name)}
            />
          ))}
        </div>

        {projects.length === 0 && (
          <p className="text-[#acabaa]/40 text-xs text-center mt-8" style={{ fontFamily: 'Inter' }}>
            还没有项目，点击新建开始创作
          </p>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center mt-4">
        <p className="text-[#acabaa]/30 text-[11px]" style={{ fontFamily: 'Inter' }}>知识产权及用户合规声明</p>
        <p className="text-[#acabaa]/30 text-[11px] mt-0.5" style={{ fontFamily: 'Inter' }}>特别鸣谢</p>
      </footer>
    </div>
  );
}
