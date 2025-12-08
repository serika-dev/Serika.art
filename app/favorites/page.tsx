'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import ImageCard from '@/components/ImageCard';
import { Image } from '@/lib/models';
import axios from 'axios';
import { Loader2, Heart } from 'lucide-react';

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
        setImages(response.data.favorites);
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
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Heart className="text-pink-500" size={36} />
          Your Favorites
        </h1>
        <p className="text-zinc-400">Images you've favorited</p>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={48} />
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 text-lg mb-2">No favorites yet</p>
          <p className="text-zinc-600 text-sm">Start favoriting images to build your collection!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((image) => (
            <ImageCard key={image._id.toString()} image={image} />
          ))}
        </div>
      )}
    </div>
  );
}
