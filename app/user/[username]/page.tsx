'use client';

import { useState, useEffect, use } from 'react';
import { Image } from '@/lib/models';
import ImageCard from '@/components/ImageCard';
import { Loader2, Calendar, User as UserIcon, Shield, Crown, ImageIcon, Mail, Link as LinkIcon, ThumbsUp, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import NextImage from 'next/image';

type UserRank = 'user' | 'moderator' | 'admin' | 'owner';

interface UserProfile {
  id: string;
  username: string;
  avatarUrl?: string;
  bannerUrl?: string;
  rank: UserRank;
  createdAt: string;
  bio?: string;
}

interface UserComment {
  _id: string;
  content: string;
  createdAt: string;
  image: {
    sequentialId: number;
    thumbnailUrl: string;
  } | null;
}

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [likedImages, setLikedImages] = useState<Image[]>([]);
  const [comments, setComments] = useState<UserComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalImages, setTotalImages] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mostRecentImage, setMostRecentImage] = useState<Image | null>(null);
  const LIMIT = 50;

  const isAnonymousUser = username.toLowerCase() === 'anonymous';

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user details by username (includes banner from accounts API)
        const userRes = await fetch(`/api/users?username=${encodeURIComponent(username)}`);
        const userData = await userRes.json();

        if (!userData.success) {
          throw new Error(userData.error || 'Failed to fetch user');
        }
        
        setUser(userData.user);

        // Fetch user images - use userId for indexed fast query
        const imageQuery = isAnonymousUser 
          ? `userId=null&limit=${LIMIT}&page=1`
          : `userId=${encodeURIComponent(userData.user.id)}&limit=${LIMIT}&page=1`;
        const imagesRes = await fetch(`/api/images?${imageQuery}`);
        const imagesData = await imagesRes.json();

        if (imagesData.success) {
          setImages(imagesData.images);
          setTotalImages(imagesData.pagination?.total || imagesData.images.length);
          setTotalPages(imagesData.pagination?.pages || 1);
          // Set most recent image for anonymous avatar
          if (isAnonymousUser && imagesData.images.length > 0) {
            setMostRecentImage(imagesData.images[0]);
          }
        }

        // Fetch user activity (likes and comments) - skip for anonymous
        if (!isAnonymousUser) {
          const activityRes = await fetch(`/api/users/${encodeURIComponent(username)}/activity`);
          const activityData = await activityRes.json();

          if (activityData.success) {
            setLikedImages(activityData.likes || []);
            setComments(activityData.comments || []);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      setPage(1);
      setImages([]);
      fetchData();
    }
  }, [username, isAnonymousUser]);

  // Load more images
  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const imageQuery = isAnonymousUser 
        ? `userId=null&limit=${LIMIT}&page=${nextPage}`
        : `userId=${encodeURIComponent(user!.id)}&limit=${LIMIT}&page=${nextPage}`;
      const imagesRes = await fetch(`/api/images?${imageQuery}`);
      const imagesData = await imagesRes.json();
      if (imagesData.success) {
        setImages(prev => [...prev, ...imagesData.images]);
        setPage(nextPage);
      }
    } catch (err) {
      console.error('Failed to load more images:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <UserIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">User not found</h1>
        <p className="text-muted-foreground">{error || 'This user does not exist'}</p>
        <Link href="/tags" className="text-primary hover:underline mt-4 inline-block">
          Browse tags instead
        </Link>
      </div>
    );
  }

  const getRankStyles = (rank: UserRank) => {
    switch (rank) {
      case 'owner':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0';
      case 'admin':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'moderator':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return '';
    }
  };

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Banner */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        {user.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.bannerUrl}
            alt="User banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="relative -mt-32 mb-12 z-10">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 px-4">
            {/* Avatar */}
            <div className="relative group">
              <Avatar className="h-40 w-40 md:h-48 md:w-48 border-[6px] border-background shadow-2xl flex-shrink-0 rounded-3xl overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
                <AvatarImage src={isAnonymousUser && mostRecentImage ? mostRecentImage.thumbnailUrl : user.avatarUrl} className="object-cover" />
                <AvatarFallback className="text-5xl bg-muted text-muted-foreground rounded-none">
                  {isAnonymousUser ? '?' : user.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* User Info */}
            <div className="flex-1 pb-2 space-y-4 text-center md:text-left">
              <div className="space-y-1">
                <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
                    {isAnonymousUser ? 'Anonymous' : user.username}
                  </h1>
                  {user.rank && user.rank !== 'user' && (
                    <Badge className={cn("font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider", getRankStyles(user.rank))}>
                      {user.rank === 'owner' ? <Crown className="h-3 w-3 mr-1.5" /> : <Shield className="h-3 w-3 mr-1.5" />}
                      {user.rank}
                    </Badge>
                  )}
                </div>
                {isAnonymousUser ? (
                  <p className="text-muted-foreground font-medium">
                    Content from users who aren't logged in
                  </p>
                ) : (
                  <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Bio */}
              {user.bio && !isAnonymousUser && (
                <p className="text-foreground/70 leading-relaxed max-w-2xl text-lg font-medium italic">
                  &ldquo;{user.bio}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-8 grid grid-cols-2 md:flex md:items-center gap-4 md:gap-12 p-6 rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm">
            <div className="space-y-0.5">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Uploads</div>
              <div className="text-2xl font-black text-foreground">{totalImages}</div>
            </div>
            {!isAnonymousUser && (
              <>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Likes</div>
                  <div className="text-2xl font-black text-foreground">{likedImages.length}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Comments</div>
                  <div className="text-2xl font-black text-foreground">{comments.length}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content Tabs */}
        <div className="mb-20">
          {isAnonymousUser ? (
            // Anonymous users only have uploads
            <>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
                Anonymous Uploads
              </h2>
              {images.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No uploads yet</h3>
                    <p className="text-muted-foreground">
                      No content from anonymous users yet
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 pb-8">
                    {images.map((image) => (
                      <ImageCard key={image._id.toString()} image={image} />
                    ))}
                  </div>
                  {page < totalPages && (
                    <div className="flex justify-center py-8">
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          `Load More (${images.length} of ${totalImages})`
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            // Regular users have tabs
            <Tabs defaultValue="uploads" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="uploads" className="gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Uploads ({totalImages})
                </TabsTrigger>
                <TabsTrigger value="likes" className="gap-2">
                  <ThumbsUp className="h-4 w-4" />
                  Likes ({likedImages.length})
                </TabsTrigger>
                <TabsTrigger value="comments" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comments ({comments.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="uploads">
                {images.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No uploads yet</h3>
                      <p className="text-muted-foreground">
                        {user.username} hasn&apos;t uploaded any images yet
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 pb-8">
                      {images.map((image) => (
                        <ImageCard key={image._id.toString()} image={image} />
                      ))}
                    </div>
                    {page < totalPages && (
                      <div className="flex justify-center py-8">
                        <button
                          onClick={loadMore}
                          disabled={loadingMore}
                          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {loadingMore ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            `Load More (${images.length} of ${totalImages})`
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="likes">
                {likedImages.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <ThumbsUp className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No likes yet</h3>
                      <p className="text-muted-foreground">
                        {user.username} hasn&apos;t liked any images yet
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 pb-8">
                    {likedImages.map((image) => (
                      <ImageCard key={image._id.toString()} image={image} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comments">
                {comments.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <MessageSquare className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No comments yet</h3>
                      <p className="text-muted-foreground">
                        {user.username} hasn&apos;t commented on any images yet
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 pb-8">
                    {comments.map((comment) => (
                      <div key={comment._id} className="group relative flex gap-4 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/50 transition-all duration-200">
                        {comment.image && (
                          <Link href={`/image/${comment.image.sequentialId}`} className="shrink-0">
                            <div className="relative w-20 h-20 rounded-lg overflow-hidden ring-1 ring-border group-hover:ring-primary/50 transition-all">
                              <NextImage
                                src={comment.image.thumbnailUrl}
                                alt="Post thumbnail"
                                fill
                                className="object-cover"
                              />
                            </div>
                          </Link>
                        )}
                        <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {comment.image && (
                                <Link 
                                  href={`/image/${comment.image.sequentialId}`}
                                  className="text-[10px] uppercase tracking-wider font-bold text-primary/70 hover:text-primary transition-colors"
                                >
                                  View Post
                                </Link>
                              )}
                            </div>
                            <p className="text-sm text-foreground/90 leading-relaxed line-clamp-3 italic">
                              &ldquo;{comment.content}&rdquo;
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
