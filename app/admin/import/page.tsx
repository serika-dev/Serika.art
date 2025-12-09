'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ImportResult {
  success: boolean;
  imageId?: string;
  error?: string;
  postId?: number;
}

export default function ImportPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Single post import
  const [postId, setPostId] = useState('');
  const [importingSingle, setImportingSingle] = useState(false);
  const [singleResult, setSingleResult] = useState<ImportResult | null>(null);
  
  // Bulk artist import
  const [artistTag, setArtistTag] = useState('');
  const [bulkLimit, setBulkLimit] = useState(100);
  const [importingBulk, setImportingBulk] = useState(false);
  const [bulkResults, setBulkResults] = useState<ImportResult[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      if (response.data.success) {
        const userRank = response.data.user.rank;
        if (userRank === 'admin' || userRank === 'owner') {
          setIsAdmin(true);
        } else {
          router.push('/');
        }
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSingleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId.trim()) return;

    setImportingSingle(true);
    setSingleResult(null);

    try {
      const response = await axios.post('/api/admin/import/danbooru', {
        type: 'single',
        postId: parseInt(postId),
      });

      setSingleResult(response.data);
      if (response.data.success) {
        setPostId('');
      }
    } catch (error: any) {
      setSingleResult({
        success: false,
        error: error.response?.data?.error || 'Import failed',
      });
    } finally {
      setImportingSingle(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistTag.trim()) return;

    setImportingBulk(true);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: 0 });

    try {
      const response = await fetch('/api/admin/import/danbooru', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'bulk',
          artistTag: artistTag.trim(),
          limit: bulkLimit,
        }),
      });

      if (!response.body) {
        console.error('No response body');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'start') {
                setBulkProgress({ current: 0, total: data.total });
              } else if (data.type === 'progress') {
                setBulkProgress({ current: data.current, total: data.total });
                setBulkResults((prev) => [...prev, data.result]);
              } else if (data.type === 'complete') {
                setBulkProgress({ current: data.total, total: data.total });
                setBulkResults(data.results);
              } else if (data.type === 'error') {
                console.error('Import error:', data.error);
                setBulkResults([
                  {
                    success: false,
                    error: data.error,
                  },
                ]);
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Bulk import error:', error);
      setBulkResults([
        {
          success: false,
          error: error.message || 'Bulk import failed',
        },
      ]);
    } finally {
      setImportingBulk(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Download size={36} className="text-blue-500" />
          Danbooru Import
        </h1>
        <p className="text-zinc-400">Import posts from Danbooru (uploaded as anonymous)</p>
      </div>

      {/* Single Post Import */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-6">
        <h2 className="text-2xl font-bold text-white mb-4">Import Single Post</h2>
        <form onSubmit={handleSingleImport} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Danbooru Post ID
            </label>
            <input
              type="number"
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              placeholder="e.g., 7654321"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={importingSingle}
            />
          </div>
          
          <button
            type="submit"
            disabled={importingSingle || !postId.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {importingSingle ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Importing...
              </>
            ) : (
              <>
                <Download size={20} />
                Import Post
              </>
            )}
          </button>
        </form>

        {singleResult && (
          <div
            className={`mt-4 p-4 rounded-lg border ${
              singleResult.success
                ? 'bg-green-900/20 border-green-800 text-green-200'
                : 'bg-red-900/20 border-red-800 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {singleResult.success ? (
                <>
                  <CheckCircle size={20} />
                  <span>
                    Successfully imported!{' '}
                    {singleResult.imageId && (
                      <a
                        href={`/image/${singleResult.imageId}`}
                        className="underline hover:text-green-100"
                      >
                        View post
                      </a>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={20} />
                  <span>{singleResult.error}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Artist Import */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Bulk Import by Artist</h2>
        <form onSubmit={handleBulkImport} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Artist Tag
            </label>
            <input
              type="text"
              value={artistTag}
              onChange={(e) => setArtistTag(e.target.value)}
              placeholder="e.g., wlop"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={importingBulk}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Maximum Posts to Import
            </label>
            <input
              type="number"
              value={bulkLimit}
              onChange={(e) => setBulkLimit(Math.max(1, Math.min(1000, parseInt(e.target.value) || 100)))}
              min="1"
              max="1000"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={importingBulk}
            />
            <p className="text-sm text-zinc-500 mt-1">Maximum 1000 posts</p>
          </div>

          <button
            type="submit"
            disabled={importingBulk || !artistTag.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {importingBulk ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Importing {bulkProgress.current} / {bulkProgress.total}...
              </>
            ) : (
              <>
                <Download size={20} />
                Bulk Import
              </>
            )}
          </button>
        </form>

        {bulkResults.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-lg font-semibold text-white mb-2">
              Import Results ({bulkResults.filter((r) => r.success).length} /{' '}
              {bulkResults.length} successful)
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {bulkResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border text-sm ${
                    result.success
                      ? 'bg-green-900/10 border-green-800/50 text-green-200'
                      : 'bg-red-900/10 border-red-800/50 text-red-200'
                  }`}
                >
                  {result.success ? (
                    <>
                      ✓ Post {result.postId} imported
                      {result.imageId && (
                        <>
                          {' - '}
                          <a
                            href={`/image/${result.imageId}`}
                            className="underline hover:opacity-80"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </a>
                        </>
                      )}
                    </>
                  ) : (
                    <>✗ Post {result.postId}: {result.error}</>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
