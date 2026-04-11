import React, { useState } from 'react';
import { type ProjectType } from '../lib/storage';

const PROJECT_TYPES: ProjectType[] = ['短片', '广告', 'MV', '教程', '其他'];

const AVATAR_COLORS = [
  'rgba(160,145,130,0.45)',
  'rgba(145,155,165,0.45)',
  'rgba(130,150,135,0.45)',
  'rgba(155,145,160,0.45)',
  'rgba(150,160,145,0.45)',
];

export interface NewProjectData {
  name: string;
  projectType?: ProjectType;
  tags: string[];
  members: string[];
}

interface Props {
  onConfirm: (data: NewProjectData) => void;
  onCancel: () => void;
}

export default function NewProjectDialog({ onConfirm, onCancel }: Props) {
  const [name, setName] = useState('未命名项目');
  const [projectType, setProjectType] = useState<ProjectType | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState('');

  const handleConfirm = () => {
    onConfirm({ name: name.trim() || '未命名项目', projectType, tags, members });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl" style={{ fontFamily: 'Inter' }}>
        <h2 className="text-sm font-bold text-[#e8e6e4] mb-5" style={{ fontFamily: 'Manrope' }}>新建项目</h2>

        {/* Name */}
        <div className="mb-4">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5">项目名称</p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={e => e.target.select()}
            className="w-full bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-white/25"
          />
        </div>

        {/* Type */}
        <div className="mb-4">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5">项目类型</p>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setProjectType(prev => prev === t ? undefined : t)}
                className="px-2.5 py-1 rounded-full text-[10px] transition-colors"
                style={{
                  background: projectType === t ? 'rgba(200,190,220,0.18)' : 'rgba(255,255,255,0.05)',
                  border: projectType === t ? '1px solid rgba(200,190,220,0.35)' : '1px solid rgba(255,255,255,0.12)',
                  color: projectType === t ? 'rgba(220,210,240,0.8)' : 'rgba(255,255,255,0.35)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="mb-4">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5">标签 <span className="normal-case text-white/20">（可选）</span></p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 bg-white/6 rounded-full px-2 py-0.5 text-[10px] text-white/45">
                  {tag}
                  <button onClick={() => setTags(prev => prev.filter((_, j) => j !== i))} className="text-white/25 hover:text-white/50">×</button>
                </span>
              ))}
            </div>
          )}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = tagInput.trim();
                if (v && !tags.includes(v)) setTags(prev => [...prev, v]);
                setTagInput('');
              }
            }}
            placeholder="输入标签后回车添加..."
            className="w-full bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25"
          />
        </div>

        {/* Members */}
        <div className="mb-5">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5">成员 <span className="normal-case text-white/20">（可选）</span></p>
          {members.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-2">
              {members.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white/65 flex-shrink-0" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {m.slice(0, 1)}
                    </div>
                    <span className="text-xs text-white/65">{m}</span>
                  </div>
                  <button onClick={() => setMembers(prev => prev.filter((_, j) => j !== i))} className="text-white/25 hover:text-white/50 px-1 text-sm">×</button>
                </div>
              ))}
            </div>
          )}
          <input
            value={memberInput}
            onChange={e => setMemberInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = memberInput.trim();
                if (v && !members.includes(v)) setMembers(prev => [...prev, v]);
                setMemberInput('');
              }
            }}
            placeholder="输入姓名后回车添加..."
            className="w-full bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors border border-white/10 rounded-lg bg-white/5">取消</button>
          <button onClick={handleConfirm} className="px-4 py-1.5 text-xs font-bold bg-white/90 text-black rounded-lg hover:bg-white transition-colors">创建</button>
        </div>
      </div>
    </div>
  );
}
