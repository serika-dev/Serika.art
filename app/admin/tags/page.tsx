'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { Shield, Search, Edit2, Save, X, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Wand2 } from 'lucide-react';
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
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState('count');
  const [perPage, setPerPage] = useState(50);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [backfill, setBackfill] = useState<{ configured: boolean; enabled: boolean; cursor: number; maxImageId: number; processed: number; tagsAdded: number } | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || (user.rank !== 'admin' && user.rank !== 'owner'))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Debounce the search box; a new search or filter starts at page 1
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, typeFilter, sort, perPage]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    if (user && (user.rank === 'admin' || user.rank === 'owner')) fetchTags();
  }, [user, debouncedQuery, typeFilter, sort, perPage, page]);

  useEffect(() => {
    if (!user || (user.rank !== 'admin' && user.rank !== 'owner')) return;
    const load = () => axios.get('/api/admin/autotag').then((r) => r.data.success && setBackfill(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/admin/tags', {
        params: { q: debouncedQuery || undefined, type: typeFilter || undefined, sort, limit: perPage, page },
      });
      if (response.data.success) {
        setTags(response.data.tags);
        setTotal(response.data.pagination.total);
        setPages(response.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (n: number) => setPage(Math.min(Math.max(1, Math.floor(n) || 1), pages));

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

      {/* Backfill progress */}
      {backfill?.configured && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-semibold text-white">
            <Wand2 size={16} className="text-purple-400" /> Autotag backfill
          </span>
          <span className="text-zinc-400">
            {backfill.enabled ? 'Running' : 'Off (set AUTOTAG_BACKFILL=true)'}
          </span>
          <span className="text-zinc-400">Posts checked: <span className="text-white tabular-nums">{backfill.processed.toLocaleString()}</span></span>
          <span className="text-zinc-400">Tags added: <span className="text-white tabular-nums">{backfill.tagsAdded.toLocaleString()}</span></span>
          <span className="text-zinc-400">
            Progress: <span className="text-white tabular-nums">
              {backfill.maxImageId ? Math.min(100, (backfill.cursor / backfill.maxImageId) * 100).toFixed(1) : '0'}%
            </span>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-3 text-white text-sm"
          aria-label="Tag type"
        >
          <option value="">All types</option>
          <option value="general">General</option>
          <option value="artist">Artist</option>
          <option value="character">Character</option>
          <option value="copyright">Copyright</option>
          <option value="meta">Meta</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-3 text-white text-sm"
          aria-label="Sort"
        >
          <option value="count">Most used</option>
          <option value="count-asc">Least used</option>
          <option value="name">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="newest">Newest</option>
        </select>
        <select
          value={perPage}
          onChange={(e) => setPerPage(parseInt(e.target.value, 10))}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-3 text-white text-sm"
          aria-label="Tags per page"
        >
          {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
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
                  <tr key={tag._id} className="hover:bg-zinc-800/50 transition">
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

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 text-sm text-zinc-400">
        <span className="tabular-nums">
          {total > 0
            ? `${((page - 1) * perPage + 1).toLocaleString()}–${Math.min(page * perPage, total).toLocaleString()} of ${total.toLocaleString()} tags`
            : 'No tags'}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => goToPage(1)} disabled={page <= 1 || loading} className="p-2 rounded hover:bg-zinc-800 disabled:opacity-40" title="First page">
            <ChevronsLeft size={18} />
          </button>
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1 || loading} className="p-2 rounded hover:bg-zinc-800 disabled:opacity-40" title="Previous page">
            <ChevronLeft size={18} />
          </button>
          <form
            onSubmit={(e) => { e.preventDefault(); goToPage(parseInt(pageInput, 10)); }}
            className="flex items-center gap-2 px-2"
          >
            <span>Page</span>
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className="w-20 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white text-center tabular-nums"
              aria-label="Page number"
            />
            <span className="tabular-nums">of {pages.toLocaleString()}</span>
          </form>
          <button onClick={() => goToPage(page + 1)} disabled={page >= pages || loading} className="p-2 rounded hover:bg-zinc-800 disabled:opacity-40" title="Next page">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => goToPage(pages)} disabled={page >= pages || loading} className="p-2 rounded hover:bg-zinc-800 disabled:opacity-40" title="Last page">
            <ChevronsRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
