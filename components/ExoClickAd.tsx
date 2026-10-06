"use client";

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { Megaphone } from 'lucide-react';

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
   * NativeAd shows a Serika Ads card instead.
   */
  onEmpty?: () => void;
}

/** How long an ExoClick slot may stay empty before it counts as unfilled. */
const EXOCLICK_FILL_TIMEOUT_MS = 6000;

/** Only `safe` counts as SFW: questionable and explicit pages get the NSFW zone. */
export const isSafeAdRating = (rating: AdRating = 'safe') => rating === 'safe';

const SFW_ZONE_ID = process.env.NEXT_PUBLIC_SFW_AD_ZONE_ID || '5897078';
const NSFW_ZONE_ID = process.env.NEXT_PUBLIC_NSFW_AD_ZONE_ID || SFW_ZONE_ID;

interface AdData {
  title: string;
  description: string;
  brand: string;
  image: string;
  url: string;
}

/** ExoClick native ad (SFW or NSFW zone). Used by NativeAd for its ExoClick share. */
const ExoClickAd: React.FC<AdSlotProps> = ({ id, rating = 'safe', variant = 'inline', onEmpty }) => {
  const onEmptyRef = useRef(onEmpty);
  useEffect(() => { onEmptyRef.current = onEmpty; }, [onEmpty]);
  const isSafe = isSafeAdRating(rating);
  const zoneId = isSafe ? SFW_ZONE_ID : NSFW_ZONE_ID;
  const insRef = useRef<HTMLModElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [adData, setAdData] = useState<AdData | null>(null);
  const isMounted = useRef(false);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Track when ad script loads — single check + lightweight poll
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.AdProvider) {
      if (isMounted.current) setScriptLoaded(true);
      return;
    }

    // Poll for script load (max 5 seconds, 250ms intervals instead of 200ms × 50)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.AdProvider) {
        if (isMounted.current) setScriptLoaded(true);
        clearInterval(interval);
      } else if (attempts >= 20) {
        clearInterval(interval);
        // Five seconds and still no ExoClick script: it was blocked.
        onEmptyRef.current?.();
      }
    }, 250);

    return () => clearInterval(interval);
  }, []);

  // No creative in the slot after a while: unfilled (or its requests were blocked).
  useEffect(() => {
    if (!onEmptyRef.current) return;
    const timer = setTimeout(() => {
      const el = insRef.current;
      const filled = !!el && (el.querySelector('iframe, img, a') || (el.parentElement?.querySelector('[id^="exo-native-widget"]')));
      if (!filled) onEmptyRef.current?.();
    }, EXOCLICK_FILL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  // Clean up and reset the ad container whenever pathname or search params change
  useEffect(() => {
    const el = insRef.current;
    if (el) {
      el.removeAttribute('data-processed');
      el.innerHTML = '';
      
      const parent = el.parentElement;
      if (parent) {
        Array.from(parent.children).forEach((child) => {
          if (child !== el && child.getAttribute('data-ad-badge') !== 'true') {
            child.remove();
          }
        });
      }
    }
  }, [pathname, searchParams]);

  // Trigger ad render when script is ready, zoneId exists, and the element is in the DOM
  useEffect(() => {
    if (!zoneId || !scriptLoaded || typeof window === 'undefined') return;

    let timer: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 50; // Poll for up to 5 seconds

    const checkAndRender = () => {
      attempts++;
      const el = insRef.current;
      
      if (el && document.body.contains(el)) {
        if (el.getAttribute('data-processed') !== 'true') {
          try {
            window.AdProvider = window.AdProvider || [];
            window.AdProvider.push({
              serve: {},
            });
          } catch (e) {
            console.error('AdProvider render error:', e);
          }
        }
      } else if (attempts < maxAttempts) {
        timer = setTimeout(checkAndRender, 100);
      }
    };

    timer = setTimeout(checkAndRender, 100);
    return () => clearTimeout(timer);
  }, [id, rating, zoneId, scriptLoaded, pathname, searchParams]);

  // Don't render if no zone configured (but still return placeholder to avoid layout shift)
  if (!zoneId) {
    return (
      <div className="promo-card group flex flex-col bg-card/50 rounded-2xl overflow-hidden border border-border/40 relative">
        <div className="relative aspect-square overflow-hidden bg-muted flex items-center justify-center">
          <Badge data-ad-badge="true" className="absolute top-3 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border bg-gray-500/20 text-gray-400 border-gray-500/30 z-10">
            Ad Unavailable
          </Badge>
        </div>
      </div>
    );
  }

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
        <CardContent className="p-3 flex flex-col flex-1">
          <h3 className="text-xs font-bold text-foreground mb-1 line-clamp-1">
            {adData?.title || 'Advertisement'}
          </h3>
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Megaphone size={8} className="text-primary" />
              </div>
              <span className="text-[10px] font-bold text-foreground/70 truncate group-hover:text-primary transition-colors">
                {adData?.brand || 'ExoClick'}
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
      <CardContent className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-bold text-foreground mb-1 line-clamp-1">
          {adData?.title || 'Advertisement'}
        </h3>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {adData?.description || 'Discover amazing products and services.'}
        </p>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Megaphone size={10} className="text-primary" />
            </div>
            <span className="text-xs font-bold text-foreground/70 truncate group-hover:text-primary transition-colors">
              {adData?.brand || 'ExoClick'}
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
