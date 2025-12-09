'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import axios from 'axios';
import { Image as ImageType, Comment } from '@/lib/models';
import { Heart, ThumbsUp, ThumbsDown, Eye, Download, Share2, Trash2, Sparkles, ExternalLink, Calendar, User, Maximize2, Minimize2, MessageCircle, Send } from 'lucide-react';
import Link from 'next/link';

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
        return 'bg-green-900/50 text-green-200 border border-green-800';
      case 'questionable':
        return 'bg-yellow-900/50 text-yellow-200 border border-yellow-800';
      case 'explicit':
        return 'bg-red-900/50 text-red-200 border border-red-800';
      default:
        return 'bg-zinc-800 text-zinc-300';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-white mb-4">Image not found</h1>
        <p className="text-zinc-400 mb-6">This image doesn't exist or has been deleted.</p>
        <Link href="/" className="text-blue-500 hover:text-blue-400">
          Back to gallery
        </Link>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-white mb-4">Image not found</h1>
        <Link href="/" className="text-blue-500 hover:text-blue-400">
          Back to gallery
        </Link>
      </div>
    );
  }

  const getRankBadge = (rank: string) => {
    switch (rank) {
      case 'owner':
        return 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white';
      case 'admin':
        return 'bg-red-900/50 text-red-200 border border-red-800';
      case 'moderator':
        return 'bg-blue-900/50 text-blue-200 border border-blue-800';
      default:
        return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
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
    <div className="bg-zinc-900 rounded-lg shadow-lg border border-zinc-800 p-6">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <MessageCircle size={24} />
        Comments ({comments.length})
      </h2>

      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmitComment} className="mb-8">
          <div className="flex gap-3">
            <img
              src={user.avatarUrl || 'https://via.placeholder.com/40'}
              alt={user.username}
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1">
              {replyTo && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm text-zinc-400">Replying to comment</span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                rows={3}
                maxLength={5000}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-zinc-500">
                  {commentText.length}/5000
                </span>
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 bg-zinc-800 rounded-lg text-center">
          <p className="text-zinc-400">
            <Link href="/login" className="text-blue-500 hover:text-blue-400">
              Log in
            </Link>{' '}
            to post a comment
          </p>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-6">
        {organizeComments(comments).map((comment) => (
          <div key={comment._id.toString()} className="space-y-4">
            {/* Top-level Comment */}
            <div className="flex gap-3">
              <img
                src={comment.avatarUrl || 'https://via.placeholder.com/40'}
                alt={comment.username}
                className="w-10 h-10 rounded-full"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Link
                    href={`/user/${comment.userId}`}
                    className="font-semibold text-white hover:text-blue-400"
                  >
                    {comment.username}
                  </Link>
                  {comment.rank && comment.rank !== 'user' && (
                    <span className={`${getRankBadge(comment.rank)} px-2 py-0.5 rounded text-xs uppercase font-medium`}>
                      {comment.rank}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-zinc-300 whitespace-pre-wrap mb-2">{comment.content}</p>
                {user && (
                  <button
                    onClick={() => setReplyTo(comment._id.toString())}
                    className="text-xs text-blue-500 hover:text-blue-400"
                  >
                    Reply
                  </button>
                )}
              </div>
            </div>

            {/* Replies */}
            {comment.replies.length > 0 && (
              <div className="ml-12 space-y-4">
                {comment.replies.map((reply) => (
                  <div key={reply._id.toString()} className="flex gap-3">
                    <img
                      src={reply.avatarUrl || 'https://via.placeholder.com/40'}
                      alt={reply.username}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={reply.userId ? `/user/${reply.userId}` : `/user/anonymous`}
                          className="font-semibold text-white hover:text-blue-400 text-sm"
                        >
                          {reply.username}
                        </Link>
                        {!reply.userId && (
                          <span className="text-xs text-zinc-500">(system)</span>
                        )}
                        {reply.rank && reply.rank !== 'user' && (
                          <span className={`${getRankBadge(reply.rank)} px-2 py-0.5 rounded text-xs uppercase font-medium`}>
                            {reply.rank}
                          </span>
                        )}
                        <span className="text-xs text-zinc-500">
                          {new Date(reply.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-zinc-300 whitespace-pre-wrap text-sm">{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {comments.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No comments yet. Be the first to comment!
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Image */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-800">
            {/* Image Size Toggle */}
            <div className="bg-zinc-800/50 border-b border-zinc-700 px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-zinc-400">
                {image.width} × {image.height} • {(image.fileSize / 1024 / 1024).toFixed(2)} MB
              </span>
              <button
                onClick={() => setImageSize(imageSize === 'fit' ? 'original' : 'fit')}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md transition text-sm"
              >
                {imageSize === 'fit' ? (
                  <>
                    <Maximize2 size={16} />
                    View Original
                  </>
                ) : (
                  <>
                    <Minimize2 size={16} />
                    Fit to Screen
                  </>
                )}
              </button>
            </div>
            
            <div className={`${imageSize === 'fit' ? 'flex justify-center items-center bg-black' : 'overflow-auto'}`}>
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
          </div>

          {/* Actions */}
          <div className="bg-zinc-900 rounded-lg shadow-lg p-4 mt-4 border border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVote('upvote')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
                    userVote === 'upvote'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <ThumbsUp size={18} />
                  {image.upvotes}
                </button>
                <button
                  onClick={() => handleVote('downvote')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
                    userVote === 'downvote'
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <ThumbsDown size={18} />
                  {image.downvotes}
                </button>
                <button
                  onClick={handleFavorite}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
                    isFavorited
                      ? 'bg-pink-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <Heart size={18} />
                  {image.favorites}
                </button>
                <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-md text-zinc-300">
                  <Eye size={18} />
                  {image.views}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={image.url}
                  download
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition"
                >
                  <Download size={18} />
                  Download
                </a>
                {user && image.userId && user.id === image.userId.toString() && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 transition"
                  >
                    <Trash2 size={18} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          {imageSize === 'fit' && commentsSection}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info */}
          <div className="bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-4">Information</h2>
            
            <div className="space-y-3">
              <div>
                <span className="text-sm text-zinc-500">Uploaded by</span>
                <div className="flex items-center gap-2 mt-1">
                  <User size={16} className="text-zinc-600" />
                  <Link href={image.userId ? `/user/${image.userId}` : `/user/anonymous`} className="text-blue-500 hover:text-blue-400 font-medium">
                    {image.username}
                  </Link>
                  {!image.userId && (
                    <span className="text-xs text-zinc-500">(system)</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-sm text-zinc-500">Date</span>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar size={16} className="text-zinc-600" />
                  <span className="text-zinc-300">{new Date(image.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <span className="text-sm text-zinc-500">Rating</span>
                <div className="mt-1">
                  <span className={`${getRatingColor(image.rating)} px-3 py-1 rounded-full text-sm font-medium uppercase`}>
                    {image.rating}
                  </span>
                </div>
              </div>

              {image.isAIGenerated && (
                <div>
                  <span className="bg-purple-900/50 text-purple-200 border border-purple-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 w-fit">
                    <Sparkles size={16} />
                    AI Generated
                  </span>
                </div>
              )}

              <div>
                <span className="text-sm text-zinc-500">Dimensions</span>
                <p className="text-zinc-300">{image.width} × {image.height}</p>
              </div>

              <div>
                <span className="text-sm text-zinc-500">File Size</span>
                <p className="text-zinc-300">{(image.fileSize / 1024 / 1024).toFixed(2)} MB</p>
              </div>

              {image.source && (
                <div>
                  <span className="text-sm text-zinc-500">Source</span>
                  <a
                    href={image.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-400 flex items-center gap-1 mt-1"
                  >
                    <ExternalLink size={14} />
                    View Source
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-4">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {image.tags.map((tag) => {
                let tagName = 'unknown';
                let tagType: 'general' | 'artist' | 'character' | 'copyright' | 'meta' = 'general';
                
                if (typeof tag === 'string') {
                  tagName = tag;
                } else if (tag && typeof tag === 'object' && 'name' in tag) {
                  const tagObj = tag as any;
                  tagName = tagObj.name || 'unknown';
                  tagType = tagObj.type || 'general';
                }
                
                const typeColors = {
                  artist: 'bg-red-900/30 text-red-200 border-red-800',
                  copyright: 'bg-purple-900/30 text-purple-200 border-purple-800',
                  character: 'bg-green-900/30 text-green-200 border-green-800',
                  general: 'bg-blue-900/30 text-blue-200 border-blue-800',
                  meta: 'bg-yellow-900/30 text-yellow-200 border-yellow-800',
                };
                return (
                  <Link
                    key={tagName}
                    href={`/posts?tags=${encodeURIComponent(tagName)}`}
                    className={`${typeColors[tagType as keyof typeof typeColors]} border px-3 py-1.5 rounded-md hover:opacity-80 transition text-sm`}
                  >
                    {tagName}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Description */}
          {image.description && (
            <div className="bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-800">
              <h2 className="text-xl font-bold text-white mb-4">Description</h2>
              <p className="text-zinc-300 whitespace-pre-wrap">{image.description}</p>
            </div>
          )}
        </div>
      </div>
      {imageSize === 'original' && (
        <div className="mt-8">
          {commentsSection}
        </div>
      )}
    </div>
  );
}
