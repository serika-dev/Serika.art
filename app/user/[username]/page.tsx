'use client';

import { useState, useEffect, use } from 'react';
import { Image } from '@/lib/models';
import ImageCard from '@/components/ImageCard';
import { Loader2, Calendar, User as UserIcon, Shield, Crown, ImageIcon, Mail, Link as LinkIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        // Fetch user images
        const imagesRes = await fetch(`/api/images?username=${encodeURIComponent(username)}&limit=50`);
        const imagesData = await imagesRes.json();

        if (imagesData.success) {
          setImages(imagesData.images);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchData();
    }
  }, [username]);

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

  const isAnonymous = username === 'anonymous';

  return (
    <div className="w-full">
      {/* Banner */}
      <div className="relative h-48 md:h-64 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-transparent overflow-hidden">
        {user.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.bannerUrl}
            alt="User banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-purple-500/20 via-pink-500/10 to-blue-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header Card */}
        <div className="relative -mt-24 mb-8 z-10">
          <Card className="border-border/50">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* Avatar */}
                <Avatar className="h-40 w-40 md:h-48 md:w-48 border-4 border-background shadow-xl flex-shrink-0">
                  <AvatarImage src={user.avatarUrl} />
                  <AvatarFallback className="text-5xl bg-gradient-to-br from-primary to-primary/50 text-primary-foreground">
                    {isAnonymous ? '?' : user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* User Info */}
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                        {isAnonymous ? 'Anonymous User' : user.username}
                      </h1>
                      {user.rank && user.rank !== 'user' && (
                        <Badge className={cn("font-semibold text-sm", getRankStyles(user.rank))}>
                          {user.rank === 'owner' ? <Crown className="h-3.5 w-3.5 mr-1.5" /> : <Shield className="h-3.5 w-3.5 mr-1.5" />}
                          {user.rank.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    {isAnonymous && (
                      <p className="text-muted-foreground">
                        Content from users who aren't logged in
                      </p>
                    )}
                  </div>

                  {/* Bio */}
                  {user.bio && !isAnonymous && (
                    <p className="text-foreground/80 leading-relaxed max-w-2xl">
                      {user.bio}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex flex-wrap gap-6 pt-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-primary" />
                      <div>
                        <div className="text-2xl font-bold">{images.length}</div>
                        <div className="text-sm text-muted-foreground">
                          {images.length === 1 ? 'Upload' : 'Uploads'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <div className="text-sm text-muted-foreground">Joined</div>
                        <div className="text-sm font-medium">
                          {new Date(user.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Uploads Section */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            {isAnonymous ? 'Anonymous Uploads' : 'Gallery'}
          </h2>

          {images.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No uploads yet</h3>
                <p className="text-muted-foreground">
                  {isAnonymous
                    ? 'No content from anonymous users yet'
                    : `${user.username} hasn't uploaded any images yet`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 pb-8">
              {images.map((image) => (
                <ImageCard key={image._id.toString()} image={image} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
