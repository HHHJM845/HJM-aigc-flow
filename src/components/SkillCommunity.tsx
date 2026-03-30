import React, { useState } from 'react';
import { Sparkles, Search, Plus, Heart, Eye, MessageCircle, Star, Trophy, ArrowLeft, Zap, TrendingUp, CheckCircle, Upload } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  author: string;
  authorInitial: string;
  likes: number;
  views: number;
  comments: number;
  stars: number;
  isActivated: boolean;
  gradient: string;
}

const MOCK_SKILLS: Skill[] = [
  { id: '1', name: '写剧本超快', description: '用于内容创意类项目启动阶段，帮助用户快速得到一份可使用的剧本草稿，当用户想要快选择一个可使用的剧本草稿，从故事剧情到细节剧情', author: '重威-xxx', authorInitial: 'Z', likes: 2, views: 253, comments: 58, stars: 0, isActivated: false, gradient: 'from-violet-500 to-purple-600' },
  { id: '2', name: '提示词全能自动优化器', description: '当运镜创作任意素材视频的操作时，进行提示词优化、【自动触发】当任何任务，当运镜创作任意素材视频的操作时', author: 'zhangjiaxi', authorInitial: 'Z', likes: 1, views: 254, comments: 36, stars: 1, isActivated: true, gradient: 'from-blue-400 to-cyan-500' },
  { id: '3', name: '批量统一分镜光影', description: 'Use when user wants to unify lighting/atmosphere across storyboard...', author: '15995253167', authorInitial: '1', likes: 3, views: 248, comments: 18, stars: 1, isActivated: true, gradient: 'from-emerald-400 to-teal-500' },
  { id: '4', name: '硅基制片厂', description: '完整视觉内容制作流水线，从故事创意到视觉化成品制作输出，触发条件：用户输入任意关于影视/内容创作...', author: 'erpang233', authorInitial: 'E', likes: 3, views: 192, comments: 58, stars: 1, isActivated: false, gradient: 'from-pink-500 to-rose-600' },
  { id: '5', name: '画布整理大师', description: '面布梳理与整理专家，当用户需要整理面布节点（需批次查）、局部对齐节点（左对...', author: '重威-xxx', authorInitial: 'Z', likes: 1, views: 32, comments: 7, stars: 0, isActivated: false, gradient: 'from-amber-400 to-orange-500' },
  { id: '6', name: 'Seedance全能提示词', description: 'Seedance 2.0 (SD2) 视频提示词优化专家，当用户提到 Seedance、SD2、或需...', author: '立冬', authorInitial: 'L', likes: 2, views: 35, comments: 0, stars: 0, isActivated: false, gradient: 'from-indigo-400 to-violet-500' },
  { id: '7', name: '我想上热门', description: '社媒爆款内容创助手，当用户想要实时热点、当日热榜、B站热门内容等进行视...', author: '重威-xxx', authorInitial: 'Z', likes: 2, views: 29, comments: 6, stars: 0, isActivated: false, gradient: 'from-red-400 to-pink-500' },
  { id: '8', name: '一站式超选分镜头剧本', description: 'Use when user wants to create storyboard scripts (分镜头剧本/分镜), when user...', author: 'zhangjiaxi', authorInitial: 'Z', likes: 1, views: 21, comments: 13, stars: 0, isActivated: false, gradient: 'from-teal-400 to-emerald-500' },
  { id: '9', name: '场景多机位助手', description: 'Use when any skill reaches a scene-building or storyboard phase and need...', author: 'zhangjiaxi', authorInitial: 'Z', likes: 3, views: 26, comments: 4, stars: 0, isActivated: false, gradient: 'from-sky-400 to-blue-500' },
  { id: '10', name: '出角色又快又准', description: '用于内容创意类项目启动阶段，当用户想要快速建立角色、设计人物形象、或项目向无...', author: '重威-xxx', authorInitial: 'Z', likes: 0, views: 22, comments: 6, stars: 0, isActivated: true, gradient: 'from-purple-400 to-indigo-500' },
  { id: '11', name: '秒出大纲！', description: '用于内容创意类项目启动阶段，帮助用户快速确立故事大纲，当用户想聚焦于创意，轻...', author: '重威-xxx', authorInitial: 'Z', likes: 0, views: 14, comments: 16, stars: 0, isActivated: false, gradient: 'from-yellow-400 to-amber-500' },
  { id: '12', name: '从零开始全流程角色设计', description: '当用户需要设计角色成人物形象，要求设计角色服装风格造型、上传人物色搭图片进...', author: '立冬', authorInitial: 'L', likes: 1, views: 23, comments: 0, stars: 0, isActivated: false, gradient: 'from-fuchsia-400 to-pink-500' },
];

