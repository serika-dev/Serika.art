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
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'questionable':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'explicit':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  }

  return (
    <Link href={`/image/${image.sequentialId}`} className="group block">
      <Card className="overflow-hidden border-border/40 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 rounded-2xl">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <NextImage
            src={image.thumbnailUrl || image.url}
            alt={image.tags.map(t => {
              if (typeof t === 'string') return t;
              if (t && typeof t === 'object' && 'name' in t) return (t as any).name;
              return 'image';
            }).join(', ')}
            width={400}
            height={400}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {image.isAIGenerated && (
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30 backdrop-blur-md gap-1 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">
                <Sparkles size={10} className="fill-purple-300" />
                AI
              </Badge>
            )}
          </div>

          <Badge className={`absolute top-3 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border ${getRatingClass(image.rating)}`}>
            {image.rating}
          </Badge>

          {/* Hover Stats */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0 transition-transform">
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1">
                <ThumbsUp size={12} className="fill-white/20" />
                {image.upvotes}
              </span>
              <span className="flex items-center gap-1">
                <Heart size={12} className="fill-white/20" />
                {image.favorites}
              </span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-tighter bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md">
              View Post
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(() => {
              // Sort tags: character first, then artist, then others
              const sortedTags = [...image.tags].sort((a, b) => {
                const typeA = (a && typeof a === 'object' && 'type' in a) ? (a as any).type : 'general';
                const typeB = (b && typeof b === 'object' && 'type' in b) ? (b as any).type : 'general';
                const priority: Record<string, number> = { character: 0, artist: 1, copyright: 2, general: 3, meta: 4 };
                return (priority[typeA] ?? 3) - (priority[typeB] ?? 3);
              });
              return sortedTags.slice(0, 5).map((tag) => {
                const tagName = typeof tag === 'string' ? tag : (tag && typeof tag === 'object' && 'name' in tag) ? (tag as any).name : 'unknown';
                const tagType = (tag && typeof tag === 'object' && 'type' in tag) ? (tag as any).type : 'general';
                const typeColors: Record<string, string> = {
                  artist: 'bg-red-500/10 text-red-400 border-red-500/20',
                  copyright: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                  character: 'bg-green-500/10 text-green-400 border-green-500/20',
                  general: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                  meta: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                };
                return (
                  <Badge
                    key={tagName}
                    variant="secondary"
                    className={`text-[10px] px-2 py-0 h-auto font-bold uppercase tracking-wider hover:opacity-80 transition-colors ${typeColors[tagType] || typeColors.general}`}
                  >
                    {tagName}
                  </Badge>
                );
              });
            })()}
            {image.tags.length > 5 && (
              <span className="text-muted-foreground/60 text-[10px] font-bold px-1 flex items-center">
                +{image.tags.length - 5}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-primary uppercase">{image.username[0]}</span>
              </div>
              <span className="text-xs font-bold text-foreground/70 truncate group-hover:text-primary transition-colors">
                {image.username}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground/40">
              <Eye size={12} />
              <span className="text-[10px] font-bold">{image.views}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
