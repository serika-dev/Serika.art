"use client";

import React, { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { Megaphone } from 'lucide-react';

declare global {
  interface Window {
    AdProvider?: Array<{ serve?: Record<string, unknown>; render?: Record<string, unknown> }>;
  }
}

interface NativeAdProps {
  id?: string | number;
  rating?: 'safe' | 'questionable' | 'explicit';
  variant?: 'inline' | 'banner'; // inline = grid card, banner = full-width row
}

const SFW_ZONE_ID = process.env.NEXT_PUBLIC_SFW_AD_ZONE_ID || '5897078';
const NSFW_ZONE_ID = process.env.NEXT_PUBLIC_NSFW_AD_ZONE_ID || '';

interface AdData {
  title: string;
  description: string;
  brand: string;
  image: string;
  url: string;
}

const NativeAd: React.FC<NativeAdProps> = ({ id, rating = 'safe', variant = 'inline' }) => {
  const isSafe = rating === 'safe';
  const zoneId = isSafe ? SFW_ZONE_ID : NSFW_ZONE_ID;
  const insRef = useRef<HTMLModElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [adData, setAdData] = useState<AdData | null>(null);

  // Track when ad script loads
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if script already loaded
    if (window.AdProvider) {
      setScriptLoaded(true);
      return;
    }

    // Poll for script load (max 10 seconds)
    let attempts = 0;
    const maxAttempts = 50;
    const interval = setInterval(() => {
      attempts++;
      if (window.AdProvider) {
        setScriptLoaded(true);
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Fetch ad data from API
  useEffect(() => {
    if (!zoneId || typeof window === 'undefined') return;

    const fetchAdData = async () => {
      try {
        const response = await fetch(`/api/ad?zoneId=${zoneId}`);
        if (!response.ok) return;
        const data = await response.json();
        
        if (data.title) {
          setAdData({
            title: data.title,
            description: data.description || '',
            brand: data.brand || 'ExoClick',
            image: data.image || '',
            url: data.url || '#',
          });
        }
      } catch (e) {
        console.error('Failed to fetch ad data:', e);
      }
    };

    fetchAdData();
  }, [zoneId]);

  // Trigger ad render when script is ready and zoneId exists
  useEffect(() => {
    if (!zoneId || !scriptLoaded || typeof window === 'undefined') return;

    const tryRender = () => {
      try {
        window.AdProvider = window.AdProvider || [];
        window.AdProvider.push({
          serve: {
            zoneId: zoneId,
          },
        });
      } catch (e) {
        console.error('AdProvider render error:', e);
      }
    };

    const timer = setTimeout(tryRender, 100);
    return () => clearTimeout(timer);
  }, [id, rating, zoneId, scriptLoaded]);

  // Don't render if no zone configured (but still return placeholder to avoid layout shift)
  if (!zoneId) {
    return (
      <div className="native-ad-item group flex flex-col bg-card/50 rounded-2xl overflow-hidden border border-border/40 relative">
        <div className="relative aspect-square overflow-hidden bg-muted flex items-center justify-center">
          <Badge className="absolute top-3 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border bg-gray-500/20 text-gray-400 border-gray-500/30 z-10">
            Ad Unavailable
          </Badge>
        </div>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="native-ad-banner w-full flex items-center justify-center bg-card/30 rounded-2xl overflow-hidden border border-border/30 relative py-2 min-h-[120px]">
        <Badge className="absolute top-2 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border bg-blue-500/20 text-blue-400 border-blue-500/30 z-10 pointer-events-none">
          Sponsored{isSafe ? "" : " (18+)"}
        </Badge>
        <ins ref={insRef} className="eas6a97888e20" data-zoneid={zoneId} style={{ display: 'block', width: '100%', minHeight: '90px' }}></ins>
      </div>
    );
  }

  return (
    <div className="native-ad-item group flex flex-col h-full bg-card/50 rounded-2xl overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-300 relative">
      <div className="relative aspect-square overflow-hidden bg-muted shrink-0">
        <Badge className="absolute top-3 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border bg-blue-500/20 text-blue-400 border-blue-500/30 z-10 pointer-events-none">
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

export default NativeAd;
