"use client";

import React, { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, Megaphone } from 'lucide-react';
import type { AdVariant } from '@/components/ExoClickAd';

/**
 * Serika Ads native ad (from cdn.serika.dev), rendered as one of our own cards.
 *
 * The public embed script (`/api/embed?format=script`) only fills a single
 * `#serika-ad-container` per page, so each slot asks `/api/embed` for JSON instead
 * and renders it itself. That gives every slot its own ad, and works across client
 * navigation and remounts. Anything short of a usable ad (no active ads, network
 * error, timeout, broken image) calls `onEmpty`, and the slot falls back to ExoClick.
 *
 * Serika Ads is SFW only: NativeAd never shows this on NSFW pages.
 */

// cdn.serika.dev is Serika Ads under a name ad blockers don't block (uBlock Origin's `://ads.`
// rule stops scripts and clicks on ads.serika.dev).
const SERIKA_ADS_URL = (process.env.NEXT_PUBLIC_SERIKA_ADS_URL || 'https://cdn.serika.dev')
  .replace(/\/+$/, '')
  .replace('://ads.serika.dev', '://cdn.serika.dev');
const PLACEMENT_ID = process.env.NEXT_PUBLIC_SERIKA_ADS_PLACEMENT_ID || '5';
const FETCH_TIMEOUT_MS = 6000;

interface SerikaAd {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  clickUrl: string;
  impressionPixel: string;
  buttonText: string;
  brand: string;
}

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

/** The advertiser's domain, read from the click tracker's `redirect` parameter. */
const brandFromClickUrl = (clickUrl: string): string => {
  try {
    const target = new URL(clickUrl).searchParams.get('redirect');
    if (target) return new URL(target).hostname.replace(/^www\./, '');
  } catch {
    // fall through
  }
  return 'Serika Ads';
};

const parseAd = (data: unknown): SerikaAd | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isHttpUrl(d.imageUrl) || !isHttpUrl(d.clickUrl)) return null;
  const ui = (d.uiConfig && typeof d.uiConfig === 'object' ? d.uiConfig : {}) as Record<string, unknown>;
  return {
    id: Number(d.id) || 0,
    title: typeof d.title === 'string' && d.title.trim() ? d.title.trim() : 'Sponsored',
    description: typeof d.description === 'string' ? d.description.trim() : '',
    imageUrl: d.imageUrl,
    clickUrl: d.clickUrl,
    impressionPixel: isHttpUrl(d.impressionPixel) ? d.impressionPixel : '',
    buttonText: typeof ui.buttonText === 'string' && ui.buttonText.trim() ? ui.buttonText.trim() : 'Learn more',
    brand: brandFromClickUrl(d.clickUrl),
  };
};

const badgeClass =
  'absolute backdrop-blur-md uppercase font-black tracking-widest border bg-blue-500/20 text-blue-400 border-blue-500/30 z-10 pointer-events-none';

