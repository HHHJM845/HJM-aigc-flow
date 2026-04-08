import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { type Project, type ProjectStage, inferStage, stageIndex } from '../lib/storage';

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return '刚刚';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} 分钟前`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} 小时前`;
  if (d < 86_400_000 * 2) return '昨日';
  return `${Math.floor(d / 86_400_000)} 天前`;
}

const AVATAR_COLORS = [
  'rgba(160,145,130,0.45)',
  'rgba(145,155,165,0.45)',
  'rgba(130,150,135,0.45)',
  'rgba(155,145,160,0.45)',
  'rgba(150,160,145,0.45)',
];

const STAGES: { key: ProjectStage; label: string }[] = [
  { key: 'script',      label: '剧本' },
  { key: 'storyboard',  label: '分镜' },
  { key: 'generation',  label: '生成' },
  { key: 'review',      label: '审片' },
];

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onUpdate: (updates: Partial<Project>) => void;
}

export default function ProjectCard({
  project,
  onOpen,
  onDelete,
  onRename,
  onUpdate,
}: ProjectCardProps) {
  // onUpdate: used by child menus (Tasks 4-6) for stage/member/tag changes
  const [menuOpen, setMenuOpen] = useState(false);
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const [memberList, setMemberList] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStage = inferStage(project);
  const currentStageIdx = stageIndex(currentStage);

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
    if (!menuOpen) { setStageMenuOpen(false); return; }
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setStageMenuOpen(false);
      }
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
        {project.projectType && (
          <div className="absolute top-2 left-2 bg-white/7 border border-white/12 rounded-full px-2 py-0.5 text-[9px] text-white/45 leading-none">
            {project.projectType}
          </div>
        )}
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
          <div className="flex flex-wrap gap-1 mt-2 min-h-[14px]">
            {project.tags?.map(tag => (
              <span
                key={tag}
                className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/35 leading-none"
                style={{ fontFamily: 'Inter' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3">
          {/* Stage step dots */}
          <div className="flex items-center mb-3">
            {STAGES.map((s, i) => {
              const done = i <= currentStageIdx;
              return (
                <React.Fragment key={s.key}>
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white/90 flex-shrink-0"
                      style={{ background: done ? 'rgba(200,190,220,0.7)' : 'rgba(255,255,255,0.07)', border: done ? 'none' : '1px solid rgba(255,255,255,0.15)' }}
                    >
                      {done && '✓'}
                    </div>
                    <span className="text-[6.5px] leading-none" style={{ color: done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)', fontFamily: 'Inter' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className="flex-1 h-px mb-2.5" style={{ background: done && i < currentStageIdx ? 'rgba(200,190,220,0.35)' : 'rgba(255,255,255,0.1)' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Avatars + menu */}
          <div className="flex justify-between items-center">
            <div className="flex">
              {(project.members ?? []).length === 0 ? (
                <div className="w-5 h-5 rounded-full border border-white/15 bg-white/5" />
              ) : (
                <>
                  {(project.members ?? []).slice(0, 3).map((m, i) => (
                    <div
                      key={m}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border-[1.5px] border-[#111]"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: 'rgba(255,255,255,0.65)', marginLeft: i > 0 ? '-5px' : 0, zIndex: 3 - i }}
                    >
                      {m.slice(0, 1)}
                    </div>
                  ))}
                  {(project.members ?? []).length > 3 && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border-[1.5px] border-[#111] bg-white/10 text-white/50" style={{ marginLeft: '-5px' }}>
                      +{project.members.length - 3}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-[#acabaa]/40 hover:text-[#fbf9f8] transition-colors text-[20px]">more_horiz</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-8 bg-[#242424] border border-white/10 rounded-xl py-1 shadow-xl z-20 min-w-[130px]">
                  <button onClick={() => { setMenuOpen(false); startEditing(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors" style={{ fontFamily: 'Inter' }}>
                    <Pencil size={11} /> 重命名
                  </button>

                  {/* 调整阶段 */}
                  <div className="relative">
                    <button
                      onClick={e => { e.stopPropagation(); setStageMenuOpen(v => !v); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors"
                      style={{ fontFamily: 'Inter' }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[12px]">flag</span> 调整阶段
                      </span>
                      <span className="text-white/30">›</span>
                    </button>
                    {stageMenuOpen && (
                      <div className="absolute right-full top-0 mr-1 bg-[#2a2a2a] border border-white/10 rounded-xl py-1 shadow-xl z-30 min-w-[120px]">
                        <p className="px-3 py-1 text-[9px] text-white/30 uppercase tracking-wide" style={{ fontFamily: 'Inter' }}>手动指定</p>
                        {STAGES.map((s, i) => {
                          const isCurrent = currentStageIdx === i;
                          const isDone = i <= currentStageIdx;
                          return (
                            <button
                              key={s.key}
                              onClick={e => {
                                e.stopPropagation();
                                onUpdate({ stageOverride: s.key, updatedAt: Date.now() });
                                setStageMenuOpen(false);
                                setMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-white/5 ${isCurrent ? 'bg-white/6' : ''}`}
                              style={{ color: isCurrent ? '#e8e6e4' : 'rgba(255,255,255,0.5)', fontFamily: 'Inter' }}
                            >
                              <div className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: isDone ? 'rgba(200,190,220,0.7)' : 'rgba(255,255,255,0.08)', border: isDone ? 'none' : '1px solid rgba(255,255,255,0.15)' }}>
                                {isDone && <span className="text-[6px] text-white/90">✓</span>}
                              </div>
                              {s.label}
                              {isCurrent && <span className="ml-auto text-[9px] text-white/30">当前</span>}
                            </button>
                          );
                        })}
                        <div className="h-px bg-white/7 mx-2 my-1" />
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onUpdate({ stageOverride: undefined, updatedAt: Date.now() });
                            setStageMenuOpen(false);
                            setMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white/30 hover:text-white/50 hover:bg-white/5 transition-colors"
                          style={{ fontFamily: 'Inter' }}
                        >
                          ↺ 恢复自动推断
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setMemberList(project.members ?? []);
                      setMemberInput('');
                      setMemberModalOpen(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors"
                    style={{ fontFamily: 'Inter' }}
                  >
                    <span className="material-symbols-outlined text-[12px]">group</span> 管理成员
                  </button>

                  <div className="h-px bg-white/7 mx-2 my-0.5" />
                  <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-white/5 text-xs transition-colors" style={{ fontFamily: 'Inter' }}>
                    <Trash2 size={11} /> 删除项目
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {memberModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) setMemberModalOpen(false); }}
        >
          <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-5 w-72 shadow-2xl" style={{ fontFamily: 'Inter' }}>
            <h3 className="text-sm font-bold text-[#e8e6e4] mb-4" style={{ fontFamily: 'Manrope' }}>管理成员</h3>

            {/* Member list */}
            <div className="flex flex-col gap-2 mb-3 max-h-40 overflow-y-auto">
              {memberList.length === 0 && (
                <p className="text-xs text-white/30 text-center py-2">暂无成员</p>
              )}
              {memberList.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white/65" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {m.slice(0, 1)}
                    </div>
                    <span className="text-xs text-white/70">{m}</span>
                  </div>
                  <button onClick={() => setMemberList(prev => prev.filter((_, j) => j !== i))} className="text-white/25 hover:text-white/50 text-sm px-1 transition-colors">×</button>
                </div>
              ))}
            </div>

            {/* Add input */}
            <input
              value={memberInput}
              onChange={e => setMemberInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = memberInput.trim();
                  if (v && !memberList.includes(v)) setMemberList(prev => [...prev, v]);
                  setMemberInput('');
                }
              }}
              placeholder="输入姓名后回车添加..."
              className="w-full bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setMemberModalOpen(false)} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors">取消</button>
              <button
                onClick={() => {
                  onUpdate({ members: memberList, updatedAt: Date.now() });
                  setMemberModalOpen(false);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-white/90 text-black rounded-lg hover:bg-white transition-colors"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
