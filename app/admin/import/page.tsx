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
  const [artistLimit, setArtistLimit] = useState(100);
  const [artistBackground, setArtistBackground] = useState(true);
  const [importingArtist, setImportingArtist] = useState(false);
  const [artistResults, setArtistResults] = useState<ImportResult[]>([]);
  const [artistProgress, setArtistProgress] = useState({ current: 0, total: 0 });

  // Bulk tag import
  const [searchTags, setSearchTags] = useState('');
  const [tagLimit, setTagLimit] = useState(100);
  const [tagBackground, setTagBackground] = useState(true);
  const [importingTag, setImportingTag] = useState(false);
  const [tagResults, setTagResults] = useState<ImportResult[]>([]);
  const [tagProgress, setTagProgress] = useState({ current: 0, total: 0 });

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

  const handleArtistImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistTag.trim()) return;

    setImportingArtist(true);
    setArtistResults([]);
    setArtistProgress({ current: 0, total: 0 });

    // If background mode, start async import
    if (artistBackground) {
      try {
        await fetch('/api/admin/import/danbooru', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'artist',
            artistTag: artistTag.trim(),
            limit: artistLimit,
            background: true,
          }),
        });

      // Show success message
      setArtistResults([
        {
          success: true,
          postId: 0,
          imageId: undefined,
          error: undefined,
        },
      ]);
      setArtistProgress({ current: 0, total: artistLimit });
      
      // Add informational message
      setTimeout(() => {
        setArtistResults((prev) => [
          ...prev,
          {
            success: false,
            error: `ℹ️  Import is now running in the background. Importing up to ${artistLimit.toLocaleString()} posts for artist "${artistTag}". You can safely leave this page - check your server logs or the Posts page to see new images appear.`,
          },
        ]);
      }, 100);
      
      setImportingArtist(false);
    } catch (error: any) {
      setArtistResults([
        {
          success: false,
          error: error.message || 'Failed to start import',
        },
      ]);
      setImportingArtist(false);
    }
      return;
    }

    // Normal mode with streaming
    handleArtistImportOld(e);
  };

  const handleArtistImportOld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistTag.trim()) return;

    setImportingArtist(true);
    setArtistResults([]);
    setArtistProgress({ current: 0, total: 0 });

    try {
      const response = await fetch('/api/admin/import/danbooru', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'artist',
          artistTag: artistTag.trim(),
          limit: artistLimit,
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
                setArtistProgress({ current: 0, total: data.total });
              } else if (data.type === 'progress') {
                setArtistProgress({ current: data.current, total: data.total });
                if (data.result && (data.result.success || data.result.error)) {
                  setArtistResults((prev) => [...prev, data.result]);
                }
              } else if (data.type === 'complete') {
                setArtistProgress({ current: data.total, total: data.total });
                // Use the complete results array which is already filtered
                setArtistResults(data.results || []);
              } else if (data.type === 'error') {
                console.error('Import error:', data.error);
                setArtistResults([
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
      console.error('Artist import error:', error);
      setArtistResults([
        {
          success: false,
          error: error.message || 'Artist import failed',
        },
      ]);
    } finally {
      setImportingArtist(false);
    }
  };

  const handleTagImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTags.trim()) return;

    setImportingTag(true);
    setTagResults([]);
    setTagProgress({ current: 0, total: 0 });

    // If background mode, start async import
    if (tagBackground) {
      try {
        await fetch('/api/admin/import/danbooru', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'tags',
            tags: searchTags.trim(),
            limit: tagLimit,
            background: true,
          }),
        });

      // Show success message
      setTagResults([
        {
          success: true,
          postId: 0,
          imageId: undefined,
          error: undefined,
        },
      ]);
      setTagProgress({ current: 0, total: tagLimit });
      
      // Add informational message
      setTimeout(() => {
        setTagResults((prev) => [
          ...prev,
          {
            success: false,
            error: `ℹ️  Import is now running in the background. Importing up to ${tagLimit.toLocaleString()} posts for "${searchTags}". You can safely leave this page - check your server logs or the Posts page to see new images appear.`,
          },
        ]);
      }, 100);
      
      setImportingTag(false);
    } catch (error: any) {
      setTagResults([
        {
          success: false,
          error: error.message || 'Failed to start import',
        },
      ]);
      setImportingTag(false);
    }
      return;
    }

    // Normal mode with streaming
    handleTagImportOld(e);
  };

  const handleTagImportOld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTags.trim()) return;

    setImportingTag(true);
    setTagResults([]);
    setTagProgress({ current: 0, total: 0 });

    try {
      const response = await fetch('/api/admin/import/danbooru', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'tags',
          tags: searchTags.trim(),
          limit: tagLimit,
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
                setTagProgress({ current: 0, total: data.total });
              } else if (data.type === 'progress') {
                setTagProgress({ current: data.current, total: data.total });
                if (data.result && (data.result.success || data.result.error)) {
                  setTagResults((prev) => [...prev, data.result]);
                }
              } else if (data.type === 'complete') {
                setTagProgress({ current: data.total, total: data.total });
                setTagResults(data.results || []);
              } else if (data.type === 'error') {
                console.error('Import error:', data.error);
                setTagResults([
                  {
                    success: false,
                    error: data.error,
                  },
                ]);
              }
            } catch (err) {
              console.error('Failed to parse SSE message:', err);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Tag import error:', error);
      setTagResults([
        {
          success: false,
          error: error.message || 'Tag import failed',
        },
      ]);
    } finally {
      setImportingTag(false);
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
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-6">
        <h2 className="text-2xl font-bold text-white mb-4">Bulk Import by Artist</h2>
        <form onSubmit={handleArtistImport} className="space-y-4">
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
              disabled={importingArtist}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Number of Posts
            </label>
            <input
              type="number"
              value={artistLimit}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 100);
                setArtistLimit(artistBackground ? val : Math.min(val, 1000));
              }}
              min="1"
              max={artistBackground ? undefined : 1000}
              placeholder="100"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={importingArtist}
            />
            <p className="text-sm text-zinc-500 mt-1">
              {artistBackground ? 'No limit - will run as background process' : 'Maximum 1,000 posts in normal mode'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="artistBackground"
              checked={artistBackground}
              onChange={(e) => {
                setArtistBackground(e.target.checked);
                if (!e.target.checked && artistLimit > 1000) {
                  setArtistLimit(1000);
                }
              }}
              disabled={importingArtist}
              className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-600 focus:ring-2"
            />
            <label htmlFor="artistBackground" className="text-sm text-zinc-300">
              Background mode (can leave page, unlimited posts)
            </label>
          </div>

          <button
            type="submit"
            disabled={importingArtist || !artistTag.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {importingArtist ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {artistBackground ? 'Started - Running in Background' : 'Importing...'}
              </>
            ) : (
              <>
                <Download size={20} />
                {artistBackground ? 'Start Import (Background)' : 'Import with Progress'}
              </>
            )}
          </button>
        </form>

        {artistResults.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-lg font-semibold text-white mb-2">
              Import Status
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {artistResults.filter((r) => r).map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border text-sm ${
                    result?.success && result.postId !== 0
                      ? 'bg-green-900/10 border-green-800/50 text-green-200'
                      : result?.success && result.postId === 0
                      ? 'bg-blue-900/10 border-blue-800/50 text-blue-200'
                      : 'bg-yellow-900/10 border-yellow-800/50 text-yellow-200'
                  }`}
                >
                  {result?.success && result.postId === 0 ? (
                    <>✓ Background import started successfully</>
                  ) : result?.success ? (
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
                    <>{result?.error}</>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Tag Search Import */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Bulk Import by Tags</h2>
        <form onSubmit={handleTagImport} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Search Tags
            </label>
            <input
              type="text"
              value={searchTags}
              onChange={(e) => setSearchTags(e.target.value)}
              placeholder="e.g., 1girl solo rating:safe"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={importingTag}
            />
            <p className="text-sm text-zinc-500 mt-1">Use Danbooru search syntax (space-separated tags)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Number of Posts
            </label>
            <input
              type="number"
              value={tagLimit}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 100);
                setTagLimit(tagBackground ? val : Math.min(val, 1000));
              }}
              min="1"
              max={tagBackground ? undefined : 1000}
              placeholder="100"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={importingTag}
            />
            <p className="text-sm text-zinc-500 mt-1">
              {tagBackground ? 'No limit - will run as background process' : 'Maximum 1,000 posts in normal mode'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="tagBackground"
              checked={tagBackground}
              onChange={(e) => {
                setTagBackground(e.target.checked);
                if (!e.target.checked && tagLimit > 1000) {
                  setTagLimit(1000);
                }
              }}
              disabled={importingTag}
              className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-600 focus:ring-2"
            />
            <label htmlFor="tagBackground" className="text-sm text-zinc-300">
              Background mode (can leave page, unlimited posts)
            </label>
          </div>

          <button
            type="submit"
            disabled={importingTag || !searchTags.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {importingTag ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {tagBackground ? 'Started - Running in Background' : 'Importing...'}
              </>
            ) : (
              <>
                <Download size={20} />
                {tagBackground ? 'Start Import (Background)' : 'Import with Progress'}
              </>
            )}
          </button>
        </form>

        {tagResults.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-lg font-semibold text-white mb-2">
              Import Status
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {tagResults.filter((r) => r).map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border text-sm ${
                    result?.success && result.postId !== 0
                      ? 'bg-green-900/10 border-green-800/50 text-green-200'
                      : result?.success && result.postId === 0
                      ? 'bg-blue-900/10 border-blue-800/50 text-blue-200'
                      : 'bg-yellow-900/10 border-yellow-800/50 text-yellow-200'
                  }`}
                >
                  {result?.success && result.postId === 0 ? (
                    <>✓ Background import started successfully</>
                  ) : result?.success ? (
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
                    <>{result?.error}</>
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
