'use client';

import { useState, useEffect, use } from 'react';
import { Image } from '@/lib/models';
import ImageCard from '@/components/ImageCard';
import { Loader2, Calendar, User as UserIcon, Shield, Crown, ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type UserRank = 'user' | 'moderator' | 'admin' | 'owner';

interface UserProfile {
  id: string;
  username: string;
  avatarUrl?: string;
  rank: UserRank;
  createdAt: string;
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user details
        const userRes = await fetch(`/api/users/${id}`);
        const userData = await userRes.json();

        if (!userData.success) {
          throw new Error(userData.error || 'Failed to fetch user');
        }
        setUser(userData.user);

        // Fetch user images
        const imagesRes = await fetch(`/api/images?userId=${id}&limit=50`);
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

    if (id) {
      fetchData();
    }
  }, [id]);

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
        <h1 className="text-2xl font-bold mb-4">User not found</h1>
        <p className="text-muted-foreground">{error}</p>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <Avatar className="h-32 w-32 border-4 border-border">
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                {user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="text-center md:text-left space-y-3">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{user.username}</h1>
                {user.rank && user.rank !== 'user' && (
                  <Badge variant="outline" className={cn("font-semibold", getRankStyles(user.rank))}>
                    {user.rank === 'owner' ? <Crown className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                    {user.rank.toUpperCase()}
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-center md:justify-start gap-6 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <span>{images.length} Uploads</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User's Images */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Uploads</h2>
      </div>
      
      {images.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No uploads yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
          {images.map((image) => (
            <ImageCard key={image._id.toString()} image={image} />
          ))}
        </div>
      )}
    </div>
  );
}
