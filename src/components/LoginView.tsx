import React, { useState } from 'react';
import loginBgVideo from '../assets/login-bg.mp4';

interface Props {
  onLogin: (username: string, role: string) => void;
}

export default function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入账号和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json() as { token?: string; username?: string; role?: string; error?: string };
      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }
      sessionStorage.setItem('token', data.token!);
      sessionStorage.setItem('role', data.role!);
      onLogin(data.username!, data.role!);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-black">

      {/* 左侧 — 全幅视频 */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          style={{ willChange: 'transform', transform: 'translateZ(0)' }}
          src={loginBgVideo}
        />
      </div>

      {/* 右侧 — 表单区 */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center overflow-hidden">
        {/* 背景：同一视频模糊压暗 */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-50 blur-xl"
          style={{ willChange: 'transform', transform: 'translateZ(0)' }}
          src={loginBgVideo}
        />
        <div className="absolute inset-0 bg-black/20" />

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
              disabled={loading}
              className="w-full rounded-md bg-black py-3.5 text-sm font-semibold text-white hover:bg-black/80 active:scale-[0.98] transition-all border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Inter' }}
            >
              {loading ? '登录中...' : '登录'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
