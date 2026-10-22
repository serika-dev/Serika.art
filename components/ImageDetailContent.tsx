'use client';

import React, { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import axios from 'axios';
import { Image as ImageType, Comment, Tag as TagModel } from '@/lib/models';
import { Heart, ThumbsUp, ThumbsDown, Eye, Download, Trash2, Sparkles, ExternalLink, Calendar, User, Maximize2, Minimize2, MessageCircle, Send, Shield, EyeOff, RotateCcw, History, Loader2, Palette, Search, Edit2, X } from 'lucide-react';
import Link from 'next/link';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import NativeAd from '@/components/NativeAd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { normalizeTagName } from '@/lib/tagName';

const TAG_GROUPS = [
  { type: 'artist', label: 'Artist' },
  { type: 'copyright', label: 'Copyright' },
  { type: 'character', label: 'Character' },
  { type: 'general', label: 'General' },
  { type: 'meta', label: 'Meta' },
] as const;

const TAG_COLORS: Record<string, string> = {
  artist: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
  copyright: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
  character: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20',
  general: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
  meta: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
};

interface ImageDetailContentProps {
  initialImage: ImageType;
  imageId: string;
  /** "hatsune miku (vocaloid) drawn by kuroi" – the page's h1 */
  headline?: string;
  /** Plain-sentence description of the post, rendered under the h1 */
  summary?: string;
  /** Descriptive alt text for the image */
  imageAlt?: string;
}

export default function ImageDetailContent({ initialImage, imageId, headline, summary, imageAlt }: ImageDetailContentProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [image, setImage] = useState<ImageType>(initialImage);
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
  
  // Artist comment state
  const [canCommentAsArtist, setCanCommentAsArtist] = useState(false);
  const [userArtistTags, setUserArtistTags] = useState<{ tagId: string; tagName: string }[]>([]);
  const [commentAsArtist, setCommentAsArtist] = useState(false);
  const [selectedArtistTag, setSelectedArtistTag] = useState<string | null>(null);

  // Edit state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTags, setEditTags] = useState<{ name: string; type: 'general' | 'artist' | 'character' | 'copyright' | 'meta' }[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editTagSuggestions, setEditTagSuggestions] = useState<TagModel[]>([]);
  const [showEditTagSuggestions, setShowEditTagSuggestions] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editRating, setEditRating] = useState<'safe' | 'questionable' | 'explicit'>('safe');
  const [editIsAIGenerated, setEditIsAIGenerated] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Comment edit/delete states
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [updatingComment, setUpdatingComment] = useState(false);

  // Check if user is a moderator or higher
  const canModerate = user && ['moderator', 'admin', 'owner'].includes(user.rank || '');
  const isAdmin = user && ['admin', 'owner'].includes(user.rank || '');
  const canEdit = user && (canModerate || (image?.userId && user.id === image.userId.toString()));
  const provenance = (image as { aiProvenance?: { source: string; evidence: string } | null }).aiProvenance ?? null;
  const aiLocked = !!provenance && !canModerate;

  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // The page itself is served from cache, so count the view from here
  useEffect(() => {
    fetch(`/api/images/${imageId}/view`, { method: 'POST', keepalive: true }).catch(() => {});
  }, [imageId]);

  useEffect(() => {
    fetchComments();
    fetchArtistStatus();
    checkUserInteraction();
  }, [imageId, user]);

  const checkUserInteraction = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`/api/images/${imageId}/user-interaction`);
      if (response.data.success && isMounted.current) {
        setUserVote(response.data.vote);
        setIsFavorited(response.data.isFavorited);
      }
    } catch (error) {
       // Silently fail interaction check
    }
  };

  const fetchArtistStatus = async () => {
    try {
      const response = await axios.get(`/api/images/${imageId}/artist-status`);
      if (response.data.success && isMounted.current) {
        setCanCommentAsArtist(response.data.canCommentAsArtist);
        setUserArtistTags(response.data.artistTags || []);
        if (response.data.artistTags?.length === 1) {
          setSelectedArtistTag(response.data.artistTags[0].tagId);
        }
      }
    } catch (error) {
      console.error('Error fetching artist status:', error);
    }
  };

  const fetchImage = async () => {
    try {
      const response = await axios.get(`/api/images/${imageId}`);
      if (response.data.success && isMounted.current) {
        setImage(response.data.image);
      }
    } catch (error) {
      console.error('Error fetching image:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/images/${imageId}/comments`);
      if (response.data.success && isMounted.current) {
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
      const response = await axios.post(`/api/images/${imageId}/comments`, {
        content: commentText,
        parentId: replyTo,
        asArtist: commentAsArtist && selectedArtistTag ? true : false,
        artistTagId: commentAsArtist ? selectedArtistTag : undefined,
      });
      
      if (response.data.success) {
        setCommentText('');
        setReplyTo(null);
        setCommentAsArtist(false);
        fetchComments();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEditComment = (commentId: string, content: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(content);
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    setUpdatingComment(true);
    try {
      const response = await axios.patch(`/api/comments/${commentId}`, {
        content: editingCommentText,
      });
      if (response.data.success) {
        setEditingCommentId(null);
        setEditingCommentText('');
        fetchComments();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update comment');
    } finally {
      setUpdatingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      const response = await axios.delete(`/api/comments/${commentId}`);
      if (response.data.success) {
        fetchComments();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete comment');
    }
  };

  const handleVote = async (type: 'upvote' | 'downvote') => {
    if (!user) {
      alert('Please login to vote');
      return;
    }

    try {
      await axios.post('/api/vote', { imageId: imageId, type });
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
      await axios.post('/api/favorite', { imageId: imageId });
      setIsFavorited(!isFavorited);
      fetchImage();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to toggle favorite');
    }
  };

  const handleDelete = async () => {
    if (!user || !confirm('Are you sure you want to delete this image?')) return;

    try {
      await axios.delete(`/api/images/${imageId}`, {
        data: { userId: user.id },
      });
      router.push('/');
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
        targetId: imageId,
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
        targetId: imageId,
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

  const openEditDialog = () => {
    if (!image) return;
    
    // Initialize edit state with current image data
    const currentTags = (image.tags || []).map((tag: any) => ({
      name: typeof tag === 'string' ? tag : tag.name,
      type: typeof tag === 'object' && tag.type ? tag.type : 'general' as const,
    }));
    
    setEditTags(currentTags);
    setEditDescription(image.description || '');
    setEditSource(image.source || '');
    setEditRating(image.rating);
    setEditIsAIGenerated(image.isAIGenerated || false);
    setIsEditDialogOpen(true);
  };

  const fetchEditTagSuggestions = async () => {
    try {
      const response = await axios.get('/api/tags', { params: { suggest: editTagInput.trim(), limit: 10 } });
      if (response.data.success) {
        setEditTagSuggestions(response.data.suggestions);
        setShowEditTagSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const addEditTag = (tag: TagModel) => {
    if (!editTags.some(t => t.name === tag.name)) {
      setEditTags([...editTags, { name: tag.name, type: tag.type }]);
    }
    setEditTagInput('');
    setShowEditTagSuggestions(false);
  };

  const removeEditTag = (tagName: string) => {
    setEditTags(editTags.filter(t => t.name !== tagName));
  };

  const handleEditTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const normalizedInput = normalizeTagName(editTagInput);
      
      if (!normalizedInput) return;
      
      const exactMatch = editTagSuggestions.find(
        t => t.name.toLowerCase() === normalizedInput
      );
      
      if (exactMatch) {
        addEditTag(exactMatch);
      } else if (editTagSuggestions.length > 0) {
        addEditTag(editTagSuggestions[0]);
      } else {
        if (!editTags.some(t => t.name === normalizedInput)) {
          setEditTags([...editTags, { name: normalizedInput, type: 'general' }]);
          setEditTagInput('');
        }
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!user || !image) return;
    
    if (editTags.length === 0) {
      alert('At least one tag is required');
      return;
    }

    setSavingEdit(true);
    try {
      const response = await axios.patch(`/api/images/${imageId}`, {
        tags: editTags,
        description: editDescription,
        source: editSource,
        rating: editRating,
        isAIGenerated: editIsAIGenerated,
      });

      if (response.data.success) {
        alert('Image updated successfully');
        setIsEditDialogOpen(false);
        fetchImage();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update image');
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    if (editTagInput.trim().length > 0) {
      fetchEditTagSuggestions();
    } else {
      setEditTagSuggestions([]);
      setShowEditTagSuggestions(false);
    }
  }, [editTagInput]);

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'safe': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'questionable': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'explicit': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRankBadge = (rank: string) => {
    switch (rank) {
      case 'owner': return 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white border-0';
      case 'admin': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'moderator': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const organizeComments = (comments: Comment[]) => {
    const commentMap = new Map<string, Comment & { replies: Comment[] }>();
    const topLevel: (Comment & { replies: Comment[] })[] = [];

    comments.forEach(comment => {
      const idStr = (comment.id || comment._id)?.toString();
      if (idStr) {
        commentMap.set(idStr, { ...comment, replies: [] });
      }
    });

    comments.forEach(comment => {
      const idStr = (comment.id || comment._id)?.toString();
      if (!idStr) return;
      const commentWithReplies = commentMap.get(idStr)!;
      const parentId = comment.parentId || comment.parent_id;
      if (parentId) {
        const parent = commentMap.get(parentId.toString());
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {commentText.length}/5000
                    </span>
                    {canCommentAsArtist && userArtistTags.length > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commentAsArtist}
                          onChange={(e) => setCommentAsArtist(e.target.checked)}
                          className="rounded border-red-500/50 text-red-500 focus:ring-red-500"
                        />
                        <span className="text-xs flex items-center gap-1.5">
                          <Palette className="h-3 w-3 text-red-400" />
                          <span className="text-red-400">
                            Comment as {userArtistTags.length === 1 
                              ? userArtistTags[0].tagName.replace(/_/g, ' ') 
                              : 'Artist'}
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
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
              <Link href="/login" className="text-primary underline underline-offset-2">Log in</Link> to post a comment
            </p>
          </div>
        )}

        <Separator />

        <div className="space-y-6">
          {organizeComments(comments).map((comment) => (
            <div key={(comment.id || comment._id)?.toString()} className="space-y-4">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={comment.avatarUrl || undefined} />
                  <AvatarFallback>{comment.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Link href={`/user/${encodeURIComponent(comment.username.trim())}`} className="font-semibold hover:text-primary transition-colors">
                      {comment.username}
                    </Link>
                    {comment.asArtist && (comment as any).artistTagName && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-400 border-red-500/30">
                        <Palette className="h-2.5 w-2.5 mr-1" />
                        {((comment as any).artistTagName as string).replace(/_/g, ' ')}
                      </Badge>
                    )}
                    {comment.rank && comment.rank !== 'user' && (
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getRankBadge(comment.rank))}>
                        {comment.rank}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {editingCommentId === (comment.id || comment._id)?.toString() ? (
                    <div className="space-y-2 mb-2 mt-1">
                      <textarea
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        className="w-full text-sm bg-background border border-input rounded-md p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateComment((comment.id || comment._id)!.toString())} disabled={updatingComment}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCommentId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-2">{comment.content}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {user && (
                      <Button variant="ghost" size="sm" onClick={() => setReplyTo((comment.id || comment._id)?.toString())} className="h-auto py-0.5 px-2 text-xs text-muted-foreground hover:text-primary">
                        Reply
                      </Button>
                    )}
                    {user && (comment.userId === user.id || canModerate) && editingCommentId !== (comment.id || comment._id)?.toString() && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleEditComment((comment.id || comment._id)!.toString(), comment.content)} className="h-auto py-0.5 px-2 text-xs text-muted-foreground hover:text-primary">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteComment((comment.id || comment._id)!.toString())} className="h-auto py-0.5 px-2 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10">
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {comment.replies.length > 0 && (
                <div className="ml-12 space-y-4 border-l-2 border-border pl-4">
                  {comment.replies.map((reply) => (
                    <div key={(reply.id || reply._id)?.toString()} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={reply.avatarUrl || undefined} />
                        <AvatarFallback>{reply.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Link href={`/user/${encodeURIComponent(reply.username.trim())}`} className="font-semibold text-sm hover:text-primary transition-colors">
                            {reply.username}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {new Date(reply.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {editingCommentId === (reply.id || reply._id)?.toString() ? (
                          <div className="space-y-2 mb-2 mt-1">
                            <textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="w-full text-sm bg-background border border-input rounded-md p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleUpdateComment((reply.id || reply._id)!.toString())} disabled={updatingComment}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingCommentId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{reply.content}</p>
                        )}
                        {user && (reply.userId === user.id || canModerate) && editingCommentId !== (reply.id || reply._id)?.toString() && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Button variant="ghost" size="sm" onClick={() => handleEditComment((reply.id || reply._id)!.toString(), reply.content)} className="h-auto py-0.5 px-2 text-xs text-muted-foreground hover:text-primary">
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteComment((reply.id || reply._id)!.toString())} className="h-auto py-0.5 px-2 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10">
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {headline && (
        <h1 className="mb-4 text-xl font-bold capitalize leading-snug tracking-tight text-foreground/90 sm:text-2xl">
          {headline}
        </h1>
      )}
      {(summary || image.description) && (
        <div className="mb-6 max-w-3xl space-y-2 text-sm leading-relaxed text-muted-foreground">
          {image.description && <p className="whitespace-pre-line text-foreground/80">{image.description}</p>}
          {summary && <p>{summary}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-muted/50 border-b px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                {image.width} × {image.height} • {((image.fileSize || image.file_size || 0) / 1024 / 1024).toFixed(2)} MB • ID #{image.sequentialId}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setImageSize(imageSize === 'fit' ? 'original' : 'fit')}
              >
                {imageSize === 'fit' ? <><Maximize2 className="h-4 w-4 mr-2" /> View Original</> : <><Minimize2 className="h-4 w-4 mr-2" /> Fit to Screen</>}
              </Button>
            </div>
            
            <div className={cn(
              imageSize === 'fit' ? 'flex justify-center items-center bg-zinc-950/40 p-4' : 'overflow-auto bg-zinc-950/40'
            )}>
              {imageSize === 'fit' && image.width > 0 && image.height > 0 ? (
                // Straight from the CDN, not the Next image optimizer: resizing a
                // multi-MB original takes seconds of CPU on the app server, and
                // at ~20 post views a second that took the whole site down
                // (it also starved the thread pool DB connections need).
                <NextImage
                  src={image.url}
                  unoptimized
                  alt={imageAlt || (image.tags || []).map(t => typeof t === 'string' ? t : (t as any).name).join(', ')}
                  width={image.width}
                  height={image.height}
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  // A definite width (column width, or whatever keeps it under
                  // 85vh tall) lets the browser reserve the height from the
                  // aspect ratio before the file arrives: no layout shift.
                  style={{ width: `min(100%, calc(85vh * ${image.width / image.height}))` }}
                  className="h-auto max-w-full object-contain shadow-2xl rounded-sm"
                  preload
                  fetchPriority="high"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={image.url}
                  alt={imageAlt || (image.tags || []).map(t => typeof t === 'string' ? t : (t as any).name).join(', ')}
                  className={imageSize === 'fit' ? 'max-w-full max-h-[85vh] object-contain shadow-2xl rounded-sm' : 'w-auto h-auto'}
                  fetchPriority="high"
                />
              )}
            </div>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button variant={userVote === 'upvote' ? 'default' : 'secondary'} size="sm" onClick={() => handleVote('upvote')}>
                    <ThumbsUp className="h-4 w-4 mr-1.5" /> {image.upvotes}
                  </Button>
                  <Button variant={userVote === 'downvote' ? 'destructive' : 'secondary'} size="sm" onClick={() => handleVote('downvote')}>
                    <ThumbsDown className="h-4 w-4 mr-1.5" /> {image.downvotes}
                  </Button>
                  <Button variant={isFavorited ? 'default' : 'secondary'} size="sm" onClick={handleFavorite} className={cn(isFavorited && "bg-pink-600 hover:bg-pink-500")}>
                    <Heart className={cn("h-4 w-4 mr-1.5", isFavorited && "fill-current")} /> {image.favorites}
                  </Button>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md text-muted-foreground text-sm font-medium">
                    <Eye className="h-4 w-4" /> {image.views}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <a href={image.url} download>
                      <Download className="h-4 w-4 mr-1.5" /> Download
                    </a>
                  </Button>
                  {canEdit && <Button variant="secondary" size="sm" onClick={openEditDialog}><Edit2 className="h-4 w-4 mr-1.5" /> Edit</Button>}
                </div>
              </div>
            </CardContent>
          </Card>

          {canModerate && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">Moderation Tools</span>
                  </div>
                  {image.deleted && (
                    <Badge variant="destructive" className="animate-pulse">DELETED</Badge>
                  )}
                  {image.unlisted && (
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">UNLISTED</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!image.deleted ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowModReasonInput('delete')} 
                      className={cn("border-red-500/30 text-red-400 hover:bg-red-500/10", showModReasonInput === 'delete' && "bg-red-500/20")}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleModerationAction('restore')} 
                      disabled={moderating}
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5" /> Restore
                    </Button>
                  )}
                  
                  {!image.unlisted ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowModReasonInput('unlist')} 
                      className={cn("border-amber-500/30 text-amber-400 hover:bg-amber-500/10", showModReasonInput === 'unlist' && "bg-amber-500/20")}
                    >
                      <EyeOff className="h-4 w-4 mr-1.5" /> Unlist
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleModerationAction('restore')} 
                      disabled={moderating}
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5" /> Re-list
                    </Button>
                  )}

                  <Button size="sm" variant="outline" onClick={handleUndoAction} disabled={moderating} className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                    <History className="h-4 w-4 mr-1.5" /> Undo Last
                  </Button>
                </div>

                {showModReasonInput && (
                  <div className="space-y-3 pt-2 border-t border-amber-500/20 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="mod-reason" className="text-xs text-amber-400">Reason for {showModReasonInput}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="mod-reason"
                        size={1}
                        value={modReason}
                        onChange={(e) => setModReason(e.target.value)}
                        placeholder="Required reason..."
                        className="h-9 bg-zinc-900 border-amber-500/30 focus-visible:ring-amber-500"
                        autoFocus
                      />
                      <Button 
                        size="sm" 
                        onClick={() => handleModerationAction(showModReasonInput as any)}
                        disabled={moderating || !modReason.trim()}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowModReasonInput(null)} className="text-muted-foreground">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {imageSize === 'fit' && commentsSection}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Uploaded by</span>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Link href={`/user/${encodeURIComponent(image.username.trim())}`} className="text-primary hover:underline font-bold">{image.username}</Link>
                </div>
              </div>
              <Separator />
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Metadata</span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                  <div><span className="text-[10px] text-muted-foreground block">Dimensions</span><span className="text-sm font-medium">{image.width} × {image.height}</span></div>
                  <div><span className="text-[10px] text-muted-foreground block">Size</span><span className="text-sm font-medium">{((image.fileSize || image.file_size || 0) / 1024 / 1024).toFixed(2)} MB</span></div>
                  <div><span className="text-[10px] text-muted-foreground block">Rating</span><Badge variant="outline" className={cn("uppercase text-[10px]", getRatingColor(image.rating))}>{image.rating}</Badge></div>
                  <div><span className="text-[10px] text-muted-foreground block">Date</span><span className="text-sm font-medium">{new Date(image.createdAt || image.created_at || new Date()).toLocaleDateString()}</span></div>
                </div>
              </div>
              {image.source && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Original Source</span>
                    <a href={image.source} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1.5 text-sm truncate"><ExternalLink className="h-3.5 w-3.5" /> {image.source}</a>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
            <CardContent>
              {/* Grouped like a booru: who drew it, what it's from, who's in it, what's in it */}
              <div className="space-y-4">
                {TAG_GROUPS.map(({ type, label }) => {
                  const group = (image.tags || [])
                    .map((tag: any) => ({
                      name: typeof tag === 'string' ? tag : tag.name,
                      type: (typeof tag === 'object' && tag.type) || 'general',
                    }))
                    .filter((t: { type: string }) => (type === 'general' ? !TAG_GROUPS.some((g) => g.type === t.type && g.type !== 'general') : t.type === type))
                    .sort((x: { name: string }, y: { name: string }) => x.name.localeCompare(y.name));
                  if (group.length === 0) return null;
                  return (
                    <div key={type}>
                      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</h3>
                      <ul className="flex flex-wrap gap-1.5">
                        {group.map(({ name }: { name: string }) => {
                          const slug = normalizeTagName(name);
                          return (
                            <li key={slug}>
                              <Link href={`/posts?tags=${encodeURIComponent(slug)}`} className={cn("px-2.5 py-1 rounded-md border text-xs font-bold transition-all hover:scale-105 inline-block", TAG_COLORS[type])}>
                                {slug.replace(/_/g, ' ')}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <NativeAd rating={image.rating} id="sidebar-ad" variant="sidebar" />
        </div>

      </div>
      
      {/* Edit Dialog - Kept simple in extraction */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800">
          <DialogHeader><DialogTitle>Edit Metadata</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {editTags.map((tag) => (
                  <Badge key={tag.name} variant="secondary" className="cursor-pointer hover:bg-destructive" onClick={() => removeEditTag(tag.name)}>
                    {tag.name} ×
                  </Badge>
                ))}
              </div>
              <div className="relative">
                <Input
                  value={editTagInput}
                  onChange={(e) => {
                    setEditTagInput(e.target.value);
                    if (e.target.value.trim()) {
                      fetchEditTagSuggestions();
                    } else {
                      setShowEditTagSuggestions(false);
                    }
                  }}
                  onKeyDown={handleEditTagKeyDown}
                  placeholder="Add tags..."
                />
                {showEditTagSuggestions && editTagSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg max-h-48 overflow-auto">
                    {editTagSuggestions.map((tag) => (
                      <button
                        key={tag.name}
                        className="w-full px-3 py-2 text-left hover:bg-zinc-800 text-sm"
                        onClick={() => addEditTag(tag)}
                      >
                        {tag.name} <span className="text-muted-foreground text-xs">({tag.type})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter description..."
                rows={3}
              />
            </div>

            {/* Source */}
            <div className="space-y-2">
              <Label htmlFor="edit-source">Source URL</Label>
              <Input
                id="edit-source"
                value={editSource}
                onChange={(e) => setEditSource(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <Label>Rating</Label>
              <Select value={editRating} onValueChange={(v) => setEditRating(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">Safe</SelectItem>
                  <SelectItem value="questionable">Questionable</SelectItem>
                  <SelectItem value="explicit">Explicit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AI Generated – locked on when the file's metadata says so */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-ai"
                  checked={editIsAIGenerated}
                  onCheckedChange={setEditIsAIGenerated}
                  disabled={aiLocked}
                />
                <Label htmlFor="edit-ai">AI Generated</Label>
              </div>
              {provenance && (
                <p className="text-xs text-muted-foreground">
                  {provenance.evidence} in the file show it was made with {provenance.source}.
                  {aiLocked ? ' It stays marked as AI-generated.' : ' (Moderators can override a false positive.)'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
