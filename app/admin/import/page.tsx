'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Download, AlertCircle, CheckCircle, Loader2, Play, Pause, Trash2, RefreshCw, Clock, List, Plus, X, Zap, Infinity, Flame, Settings, Gauge } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SpeedMode = 'default' | 'turbo' | 'insane' | 'custom';

interface SpeedSettings {
  concurrentJobs: number;
  concurrentImports: number;
  batchSize: number;
  importDelay: number;
  dbUpdateInterval: number;
}

interface ImportJob {
  _id: string;
  type: 'artist' | 'tags' | 'single';
  query: string;
  limit: number; // 0 = unlimited
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: {
    current: number;
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  createdBy: string;
}

export default function ImportPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Job queue
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  
  // Single post import
  const [postId, setPostId] = useState('');
  const [importingSingle, setImportingSingle] = useState(false);
  const [singleResult, setSingleResult] = useState<{ success: boolean; error?: string; imageId?: string } | null>(null);
  
  // Bulk import form
  const [importType, setImportType] = useState<'artist' | 'tags'>('tags');
  const [queries, setQueries] = useState(''); // Newline-separated queries
  const [limit, setLimit] = useState(100);
  const [unlimited, setUnlimited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Speed mode
  const [speedMode, setSpeedMode] = useState<SpeedMode>('insane');
  const [speedSettings, setSpeedSettings] = useState<SpeedSettings>({
    concurrentJobs: 10,
    concurrentImports: 50,
    batchSize: 100,
    importDelay: 0,
    dbUpdateInterval: 20,
  });
  const [changingSpeed, setChangingSpeed] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchJobs();
      // Poll for updates every 5 seconds
      const interval = setInterval(fetchJobs, 5000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

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

  const fetchJobs = async () => {
    try {
      const response = await axios.get('/api/admin/import/queue');
      if (response.data.success) {
        setJobs(response.data.jobs);
        if (response.data.speedMode) {
          setSpeedMode(response.data.speedMode);
        }
        if (response.data.speedSettings) {
          setSpeedSettings(response.data.speedSettings);
        }
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  const changeSpeedMode = async (mode: SpeedMode, customSettings?: SpeedSettings) => {
    setChangingSpeed(true);
    try {
      const response = await axios.put('/api/admin/import/queue', {
        mode,
        customSettings: mode === 'custom' ? customSettings : undefined,
      });
      if (response.data.success) {
        setSpeedMode(response.data.mode);
        setSpeedSettings(response.data.settings);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to change speed mode');
    } finally {
      setChangingSpeed(false);
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
    if (!queries.trim()) return;

    setSubmitting(true);

    try {
      // Split by newlines and filter empty lines
      const queryList = queries
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0);

      if (queryList.length === 0) {
        alert('Please enter at least one query');
        setSubmitting(false);
        return;
      }

      const response = await axios.post('/api/admin/import/queue', {
        type: importType,
        queries: queryList,
        limit: unlimited ? 0 : limit,
      });

      if (response.data.success) {
        setQueries('');
        fetchJobs();
        alert(`Created ${response.data.jobs?.length || 1} import job(s)`);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create import jobs');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;

    try {
      await axios.delete(`/api/admin/import/queue?jobId=${jobId}`);
      fetchJobs();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to cancel job');
    }
  };

  const resumeWorker = async () => {
    try {
      await axios.get('/api/admin/import/queue?action=resume');
      fetchJobs();
      alert('Worker started to resume paused jobs');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to resume worker');
    }
  };

  const getStatusBadge = (status: ImportJob['status']) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      pending: { variant: 'secondary', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
      running: { variant: 'default', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse' },
      completed: { variant: 'default', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
      failed: { variant: 'destructive', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
      paused: { variant: 'outline', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className={config.className}>
        {status}
      </Badge>
    );
  };

  const getProgressPercent = (job: ImportJob) => {
    if (job.progress.total === 0) return 0;
    return Math.round((job.progress.current / job.progress.total) * 100);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const runningJobs = jobs.filter(j => j.status === 'running');
  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const pausedJobs = jobs.filter(j => j.status === 'paused');

  const getModeLabel = (mode: SpeedMode) => {
    switch (mode) {
      case 'default': return '🐢 Default';
      case 'turbo': return '🚀 Turbo';
      case 'insane': return '🔥 Insane';
      case 'custom': return '⚙️ Custom';
    }
  };

  const getModeColor = (mode: SpeedMode) => {
    switch (mode) {
      case 'default': return 'bg-gray-500';
      case 'turbo': return 'bg-blue-500';
      case 'insane': return 'bg-gradient-to-r from-red-600 to-orange-500';
      case 'custom': return 'bg-purple-500';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <div className="relative">
            <Download size={36} className="text-primary" />
            <Flame size={16} className="absolute -top-1 -right-1 text-orange-500 animate-pulse" />
          </div>
          Danbooru Import
          <Badge className={`${getModeColor(speedMode)} text-white border-0 text-xs font-bold ${speedMode === 'insane' ? 'animate-pulse' : ''}`}>
            {getModeLabel(speedMode)}
          </Badge>
        </h1>
        <p className="text-muted-foreground">
          <span className={speedMode === 'insane' ? 'text-red-400 font-bold' : 'text-primary font-semibold'}>
            {speedSettings.concurrentJobs} jobs × {speedSettings.concurrentImports} imports = {speedSettings.concurrentJobs * speedSettings.concurrentImports} concurrent
          </span>
          {' • '}Delay: {speedSettings.importDelay}ms • Batch: {speedSettings.batchSize}
        </p>
      </div>

      {/* Speed Mode Selector */}
      <Card className="mb-6 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Speed Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {(['default', 'turbo', 'insane'] as SpeedMode[]).map((mode) => (
              <Button
                key={mode}
                variant={speedMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => changeSpeedMode(mode)}
                disabled={changingSpeed}
                className={speedMode === mode ? getModeColor(mode) : ''}
              >
                {changingSpeed && speedMode !== mode ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {getModeLabel(mode)}
              </Button>
            ))}
            <div className="text-xs text-muted-foreground ml-2">
              {speedMode === 'default' && '2×5 (10 concurrent) - Safe for low resources'}
              {speedMode === 'turbo' && '5×20 (100 concurrent) - Fast'}
              {speedMode === 'insane' && '10×50 (500 concurrent) - Maximum speed'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Bar */}
      {(runningJobs.length > 0 || pendingJobs.length > 0 || pausedJobs.length > 0) && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {runningJobs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    <span className="text-sm text-blue-400">{runningJobs.length} running</span>
                  </div>
                )}
                {pendingJobs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">{pendingJobs.length} pending</span>
                  </div>
                )}
                {pausedJobs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Pause className="h-4 w-4 text-orange-400" />
                    <span className="text-sm text-orange-400">{pausedJobs.length} paused</span>
                  </div>
                )}
              </div>
              {pausedJobs.length > 0 && (
                <Button size="sm" onClick={resumeWorker} className="gap-2">
                  <Play className="h-4 w-4" />
                  Resume Paused Jobs
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Forms */}
        <div className="space-y-6">
          {/* Single Post Import */}
          <Card>
            <CardHeader>
              <CardTitle>Single Post Import</CardTitle>
              <CardDescription>Import a specific Danbooru post by ID</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSingleImport} className="space-y-4">
                <Input
                  type="number"
                  placeholder="Danbooru Post ID (e.g., 1234567)"
                  value={postId}
                  onChange={(e) => setPostId(e.target.value)}
                  disabled={importingSingle}
                />
                <Button type="submit" disabled={importingSingle || !postId.trim()} className="w-full">
                  {importingSingle ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Import Post
                    </>
                  )}
                </Button>
                {singleResult && (
                  <div className={`p-3 rounded-lg ${singleResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                    {singleResult.success ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span>Imported successfully!</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        <span>{singleResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Bulk Import */}
          <Card>
            <CardHeader>
              <CardTitle>Bulk Import</CardTitle>
              <CardDescription>
                Queue multiple imports (one per line). Supports multiple artists or tag searches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBulkImport} className="space-y-4">
                <Tabs value={importType} onValueChange={(v) => setImportType(v as 'artist' | 'tags')}>
                  <TabsList className="w-full">
                    <TabsTrigger value="tags" className="flex-1">Tag Search</TabsTrigger>
                    <TabsTrigger value="artist" className="flex-1">Artist</TabsTrigger>
                  </TabsList>
                </Tabs>

                <Textarea
                  placeholder={importType === 'artist' 
                    ? "Enter artist tags (one per line):\nartist_name\nanother_artist\n..." 
                    : "Enter tag searches (one per line):\n1girl solo\nblue_eyes cat_ears\n..."}
                  value={queries}
                  onChange={(e) => setQueries(e.target.value)}
                  className="min-h-[120px] font-mono text-sm"
                  disabled={submitting}
                />

                {/* Unlimited Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-gradient-to-r from-orange-500/5 to-red-500/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-gradient-to-br from-orange-500 to-red-500">
                      <Infinity className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <Label htmlFor="unlimited" className="font-bold text-foreground cursor-pointer">
                        Unlimited Mode
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Import ALL matching posts (up to 100k per query)
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="unlimited"
                    checked={unlimited}
                    onCheckedChange={setUnlimited}
                    disabled={submitting}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-muted-foreground mb-1 block">
                      {unlimited ? 'Limit disabled' : 'Limit per query'}
                    </label>
                    <Input
                      type="number"
                      value={unlimited ? '∞' : limit}
                      onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                      min={1}
                      disabled={submitting || unlimited}
                      className={unlimited ? 'opacity-50' : ''}
                      placeholder={unlimited ? '∞ Unlimited' : ''}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground pt-6">
                    {queries.split('\n').filter(q => q.trim()).length} job(s)
                    {unlimited && <span className="ml-1 text-orange-400 font-bold">• UNLIMITED</span>}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={submitting || !queries.trim()} 
                  className={`w-full ${unlimited ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600' : ''}`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Creating Jobs...
                    </>
                  ) : unlimited ? (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Import Everything
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Queue
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Job Queue */}
        <Card className="lg:row-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Import Queue
              </CardTitle>
              <CardDescription>{jobs.length} total jobs</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loadingJobs}>
              <RefreshCw className={`h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <List className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No import jobs yet</p>
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job._id}
                  className={`p-4 rounded-lg border ${
                    job.status === 'running' ? 'border-blue-500/30 bg-blue-500/5' :
                    job.status === 'completed' ? 'border-green-500/20 bg-green-500/5' :
                    job.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
                    job.status === 'paused' ? 'border-orange-500/20 bg-orange-500/5' :
                    'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {job.type}
                        </Badge>
                        {job.limit === 0 && (
                          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-xs">
                            <Infinity className="h-3 w-3 mr-1" />
                            UNLIMITED
                          </Badge>
                        )}
                        {getStatusBadge(job.status)}
                      </div>
                      <p className="font-medium truncate" title={job.query}>
                        {job.query}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {job.createdBy} • {new Date(job.createdAt).toLocaleString()}
                        {job.limit > 0 && <span> • limit: {job.limit}</span>}
                      </p>
                    </div>
                    {(job.status === 'pending' || job.status === 'running' || job.status === 'paused') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelJob(job._id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {job.progress.total > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{job.progress.current} / {job.progress.total}</span>
                        <span>{getProgressPercent(job)}%</span>
                      </div>
                      <Progress value={getProgressPercent(job)} className="h-1.5" />
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-400">✓ {job.progress.successful}</span>
                        <span className="text-red-400">✗ {job.progress.failed}</span>
                        <span className="text-yellow-400">⊘ {job.progress.skipped}</span>
                      </div>
                    </div>
                  )}

                  {job.error && (
                    <p className="text-xs text-red-400 mt-2">{job.error}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
