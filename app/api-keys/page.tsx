'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { Key, Plus, Trash2, Copy, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface ApiKey {
  _id: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  usageCount: number;
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  'images:read': 'Read Images',
  'images:write': 'Write Images',
  'images:delete': 'Delete Images',
  'tags:read': 'Read Tags',
  'tags:write': 'Write Tags',
  'users:read': 'Read Users',
  'random:read': 'Random Images',
  'upload': 'Upload Images',
};

const DEFAULT_PERMISSIONS = ['images:read', 'tags:read', 'users:read', 'random:read'];

export default function ApiKeysPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    permissions: DEFAULT_PERMISSIONS,
    rateLimit: 60,
    expiresIn: 0, // days, 0 = no expiration
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?returnUrl=/api-keys');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchKeys();
    }
  }, [user]);

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/keys');
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name || 'API Key',
          permissions: createForm.permissions,
          rateLimit: createForm.rateLimit,
          expiresIn: createForm.expiresIn || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewKey(data.key.apiKey);
        fetchKeys();
        setCreateForm({
          name: '',
          permissions: DEFAULT_PERMISSIONS,
          rateLimit: 60,
          expiresIn: 0,
        });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/keys?id=${keyId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setKeys(keys.filter((k) => k._id !== keyId));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete API key');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePermission = (permission: string) => {
    setCreateForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Key className="text-indigo-400" />
              API Keys
            </h1>
            <p className="text-gray-400 mt-2">
              Manage your API keys for programmatic access to Serika
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition"
          >
            <Plus size={20} />
            Create Key
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="text-red-400" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* New key display */}
        {newKey && (
          <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-400 mb-2">New API Key Created!</h3>
            <p className="text-gray-400 text-sm mb-3">
              Copy this key now - it will not be shown again.
            </p>
            <div className="flex items-center gap-2 bg-black/50 rounded p-3">
              <code className="flex-1 text-green-300 break-all">{newKey}</code>
              <button
                onClick={() => copyToClipboard(newKey, 'new')}
                className="p-2 hover:bg-white/10 rounded transition"
              >
                {copiedId === 'new' ? (
                  <Check size={18} className="text-green-400" />
                ) : (
                  <Copy size={18} />
                )}
              </button>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="mt-3 text-sm text-gray-400 hover:text-white"
            >
              I've saved this key
            </button>
          </div>
        )}

        {/* Keys list */}
        {keys.length === 0 ? (
          <div className="bg-[#111] rounded-lg p-8 text-center">
            <Key size={48} className="mx-auto text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No API Keys</h3>
            <p className="text-gray-400">Create your first API key to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {keys.map((key) => (
              <div
                key={key._id}
                className="bg-[#111] border border-white/10 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{key.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                    {key.lastUsedAt && (
                      <p className="text-gray-400 text-sm">
                        Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                      </p>
                    )}
                    {key.expiresAt && (
                      <p className="text-yellow-400 text-sm">
                        Expires: {new Date(key.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">
                      {key.usageCount.toLocaleString()} uses
                    </span>
                    <button
                      onClick={() => deleteKey(key._id)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {key.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded"
                    >
                      {PERMISSION_LABELS[perm] || perm}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-gray-500 text-sm">
                  Rate limit: {key.rateLimit} requests/min
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-white/10 rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">Create API Key</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    placeholder="My API Key"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Permissions</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PERMISSION_LABELS).map(([perm, label]) => (
                      <label
                        key={perm}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={createForm.permissions.includes(perm)}
                          onChange={() => togglePermission(perm)}
                          className="rounded"
                        />
                        <span className={createForm.permissions.includes(perm) ? 'text-white' : 'text-gray-400'}>
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rate Limit (requests/minute)
                  </label>
                  <input
                    type="number"
                    value={createForm.rateLimit}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        rateLimit: parseInt(e.target.value) || 60,
                      })
                    }
                    min={10}
                    max={120}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Expiration (days, 0 = never)
                  </label>
                  <input
                    type="number"
                    value={createForm.expiresIn}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        expiresIn: parseInt(e.target.value) || 0,
                      })
                    }
                    min={0}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createKey}
                  disabled={creating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
