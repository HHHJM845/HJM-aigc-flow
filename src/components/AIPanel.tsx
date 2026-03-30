import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Library, Users, Minimize2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

const SKILLS = [
  '硅基制片厂',
  '写剧本超快',
  '提示词全能自动优化器',
  '批量统一分镜光影',
];

function WelcomeState({ onSkillClick }: { onSkillClick: (s: string) => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-1 text-center">
        <span className="text-4xl select-none">👋</span>
        <p className="text-gray-400 text-[13px] leading-relaxed">
          你好！输入你的创意，我来帮你完成剧本、分镜、角色设计等工作。
        </p>
      </div>
      <div className="mt-auto space-y-1.5">
        <p className="text-gray-600 text-[11px] mb-2 tracking-wide">试一下创意SKILL：</p>
        {SKILLS.map(skill => (
          <button
            key={skill}
            onClick={() => onSkillClick(skill)}
            className="w-full text-left px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] rounded-xl text-gray-300 text-[12px] transition-colors"
          >
            {skill}
          </button>
        ))}
        <div className="flex items-center gap-5 pt-2">
          <button className="flex items-center gap-1.5 text-gray-600 hover:text-gray-400 text-[11px] transition-colors">
            <Library size={11} />技能库
          </button>
          <button className="flex items-center gap-1.5 text-gray-600 hover:text-gray-400 text-[11px] transition-colors">
            <Users size={11} />技能社区
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={11} className="text-white" />
        </div>
      )}
      <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
        isUser ? 'bg-white/10 text-gray-200 rounded-tr-sm' : 'bg-white/[0.05] text-gray-300 rounded-tl-sm'
      }`}>
        {msg.loading ? (
          <span className="flex gap-1 items-center h-4">
            <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : msg.content}
      </div>
    </div>
  );
}

export default function AIPanel() {
  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', loading: true }]);
    setInput('');
    setLoading(true);
    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          systemPrompt: '你是专业的AI影视创作助手，帮助用户完成剧本创作、分镜设计、角色设计、提示词优化等工作。回答简洁专业，中文回复。',
        }),
      });
      const { content } = await res.json() as { content: string };
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: content || '出现了一些问题，请稍后再试。' }]);
    } catch {
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: '网络错误，请稍后再试。' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  // ── 折叠态：圆形 logo 悬浮在缩小按钮的位置（右上角） ──
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        title="打开 AI 助手"
        className="fixed right-[22px] top-[22px] z-50 w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles size={15} className="text-white" />
      </button>
    );
  }

  // ── 展开态：悬浮卡片，四边留边，圆角 ──
  return (
    <div
      className="fixed z-40 flex flex-col bg-[#141414] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
      style={{ right: 16, top: 16, bottom: 16, width: 268 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] rounded-lg bg-gradient-to-br from-violet-500 via-pink-500 to-orange-400 flex items-center justify-center">
            <Sparkles size={11} className="text-white" />
          </div>
          <span className="text-white text-[13px] font-semibold tracking-tight">updream</span>
        </div>
        {/* 仅一个缩小按钮 */}
        <button
          onClick={() => setExpanded(false)}
          title="缩小"
          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-200 rounded-lg hover:bg-white/8 transition-colors"
        >
          <Minimize2 size={13} />
        </button>
      </div>

      {/* Messages / Welcome */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {messages.length === 0 ? (
          <WelcomeState onSkillClick={s => { setInput(s); textareaRef.current?.focus(); }} />
        ) : (
          <>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1 flex-shrink-0">
        <div className="bg-[#1e1e1e] border border-white/[0.07] rounded-2xl px-3 pt-3 pb-2 flex flex-col gap-2 focus-within:border-white/15 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的创意或请求，可拖拽/粘贴图片..."
            className="w-full bg-transparent text-gray-200 text-[12px] leading-relaxed resize-none focus:outline-none placeholder:text-gray-600 min-h-[38px] max-h-[100px]"
          />
          <div className="flex items-center justify-between">
            <button className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-400 rounded-lg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>
              </svg>
            </button>
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-30"
            >
              <Send size={12} className="text-gray-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
