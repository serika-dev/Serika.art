'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import ImageCard from '@/components/ImageCard';
import { Image } from '@/lib/models';
import axios from 'axios';
import { Loader2, Heart, Sparkles } from 'lucide-react';

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?returnUrl=/favorites');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/favorite');
      if (response.data.success) {
        setImages(response.data.images || []);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-pink-500/10">
            <Heart className="h-7 w-7 text-pink-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Your Favorites</h1>
        </div>
        <p className="text-muted-foreground">Images you've favorited</p>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-lg">No favorites yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Start favoriting images to build your collection!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
          {images.map((image) => (
            <ImageCard key={(image.id || image._id)?.toString()} image={image} />
          ))}
        </div>
      )}
    </div>
  );
}
