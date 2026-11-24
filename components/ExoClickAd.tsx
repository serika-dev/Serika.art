"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone } from 'lucide-react';
import { AdPlaceholder } from '@/components/SerikaNativeAd';
import { getAdScriptStatus, getServerAdScriptStatus, subscribeAdScriptStatus } from '@/lib/adScriptStatus';

declare global {
  interface Window {
    AdProvider?: Array<{ serve?: Record<string, unknown>; render?: Record<string, unknown> }>;
  }
}

export type AdRating = 'safe' | 'questionable' | 'explicit';
export type AdVariant = 'inline' | 'banner' | 'sidebar'; // inline = grid card, banner = full-width row, sidebar = compact sidebar block

export interface AdSlotProps {
  id?: string | number;
  rating?: AdRating;
  variant?: AdVariant;
  /**
   * ExoClick had no ad for the slot, or is blocked (uBlock Origin blocks magsrv.com):
   * NativeAd shows a Serika Ads card instead. Called at most once per mount.
   */
  onEmpty?: () => void;
}

/** How long an ExoClick slot may stay empty, once the script is there, before it counts as unfilled. */
const EXOCLICK_FILL_TIMEOUT_MS = 8000;

/** Only `safe` counts as SFW: questionable and explicit pages get the NSFW zone. */
export const isSafeAdRating = (rating: AdRating = 'safe') => rating === 'safe';

// Defaults are the production zones. The SFW default must never be the NSFW zone.
const SFW_ZONE_ID = process.env.NEXT_PUBLIC_SFW_AD_ZONE_ID || '5897178';
const NSFW_ZONE_ID = process.env.NEXT_PUBLIC_NSFW_AD_ZONE_ID || '5897078';

/**
 * The ExoClick zone for a page's rating, or null when there is none. Safe pages
 * only ever get the SFW zone: if it were misconfigured to the NSFW zone, safe
 * pages get no ExoClick at all rather than NSFW ads.
 */
export const exoClickZoneFor = (rating: AdRating = 'safe'): string | null => {
  if (!isSafeAdRating(rating)) return NSFW_ZONE_ID || null;
  return SFW_ZONE_ID && SFW_ZONE_ID !== NSFW_ZONE_ID ? SFW_ZONE_ID : null;
};

interface AdData {
  title: string;
  description: string;
  brand: string;
  image: string;
  url: string;
}

/**
 * ExoClick injects its native creative next to our <ins>, not inside it: a
 * #msg-native-widget-<zone>-… (formerly exo-native-widget) holding
 * .exo-native-widget-item links. Any of those, or an iframe/image, means filled.
 */
const CREATIVE_SELECTOR =
  '.exo-native-widget-item, .exo-native-widget, .msg-native-widget, [id^="msg-native-widget"], [id^="exo-native-widget"], iframe, img';

function isFilled(container: Element): boolean {
  return !!container.querySelector(CREATIVE_SELECTOR);
}

/**
 * Read the widget's image, title, text and brand so the card caption shows the
 * real ad instead of placeholder text.
 */
