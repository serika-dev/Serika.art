'use client';

import Link from 'next/link';
import NextImage from 'next/image';
import { Heart, Eye, ThumbsUp, Sparkles } from 'lucide-react';
import { Image } from '@/lib/models';

interface ImageCardProps {
  image: Image;
}

export default function ImageCard({ image }: ImageCardProps) {
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

  return (
    <Link href={`/image/${image._id}`} className="group block">
      <div className="bg-zinc-900 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-zinc-800 hover:border-zinc-700">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-zinc-950">
          <NextImage
            src={image.thumbnailUrl || image.url}
            alt={image.tags.map(t => {
              if (typeof t === 'string') return t;
              if (t && typeof t === 'object' && 'name' in t) return (t as any).name;
              return 'image';
            }).join(', ')}
            width={400}
            height={400}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {image.isAIGenerated && (
            <div className="absolute top-2 right-2 bg-purple-900/80 backdrop-blur-sm text-purple-100 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 border border-purple-700">
              <Sparkles size={12} />
              AI
            </div>
          )}
          <div className={`absolute top-2 left-2 ${getRatingColor(image.rating)} px-2 py-1 rounded-full text-xs font-medium uppercase backdrop-blur-sm`}>
            {image.rating}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {image.tags.slice(0, 3).map((tag) => {
              const tagName = typeof tag === 'string' ? tag : (tag && typeof tag === 'object' && 'name' in tag) ? (tag as any).name : 'unknown';
              return (
                <span
                  key={tagName}
                  className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs hover:bg-zinc-700 transition"
                >
                  {tagName}
                </span>
              );
            })}
            {image.tags.length > 3 && (
              <span className="text-zinc-500 text-xs px-1">
                +{image.tags.length - 3} more
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <ThumbsUp size={14} />
                {image.upvotes}
              </span>
              <span className="flex items-center gap-1">
                <Heart size={14} />
                {image.favorites}
              </span>
              <span className="flex items-center gap-1">
                <Eye size={14} />
                {image.views}
              </span>
            </div>
          </div>

          {/* User */}
          <div className="mt-2 text-xs text-zinc-500">
            by <span className="font-medium text-zinc-400 group-hover:text-blue-400 transition">{image.username}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