/** Same footprint as a filled ad card, shown while a slot decides or loads. */
export const AdPlaceholder: React.FC<{ variant?: AdVariant }> = ({ variant = 'inline' }) => {
  if (variant === 'banner') {
    return (
      <div className="promo-card-banner w-full bg-card/30 rounded-2xl overflow-hidden border border-border/30 min-h-[120px] flex items-center gap-4 p-3" aria-hidden="true">
        <Skeleton className="h-24 aspect-[16/10] rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    );
  }
  if (variant === 'sidebar') {
    return (
      <div className="promo-card-sidebar flex flex-col bg-card/50 rounded-2xl overflow-hidden border border-border/40" aria-hidden="true">
        <Skeleton className="aspect-[16/10] rounded-none" />
        <div className="p-3 space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      </div>
    );
  }
  return (
    <div className="promo-card flex flex-col h-full bg-card/50 rounded-2xl overflow-hidden border border-border/40" aria-hidden="true">
      <Skeleton className="aspect-square rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
};

interface SerikaNativeAdProps {
  variant?: AdVariant;
  /** Called once when there's no ad to show; the parent swaps in ExoClick. */
  onEmpty: () => void;
}

const SerikaNativeAd: React.FC<SerikaNativeAdProps> = ({ variant = 'inline', onEmpty }) => {
  const [ad, setAd] = useState<SerikaAd | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const rootRef = useRef<HTMLAnchorElement>(null);
  const onEmptyRef = useRef(onEmpty);
  const impressionSentFor = useRef<SerikaAd | null>(null);

  useEffect(() => {
    onEmptyRef.current = onEmpty;
  }, [onEmpty]);

  // One request per mounted slot. The parent keys this component by page, so a
  // client navigation mounts a fresh slot and fetches a fresh ad.
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let cancelled = false;

    const url = `${SERIKA_ADS_URL}/api/embed?placementId=${encodeURIComponent(PLACEMENT_ID)}&type=native&format=json`;

    fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
      .then(async (res) => (res.ok ? parseAd(await res.json()) : null))
      .catch(() => null)
      .then((parsed) => {
        if (cancelled) return;
        if (parsed) setAd(parsed);
        else onEmptyRef.current();
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  // Count the impression once the creative has loaded and at least half the card
  // has been on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!ad || !imageLoaded || !el || !ad.impressionPixel) return;
    if (impressionSentFor.current === ad) return;

    const fire = () => {
      if (impressionSentFor.current === ad) return;
      impressionSentFor.current = ad;
      new Image().src = ad.impressionPixel;
    };

    if (typeof IntersectionObserver === 'undefined') {
      fire();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fire();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad, imageLoaded]);

  if (!ad) return <AdPlaceholder variant={variant} />;

  const handleImageError = () => onEmptyRef.current();

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ad.imageUrl}
      alt={ad.title}
      loading="lazy"
      decoding="async"
      onLoad={() => setImageLoaded(true)}
      onError={handleImageError}
      className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.03] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
    />
  );

  const linkProps = {
    ref: rootRef,
    href: ad.clickUrl,
    target: '_blank',
    rel: 'noopener noreferrer sponsored',
    'aria-label': `Sponsored: ${ad.title}`,
    'data-serika-ad-id': ad.id,
  } as const;

  if (variant === 'banner') {
    return (
      <a
        {...linkProps}
        className="promo-card-banner group w-full flex items-center gap-4 bg-card/30 rounded-2xl overflow-hidden border border-border/30 hover:border-primary/30 transition-colors duration-300 relative p-3 min-h-[120px]"
      >
        <div className="relative h-24 aspect-[16/10] rounded-xl overflow-hidden bg-muted shrink-0">{image}</div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Sponsored</span>
          <h3 className="text-sm font-bold text-foreground line-clamp-1">{ad.title}</h3>
          {ad.description && <p className="text-xs text-muted-foreground line-clamp-2">{ad.description}</p>}
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-foreground/70 group-hover:text-primary transition-colors">
            {ad.buttonText}
            <ArrowUpRight size={12} />
          </span>
        </div>
      </a>
    );
  }

  if (variant === 'sidebar') {
    return (
      <a
        {...linkProps}
        className="promo-card-sidebar group flex flex-col bg-card/50 rounded-2xl overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-300 relative"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-muted shrink-0">
          <Badge className={`${badgeClass} top-2 left-2 text-[9px] px-1.5 py-0.5`}>Sponsored</Badge>
          {image}
        </div>
        <CardContent className="p-3 flex flex-col flex-1">
          <h3 className="text-xs font-bold text-foreground mb-1 line-clamp-1">{ad.title}</h3>
          <div className="flex items-center justify-between mt-auto gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Megaphone size={8} className="text-primary" />
              </div>
              <span className="text-[10px] font-bold text-foreground/70 truncate group-hover:text-primary transition-colors">
                {ad.brand}
              </span>
            </div>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors shrink-0">
              {ad.buttonText}
              <ArrowUpRight size={10} />
            </span>
          </div>
        </CardContent>
      </a>
    );
  }

  return (
    <a
      {...linkProps}
      className="promo-card group flex flex-col h-full bg-card/50 rounded-2xl overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-300 relative"
    >
      <div className="relative aspect-square overflow-hidden bg-muted shrink-0">
        <Badge className={`${badgeClass} top-3 left-3 text-[10px] px-2 py-0.5`}>Sponsored</Badge>
        {image}
      </div>
      <CardContent className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-bold text-foreground mb-1 line-clamp-1">{ad.title}</h3>
        {ad.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{ad.description}</p>}
        <div className="flex items-center justify-between mt-auto gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Megaphone size={10} className="text-primary" />
            </div>
            <span className="text-xs font-bold text-foreground/70 truncate group-hover:text-primary transition-colors">
              {ad.brand}
            </span>
          </div>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors shrink-0">
            {ad.buttonText}
            <ArrowUpRight size={12} />
          </span>
        </div>
      </CardContent>
    </a>
  );
};

export default SerikaNativeAd;
