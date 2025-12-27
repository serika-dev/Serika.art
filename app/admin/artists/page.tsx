'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Loader2, 
  ArrowLeft, 
  Check, 
  X, 
  Clock, 
  ExternalLink,
  User,
  Mail,
  Calendar,
  MessageSquare,
  Copy,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface ArtistClaim {
  _id: string;
  artistTagId: string;
  artistTagName: string;
  userId: string;
  username: string;
  userEmail: string;
  verificationWords: string[];
  verificationMethod: string;
  additionalInfo?: string;
  discordId?: string;
  contactEmailOnly?: boolean;
  artworkLink?: string;
  psdFileUrl?: string;
  status: string;
  reviewedBy?: string;
  reviewedByUsername?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminArtistsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [claims, setClaims] = useState<ArtistClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });

  useEffect(() => {
    if (!authLoading && (!user || (user.rank !== 'admin' && user.rank !== 'owner'))) {
      router.push('/posts');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && (user.rank === 'admin' || user.rank === 'owner')) {
      fetchClaims();
    }
  }, [activeTab, user]);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/artists/claims?status=${activeTab}`);
      const data = await res.json();
      if (data.success) {
        setClaims(data.claims);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch claims:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (claimId: string, action: 'approve' | 'reject') => {
    setProcessing(claimId);
    try {
      const res = await fetch('/api/admin/artists/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId,
          action,
          reviewNotes: reviewNotes[claimId] || '',
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Remove from list
        setClaims(prev => prev.filter(c => c._id !== claimId));
      } else {
        alert(data.error || 'Failed to process claim');
      }
    } catch (err) {
      alert('Failed to process claim');
    } finally {
      setProcessing(null);
    }
  };

  const copyVerificationPhrase = (words: string[], claimId: string) => {
    navigator.clipboard.writeText(words.join(' '));
    setCopiedId(claimId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'social': return 'Social Bio/Post';
      case 'website': return 'Website';
      case 'dm': return 'Twitter DM';
      case 'psd': return 'PSD/Project File';
      default: return method;
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  if (!user || (user.rank !== 'admin' && user.rank !== 'owner')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-white">Artist Claims</h1>
          <p className="text-zinc-400">Review and approve artist page verification requests</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="pending" className="data-[state=active]:bg-zinc-800">
              <Clock className="w-4 h-4 mr-2" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-zinc-800">
              <Check className="w-4 h-4 mr-2" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-zinc-800">
              <X className="w-4 h-4 mr-2" />
              Rejected
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800">
              All
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Claims List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin h-10 w-10 text-primary" />
          </div>
        ) : claims.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="py-16 text-center">
              <p className="text-zinc-400">No {activeTab === 'all' ? '' : activeTab} claims found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <Card key={claim._id} className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Link 
                          href={`/artist/${encodeURIComponent(claim.artistTagName)}`}
                          className="hover:text-primary transition capitalize"
                        >
                          {claim.artistTagName.replace(/_/g, ' ')}
                        </Link>
                        <Badge variant="outline" className={cn(
                          claim.status === 'pending' && 'border-amber-500/40 text-amber-400',
                          claim.status === 'approved' && 'border-green-500/40 text-green-400',
                          claim.status === 'rejected' && 'border-red-500/40 text-red-400',
                        )}>
                          {claim.status}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-zinc-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <Link href={`/user/${claim.username}`} className="hover:text-white">
                            {claim.username}
                          </Link>
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {claim.userEmail}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(claim.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/posts?tags=${encodeURIComponent(claim.artistTagName)}`} target="_blank">
                        <Button variant="outline" size="sm">
                          View Posts
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Verification Info */}
                  <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Verification Method:</span>
                      <Badge variant="outline">{getMethodLabel(claim.verificationMethod)}</Badge>
                    </div>
                    
                    {/* Verification Phrase - Hide for PSD method */}
                    {claim.verificationMethod !== 'psd' && (
                      <div>
                        <span className="text-sm text-zinc-400">Verification Phrase:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex flex-wrap gap-1">
                            {claim.verificationWords.map((word, i) => (
                              <Badge key={i} variant="secondary" className="text-sm">
                                {word}
                              </Badge>
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyVerificationPhrase(claim.verificationWords, claim._id)}
                            className="h-8 px-2"
                          >
                            {copiedId === claim._id ? (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Artwork Link - Only for PSD method */}
                    {claim.verificationMethod === 'psd' && claim.artworkLink && (
                      <div>
                        <span className="text-sm text-zinc-400">Artwork Link:</span>
                        <div className="mt-1">
                          <Link 
                            href={claim.artworkLink} 
                            target="_blank"
                            className="text-primary hover:underline text-sm flex items-center gap-1"
                          >
                            {claim.artworkLink}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                    
                    {/* PSD File Download - Only for PSD method */}
                    {claim.verificationMethod === 'psd' && claim.psdFileUrl && (
                      <div>
                        <span className="text-sm text-zinc-400">Project File:</span>
                        <div className="mt-1">
                          <Link 
                            href={claim.psdFileUrl} 
                            target="_blank"
                            className="inline-flex items-center gap-2 px-3 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition text-sm"
                          >
                            🎨 Download PSD/Project File
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                    
                    {claim.additionalInfo && (
                      <div>
                        <span className="text-sm text-zinc-400">Additional Info:</span>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{claim.additionalInfo}</p>
                      </div>
                    )}
                    
                    {/* Contact Information */}
                    <div className="pt-2 border-t border-zinc-700">
                      <span className="text-sm text-zinc-400">Contact Info:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          📧 {claim.userEmail || 'No email'}
                        </Badge>
                        {claim.discordId && (
                          <Badge variant="outline" className="text-xs">
                            💬 Discord: {claim.discordId}
                          </Badge>
                        )}
                        {claim.contactEmailOnly && (
                          <Badge variant="secondary" className="text-xs">
                            Email only
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Review Notes (for already reviewed) */}
                  {claim.status !== 'pending' && claim.reviewedByUsername && (
                    <div className="bg-zinc-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                        <span>Reviewed by {claim.reviewedByUsername}</span>
                        {claim.reviewedAt && (
                          <span>on {formatDate(claim.reviewedAt)}</span>
                        )}
                      </div>
                      {claim.reviewNotes && (
                        <p className="text-sm">{claim.reviewNotes}</p>
                      )}
                    </div>
                  )}

                  {/* Actions for pending */}
                  {claim.status === 'pending' && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <Label className="text-sm text-zinc-400">Review Notes (optional)</Label>
                        <Textarea
                          placeholder="Add notes about your decision..."
                          value={reviewNotes[claim._id] || ''}
                          onChange={(e) => setReviewNotes(prev => ({
                            ...prev,
                            [claim._id]: e.target.value
                          }))}
                          className="mt-1 bg-zinc-800 border-zinc-700"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleReview(claim._id, 'approve')}
                          disabled={processing === claim._id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {processing === claim._id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReview(claim._id, 'reject')}
                          disabled={processing === claim._id}
                        >
                          {processing === claim._id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <X className="w-4 h-4 mr-2" />
                          )}
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination info */}
        {pagination.total > 0 && (
          <div className="mt-6 text-center text-sm text-zinc-400">
            Showing {claims.length} of {pagination.total} claims
          </div>
        )}
      </div>
    </div>
  );
}
