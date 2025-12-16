'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import axios from 'axios';
import { Image as ImageType, Comment } from '@/lib/models';
import { Heart, ThumbsUp, ThumbsDown, Eye, Download, Share2, Trash2, Sparkles, ExternalLink, Calendar, User, Maximize2, Minimize2, MessageCircle, Send, Loader2 } from 'lucide-react';
import Link from 'next/link';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
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
                    <Link href={`/user/${comment.userId}`} className="font-semibold hover:text-primary transition-colors">
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
                          <Link href={reply.userId ? `/user/${reply.userId}` : `/user/anonymous`} className="font-semibold text-sm hover:text-primary transition-colors">
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
                  <Link href={image.userId ? `/user/${image.userId}` : `/user/anonymous`} className="text-primary hover:underline font-medium">
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
