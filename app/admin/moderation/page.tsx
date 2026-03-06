'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { History, Trash2, EyeOff, RotateCcw, ChevronLeft, ChevronRight, Loader2, User, Image, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ModerationLog {
  _id: string;
  action: string;
  targetType: string;
  targetId: string;
  performedBy: string;
  performedByUsername: string;
  performedByRank: string;
  reason?: string;
  previousState?: Record<string, any>;
  reversible: boolean;
  undone: boolean;
  undoneAt?: string;
  undoneBy?: string;
  createdAt: string;
}

export default function AdminModerationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && (!user || !['admin', 'owner', 'moderator'].includes(user.rank || ''))) {
      router.push('/posts');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && ['admin', 'owner', 'moderator'].includes(user.rank || '')) {
      fetchLogs();
    }
  }, [user, page, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '50');
      if (actionFilter !== 'all') {
        params.set('action', actionFilter);
      }
      
      const response = await axios.get(`/api/moderation/action?${params}`);
      if (response.data.success) {
        setLogs(response.data.logs);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching moderation logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('delete') || action === 'dmca_takedown') return <Trash2 className="h-4 w-4" />;
    if (action.includes('unlist')) return <EyeOff className="h-4 w-4" />;
    if (action.includes('restore') || action.includes('undo')) return <RotateCcw className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action === 'dmca_takedown') return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (action.includes('unlist')) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    if (action.includes('restore') || action.includes('undo')) return 'text-green-400 bg-green-500/10 border-green-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };

  const getRankBadge = (rank: string) => {
    switch (rank) {
      case 'owner':
        return 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white border-0';
      case 'admin':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'moderator':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    );
  }

  if (!user || !['admin', 'owner', 'moderator'].includes(user.rank || '')) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <History className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Moderation Logs</h1>
        </div>
        <p className="text-muted-foreground">View all moderation actions performed on the site</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'delete', 'unlist', 'restore', 'undo', 'dmca_takedown'].map((action) => (
              <Button
                key={action}
                variant={actionFilter === action ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setActionFilter(action); setPage(1); }}
                className="rounded-xl"
              >
                {action === 'all' ? 'All Actions' : action.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No moderation logs found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log._id} className={cn(log.undone && 'opacity-60')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Action Icon */}
                  <div className={cn(
                    "p-2 rounded-lg border",
                    getActionColor(log.action)
                  )}>
                    {getActionIcon(log.action)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className={getActionColor(log.action)}>
                        {log.action.replace('_', ' ')}
                      </Badge>
                      <span className="text-muted-foreground">on</span>
                      <Badge variant="secondary">
                        {log.targetType}
                      </Badge>
                      {log.undone && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Undone
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm mb-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{log.performedByUsername}</span>
                      {log.performedByRank && (
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getRankBadge(log.performedByRank))}>
                          {log.performedByRank}
                        </Badge>
                      )}
                    </div>

                    {log.reason && (
                      <p className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium">Reason:</span> {log.reason}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.targetType === 'image' && (
                        <Link
                          href={`/image/${log.targetId}`}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Image className="h-3 w-3" />
                          View Image
                        </Link>
                      )}
                      {log.reversible && !log.undone && (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Reversible
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-xl"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
