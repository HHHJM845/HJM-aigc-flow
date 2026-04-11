import React, { useState } from 'react';
import { type Project } from '../lib/storage';
import homeBgVideo from '../assets/home-bg.mp4';
import ProjectCard from './ProjectCard';
import NewProjectDialog, { type NewProjectData } from './NewProjectDialog';

interface Props {
  projects: Project[];
  onNewProject: (data?: NewProjectData) => void;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onGoToTopic?: (keyword: string) => void;
}

export default function HomePage({ projects, onNewProject, onOpenProject, onDeleteProject, onRenameProject, onUpdateProject, onGoToTopic }: Props) {
  const [inputText, setInputText] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSubmit = () => {
    const kw = inputText.trim();
    if (kw && onGoToTopic) {
      onGoToTopic(kw);
    } else {
      setDialogOpen(true);
    }
    setInputText('');
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center pt-16 pb-8 bg-black overflow-x-hidden">

      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
        src={homeBgVideo}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70 pointer-events-none" />

      {/* Hero */}
      <section className="relative z-10 w-full max-w-screen-2xl px-12 flex flex-col items-center text-center pb-6">
        <h1
          className="text-6xl md:text-7xl font-extrabold tracking-tighter text-[#fbf9f8] mb-10"
          style={{ fontFamily: 'Manrope' }}
        >
          灵感从这里开始！
        </h1>

        {/* Input */}
        <div className="relative w-full max-w-4xl mb-10">
          <div className="flex items-center bg-black/40 backdrop-blur-md rounded-full px-8 py-5 border border-white/20 focus-within:border-white/40 transition-colors duration-300">
            <span className="material-symbols-outlined text-white/40 mr-4 text-xl">auto_awesome</span>
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="输入你想创作的场景或关键词..."
              className="bg-transparent border-none focus:ring-0 text-xl w-full text-white placeholder:text-white/30 font-medium focus:outline-none"
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

      </section>

      {/* Recent Projects */}
      <section className="relative z-10 w-full max-w-[1600px] px-12 mt-2 mb-6">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#e8e7e7] tracking-tight" style={{ fontFamily: 'Manrope' }}>最近项目</h2>
            <p className="text-white/40 text-sm mt-1" style={{ fontFamily: 'Inter' }}>继续你的创意旅程</p>
          </div>
          {projects.length > 4 && (
            <button
              className="group text-white/40 text-sm font-medium flex items-center gap-1.5 hover:text-white/70 transition-colors"
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
            onClick={() => setDialogOpen(true)}
            className="group relative aspect-[4/5] bg-black/30 backdrop-blur-sm rounded-2xl border border-dashed border-white/20 hover:border-white/40 flex flex-col items-center justify-center transition-all duration-500"
          >
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-5 group-hover:scale-105 group-hover:border-white/40 transition-all duration-500">
              <span className="material-symbols-outlined text-white/50 text-2xl group-hover:text-white/80 transition-colors">add</span>
            </div>
            <span className="text-base font-bold text-white/50 group-hover:text-white/80 transition-colors" style={{ fontFamily: 'Manrope' }}>
              新建项目
            </span>
            <span className="text-white/30 text-xs mt-1.5 font-medium group-hover:text-white/50 transition-colors" style={{ fontFamily: 'Inter' }}>
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
              onUpdate={updates => onUpdateProject?.(project.id, updates)}
            />
          ))}
        </div>

        {projects.length === 0 && (
          <p className="text-[#acabaa]/40 text-xs text-center mt-8" style={{ fontFamily: 'Inter' }}>
            还没有项目，点击新建开始创作
          </p>
        )}
      </section>

      {dialogOpen && (
        <NewProjectDialog
          onConfirm={data => { onNewProject(data); setDialogOpen(false); }}
          onCancel={() => setDialogOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="relative z-10 text-center mt-4">
        <p className="text-[#acabaa]/30 text-[11px]" style={{ fontFamily: 'Inter' }}>知识产权及用户合规声明</p>
        <p className="text-[#acabaa]/30 text-[11px] mt-0.5" style={{ fontFamily: 'Inter' }}>特别鸣谢</p>
      </footer>
    </div>
  );
}
