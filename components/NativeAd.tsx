"use client";

import React, { useEffect } from 'react';
import Script from 'next/script';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface NativeAdProps {
  id?: string | number;
}

const NativeAd: React.FC<NativeAdProps> = ({ id }) => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Trigger the push for this specifically placed ad
        ((window as any).AdProvider = (window as any).AdProvider || []).push({"serve": {}});
      } catch (e) {
        console.error('AdProvider error:', e);
      }
    }
  }, [id]);

  return (
    <div className="native-ad-item group flex flex-col h-full bg-card/50 rounded-2xl overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-300 relative min-h-[350px]">
      <Badge className="absolute top-3 left-3 backdrop-blur-md uppercase text-[10px] font-black tracking-widest px-2 py-0.5 border bg-blue-500/20 text-blue-400 border-blue-500/30 z-10 pointer-events-none">
        Sponsored
      </Badge>

      {/* The exact internal content snippet provided by the user */}
      <ins className="eas6a97888e20" data-zoneid="5897078"></ins>
    </div>
  );
};





export default NativeAd;
