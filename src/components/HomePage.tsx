import React, { useState, useEffect, useRef } from 'react';
import { Plus, Sparkles, Clock, Folder, Trash2, MoreHorizontal } from 'lucide-react';
import { loadProjects, deleteProject, type Project } from '../lib/storage';

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return '刚刚';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} 分钟前`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} 小时前`;
  return `${Math.floor(d / 86_400_000)} 天前`;
}

interface Props {
  onNewProject: (initialScript?: string) => void;
  onOpenProject: (project: Project) => void;
  onGoToSkills?: () => void;
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-white/[0.07] hover:border-white/20 transition-all duration-300 group bg-[#181818] relative">
      {/* Thumbnail */}
      <button onClick={onOpen} className="block w-full aspect-[16/9] bg-[#111] overflow-hidden">
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Folder size={28} className="text-gray-700" />
          </div>
        )}
      </button>

      {/* Info */}
      <div className="px-3.5 py-3 flex items-start justify-between gap-2">
        <button onClick={onOpen} className="flex-1 text-left min-w-0">
          <p className="text-white text-xs font-medium truncate">{project.name}</p>
          <p className="text-gray-600 text-[11px] mt-0.5 flex items-center gap-1">
            <Clock size={9} />
            编辑于 {timeAgo(project.updatedAt)}
          </p>
        </button>

        {/* Context menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-all rounded-md"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 bottom-7 bg-[#242424] border border-white/10 rounded-xl py-1 shadow-xl z-10 min-w-[100px]">
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-white/5 text-xs transition-colors"
              >
                <Trash2 size={12} />
                删除项目
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage({ onNewProject, onOpenProject, onGoToSkills }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  const handleSubmit = () => {
    const text = inputText.trim();
    onNewProject(text || undefined);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const quickTags = [
    { label: '剧本拆解分镜', color: '#f59e0b' },
    { label: '提示词全能优化', color: '#6366f1' },
    { label: '批量统一分镜光影', color: '#10b981' },
    { label: '技能社区', color: '#8b5cf6' },
  ];

  return (
    <div className="w-screen h-screen bg-[#0d0d0d] flex flex-col overflow-hidden">
      {/* Navbar */}
      <header className="flex items-center justify-between px-6 md:px-10 xl:px-14 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-white font-semibold text-[16px] tracking-tight">AIGC Flow</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-emerald-600/90 flex items-center justify-center text-white text-sm font-semibold">
          M
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto flex flex-col items-center px-6 md:px-10 xl:px-14">
        {/* Flexible spacer — pushes hero into upper-center, matches reference proportions */}
        <div className="w-full shrink-0 h-[12vh] min-h-[84px] max-h-[142px]" />

        <div className="w-full max-w-[1280px] flex flex-col items-center">
          {/* Hero */}
          <div className="w-full max-w-[800px] flex flex-col items-center gap-7 mb-14 xl:mb-16">
            <h1 className="text-[42px] font-bold text-white tracking-tight leading-tight">灵感从这里开始！</h1>

            {/* Input area */}
            <div className="w-full bg-[#1a1a1a] border border-white/[0.08] rounded-[28px] px-5 py-4.5 xl:px-6 xl:py-5 focus-within:border-white/20 transition-colors shadow-[0_0_0_1px_rgba(255,255,255,0.015)]">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="在这里输入你的任何创意和想法，按 Enter 开始新项目..."
                className="w-full bg-transparent text-gray-200 text-[15px] leading-relaxed resize-none focus:outline-none min-h-[96px] xl:min-h-[108px] placeholder:text-gray-600"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-gray-700 text-[11px]">Enter 新建项目 · Shift+Enter 换行</span>
                <button
                  onClick={handleSubmit}
                  className="w-8 h-8 bg-white/8 hover:bg-white/15 rounded-full flex items-center justify-center transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 -rotate-90">
                    <path d="M12 5v14M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick tags */}
            <div className="flex items-center gap-2.5 flex-wrap justify-center">
              {quickTags.map(tag => (
                <button
                  key={tag.label}
                  onClick={() => tag.label === '技能社区' ? onGoToSkills?.() : onNewProject()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] rounded-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recent projects */}
          <div className="w-full max-w-[1180px]">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-white font-medium text-[14px]">最近项目</h2>
              {projects.length > 4 && (
                <button className="text-gray-500 hover:text-gray-300 text-xs flex items-center gap-0.5 transition-colors">
                  查看全部 <span className="text-base leading-none">›</span>
                </button>
              )}
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {/* New project card — same height as project cards */}
              <button
                onClick={() => onNewProject()}
                className="flex flex-col rounded-2xl overflow-hidden border border-dashed border-white/[0.08] hover:border-white/20 bg-[#181818] transition-all duration-300 group"
              >
                <div className="aspect-[16/9] flex flex-col items-center justify-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-white/[0.04] group-hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                    <Plus size={18} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
                  </div>
                  <span className="text-gray-600 group-hover:text-gray-400 text-xs transition-colors">新建项目</span>
                </div>
                <div className="px-3.5 py-3 border-t border-white/[0.04]">
                  <p className="text-gray-700 text-xs">空白项目</p>
                </div>
              </button>

              {/* Existing projects */}
              {projects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => onOpenProject(project)}
                  onDelete={() => handleDelete(project.id)}
                />
              ))}
            </div>

            {projects.length === 0 && (
              <p className="text-gray-700 text-xs text-center mt-6">还没有项目，点击新建开始创作</p>
            )}
          </div>
        </div>

        {/* Bottom flexible spacer */}
        <div className="w-full shrink-0 h-[16vh] min-h-[100px] max-h-[164px]" />
      </main>

      {/* Footer */}
      <footer className="pb-5 pt-2 text-center flex-shrink-0">
        <p className="text-gray-700 text-[11px]">知识产权及用户合规声明</p>
        <p className="text-gray-700 text-[11px] mt-0.5">特别鸣谢</p>
      </footer>
    </div>
  );
}
