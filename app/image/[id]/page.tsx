'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import axios from 'axios';
import { Image as ImageType, Comment } from '@/lib/models';
import { Heart, ThumbsUp, ThumbsDown, Eye, Download, Trash2, Sparkles, ExternalLink, Calendar, User, Maximize2, Minimize2, MessageCircle, Send, Shield, EyeOff, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function ImagePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [image, setImage] = useState<ImageType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userVote, setUserVote] = useState<'upvote' | 'downvote' | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [imageSize, setImageSize] = useState<'fit' | 'original'>('fit');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [showModReasonInput, setShowModReasonInput] = useState<string | null>(null);
  const [modReason, setModReason] = useState('');

  // Check if user is a moderator or higher
  const canModerate = user && ['moderator', 'admin', 'owner'].includes(user.rank || '');
  const isAdmin = user && ['admin', 'owner'].includes(user.rank || '');

  useEffect(() => {
    if (id) {
      fetchImage();
      fetchComments();
    }
  }, [id]);

  const fetchImage = async () => {
    try {
      const response = await axios.get(`/api/images/${id}`);
      if (response.data.success) {
        setImage(response.data.image);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setNotFound(true);
      } else {
        console.error('Error fetching image:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/images/${id}/comments`);
      if (response.data.success) {
        setComments(response.data.comments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await axios.post(`/api/images/${id}/comments`, {
        content: commentText,
        parentId: replyTo,
      });
      
      if (response.data.success) {
        setCommentText('');
        setReplyTo(null);
        fetchComments();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleVote = async (type: 'upvote' | 'downvote') => {
    if (!user) {
      alert('Please login to vote');
      return;
    }

    try {
      await axios.post('/api/vote', { imageId: id, type });
      if (userVote === type) {
        setUserVote(null);
      } else {
        setUserVote(type);
      }
      fetchImage();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to vote');
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      alert('Please login to favorite');
      return;
    }

    try {
      await axios.post('/api/favorite', { imageId: id });
      setIsFavorited(!isFavorited);
      fetchImage();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to toggle favorite');
    }
  };

  const handleDelete = async () => {
    if (!user || !confirm('Are you sure you want to delete this image?')) return;

    try {
      await axios.delete(`/api/images/${id}`, {
        data: { userId: user.id },
      });
      window.location.href = '/';
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete image');
    }
  };

  const handleModerationAction = async (action: 'delete' | 'unlist' | 'restore') => {
    if (!canModerate) return;
    
    const actionLabels: Record<string, string> = {
      delete: 'delete this image',
      unlist: 'unlist this image (hide from public listings)',
      restore: 'restore this image',
    };

    if (action !== 'restore' && !modReason.trim()) {
      alert('Please provide a reason for this moderation action.');
      return;
    }

    if (!confirm(`Are you sure you want to ${actionLabels[action]}?`)) return;

    setModerating(true);
    try {
      const response = await axios.post('/api/moderation/action', {
        action,
        targetType: 'image',
        targetId: id,
        reason: modReason || undefined,
      });

      if (response.data.success) {
        const message = response.data.reversible 
          ? `Image ${action}d successfully. This action can be undone within 1 week.`
          : `Image ${action}d successfully.`;
        alert(message);
        
        if (action === 'delete') {
          router.push('/');
        } else {
          fetchImage();
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.error || `Failed to ${action} image`);
    } finally {
      setModerating(false);
      setShowModReasonInput(null);
      setModReason('');
    }
  };

  const handleUndoAction = async () => {
    if (!canModerate) return;
    if (!confirm('Are you sure you want to undo your last moderation action on this image?')) return;

    setModerating(true);
    try {
      const response = await axios.post('/api/moderation/action', {
        action: 'undo',
        targetType: 'image',
        targetId: id,
      });

      if (response.data.success) {
        alert('Action undone successfully.');
        fetchImage();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to undo action');
    } finally {
      setModerating(false);
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'safe':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'questionable':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'explicit':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Image card skeleton */}
            <Card className="overflow-hidden">
              <div className="bg-muted/50 border-b px-4 py-2 flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
              <div className="relative bg-black/50 flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <Skeleton className="absolute inset-0" />
              </div>
            </Card>

            {/* Actions skeleton */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-16 rounded-md" />
                    <Skeleton className="h-9 w-16 rounded-md" />
                    <Skeleton className="h-9 w-16 rounded-md" />
                    <Skeleton className="h-9 w-14 rounded-md" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-24 rounded-md" />
                    <Skeleton className="h-9 w-20 rounded-md" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Moderation + comments skeleton */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-28" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-5 w-24" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-5 w-16" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-7 w-20 rounded-md" />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-5 w-24" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Image not found</h1>
        <p className="text-muted-foreground mb-6">This image doesn't exist or has been deleted.</p>
        <Button asChild variant="outline">
          <Link href="/">Back to gallery</Link>
        </Button>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Image not found</h1>
        <Button asChild variant="outline">
          <Link href="/">Back to gallery</Link>
        </Button>
      </div>
    );
  }

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

  const organizeComments = (comments: Comment[]) => {
    const commentMap = new Map<string, Comment & { replies: Comment[] }>();
    const topLevel: (Comment & { replies: Comment[] })[] = [];

    comments.forEach(comment => {
      commentMap.set(comment._id.toString(), { ...comment, replies: [] });
    });

    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment._id.toString())!;
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId.toString());
        if (parent) {
          parent.replies.push(commentWithReplies);
        }
      } else {
        topLevel.push(commentWithReplies);
      }
    });

    return topLevel;
  };

  const commentsSection = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment Form */}
        {user ? (
          <form onSubmit={handleSubmitComment} className="space-y-4">
            <div className="flex gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                {replyTo && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Replying to comment</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)} className="h-auto py-0.5 px-2 text-xs text-destructive hover:text-destructive">
                      Cancel
                    </Button>
                  </div>
                )}
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="min-h-[80px] resize-none"
                  maxLength={5000}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {commentText.length}/5000
                  </span>
                  <Button type="submit" size="sm" disabled={!commentText.trim() || submittingComment}>
                    <Send className="h-4 w-4 mr-2" />
                    {submittingComment ? 'Posting...' : 'Post Comment'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">Log in</Link> to post a comment
            </p>
          </div>
        )}

        <Separator />

        {/* Comments List */}
        <div className="space-y-6">
          {organizeComments(comments).map((comment) => (
            <div key={comment._id.toString()} className="space-y-4">
              {/* Top-level Comment */}
              <div className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={comment.avatarUrl || undefined} />
                  <AvatarFallback>{comment.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Link href={`/user/${comment.username}`} className="font-semibold hover:text-primary transition-colors">
                      {comment.username}
                    </Link>
                    {comment.rank && comment.rank !== 'user' && (
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getRankBadge(comment.rank))}>
                        {comment.rank}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-2">{comment.content}</p>
                  {user && (
                    <Button variant="ghost" size="sm" onClick={() => setReplyTo(comment._id.toString())} className="h-auto py-0.5 px-2 text-xs text-muted-foreground hover:text-primary">
                      Reply
                    </Button>
                  )}
                </div>
              </div>

              {/* Replies */}
              {comment.replies.length > 0 && (
                <div className="ml-12 space-y-4 border-l-2 border-border pl-4">
                  {comment.replies.map((reply) => (
                    <div key={reply._id.toString()} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={reply.avatarUrl || undefined} />
                        <AvatarFallback>{reply.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/user/${reply.username}`} className="font-semibold text-sm hover:text-primary transition-colors">
                            {reply.username}
                          </Link>
                          {!reply.userId && (
                            <span className="text-xs text-muted-foreground">(system)</span>
                          )}
                          {reply.rank && reply.rank !== 'user' && (
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getRankBadge(reply.rank))}>
                              {reply.rank}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(reply.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {comments.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Image */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            {/* Image Size Toggle */}
            <div className="bg-muted/50 border-b px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {image.width} × {image.height} • {(image.fileSize / 1024 / 1024).toFixed(2)} MB
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setImageSize(imageSize === 'fit' ? 'original' : 'fit')}
              >
                {imageSize === 'fit' ? (
                  <>
                    <Maximize2 className="h-4 w-4 mr-2" />
                    View Original
                  </>
                ) : (
                  <>
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Fit to Screen
                  </>
                )}
              </Button>
            </div>
            
            <div className={cn(
              imageSize === 'fit' ? 'flex justify-center items-center bg-black/50' : 'overflow-auto'
            )}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.tags.map(t => {
                  if (typeof t === 'string') return t;
                  if (t && typeof t === 'object' && 'name' in t) return (t as any).name;
                  return 'image';
                }).join(', ')}
                className={imageSize === 'fit' ? 'max-w-full max-h-[70vh] object-contain' : 'w-auto h-auto'}
              />
            </div>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant={userVote === 'upvote' ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => handleVote('upvote')}
                    className={cn(userVote === 'upvote' && "bg-primary")}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1.5" />
                    {image.upvotes}
                  </Button>
                  <Button
                    variant={userVote === 'downvote' ? 'destructive' : 'secondary'}
                    size="sm"
                    onClick={() => handleVote('downvote')}
                  >
                    <ThumbsDown className="h-4 w-4 mr-1.5" />
                    {image.downvotes}
                  </Button>
                  <Button
                    variant={isFavorited ? 'default' : 'secondary'}
                    size="sm"
                    onClick={handleFavorite}
                    className={cn(isFavorited && "bg-pink-600 hover:bg-pink-500")}
                  >
                    <Heart className={cn("h-4 w-4 mr-1.5", isFavorited && "fill-current")} />
                    {image.favorites}
                  </Button>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md text-muted-foreground text-sm">
                    <Eye className="h-4 w-4" />
                    {image.views}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <a href={image.url} download>
                      <Download className="h-4 w-4 mr-1.5" />
                      Download
                    </a>
                  </Button>
                  {user && image.userId && user.id === image.userId.toString() && (
                    <Button variant="destructive" size="sm" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Moderation Tools */}
          {canModerate && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-400">Moderation Tools</span>
                  {!isAdmin && (
                    <span className="text-xs text-muted-foreground">(actions reversible for 1 week)</span>
                  )}
                </div>

                {/* Status Indicators */}
                {(image.deleted || image.unlisted) && (
                  <div className="mb-3 space-y-2">
                    {image.deleted && (
                      <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <Trash2 className="h-4 w-4 text-red-400" />
                        <span className="text-sm text-red-400">
                          Deleted by {image.deletedByUsername || 'moderator'} 
                          {image.deletionReason && ` - ${image.deletionReason}`}
                        </span>
                      </div>
                    )}
                    {image.unlisted && (
                      <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <EyeOff className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm text-yellow-400">
                          Unlisted by {image.unlistedByUsername || 'moderator'}
                          {image.unlistReason && ` - ${image.unlistReason}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Reason Input */}
                {showModReasonInput && (
                  <div className="mb-3 space-y-2">
                    <Textarea
                      value={modReason}
                      onChange={(e) => setModReason(e.target.value)}
                      placeholder="Enter reason for this action..."
                      className="min-h-[60px] text-sm"
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleModerationAction(showModReasonInput as 'delete' | 'unlist')}
                        disabled={moderating}
                        className={showModReasonInput === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}
                      >
                        {moderating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => { setShowModReasonInput(null); setModReason(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!showModReasonInput && (
                  <div className="flex flex-wrap gap-2">
                    {!image.deleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowModReasonInput('delete')}
                        disabled={moderating}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete
                      </Button>
                    )}
                    {!image.unlisted && !image.deleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowModReasonInput('unlist')}
                        disabled={moderating}
                        className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                      >
                        <EyeOff className="h-4 w-4 mr-1.5" />
                        Unlist
                      </Button>
                    )}
                    {(image.deleted || image.unlisted) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleModerationAction('restore')}
                        disabled={moderating}
                        className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                      >
                        {moderating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
                        Restore
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUndoAction}
                      disabled={moderating}
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5" />
                      Undo Last Action
                    </Button>
                  </div>
                )}

                {image.dmcaRequestId && (
                  <div className="mt-3 flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-red-400">This image was removed due to a DMCA takedown request.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {imageSize === 'fit' && commentsSection}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Uploaded by</span>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Link href={`/user/${image.username || 'anonymous'}`} className="text-primary hover:underline font-medium">
                    {image.username}
                  </Link>
                  {!image.userId && (
                    <span className="text-xs text-muted-foreground">(system)</span>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Date</span>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Rating</span>
                <div>
                  <Badge variant="outline" className={cn("uppercase", getRatingColor(image.rating))}>
                    {image.rating}
                  </Badge>
                </div>
              </div>

              {image.isAIGenerated && (
                <>
                  <Separator />
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                    <Sparkles className="h-3 w-3 mr-1.5" />
                    AI Generated
                  </Badge>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Dimensions</span>
                  <p className="font-medium">{image.width} × {image.height}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">File Size</span>
                  <p className="font-medium">{(image.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>

              {image.source && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Source</span>
                    <a
                      href={image.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Source
                    </a>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {image.tags
                  .map((tag) => {
                    let tagName = 'unknown';
                    let tagType: 'general' | 'artist' | 'character' | 'copyright' | 'meta' = 'general';
                    
                    if (typeof tag === 'string') {
                      tagName = tag;
                    } else if (tag && typeof tag === 'object' && 'name' in tag) {
                      const tagObj = tag as any;
                      tagName = tagObj.name || 'unknown';
                      tagType = tagObj.type || 'general';
                    }
                    
                    return { tagName, tagType };
                  })
                  .sort((a, b) => {
                    const typeOrder = { artist: 0, copyright: 1, character: 2, general: 3, meta: 4 };
                    return typeOrder[a.tagType] - typeOrder[b.tagType];
                  })
                  .map(({ tagName, tagType }) => {
                    const typeColors = {
                      artist: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
                      copyright: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
                      character: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20',
                      general: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
                      meta: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
                    };
                    return (
                      <Link
                        key={tagName}
                        href={`/posts?tags=${encodeURIComponent(tagName)}`}
                        className={cn(
                          "px-2.5 py-1 rounded-md border text-sm transition-colors",
                          typeColors[tagType as keyof typeof typeColors]
                        )}
                      >
                        {tagName}
                      </Link>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {image.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/90 whitespace-pre-wrap">{image.description}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {imageSize === 'original' && (
        <div className="mt-6">
          {commentsSection}
        </div>
      )}
    </div>
  );
}
