'use client';

import Link from 'next/link';
import NextImage from 'next/image';
import { Heart, Eye, Sparkles } from 'lucide-react';
import { Image } from '@/lib/models';
import { postHeadline } from '@/lib/seo';

interface ImageCardProps {
  image: Image;
  /** When true, the thumbnail loads eagerly with high fetch priority (above-the-fold). */
  priority?: boolean;
  /** Also add a <link rel="preload"> in the head: for the first card or two only. */
  preload?: boolean;
}

// A grid page renders 24+ of these, so the markup is kept lean: plain spans
// with short class lists instead of <Badge>/<Card> (whose base classes alone
// were ~300 bytes per chip), and one srcset-free <img>.
const RATING_CLASS: Record<string, string> = {
  safe: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  questionable: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  explicit: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

const TAG_CLASS: Record<string, string> = {
  artist: 'bg-red-500/10 text-red-400 border-red-500/20',
  copyright: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  character: 'bg-green-500/10 text-green-400 border-green-500/20',
  general: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  meta: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

const TAG_ORDER: Record<string, number> = { character: 0, artist: 1, copyright: 2, general: 3, meta: 4 };

type CardTag = { name: string; type: string };

function cardTags(image: Image): CardTag[] {
  return (image.tags || []).map((t: any) =>
    typeof t === 'string' ? { name: t, type: 'general' } : { name: t?.name ?? '', type: t?.type ?? 'general' }
  );
}

/** Same-origin, resized WebP of the CDN thumbnail (no second connection for the LCP image). */
function optimizedThumb(url: string): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=320&q=75`;
}

export default function ImageCard({ image, priority = false, preload = false }: ImageCardProps) {
  const tags = cardTags(image);
  // "hatsune miku (vocaloid) drawn by kuroi" rather than a raw tag dump
  const cardAlt = postHeadline(tags);
  const shown = [...tags].sort((a, b) => (TAG_ORDER[a.type] ?? 3) - (TAG_ORDER[b.type] ?? 3)).slice(0, 5);
  const thumb = image.thumbnailUrl || image.url;

  return (
    <Link href={`/image/${image.sequentialId}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/50 text-card-foreground shadow-sm transition-all duration-300 hover:border-primary/30 hover:bg-card hover:shadow-2xl hover:shadow-primary/5">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <NextImage
            // Thumbnails are pre-generated at 320px and CDN-cached for a year, so
            // most load straight from the CDN. The first one or two (the LCP) go
            // through the optimizer instead: same origin as the page, and WebP.
            src={preload ? optimizedThumb(thumb) : thumb}
            unoptimized
            alt={cardAlt}
            title={cardAlt}
            width={320}
            height={320}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={preload ? 'high' : 'auto'}
            decoding={preload ? 'sync' : 'async'}
            preload={preload}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {image.isAIGenerated && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 backdrop-blur-md">
              <Sparkles size={10} className="fill-purple-300" />
              AI
            </span>
          )}

          <span className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${RATING_CLASS[image.rating] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}>
            {image.rating}
          </span>

          <div className="absolute bottom-3 left-3 right-3 flex translate-y-2 items-center justify-between text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="flex items-center gap-1 text-xs font-bold">
              <Heart size={12} className="fill-white/20" />
              {image.favorites}
            </span>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter backdrop-blur-md">View Post</span>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {shown.map((tag) => (
              <span
                key={tag.name}
                className={`rounded-full border px-2 text-[10px] font-bold uppercase tracking-wider ${TAG_CLASS[tag.type] || TAG_CLASS.general}`}
              >
                {tag.name}
              </span>
            ))}
            {tags.length > 5 && (
              <span className="flex items-center px-1 text-[10px] font-bold text-muted-foreground">+{tags.length - 5}</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black uppercase text-primary">
                {image.username[0]}
              </span>
              <span className="truncate text-xs font-bold text-foreground/70 transition-colors group-hover:text-primary">{image.username}</span>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
              <Eye size={12} />
              {image.views}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