function readExoCreative(container: Element): AdData | null {
  const item = container.querySelector<HTMLAnchorElement>('a.exo-native-widget-item, .exo-native-widget-item');
  if (!item) return null;
  const text = (selector: string) => item.querySelector(selector)?.textContent?.trim() || '';
  const title = text('.exo-native-widget-item-title');
  if (!title) return null;
  const background = item.querySelector<HTMLElement>('.exo-native-widget-item-image')?.style.backgroundImage || '';
  return {
    title,
    description: text('.exo-native-widget-item-text'),
    brand: text('.exo-native-widget-item-brand'),
    image: background.match(/url\(["']?(.*?)["']?\)/)?.[1] || '',
    url: item instanceof HTMLAnchorElement ? item.href : '',
  };
}

/**
 * ExoClick native ad (SFW or NSFW zone by rating). Used by NativeAd for its
 * ExoClick share; NativeAd mounts a fresh one per page view.
 */
const ExoClickAd: React.FC<AdSlotProps> = ({ rating = 'safe', variant = 'inline', onEmpty }) => {
  const onEmptyRef = useRef(onEmpty);
  useEffect(() => { onEmptyRef.current = onEmpty; }, [onEmpty]);
  const emptyReported = useRef(false);
  const reportEmpty = () => {
    if (emptyReported.current) return;
    emptyReported.current = true;
    onEmptyRef.current?.();
  };

  const isSafe = isSafeAdRating(rating);
  const zoneId = exoClickZoneFor(rating);
  const insRef = useRef<HTMLModElement>(null);
  const [filled, setFilled] = useState(false);
  const [adData, setAdData] = useState<AdData | null>(null);
  const scriptStatus = useSyncExternalStore(subscribeAdScriptStatus, getAdScriptStatus, getServerAdScriptStatus);

  // No zone for this rating, or the script was blocked: hand the slot to Serika Ads.
  useEffect(() => {
    if (!zoneId || scriptStatus === 'failed') reportEmpty();
  }, [zoneId, scriptStatus]);

  // Script ready: ask ExoClick to fill our <ins>, watch for the creative, and give
  // up after a while if nothing arrives (no fill, or its requests were blocked).
  useEffect(() => {
    const el = insRef.current;
    const container = el?.parentElement;
    if (!zoneId || scriptStatus !== 'ready' || !el || !container) return;

    const check = () => {
      if (!isFilled(container)) return false;
      setFilled(true);
      const creative = readExoCreative(container);
      if (creative) setAdData(creative);
      return !!creative;
    };

    if (el.getAttribute('data-processed') !== 'true') {
      try {
        window.AdProvider = window.AdProvider || [];
        window.AdProvider.push({ serve: {} });
      } catch (e) {
        console.error('AdProvider serve error:', e);
      }
    }

    if (check()) return;
    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    const timer = setTimeout(() => {
      if (!isFilled(container)) {
        observer.disconnect();
        reportEmpty();
      }
    }, EXOCLICK_FILL_TIMEOUT_MS);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [zoneId, scriptStatus]);

  // Clicks on our caption go through ExoClick's own link, so they are tracked
  const openAd = () => {
    insRef.current?.parentElement?.querySelector<HTMLAnchorElement>('a.exo-native-widget-item')?.click();
  };

  // No zone for this rating: NativeAd swaps in Serika Ads (reported above)
  if (!zoneId) return <AdPlaceholder variant={variant} />;

  if (variant === 'banner') {
    return (
      <div className="promo-card-banner w-full flex items-center justify-center bg-card/30 rounded-2xl overflow-hidden border border-border/30 relative py-2 min-h-[120px]">
        <Badge data-ad-badge="true" className="absolute top-2 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border bg-blue-500/20 text-blue-400 border-blue-500/30 z-10 pointer-events-none">
          Sponsored{isSafe ? "" : " (18+)"}
        </Badge>
        <ins ref={insRef} className="eas6a97888e20" data-zoneid={zoneId} style={{ display: 'block', width: '100%', minHeight: '90px' }}></ins>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className="promo-card-sidebar group flex flex-col bg-card/50 rounded-2xl overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-300 relative">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted shrink-0">
          <Badge data-ad-badge="true" className="absolute top-2 left-2 backdrop-blur-md uppercase text-[9px] font-black tracking-widest px-1.5 py-0.5 border bg-blue-500/20 text-blue-400 border-blue-500/30 z-10 pointer-events-none">
            Sponsored{isSafe ? "" : " (18+)"}
          </Badge>
          <ins ref={insRef} className="eas6a97888e20 absolute inset-0" data-zoneid={zoneId} style={{ display: 'block', width: '100%', height: '100%' }}></ins>
        </div>
        <CardContent
          className={`p-3 flex flex-col flex-1 ${adData ? 'cursor-pointer' : ''}`}
          onClick={adData ? openAd : undefined}
          title={adData?.title}
        >
          {filled ? (
            <p className="text-xs font-bold text-foreground mb-1 line-clamp-1">
              {adData?.title || 'Advertisement'}
            </p>
          ) : (
            <Skeleton className="h-3 w-2/3 mb-2" />
          )}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Megaphone size={8} className="text-primary" />
              </div>
              <span className="text-[10px] font-bold text-foreground/70 truncate group-hover:text-primary transition-colors">
                {adData?.brand || 'Sponsored'}
              </span>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground/40">Ad</span>
          </div>
        </CardContent>
      </div>
    );
  }

  return (
    <div className="promo-card group flex flex-col h-full bg-card/50 rounded-2xl overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-300 relative">
      <div className="relative aspect-square overflow-hidden bg-muted shrink-0">
        <Badge data-ad-badge="true" className="absolute top-3 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border bg-blue-500/20 text-blue-400 border-blue-500/30 z-10 pointer-events-none">
          Sponsored{isSafe ? "" : " (18+)"}
        </Badge>
        <ins ref={insRef} className="eas6a97888e20 absolute inset-0" data-zoneid={zoneId} style={{ display: 'block', width: '100%', height: '100%' }}></ins>
      </div>
      {/* Fixed height, same as the placeholder and the Serika card: no layout shift when it fills */}
      <CardContent
        className={`p-4 flex flex-col h-[7.5rem] shrink-0 overflow-hidden ${adData ? 'cursor-pointer' : ''}`}
        onClick={adData ? openAd : undefined}
        title={adData?.title}
      >
        {/* Skeleton until the creative is in, rather than made-up placeholder copy */}
        {filled ? (
          <>
            <p className="text-sm font-bold text-foreground mb-1 line-clamp-1">
              {adData?.title || 'Advertisement'}
            </p>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-8">
              {adData?.description}
            </p>
          </>
        ) : (
          <div className="space-y-2 mb-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Megaphone size={10} className="text-primary" />
            </div>
            <span className="text-xs font-bold text-foreground/70 truncate group-hover:text-primary transition-colors">
              {adData?.brand || 'Sponsored'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/40">
            <span className="text-[10px] font-bold">Ad</span>
          </div>
        </div>
      </CardContent>
    </div>
  );
};

export default ExoClickAd;