const LEADERBOARD_USERS = [
  { rank: 1, name: '立冬', initial: 'L', color: 'bg-violet-500', likes: 10 },
  { rank: 2, name: 'zhangjiaxi', initial: 'Z', color: 'bg-blue-500', likes: 7 },
  { rank: 3, name: '重威-xxx', initial: 'Z', color: 'bg-emerald-500', likes: 5 },
  { rank: 4, name: '15995253167', initial: '1', color: 'bg-orange-500', likes: 3 },
  { rank: 5, name: 'erpang233', initial: 'E', color: 'bg-pink-500', likes: 3 },
  { rank: 6, name: 'xlexk-xxx', initial: 'X', color: 'bg-cyan-500', likes: 1 },
  { rank: 7, name: 'zx1', initial: 'Z', color: 'bg-indigo-500', likes: 0 },
  { rank: 8, name: 'tongwei', initial: 'T', color: 'bg-teal-500', likes: 0 },
  { rank: 9, name: '白桉_Shan', initial: '白', color: 'bg-rose-500', likes: 0 },
  { rank: 10, name: '皇家骑士KATE.KING', initial: '皇', color: 'bg-amber-500', likes: 0 },
];

type FilterTab = '热门' | '高分' | '上新' | '已激活' | '我上传的';
type LeaderTab = '获奖榜' | '激活榜' | '使用榜';

function SkillCard({ skill, onToggle }: { skill: Skill; onToggle: (id: string) => void }) {
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-xl p-3.5 flex flex-col gap-2.5 hover:border-white/15 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${skill.gradient} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 mt-0.5`}>
          {skill.authorInitial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[13px] font-semibold leading-tight truncate">{skill.name}</p>
          <p className="text-gray-600 text-[11px] mt-0.5">{skill.author}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-500 text-[11px] leading-relaxed line-clamp-2">{skill.description}</p>

      {/* Footer stats + button */}
      <div className="flex items-center gap-3 mt-0.5">
        <div className="flex items-center gap-2.5 flex-1">
          <span className="flex items-center gap-1 text-gray-600 text-[11px]">
            <Heart size={10} />
            {skill.likes}
          </span>
          <span className="flex items-center gap-1 text-gray-600 text-[11px]">
            <Eye size={10} />
            {skill.views}
          </span>
          <span className="flex items-center gap-1 text-gray-600 text-[11px]">
            <MessageCircle size={10} />
            {skill.comments}
          </span>
          <span className="flex items-center gap-1 text-gray-600 text-[11px]">
            <Star size={10} />
            {skill.stars}
          </span>
        </div>
        <button
          onClick={() => onToggle(skill.id)}
          className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all flex-shrink-0 ${
            skill.isActivated
              ? 'bg-white/5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 border border-white/[0.06]'
              : 'bg-white/8 hover:bg-white/15 text-gray-300 border border-white/[0.08]'
          }`}
        >
          {skill.isActivated ? '取消激活' : '激活'}
        </button>
      </div>
    </div>
  );
}

interface Props {
  onBack: () => void;
}

