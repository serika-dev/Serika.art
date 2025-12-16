'use client';

import Link from 'next/link';
import NextImage from 'next/image';
import { Heart, Eye, ThumbsUp, Sparkles } from 'lucide-react';
import { Image } from '@/lib/models';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ImageCardProps {
  image: Image;
}

export default function ImageCard({ image }: ImageCardProps) {
  const getRatingClass = (rating: string) => {
      switch (rating) {
      case 'safe':
        return 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50';
      case 'questionable':
        return 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/50';
      case 'explicit':
        return 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/50';
      default:
        return 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 border-zinc-500/50';
    }
  }

  return (
    <Link href={`/image/${image._id}`} className="group block">
      <Card className="overflow-hidden border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-all duration-300 hover:shadow-lg">
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
            <Badge variant="secondary" className="absolute top-2 right-2 bg-purple-500/20 text-purple-300 border-purple-500/50 backdrop-blur-sm gap-1">
              <Sparkles size={12} />
              AI
            </Badge>
          )}
          <Badge className={`absolute top-2 left-2 backdrop-blur-sm uppercase ${getRatingClass(image.rating)}`}>
            {image.rating}
          </Badge>
        </div>

        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1 mb-2">
            {image.tags.slice(0, 3).map((tag) => {
              const tagName = typeof tag === 'string' ? tag : (tag && typeof tag === 'object' && 'name' in tag) ? (tag as any).name : 'unknown';
              return (
                <Badge
                  key={tagName}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 h-auto font-normal bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                >
                  {tagName}
                </Badge>
              );
            })}
            {image.tags.length > 3 && (
              <span className="text-zinc-500 text-xs px-1 flex items-center">
                +{image.tags.length - 3} more
              </span>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="p-3 pt-0 flex items-center justify-between text-sm text-zinc-500">
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
            <div className="text-xs">
                by <span className="font-medium text-zinc-400 group-hover:text-primary transition">{image.username}</span>
            </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
