import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';

interface ScriptOptimizeModalProps {
  scriptText: string;
  onApply: (optimized: string) => void;
  onClose: () => void;
}

interface ChatMessage {
  role: 'ai' | 'user' | 'error';
  content: string;
}

interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DiffChunk {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

type Phase = 'questioning' | 'preview';

const SYSTEM_PROMPT = `你是一位专业的影视剧本编辑，正在帮助用户优化剧本。

请按以下流程进行：
1. 通过多轮提问（3-5轮）了解用户需求，每轮只问一个问题，问题要简洁具体。
   参考问题方向：目标受众、整体风格（严肃/轻松/悬疑等）、节奏偏好、重点想加强的部分、是否有不想改动的内容。
2. 收集到足够信息后，输出优化后的完整剧本，格式如下：

[OPTIMIZED_SCRIPT_START]
（优化后的完整剧本内容）
[OPTIMIZED_SCRIPT_END]

注意事项：
- 不要在标记外附加任何额外说明
- 保持剧本整体结构，只优化表达方式和内容质量
- 输出完整剧本，不要省略任何部分`;

function extractOptimizedScript(response: string): string | null {
  const start = response.indexOf('[OPTIMIZED_SCRIPT_START]');
  const end = response.indexOf('[OPTIMIZED_SCRIPT_END]');
  if (start === -1 || end === -1) return null;
  return response.slice(start + '[OPTIMIZED_SCRIPT_START]'.length, end).trim();
}

// Note: positional diff — compares paragraphs by index.
// Works well when AI preserves paragraph order; may show false changes if AI reorders content.
function computeDiff(original: string, optimized: string): DiffChunk[] {
  const origParas = original.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const optParas = optimized.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: DiffChunk[] = [];
  const maxLen = Math.max(origParas.length, optParas.length);
  for (let i = 0; i < maxLen; i++) {
    const o = origParas[i];
    const n = optParas[i];
    if (o === n) {
      chunks.push({ type: 'unchanged', text: o });
    } else {
      if (o) chunks.push({ type: 'removed', text: o });
      if (n) chunks.push({ type: 'added', text: n });
    }
  }
  return chunks;
}

export default function ScriptOptimizeModal({ scriptText, onApply, onClose }: ScriptOptimizeModalProps) {
  const [phase, setPhase] = useState<Phase>('questioning');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const apiMessagesRef = useRef<ApiMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [optimizedScript, setOptimizedScript] = useState('');
  const [diffChunks, setDiffChunks] = useState<DiffChunk[]>([]);
  const [initialFailed, setInitialFailed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Abort any inflight fetch on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // On mount: kick off first AI question
  useEffect(() => {
    const initial: ApiMessage[] = [
      { role: 'user', content: `以下是我的剧本：\n\n${scriptText}` },
    ];
    apiMessagesRef.current = initial;
    askAI(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function askAI(currentApiMessages: ApiMessage[]) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentApiMessages, systemPrompt: SYSTEM_PROMPT }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const data = await res.json();
      const aiContent: string = data.content;

      const optimized = extractOptimizedScript(aiContent);
      if (optimized) {
        setOptimizedScript(optimized);
        setDiffChunks(computeDiff(scriptText, optimized));
        setPhase('preview');
        setMessages(prev => [...prev, { role: 'ai', content: '分析完成，请查看下方的修改预览。' }]);
        apiMessagesRef.current = [...apiMessagesRef.current, { role: 'assistant', content: aiContent }];
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);
        apiMessagesRef.current = [...apiMessagesRef.current, { role: 'assistant', content: aiContent }];
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : '请求失败，请重试';
      setMessages(prev => {
        const wasEmpty = prev.length === 0;
        if (wasEmpty) setInitialFailed(true);
        return [...prev, { role: 'error', content: message }];
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleSend = () => {
    const text = userInput.trim();
    if (!text || isLoading || phase !== 'questioning') return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setUserInput('');
    const next: ApiMessage[] = [...apiMessagesRef.current, { role: 'user', content: text }];
    apiMessagesRef.current = next;
    askAI(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const changedCount = diffChunks.filter(c => c.type !== 'unchanged').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 h-[80vh] bg-[#111] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-purple-400" />
            <span className="text-white font-medium text-sm">AI 优化剧本</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.role === 'error'
                  ? 'bg-red-900/40 text-red-300 border border-red-500/20'
                  : 'bg-white/[0.07] text-gray-200'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/[0.07] px-3 py-2 rounded-xl">
                <Loader2 size={14} className="animate-spin text-gray-400" />
              </div>
            </div>
          )}
          {initialFailed && messages.filter(m => m.role !== 'error').length === 0 && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => {
                  setInitialFailed(false);
                  setMessages([]);
                  askAI(apiMessagesRef.current);
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-xs transition-colors"
              >
                重新开始
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Diff preview — only shown in preview phase */}
        {phase === 'preview' && (
          <div className="border-t border-white/[0.06] flex-shrink-0">
            <div className="px-4 py-2 bg-white/[0.03] flex items-center gap-2">
              <span className="text-xs text-gray-400">修改预览</span>
              {changedCount > 0 && (
                <span className="text-xs text-gray-500">· {changedCount} 处变动</span>
              )}
            </div>
            <div className="overflow-y-auto max-h-48 px-4 py-2 space-y-1.5">
              {diffChunks.filter(c => c.type !== 'unchanged').length === 0 ? (
                <p className="text-xs text-gray-500 py-2">内容无明显变动</p>
              ) : (
                diffChunks
                  .filter(c => c.type !== 'unchanged')
                  .map((chunk, i) => (
                    <p
                      key={i}
                      className={`text-sm rounded px-2 py-1.5 leading-relaxed ${
                        chunk.type === 'removed'
                          ? 'bg-red-950/50 text-red-300 line-through'
                          : 'bg-green-950/50 text-green-300'
                      }`}
                    >
                      {chunk.text}
                    </p>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Input area (questioning) or action buttons (preview) */}
        {phase === 'questioning' ? (
          <div className="border-t border-white/[0.06] p-3 flex-shrink-0 flex gap-2">
            <textarea
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={3}
              placeholder="输入你的回答... (Ctrl+Enter 发送)"
              className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-600 px-3 py-2 resize-none focus:outline-none focus:border-white/20 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!userInput.trim() || isLoading}
              className="self-end p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        ) : (
          <div className="border-t border-white/[0.06] px-4 py-3 flex justify-end gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-gray-400 hover:text-gray-200 text-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => onApply(optimizedScript)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
            >
              ✓ 确认应用
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
