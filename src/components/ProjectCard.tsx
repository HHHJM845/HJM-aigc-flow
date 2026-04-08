import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { type Project } from '../lib/storage';

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return '刚刚';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} 分钟前`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} 小时前`;
  if (d < 86_400_000 * 2) return '昨日';
  return `${Math.floor(d / 86_400_000)} 天前`;
}

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

export default function ProjectCard({
  project,
  onOpen,
  onDelete,
  onRename,
}: ProjectCardProps) {
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
      className="group relative aspect-[4/5] bg-black/40 backdrop-blur-sm rounded-2xl overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/60 border border-white/15"
    >
      {/* Thumbnail — top 62% */}
      <button
        onClick={onOpen}
        className="relative h-[62%] w-full bg-black/30 overflow-hidden flex-shrink-0"
      >
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-white/20 text-5xl">movie_creation</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-white/30 text-[12px]">folder</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-white/30 font-bold" style={{ fontFamily: 'Inter' }}>
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
          <p className="text-white/35 text-xs mt-1.5" style={{ fontFamily: 'Inter' }}>
            {timeAgo(project.updatedAt)}编辑
          </p>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="w-6 h-6 rounded-full border border-white/20 bg-white/10" />
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
