import React, { useState, useRef, useEffect } from 'react';
import { Check, Pencil, ArrowUp } from 'lucide-react';

export default function CommentNode({ id, data }: { id: string; data: any }) {
  const [isHovered, setIsHovered] = useState(false);
  const [submittedText, setSubmittedText] = useState(data.text || '');
  const [isSubmitted, setIsSubmitted] = useState(!!data.text);
  const [isEditing, setIsEditing] = useState(false);
  const [timeAgo, setTimeAgo] = useState('just now');
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 非受控 ref，避免受控 value 在 IME 输入中文时打断输入法状态
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editKey = useRef(0); // 切换编辑态时强制重挂载 textarea

  useEffect(() => {
    if (!data.createdAt) return;
    const update = () => {
      const s = Math.floor((Date.now() - data.createdAt) / 1000);
      if (s < 60) setTimeAgo(`${s} seconds ago`);
      else if (s < 3600) setTimeAgo(`${Math.floor(s / 60)} minutes ago`);
      else setTimeAgo(`${Math.floor(s / 3600)} hours ago`);
    };
    update();
    const t = setInterval(update, 15000);
    return () => clearInterval(t);
  }, [data.createdAt]);

  const enter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setIsHovered(true);
  };

  // 延长到 500ms，避免鼠标经过间距时误收起
  const leave = () => {
    hoverTimer.current = setTimeout(() => setIsHovered(false), 500);
  };

  const handleSubmit = () => {
    const text = textareaRef.current?.value?.trim() || '';
    if (!text) return;
    const now = Date.now();
    data.onUpdate?.(id, { text, createdAt: now });
    setSubmittedText(text);
    setIsSubmitted(true);
    setIsEditing(false);
    setTimeAgo('just now');
  };

  const handleResolve = () => data.onDelete?.(id);

  const handleEdit = () => {
    editKey.current += 1; // 强制 textarea 重挂载，defaultValue 生效
    setIsEditing(true);
    setIsSubmitted(false);
    setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const showExpanded = isHovered;
  const showInput = showExpanded && (!isSubmitted || isEditing);
  const showComment = showExpanded && isSubmitted && !isEditing;

  // 统一事件处理，传给所有浮层元素
  const hoverProps = { onMouseEnter: enter, onMouseLeave: leave };
  const stopAll = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      className="relative"
      style={{ width: 36, height: 36, overflow: 'visible' }}
      {...hoverProps}
    >
      {showExpanded && (
        <>
          {/*
           * 透明桥接层：填充头像顶部与卡片底部之间的间距，
           * 保证鼠标移动时始终在 hover 区域内，不触发 onMouseLeave
           */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-9"
            style={{ bottom: '100%', height: 10 }}
            {...hoverProps}
          />

          {/* 展开卡片 */}
          <div
            className="absolute nodrag"
            style={{
              bottom: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
            }}
            {...hoverProps}
            onMouseDown={stopAll}
            onClick={stopAll}
          >
            {/* 输入态 */}
            {showInput && (
              <div className="w-[280px] bg-[#1c1c1e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
                <textarea
                  key={editKey.current}
                  ref={textareaRef}
                  defaultValue={isEditing ? submittedText : ''}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  onKeyUp={stopAll}
                  onMouseDown={stopAll}
                  onClick={stopAll}
                  placeholder="Leave a comment"
                  autoFocus
                  className="w-full bg-transparent text-white text-sm leading-relaxed resize-none focus:outline-none px-4 pt-4 pb-2 min-h-[80px] placeholder-gray-600"
                  style={{ fontFamily: 'inherit' }}
                />
                <div className="flex justify-end px-3 pb-3">
                  <button
                    onMouseDown={stopAll}
                    onClick={e => { stopAll(e); handleSubmit(); }}
                    disabled={false}
                    className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp size={15} className="text-black" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}

            {/* 已发布态 */}
            {showComment && (
              <div className="relative">
                {/* 操作按钮 */}
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[#2a2a2e] border border-white/10 rounded-full px-1.5 py-1 shadow-xl">
                  <button
                    onMouseDown={stopAll}
                    onClick={e => { stopAll(e); handleResolve(); }}
                    title="标记为已解决"
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-green-400 rounded-full hover:bg-white/5 transition-colors"
                  >
                    <Check size={13} strokeWidth={2.5} />
                  </button>
                  <button
                    onMouseDown={stopAll}
                    onClick={e => { stopAll(e); handleEdit(); }}
                    title="编辑评论"
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                  >
                    <Pencil size={12} strokeWidth={2} />
                  </button>
                </div>

                {/* 评论内容卡片 */}
                <div className="w-[280px] bg-[#1c1c1e] rounded-2xl shadow-2xl border border-white/10 p-4">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
                      {data.authorInitials || '少军'}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-xs font-semibold">{data.author || '少军 黄'}</span>
                      <span className="text-gray-500 text-[11px]">{timeAgo}</span>
                    </div>
                  </div>
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{submittedText}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 头像圆点 */}
      <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-lg cursor-pointer select-none border-2 border-white/20 hover:scale-110 transition-transform">
        {data.authorInitials || '少军'}
      </div>
    </div>
  );
}
