import React, { useState } from 'react';
import loginBg from '../assets/login-bg.jpg';

interface Props {
  onLogin: (username: string) => void;
}

export default function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入账号和密码');
      return;
    }
    onLogin(username.trim());
  };

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-black">

      {/* 左侧 — 全幅大图 */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src={loginBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ animation: 'loginBgZoom 20s ease-in-out infinite alternate' }}
        />
      </div>

      {/* 右侧 — 表单区 */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center overflow-hidden">
        {/* 背景：同一张图但模糊压暗 */}
        <img
          src={loginBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30 blur-2xl scale-110"
        />
        <div className="absolute inset-0 bg-black/30" />

        {/* 表单内容 */}
        <div className="relative z-10 w-full max-w-sm px-8 py-12">
          {/* 标题 */}
          <h1
            className="mb-2 text-4xl font-light tracking-wide text-white"
            style={{ fontFamily: 'Manrope' }}
          >
            欢迎回来
          </h1>
          <p className="mb-10 text-sm text-white/50" style={{ fontFamily: 'Inter' }}>
            请输入您的详细信息。
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 用户名 */}
            <div>
              <label className="mb-3 block text-sm text-white/80" style={{ fontFamily: 'Inter' }}>
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="请输入您的用户名"
                className="w-full border-0 border-b border-white/25 bg-transparent pb-2 text-sm text-white placeholder:text-white/25 focus:border-white/60 focus:outline-none transition-colors"
                style={{ fontFamily: 'Inter' }}
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="mb-3 block text-sm text-white/80" style={{ fontFamily: 'Inter' }}>
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                className="w-full border-0 border-b border-white/25 bg-transparent pb-2 text-sm text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none transition-colors"
                style={{ fontFamily: 'Inter' }}
              />
            </div>

            {/* 记住我 + 忘记密码 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded-none border border-white/30 bg-transparent accent-white"
                />
                <span className="text-xs text-white/60" style={{ fontFamily: 'Inter' }}>记住我</span>
              </label>
              <button
                type="button"
                className="text-xs text-white/60 hover:text-white transition-colors"
                style={{ fontFamily: 'Inter' }}
              >
                忘记密码了？
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-400" style={{ fontFamily: 'Inter' }}>{error}</p>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              className="w-full rounded-md bg-black py-3.5 text-sm font-semibold text-white hover:bg-black/80 active:scale-[0.98] transition-all border border-white/10"
              style={{ fontFamily: 'Inter' }}
            >
              登录
            </button>

            {/* 注册提示 */}
            <p className="text-center text-xs text-white/40" style={{ fontFamily: 'Inter' }}>
              还没有账号？{' '}
              <button type="button" className="font-semibold text-white/70 hover:text-white transition-colors">
                在此注册
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
