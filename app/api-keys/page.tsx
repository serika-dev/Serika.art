'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { Key, Plus, Trash2, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Key className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your API keys for programmatic access to Serika
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Key
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-destructive">{error}</span>
        </div>
      )}

      {/* New key display */}
      {newKey && (
        <Card className="mb-6 border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-green-400 mb-2">New API Key Created!</h3>
            <p className="text-muted-foreground text-sm mb-3">
              Copy this key now - it will not be shown again.
            </p>
            <div className="flex items-center gap-2 bg-background rounded-lg p-3 border">
              <code className="flex-1 text-green-400 break-all text-sm">{newKey}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(newKey, 'new')}
              >
                {copiedId === 'new' ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewKey(null)}
              className="mt-3 text-muted-foreground"
            >
              I've saved this key
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground">Create your first API key to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {keys.map((key) => (
            <Card key={key._id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{key.name}</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                    {key.lastUsedAt && (
                      <p className="text-muted-foreground text-sm">
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
                    <span className="text-muted-foreground text-sm">
                      {key.usageCount.toLocaleString()} uses
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteKey(key._id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {key.permissions.map((perm) => (
                    <Badge key={perm} variant="secondary" className="text-xs">
                      {PERMISSION_LABELS[perm] || perm}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-muted-foreground text-sm">
                  Rate limit: {key.rateLimit} requests/min
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Create API Key</CardTitle>
              <CardDescription>Create a new API key with custom permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  placeholder="My API Key"
                />
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(PERMISSION_LABELS).map(([perm, label]) => (
                    <div key={perm} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm}
                        checked={createForm.permissions.includes(perm)}
                        onCheckedChange={() => togglePermission(perm)}
                      />
                      <Label
                        htmlFor={perm}
                        className={cn(
                          "text-sm font-normal cursor-pointer",
                          !createForm.permissions.includes(perm) && "text-muted-foreground"
                        )}
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rate Limit (requests/minute)</Label>
                <Input
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
                />
              </div>

              <div className="space-y-2">
                <Label>Expiration (days, 0 = never)</Label>
                <Input
                  type="number"
                  value={createForm.expiresIn}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      expiresIn: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={createKey} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Key'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
