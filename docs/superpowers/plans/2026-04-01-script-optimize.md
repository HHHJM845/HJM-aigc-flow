# AI 剧本优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "✨ AI 优化" button to BreakdownView that opens a multi-turn chat modal — AI asks clarifying questions, then generates an optimized script and shows a diff preview for user confirmation before writing back to the editor.

**Architecture:** New `ScriptOptimizeModal` component handles all chat state, API calls, and diff rendering. `BreakdownView` only needs a boolean state and renders the modal. Helper functions `extractOptimizedScript` and `computeDiff` live inside the modal file.

**Tech Stack:** React + TypeScript, Tailwind CSS, `/api/chat` endpoint (already exists), lucide-react icons

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/ScriptOptimizeModal.tsx` | **Create** | Full modal: chat UI, API calls, diff preview, confirm/cancel |
| `src/components/BreakdownView.tsx` | **Modify** | Add `showOptimizeModal` state, AI 优化 button, render modal |

---

### Task 1: Create ScriptOptimizeModal

**Files:**
- Create: `src/components/ScriptOptimizeModal.tsx`

- [ ] **Step 1: Create the file with types and helper functions**

Create `src/components/ScriptOptimizeModal.tsx` with the following content:

```tsx
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
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [optimizedScript, setOptimizedScript] = useState('');
  const [diffChunks, setDiffChunks] = useState<DiffChunk[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // On mount: kick off first AI question
  useEffect(() => {
    const initial: ApiMessage[] = [
      { role: 'user', content: `以下是我的剧本：\n\n${scriptText}` },
    ];
    setApiMessages(initial);
    askAI(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function askAI(currentApiMessages: ApiMessage[]) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentApiMessages, systemPrompt: SYSTEM_PROMPT }),
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
        setApiMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);
        setApiMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'error', content: err.message || '请求失败，请重试' }]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSend = () => {
    const text = userInput.trim();
    if (!text || isLoading || phase !== 'questioning') return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setUserInput('');
    const next: ApiMessage[] = [...apiMessages, { role: 'user', content: text }];
    setApiMessages(next);
    askAI(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const changedCount = Math.floor(diffChunks.filter(c => c.type !== 'unchanged').length / 2);

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
          <div ref={messagesEndRef} />
        </div>

        {/* Diff preview — only shown in preview phase */}
        {phase === 'preview' && (
          <div className="border-t border-white/[0.06] flex-shrink-0">
            <div className="px-4 py-2 bg-white/[0.03] flex items-center gap-2">
              <span className="text-xs text-gray-400">修改预览</span>
              {changedCount > 0 && (
                <span className="text-xs text-gray-500">· {changedCount} 处段落有变动</span>
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd C:\Users\oldch\Desktop\HJM-aigc-flow-main && npx tsc --noEmit 2>&1`

Expected: No errors relating to `ScriptOptimizeModal.tsx`. If there are errors about missing types, check that `lucide-react` exports `Send` (it does since v0.263).

- [ ] **Step 3: Commit**

```bash
git add src/components/ScriptOptimizeModal.tsx
git commit -m "feat: add ScriptOptimizeModal with multi-turn chat and diff preview"
```

---

### Task 2: Wire ScriptOptimizeModal into BreakdownView

**Files:**
- Modify: `src/components/BreakdownView.tsx` (lines 1-13 for imports, line 103 area for state, lines 216-235 for button, line 391 area for modal render)

- [ ] **Step 1: Add import at the top of BreakdownView.tsx**

In `src/components/BreakdownView.tsx`, the current import on line 10 is:
```tsx
import {
  Sparkles, Plus, X, GripVertical, ArrowRight, Loader2, Upload, FileText, ChevronDown,
} from 'lucide-react';
```

Change it to:
```tsx
import {
  Sparkles, Plus, X, GripVertical, ArrowRight, Loader2, Upload, FileText, ChevronDown, Wand2,
} from 'lucide-react';
```

Then add after line 13 (after the diff imports):
```tsx
import ScriptOptimizeModal from './ScriptOptimizeModal';
```

- [ ] **Step 2: Add showOptimizeModal state**

In `src/components/BreakdownView.tsx`, after line 103:
```tsx
const [isRatioOpen, setIsRatioOpen] = useState(false);
```

Add:
```tsx
const [showOptimizeModal, setShowOptimizeModal] = useState(false);
```

- [ ] **Step 3: Add the AI 优化 button in the left header**

In `src/components/BreakdownView.tsx`, the left header button area currently ends at line 234:
```tsx
            {isFirstBreakdown && (
              <button
                onClick={handleFirstBreakdown}
                disabled={!scriptText.trim() || isBreaking}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isBreaking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isBreaking ? 'AI 拆解中...' : '✨ AI 拆解'}
              </button>
            )}
```

Replace that block with:
```tsx
            {isFirstBreakdown && (
              <button
                onClick={handleFirstBreakdown}
                disabled={!scriptText.trim() || isBreaking}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isBreaking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isBreaking ? 'AI 拆解中...' : '✨ AI 拆解'}
              </button>
            )}
            <button
              onClick={() => setShowOptimizeModal(true)}
              disabled={!scriptText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-purple-300 rounded-lg text-xs transition-colors border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Wand2 size={12} />
              AI 优化
            </button>
```

- [ ] **Step 4: Render the modal at the bottom of the component's return**

In `src/components/BreakdownView.tsx`, the return statement closes at line 391 with:
```tsx
    </div>
  );
}
```

Change to:
```tsx
      {showOptimizeModal && (
        <ScriptOptimizeModal
          scriptText={scriptText}
          onApply={(optimized) => {
            setScriptText(optimized);
            setShowOptimizeModal(false);
          }}
          onClose={() => setShowOptimizeModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1`

Expected: Zero errors. If `Wand2` is not found in your lucide-react version, replace with `Sparkles` (already imported) and adjust the import line accordingly.

- [ ] **Step 6: Run dev build to confirm no runtime errors**

Run: `npm run build 2>&1 | tail -20`

Expected: `✓ built in X.XXs` with no TypeScript errors. Chunk size warning is acceptable.

- [ ] **Step 7: Commit**

```bash
git add src/components/BreakdownView.tsx
git commit -m "feat: wire ScriptOptimizeModal into BreakdownView"
```

---

### Task 3: Deploy to Server

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Deploy to server via SSH**

Create a file `deploy_run.cjs` at project root with:

```js
const { Client } = require('./node_modules/ssh2');
const conn = new Client();
const cmd = `cd /home/HJM-aigc-flow && git pull origin main && npm install && npm run build && pm2 restart aigc-flow && pm2 list`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.on('error', e => console.error(e.message));
conn.connect({ host: '218.244.158.35', port: 22, username: 'root', password: 'Huang_21254875', readyTimeout: 30000, keepaliveInterval: 10000 });
```

Run: `node deploy_run.cjs`

Expected: `pm2 restart aigc-flow` succeeds, process shows `online`.

- [ ] **Step 3: Clean up deploy script**

```bash
rm deploy_run.cjs
```

---

## Manual Smoke Test Checklist

After deployment, open `http://218.244.158.35:3001` and go to the **拆解** tab:

1. **Button disabled state**: With empty script editor, "AI 优化" button should be greyed out and unclickable.
2. **Button enabled**: Paste any text → button becomes clickable.
3. **Modal opens**: Click "AI 优化" → modal appears with loading spinner immediately (first AI question loading).
4. **First question appears**: AI asks first question in grey bubble on the left.
5. **User can reply**: Type in textarea, press Ctrl+Enter or click send icon → user message appears right-aligned in blue.
6. **Multi-turn**: AI asks 3-5 questions total before producing the optimized script.
7. **Preview appears**: After AI finishes questioning, diff preview section appears below the chat. Changed paragraphs shown (red strikethrough = original, green = new).
8. **Cancel**: Click "取消" → modal closes, script unchanged.
9. **Confirm apply**: Click "✓ 确认应用" → modal closes, script editor now shows optimized text.
10. **Re-breakdown prompt**: If rows already exist, yellow diff bar should appear in BreakdownView indicating changes detected.
11. **API error**: Stop the server temporarily, try sending a message → error bubble appears in red, user can retry after server restores.
