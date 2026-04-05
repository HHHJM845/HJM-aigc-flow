import React, { useState } from 'react';
import { Instagram, Facebook, Twitter } from 'lucide-react';
import loginBg from '../assets/login-bg.jpg';

interface Props {
  onLogin: () => void;
}

export default function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    // Simple gate — any non-empty credentials pass
    onLogin();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a]">
      <img
        src={loginBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-60"
        style={{ animation: 'loginBgZoom 20s ease-in-out infinite alternate' }}
      />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-8 px-6 lg:flex-row lg:items-stretch lg:gap-12">

        {/* 左侧 - 欢迎 */}
        <div className="flex flex-1 flex-col justify-center py-12">
          <div className="mb-10">
            <svg width="40" height="40" viewBox="0 0 40 40" className="text-white">
              <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 20 C12 14, 20 10, 26 16 C30 20, 24 28, 18 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="mb-4 text-6xl md:text-7xl tracking-wider text-white" style={{ fontFamily: '"Bebas Neue", sans-serif' }}>
            欢迎 !
          </h1>
          <p className="mb-10 max-w-xs text-sm leading-relaxed text-white/60" style={{ fontFamily: 'Inter' }}>
            加入我们，快速便捷地管理您的工作。
          </p>

          <button className="w-fit rounded-full bg-white/20 px-8 py-3 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/30" style={{ fontFamily: 'Inter' }}>
            了解更多
          </button>

          <div className="mt-auto flex gap-6 pt-16">
            <a href="#" className="text-white/40 transition-colors hover:text-white"><Instagram size={20} /></a>
            <a href="#" className="text-white/40 transition-colors hover:text-white"><Facebook size={20} /></a>
            <a href="#" className="text-white/40 transition-colors hover:text-white"><Twitter size={20} /></a>
          </div>
        </div>

        {/* 右侧 - 登录表单 */}
        <div className="w-full max-w-md rounded-2xl border border-white/10 p-10 backdrop-blur-xl" style={{ background: 'rgba(26,26,26,0.6)' }}>
          <h2 className="mb-10 text-center text-3xl tracking-wide text-white" style={{ fontFamily: '"Bebas Neue", sans-serif' }}>
            登录
          </h2>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="mb-2 block text-xs text-white/50" style={{ fontFamily: 'Inter' }}>用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                placeholder="请输入用户名"
                style={{ fontFamily: 'Inter' }}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs text-white/50" style={{ fontFamily: 'Inter' }}>密码</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                placeholder="••••••••••••"
                style={{ fontFamily: 'Inter' }}
              />
            </div>

            {error && (
              <p className="text-center text-xs text-red-400" style={{ fontFamily: 'Inter' }}>{error}</p>
            )}

            <div className="pt-4 text-center">
              <button
                type="submit"
                className="rounded-full border border-white/10 bg-white/10 px-10 py-3 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
                style={{ fontFamily: 'Inter' }}
              >
                提交
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
