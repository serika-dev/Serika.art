'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { Shield, Search, Edit2, Save, X, Loader2, Crown, User as UserIcon } from 'lucide-react';
import axios from 'axios';
import Link from 'next/link';

interface User {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  rank: 'user' | 'moderator' | 'admin' | 'owner';
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingRank, setEditingRank] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || (user.rank !== 'admin' && user.rank !== 'owner'))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchUsers();
  }, [searchQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/admin/users?q=${searchQuery}`);
      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (user: User) => {
    setEditingUser(user._id);
    setEditingRank(user.rank);
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setEditingRank('');
  };

  const saveUser = async (userId: string) => {
    setSaving(true);
    try {
      const response = await axios.patch(`/api/admin/users/${userId}`, {
        rank: editingRank,
      });
      
      if (response.data.success) {
        setUsers(users.map(u => u._id === userId ? { ...u, rank: editingRank as any } : u));
        setEditingUser(null);
      } else {
        alert(response.data.error || 'Failed to update user');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user || (user.rank !== 'admin' && user.rank !== 'owner')) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  const rankColors = {
    user: 'bg-zinc-700 text-zinc-300',
    moderator: 'bg-blue-600 text-white',
    admin: 'bg-red-600 text-white',
    owner: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="text-red-500" size={36} />
            <div>
              <h1 className="text-4xl font-bold text-white">Admin Panel</h1>
              <p className="text-zinc-400">Manage users and tags</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/tags"
              className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition"
            >
              Manage Tags
            </Link>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by username or email..."
            className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-950 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Rank</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Joined</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-blue-500 mx-auto" size={32} />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-zinc-800/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.username} className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                            {u.username[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-white font-medium">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-zinc-400">{u.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      {editingUser === u._id ? (
                        <select
                          value={editingRank}
                          onChange={(e) => setEditingRank(e.target.value)}
                          className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                          disabled={u.rank === 'owner'}
                        >
                          <option value="user">User</option>
                          <option value="moderator">Moderator</option>
                          {user.rank === 'owner' && <option value="admin">Admin</option>}
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${rankColors[u.rank]} flex items-center gap-1 w-fit`}>
                          {u.rank === 'owner' && <Crown size={12} />}
                          {u.rank !== 'owner' && u.rank !== 'user' && <Shield size={12} />}
                          {u.rank.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-zinc-400 text-sm">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.rank === 'owner' ? (
                        <span className="text-zinc-600 text-sm">Protected</span>
                      ) : editingUser === u._id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveUser(u._id)}
                            disabled={saving}
                            className="p-2 text-green-400 hover:text-green-300 hover:bg-zinc-800 rounded transition disabled:opacity-50"
                            title="Save"
                          >
                            <Save size={18} />
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={saving}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-zinc-800 rounded transition disabled:opacity-50"
                            title="Cancel"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(u)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-zinc-800 rounded transition"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
