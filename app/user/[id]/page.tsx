'use client';

import { useState, useEffect, use } from 'react';
import { Image } from '@/lib/models';
import ImageCard from '@/components/ImageCard';
import { Loader2, Calendar, User as UserIcon, Shield, Crown } from 'lucide-react';

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
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">User not found</h1>
        <p className="text-zinc-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="bg-zinc-900 rounded-lg shadow-lg p-8 mb-8 border border-zinc-800 flex flex-col md:flex-row items-center gap-8">
        <div className="shrink-0">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-32 h-32 rounded-full border-4 border-zinc-800"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center text-white text-4xl font-bold border-4 border-zinc-800">
              {user.username[0].toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{user.username}</h1>
            {user.rank && user.rank !== 'user' && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${
                  user.rank === 'owner'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                    : user.rank === 'admin'
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}
              >
                {user.rank === 'owner' && <Crown size={14} />}
                {user.rank !== 'owner' && <Shield size={14} />}
                {user.rank.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center md:justify-start gap-4 text-zinc-400">
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <UserIcon size={16} />
              <span>{images.length} Uploads</span>
            </div>
          </div>
        </div>
      </div>

      {/* User's Images */}
      <h2 className="text-2xl font-bold text-white mb-6">Uploads</h2>
      
      {images.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900 rounded-lg border border-zinc-800">
          <p className="text-zinc-500">No uploads yet</p>
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