export default function SkillCommunity({ onBack }: Props) {
  const [skills, setSkills] = useState<Skill[]>(MOCK_SKILLS);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('热门');
  const [leaderTab, setLeaderTab] = useState<LeaderTab>('获奖榜');
  const [searchQuery, setSearchQuery] = useState('');

  const filterTabs: FilterTab[] = ['热门', '高分', '上新', '已激活', '我上传的'];

  const handleToggle = (id: string) => {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, isActivated: !s.isActivated } : s));
  };

  const filtered = skills.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.author.toLowerCase().includes(q);
    const matchesFilter =
      activeFilter === '热门' ? true :
      activeFilter === '高分' ? s.stars > 0 || s.likes >= 2 :
      activeFilter === '上新' ? s.id > '9' :
      activeFilter === '已激活' ? s.isActivated :
      activeFilter === '我上传的' ? false : true;
    return matchesSearch && matchesFilter;
  });

  const sorted = [...filtered].sort((a, b) =>
    activeFilter === '高分' ? (b.likes + b.stars) - (a.likes + a.stars) :
    activeFilter === '热门' ? b.views - a.views : 0
  );

  return (
    <div className="w-screen h-screen bg-[#0d0d0d] flex flex-col overflow-hidden">
      {/* Navbar */}
      <header className="flex items-center px-6 md:px-10 pt-4 pb-3 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-200 rounded-lg hover:bg-white/5 transition-colors mr-3"
        >
          <ArrowLeft size={15} />
        </button>
        <h1 className="text-white font-semibold text-[18px] tracking-tight flex-1 text-center">技能社区</h1>
        <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white rounded-xl text-[12px] font-medium transition-all shadow-lg shadow-violet-900/30">
          <Plus size={13} />
          创建我的技能
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex gap-0 px-6 md:px-10 pb-4 pt-2">
        {/* Left: main area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 pr-5">
          {/* Search + filters */}
          <div className="flex-shrink-0 mb-3">
            <div className="relative mb-2.5">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索 Skill..."
                className="w-full bg-[#1a1a1a] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2 text-gray-300 text-[13px] focus:outline-none focus:border-white/15 placeholder:text-gray-600 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {filterTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                    activeFilter === tab
                      ? 'bg-white text-black'
                      : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300 border border-white/[0.05]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <span className="text-2xl select-none">🔍</span>
                <p className="text-gray-600 text-[12px]">没有找到相关技能</p>
              </div>
            ) : (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {sorted.map(skill => (
                  <SkillCard key={skill.id} skill={skill} onToggle={handleToggle} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: leaderboard */}
        <div className="w-[200px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
          <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-3">
            {/* Title */}
            <div className="flex items-center gap-1.5">
              <Trophy size={14} className="text-amber-400" />
              <span className="text-white text-[13px] font-semibold">排行榜</span>
            </div>

            {/* Tabs */}
            <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
              {(['获奖榜', '激活榜', '使用榜'] as LeaderTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setLeaderTab(tab)}
                  className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                    leaderTab === tab ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex flex-col gap-2">
              {LEADERBOARD_USERS.map(user => (
                <div key={user.rank} className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold w-3.5 flex-shrink-0 text-right ${
                    user.rank === 1 ? 'text-amber-400' :
                    user.rank === 2 ? 'text-gray-400' :
                    user.rank === 3 ? 'text-orange-500' : 'text-gray-700'
                  }`}>{user.rank}</span>
                  <div className={`w-5 h-5 rounded-full ${user.color} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                    {user.initial}
                  </div>
                  <span className="flex-1 text-gray-400 text-[11px] truncate">{user.name}</span>
                  <span className="flex items-center gap-0.5 text-gray-600 text-[10px] flex-shrink-0">
                    <Heart size={8} className={user.likes > 0 ? 'text-red-400' : ''} />
                    {user.likes}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
