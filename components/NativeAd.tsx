"use client";

import React, { useEffect } from 'react';

import { Badge } from '@/components/ui/badge';

interface NativeAdProps {
  id?: string | number;
  rating?: 'safe' | 'questionable' | 'explicit';
  variant?: 'inline' | 'banner'; // inline = grid card, banner = full-width row
}

const NativeAd: React.FC<NativeAdProps> = ({ id, rating = 'safe', variant = 'inline' }) => {
  // 5897078 = SFW zone. Update NSFW zone ID when provided by user.
  const isSafe = rating === 'safe';
  const zoneId = isSafe ? "5897078" : "5897078"; // TODO: replace second with NSFW zone ID

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        ((window as any).AdProvider = (window as any).AdProvider || []).push({"serve": {}});
      } catch (e) {
        console.error('AdProvider error:', e);
      }
    }
  }, [id, rating]);

  if (variant === 'banner') {
    return (
      <div className="native-ad-banner w-full flex items-center justify-center bg-card/30 rounded-2xl overflow-hidden border border-border/30 relative py-2 min-h-[120px]">
        <Badge className="absolute top-2 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border bg-blue-500/20 text-blue-400 border-blue-500/30 z-10 pointer-events-none">
          Sponsored{isSafe ? "" : " (18+)"}
        </Badge>
        <ins className="eas6a97888e20" data-zoneid={zoneId} style={{ display: 'block', width: '100%', minHeight: '90px' }}></ins>
      </div>
    );
  }

  return (
    <div className="native-ad-item group flex flex-col bg-card/50 rounded-2xl overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-300 relative">
      <Badge className="absolute top-3 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border bg-blue-500/20 text-blue-400 border-blue-500/30 z-10 pointer-events-none">
        Sponsored{isSafe ? "" : " (18+)"}
      </Badge>

      <ins className="eas6a97888e20" data-zoneid={zoneId}></ins>
    </div>
  );
};

export default NativeAd;
