'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { Shield, Search, Edit2, Save, X, Loader2 } from 'lucide-react';
import axios from 'axios';

interface Tag {
  _id: string;
  name: string;
  type: 'general' | 'artist' | 'character' | 'copyright' | 'meta';
  count: number;
}

export default function AdminTagsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || (user.rank !== 'admin' && user.rank !== 'owner'))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchTags();
  }, [searchQuery]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/tags?q=${searchQuery}&limit=100`);
      if (response.data.success) {
        setTags(response.data.tags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (tag: Tag) => {
    setEditingTag(tag.name);
    setEditingType(tag.type);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setEditingType('');
  };

  const saveTag = async (tagName: string) => {
    setSaving(true);
    try {
      const response = await axios.patch(`/api/tags/${encodeURIComponent(tagName)}`, {
        type: editingType,
      });
      
      if (response.data.success) {
        setTags(tags.map(t => t.name === tagName ? { ...t, type: editingType as any } : t));
        setEditingTag(null);
      } else {
        alert(response.data.error || 'Failed to update tag');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update tag');
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

  const typeColors = {
    artist: 'bg-red-500/10 border-red-500/20 text-red-400',
    copyright: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    character: 'bg-green-500/10 border-green-500/20 text-green-400',
    general: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    meta: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="text-red-500" size={36} />
          <h1 className="text-4xl font-bold text-white">Tag Management</h1>
        </div>
        <p className="text-zinc-400">Manage tag types and categories (Admin+)</p>
      </div>

      {/* Search */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tags Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-950 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Tag Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Usage Count</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-blue-500 mx-auto" size={32} />
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    No tags found
                  </td>
                </tr>
              ) : (
                tags.map((tag) => (
                  <tr key={tag.name} className="hover:bg-zinc-800/50 transition">
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">{tag.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      {editingTag === tag.name ? (
                        <select
                          value={editingType}
                          onChange={(e) => setEditingType(e.target.value)}
                          className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                        >
                          <option value="general">General</option>
                          <option value="artist">Artist</option>
                          <option value="character">Character</option>
                          <option value="copyright">Copyright</option>
                          <option value="meta">Meta</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${typeColors[tag.type]}`}>
                          {tag.type}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-zinc-400">{tag.count.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      {editingTag === tag.name ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveTag(tag.name)}
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
                          onClick={() => startEditing(tag)}
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
