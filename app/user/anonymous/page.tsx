'use client';

import { useState, useEffect } from 'react';
import { Image as ImageType } from '@/lib/models';
import ImageCard from '@/components/ImageCard';
import { Loader2, Calendar, User as UserIcon, Shield } from 'lucide-react';
import NextImage from 'next/image';

export default function AnonymousUserPage() {
  const [images, setImages] = useState<ImageType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch anonymous user images - get all anonymous images
        const imagesRes = await fetch(`/api/images?userId=null&limit=1000`);
        const imagesData = await imagesRes.json();

        if (imagesData.success) {
          setImages(imagesData.images || []);
        } else {
          console.error('Failed to fetch images:', imagesData.error);
        }
      } catch (err: any) {
        console.error('Error fetching anonymous user images:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  // Get the latest image as profile picture
  const latestImage = images.length > 0 ? images[0] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="bg-zinc-900 rounded-lg shadow-lg p-8 mb-8 border border-zinc-800 flex flex-col md:flex-row items-center gap-8">
        <div className="shrink-0">
          {latestImage ? (
            <NextImage
              src={latestImage.url}
              alt="Anonymous User"
              width={128}
              height={128}
              className="w-32 h-32 rounded-full border-4 border-zinc-800 object-cover"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-white text-5xl border-4 border-zinc-800">
              👤
            </div>
          )}
        </div>

        <div className="text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">Anonymous</h1>
            <span className="px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 bg-zinc-700 text-zinc-300">
              <Shield size={14} />
              SYSTEM
            </span>
          </div>
          <p className="text-zinc-400 mb-4">Posts uploaded without an account</p>
          <div className="flex items-center justify-center md:justify-start gap-4 text-zinc-400">
            <div className="flex items-center gap-1">
              <UserIcon size={16} />
              <span>{images.length} Uploads</span>
            </div>
          </div>
        </div>
      </div>

      {/* Uploads */}
      <h2 className="text-2xl font-bold text-white mb-6">Uploads</h2>

      {images.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900 rounded-lg border border-zinc-800">
          <p className="text-zinc-500">No uploads yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((image) => (
            <ImageCard key={image._id?.toString() || image.url} image={image} />
          ))}
        </div>
      )}
    </div>
  );
}
