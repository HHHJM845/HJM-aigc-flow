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
      className="group relative aspect-[4/5] bg-[#131313]/40 rounded-2xl overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-white/5 border border-white/5"
    >
      {/* Thumbnail — top 62% */}
      <button
        onClick={onOpen}
        className="relative h-[62%] w-full bg-[#1f2020] overflow-hidden flex-shrink-0"
      >
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[#484848] text-4xl">folder_open</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#131313]/95 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#c6c6c7] text-[16px]">folder_open</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f9d9d] font-bold" style={{ fontFamily: 'Inter' }}>
            PROJECT
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
          <p className="text-[#acabaa]/60 text-xs mt-1.5" style={{ fontFamily: 'Inter' }}>
            {timeAgo(project.updatedAt)}编辑
          </p>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="w-7 h-7 rounded-full border-2 border-[#191a1a] bg-[#252626]" />
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

      {/* Ambient blobs */}
      <div className="fixed top-[-15%] left-[-10%] w-[70%] h-[70%] rounded-full bg-[#c6c6c7]/5 blur-[180px] pointer-events-none z-0" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-[150px] pointer-events-none z-0" />

      {/* Hero */}
      <section className="flex-grow w-full max-w-screen-2xl px-12 flex flex-col items-center justify-center text-center relative z-10">
        <h1
          className="text-6xl md:text-7xl font-extrabold tracking-tighter text-[#fbf9f8] mb-16"
          style={{ fontFamily: 'Manrope' }}
        >
          灵感从这里开始！
        </h1>

        {/* Input */}
        <div className="relative w-full max-w-4xl mb-12 group">
          <div className="absolute -inset-2 bg-gradient-to-r from-[#c6c6c7]/20 via-white/5 to-[#c6c6c7]/20 rounded-full blur-3xl opacity-20 group-focus-within:opacity-50 transition-opacity duration-1000" />
          <div className="relative flex items-center bg-[#131313]/40 backdrop-blur-xl rounded-full px-10 py-6 outline outline-1 outline-[#484848]/15 focus-within:outline-[#c6c6c7]/40 transition-all duration-500">
            <span className="material-symbols-outlined text-[#c6c6c7]/70 mr-5 text-2xl">auto_awesome</span>
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="输入你想创作的场景或关键词..."
              className="bg-transparent border-none focus:ring-0 text-2xl w-full text-[#e7e5e4] placeholder:text-[#acabaa]/40 font-medium focus:outline-none"
              style={{ fontFamily: 'Manrope' }}
            />
            <button
              onClick={handleSubmit}
              className="bg-[#fbf9f8] text-black font-bold px-10 py-3.5 rounded-full text-base hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5 flex-shrink-0 flex items-center gap-2"
              style={{ fontFamily: 'Inter' }}
            >
              立即生成
            </button>
          </div>
        </div>

        {/* Action pills */}
        <div className="flex flex-wrap justify-center gap-5">
          {quickActions.map(({ label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="px-8 py-3 rounded-full bg-[#1f2020]/30 text-sm font-semibold text-[#9f9d9d] hover:bg-[#2c2c2c] hover:text-[#fbf9f8] transition-all border border-[#484848]/5 backdrop-blur-md"
              style={{ fontFamily: 'Manrope' }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Recent Projects */}
      <section className="w-full max-w-[1600px] px-12 mt-12 mb-6 relative z-10">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-[#fbf9f8] tracking-tight" style={{ fontFamily: 'Manrope' }}>最近项目</h2>
            <p className="text-[#acabaa]/70 text-sm mt-1" style={{ fontFamily: 'Inter' }}>继续你的创意旅程</p>
          </div>
          {projects.length > 4 && (
            <button
              className="group text-[#9f9d9d]/80 text-sm font-semibold flex items-center gap-1.5 hover:text-[#c6c6c7] transition-colors"
              style={{ fontFamily: 'Inter' }}
            >
              查看全部
              <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {/* New project card */}
          <button
            onClick={() => onNewProject()}
            className="group relative aspect-[4/5] bg-black/20 rounded-2xl border-2 border-dashed border-[#484848]/10 hover:border-[#c6c6c7]/20 hover:bg-[#1f2020]/15 flex flex-col items-center justify-center transition-all duration-700"
          >
            <div className="w-16 h-16 rounded-full bg-[#1f2020]/50 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#c6c6c7] group-hover:text-black transition-all duration-700">
              <span className="material-symbols-outlined text-3xl">add</span>
            </div>
            <span className="text-xl font-bold text-[#fbf9f8]/70 group-hover:text-[#fbf9f8] transition-colors" style={{ fontFamily: 'Manrope' }}>
              新建项目
            </span>
            <span className="text-[#acabaa]/50 text-xs mt-2 font-medium" style={{ fontFamily: 'Inter' }}>
              从空白画板开始
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
      <footer className="relative z-10 text-center mt-4">
        <p className="text-[#acabaa]/30 text-[11px]" style={{ fontFamily: 'Inter' }}>知识产权及用户合规声明</p>
        <p className="text-[#acabaa]/30 text-[11px] mt-0.5" style={{ fontFamily: 'Inter' }}>特别鸣谢</p>
      </footer>
    </div>
  );
}
