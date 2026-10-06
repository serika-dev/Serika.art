"use client";

import React, { useCallback, useId, useState, useSyncExternalStore } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import ExoClickAd, { isSafeAdRating, type AdSlotProps } from '@/components/ExoClickAd';
import SerikaNativeAd, { AdPlaceholder } from '@/components/SerikaNativeAd';

/**
 * One ad slot. On SFW pages it shows a Serika Ads native ad or ExoClick, split by
 * NEXT_PUBLIC_EXOCLICK_AD_SHARE (the share that goes to ExoClick, default 0.5). On
 * NSFW pages (rating other than `safe`) it is always ExoClick with the NSFW zone,
 * because Serika Ads is SFW only. If Serika Ads has nothing for the slot, the slot
 * shows ExoClick instead, so it is never left empty.
 *
 * The split is rolled once per slot per page view (pathname + query): re-renders
 * keep it, a client navigation or a remount rolls again. It is only rolled in the
 * browser, so the server render and hydration match (both show a placeholder card).
 */

const parseShare = (value: string | undefined, fallback: number) => {
  const n = value === undefined || value.trim() === '' ? NaN : Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};

const EXOCLICK_SHARE = parseShare(process.env.NEXT_PUBLIC_EXOCLICK_AD_SHARE, 0.5);

type Source = 'serika' | 'exoclick';

// Rolls per slot per page view. Kept outside React so a re-render, Strict Mode's
// double render or a parent update can never re-roll a slot.
const rolls = new Map<string, Source>();
const MAX_ROLLS = 2000;

const rollSource = (key: string): Source => {
  let source = rolls.get(key);
  if (!source) {
    source = Math.random() < EXOCLICK_SHARE ? 'exoclick' : 'serika';
    rolls.set(key, source);
    if (rolls.size > MAX_ROLLS) rolls.delete(rolls.keys().next().value as string);
  }
  return source;
};

const noopSubscribe = () => () => {};

const NativeAd: React.FC<AdSlotProps> = ({ id, rating = 'safe', variant = 'inline' }) => {
  const serikaEligible = isSafeAdRating(rating) && EXOCLICK_SHARE < 1;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slotId = useId();
  const rollKey = `${slotId}|${pathname}?${searchParams?.toString() ?? ''}`;

  // False on the server and during hydration, so both render the placeholder and
  // the roll only happens in the browser. Slots mounted later roll straight away.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // The page view whose Serika Ads request came back empty; that slot shows ExoClick.
  const [emptyKey, setEmptyKey] = useState<string | null>(null);
  const handleSerikaEmpty = useCallback(() => setEmptyKey(rollKey), [rollKey]);

  if (!serikaEligible) {
    return <ExoClickAd id={id} rating={rating} variant={variant} />;
  }

  if (!hydrated) {
    return <AdPlaceholder variant={variant} />;
  }

  const source: Source = emptyKey === rollKey ? 'exoclick' : rollSource(rollKey);

  if (source === 'exoclick') {
    return <ExoClickAd id={id} rating={rating} variant={variant} />;
  }

  return <SerikaNativeAd key={rollKey} variant={variant} onEmpty={handleSerikaEmpty} />;
};

export default NativeAd;
