"use client";

import React, { Suspense, useCallback, useId, useState, useSyncExternalStore } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import ExoClickAd, { exoClickZoneFor, isSafeAdRating, type AdSlotProps } from '@/components/ExoClickAd';
import SerikaNativeAd, { AdPlaceholder, HouseAd } from '@/components/SerikaNativeAd';

/**
 * One ad slot: a Serika Ads native card or an ExoClick native ad, about half
 * each (NEXT_PUBLIC_EXOCLICK_AD_SHARE is ExoClick's share, default 0.5).
 *
 * - Safe pages get ExoClick's SFW zone only; questionable/explicit pages get its
 *   NSFW zone (see exoClickZoneFor). The NSFW zone never loads on a safe page.
 * - Serika Ads shows on every page. Set NEXT_PUBLIC_SERIKA_ADS_ON_NSFW=false to
 *   keep it off NSFW pages (those slots are then ExoClick only).
 * - Whichever source a slot gets, if it has nothing (no fill, blocked by an ad
 *   blocker, network error) the slot shows the other one, and if both are empty,
 *   our own Serika+ card. A slot is never left blank.
 *
 * The split is exact per page, not a coin flip per slot: each page view gets a
 * random phase and its slots alternate from there, so six slots are always
 * three and three (with share 0.5). It is decided only in the browser, so the
 * server render and hydration match (both show a placeholder of the same size).
 */

const parseShare = (value: string | undefined, fallback: number) => {
  const n = value === undefined || value.trim() === '' ? NaN : Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};

const EXOCLICK_SHARE = parseShare(process.env.NEXT_PUBLIC_EXOCLICK_AD_SHARE, 0.5);
const SERIKA_ADS_ON_NSFW = process.env.NEXT_PUBLIC_SERIKA_ADS_ON_NSFW !== 'false';

type Source = 'serika' | 'exoclick';

// Kept outside React so a re-render, Strict Mode's double render or a parent
// update can never re-roll a slot. slotSources: slot + page view -> source.
// pages: page view -> how many slots it has handed out, and its random phase.
const slotSources = new Map<string, Source>();
const pages = new Map<string, { count: number; phase: number }>();
const MAX_ENTRIES = 2000;

const remember = <V,>(map: Map<string, V>, key: string, value: V) => {
  map.set(key, value);
  if (map.size > MAX_ENTRIES) map.delete(map.keys().next().value as string);
};

/** Systematic sampling: slot n is ExoClick when floor(n * share + phase) steps up. */
const pickSource = (pageKey: string, slotKey: string): Source => {
  const known = slotSources.get(slotKey);
  if (known) return known;
  let page = pages.get(pageKey);
  if (!page) {
    page = { count: 0, phase: Math.random() };
    remember(pages, pageKey, page);
  }
  const before = Math.floor(page.count * EXOCLICK_SHARE + page.phase);
  page.count++;
  const after = Math.floor(page.count * EXOCLICK_SHARE + page.phase);
  const source: Source = after > before ? 'exoclick' : 'serika';
  remember(slotSources, slotKey, source);
  return source;
};

const noopSubscribe = () => () => {};

const NativeAdSlot: React.FC<AdSlotProps> = ({ id, rating = 'safe', variant = 'inline' }) => {
  const exoAvailable = EXOCLICK_SHARE > 0 && exoClickZoneFor(rating) !== null;
  const serikaAvailable = EXOCLICK_SHARE < 1 && (isSafeAdRating(rating) || SERIKA_ADS_ON_NSFW);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slotId = useId();
  const pageKey = `${pathname}?${searchParams?.toString() ?? ''}`;
  // The rating is part of the key: switching a page between safe and NSFW gets fresh ads
  const slotKey = `${slotId}|${rating}|${pageKey}`;

  // False on the server and during hydration, so both render the placeholder and
  // the pick only happens in the browser. Slots mounted later pick straight away.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Which sources came back empty, for this slot's current page view only
  const [empty, setEmpty] = useState<{ key: string; serika: boolean; exoclick: boolean }>({
    key: '',
    serika: false,
    exoclick: false,
  });
  const markEmpty = useCallback(
    (source: Source) =>
      setEmpty((prev) => {
        const base = prev.key === slotKey ? prev : { key: slotKey, serika: false, exoclick: false };
        return base[source] ? base : { ...base, [source]: true };
      }),
    [slotKey],
  );
  const handleSerikaEmpty = useCallback(() => markEmpty('serika'), [markEmpty]);
  const handleExoEmpty = useCallback(() => markEmpty('exoclick'), [markEmpty]);

  if (!hydrated) return <AdPlaceholder variant={variant} />;

  const current = empty.key === slotKey ? empty : { serika: false, exoclick: false };
  const usable = (source: Source) =>
    source === 'serika' ? serikaAvailable && !current.serika : exoAvailable && !current.exoclick;

  const first: Source | null =
    serikaAvailable && exoAvailable ? pickSource(pageKey, slotKey) : serikaAvailable ? 'serika' : exoAvailable ? 'exoclick' : null;
  const second: Source | null = first === 'serika' ? 'exoclick' : first === 'exoclick' ? 'serika' : null;
  const source = first && usable(first) ? first : second && usable(second) ? second : null;

  if (source === 'exoclick') {
    return <ExoClickAd key={`exo-${slotKey}`} id={id} rating={rating} variant={variant} onEmpty={handleExoEmpty} />;
  }
  if (source === 'serika') {
    return <SerikaNativeAd key={`serika-${slotKey}`} variant={variant} onEmpty={handleSerikaEmpty} />;
  }
  return <HouseAd variant={variant} />;
};

/**
 * The slot reads the URL (useSearchParams), which on a cached/ISR page makes
 * React render everything up to the nearest Suspense boundary in the browser
 * only. Its own boundary keeps that to the ad: the rest of the page (the post,
 * its tags…) stays in the server-rendered HTML that search engines read.
 */
const NativeAd: React.FC<AdSlotProps> = (props) => (
  <Suspense fallback={<AdPlaceholder variant={props.variant ?? 'inline'} />}>
    <NativeAdSlot {...props} />
  </Suspense>
);

export default NativeAd;
