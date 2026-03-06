'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Scale, Clock, CheckCircle2, XCircle, AlertTriangle, FileText, ChevronLeft, ChevronRight, Loader2, ExternalLink, Eye } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface DMCARequest {
  _id: string;
  claimantName: string;
  email: string;
  address?: string;
  phone?: string;
  copyrightedWork: string;
  infringingUrls: string;
  additionalInfo?: string;
  status: 'pending' | 'approved' | 'rejected' | 'resolved';
  createdAt: string;
  updatedAt: string;
  adminNotes?: string;
  affectedImageIds?: string[];
  handledBy?: string;
  handledByUsername?: string;
}

export default function AdminDMCAPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<DMCARequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DMCARequest | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !['admin', 'owner', 'moderator'].includes(user.rank || ''))) {
      router.push('/posts');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && ['admin', 'owner', 'moderator'].includes(user.rank || '')) {
      fetchRequests();
    }
  }, [user, page, statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      const response = await axios.get(`/api/dmca?${params}`);
      if (response.data.success) {
        setRequests(response.data.requests);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      console.error('Failed to fetch DMCA requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, status: 'approved' | 'rejected' | 'resolved') => {
    setProcessing(true);
    try {
      const response = await axios.patch(`/api/dmca/${requestId}`, {
        status,
        adminNotes: adminNotes || undefined,
      });

      if (response.data.success) {
        alert(`Request ${status} successfully.`);
        setSelectedRequest(null);
        setAdminNotes('');
        fetchRequests();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update request');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Rejected</Badge>;
      case 'resolved':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Resolved</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (authLoading || (!user || !['admin', 'owner', 'moderator'].includes(user.rank || ''))) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = ['admin', 'owner'].includes(user.rank || '');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button variant="outline" size="sm" className="rounded-xl">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">DMCA Requests</h1>
            <p className="text-muted-foreground">Review and process DMCA takedown requests</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['all', 'pending', 'approved', 'rejected', 'resolved'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className="rounded-xl capitalize"
            >
              {status}
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request List */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : requests.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="p-8 text-center">
                  <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No DMCA requests found.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {requests.map((request) => (
                  <Card 
                    key={request._id}
                    className={cn(
                      "rounded-2xl cursor-pointer transition-all hover:border-primary/50",
                      selectedRequest?._id === request._id && "border-primary"
                    )}
                    onClick={() => { setSelectedRequest(request); setAdminNotes(request.adminNotes || ''); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{request.claimantName}</span>
                            {getStatusBadge(request.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{request.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Submitted: {new Date(request.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
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
              </>
            )}
          </div>

          {/* Request Details */}
          <div>
            {selectedRequest ? (
              <Card className="rounded-2xl sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Request Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Claimant Name</span>
                      <p className="font-medium">{selectedRequest.claimantName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Email</span>
                      <p className="font-medium">{selectedRequest.email}</p>
                    </div>
                    {selectedRequest.address && (
                      <div>
                        <span className="text-xs text-muted-foreground uppercase">Address</span>
                        <p className="font-medium">{selectedRequest.address}</p>
                      </div>
                    )}
                    {selectedRequest.phone && (
                      <div>
                        <span className="text-xs text-muted-foreground uppercase">Phone</span>
                        <p className="font-medium">{selectedRequest.phone}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Copyrighted Work</span>
                    <p className="text-sm mt-1 p-3 bg-muted rounded-xl whitespace-pre-wrap">
                      {selectedRequest.copyrightedWork}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Infringing URLs</span>
                    <div className="text-sm mt-1 p-3 bg-muted rounded-xl space-y-1">
                      {selectedRequest.infringingUrls.split('\n').filter(Boolean).map((url, i) => (
                        <div key={i}>
                          <a 
                            href={url.trim()} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {url.trim()}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedRequest.additionalInfo && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Additional Info</span>
                      <p className="text-sm mt-1 p-3 bg-muted rounded-xl whitespace-pre-wrap">
                        {selectedRequest.additionalInfo}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground uppercase">Status:</span>
                    {getStatusBadge(selectedRequest.status)}
                  </div>

                  {selectedRequest.handledByUsername && (
                    <div className="text-sm text-muted-foreground">
                      Handled by: {selectedRequest.handledByUsername}
                    </div>
                  )}

                  {/* Admin Notes */}
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Admin Notes</span>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes about this request..."
                      className="mt-1 rounded-xl min-h-[80px]"
                      disabled={!isAdmin}
                    />
                  </div>

                  {/* Actions */}
                  {isAdmin && selectedRequest.status === 'pending' && (
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => handleUpdateStatus(selectedRequest._id, 'approved')}
                        disabled={processing}
                        className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl"
                      >
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Approve & Remove
                      </Button>
                      <Button
                        onClick={() => handleUpdateStatus(selectedRequest._id, 'rejected')}
                        disabled={processing}
                        variant="outline"
                        className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl"
                      >
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                        Reject
                      </Button>
                    </div>
                  )}

                  {isAdmin && selectedRequest.status === 'approved' && (
                    <Button
                      onClick={() => handleUpdateStatus(selectedRequest._id, 'resolved')}
                      disabled={processing}
                      className="w-full rounded-xl"
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Mark as Resolved
                    </Button>
                  )}

                  {!isAdmin && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      Only admins can approve or reject DMCA requests.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a request to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
