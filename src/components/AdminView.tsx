// src/components/AdminView.tsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, Plus, Loader2 } from 'lucide-react';

interface UserItem {
  id: string;
  username: string;
  role: string;
  created_at: number;
}

interface Props {
  currentUsername: string;
  onBack: () => void;
}

export default function AdminView({ currentUsername, onBack }: Props) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const token = sessionStorage.getItem('token') || '';

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { users?: UserItem[]; error?: string };
      if (!res.ok) { setError(data.error || '加载失败'); return; }
      setUsers(data.users!);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      setCreateError('请填写用户名和密码');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setCreateError(data.error || '创建失败'); return; }
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      fetchUsers();
    } catch {
      setCreateError('网络错误');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`确定删除用户「${username}」吗？`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        alert(data.error || '删除失败');
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch {
      alert('网络错误');
    }
  };

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white"
      style={{ fontFamily: 'Inter' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-5 border-b border-white/[0.08]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <span className="text-white/20">|</span>
        <h1 className="text-sm font-semibold text-white">用户管理</h1>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-10 space-y-10">

        {/* Create user form */}
        <section>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">新建用户</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="用户名"
                value={newUsername}
                onChange={e => { setNewUsername(e.target.value); setCreateError(''); }}
                className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
              />
              <input
                type="password"
                placeholder="密码"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setCreateError(''); }}
                className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
              />
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'user' | 'admin')}
                className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
              >
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              创建用户
            </button>
          </form>
        </section>

        {/* User list */}
        <section>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">所有用户</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-white/40">
              <Loader2 size={14} className="animate-spin" /> 加载中...
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : (
            <div className="space-y-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#141414] border border-white/[0.06]"
                >
                  <div>
                    <span className="text-sm text-white">{user.username}</span>
                    <span className={`ml-3 text-xs px-2 py-0.5 rounded-full ${
                      user.role === 'admin'
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'bg-white/[0.06] text-white/40'
                    }`}>
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </div>
                  {user.username !== currentUsername && (
                    <button
                      onClick={() => handleDelete(user.id, user.username)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="删除用户"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-white/30">暂无用户</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
