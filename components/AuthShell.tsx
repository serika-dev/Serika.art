'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { Brush } from 'lucide-react';
import { cn } from '@/lib/utils';

// Split-screen layout in the Serika Accounts house style (serika.dev, SerikaCord):
// a random serika.art artwork with an "Art by" chip on the left, the form on a
// dark panel on the right. On phones the art fills the screen behind a bottom sheet.

interface Art {
  post_id: number;
  url: string;
  thumbnail_url: string;
  artist: string;
}

const NEXT_ART_KEY = 'serika_auth_next_art';

async function fetchArt(): Promise<Art | null> {
  try {
    const res = await fetch('/api/art/random');
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data : null;
  } catch {
    return null;
  }
}

function readStored(): Art | null {
  try {
    return JSON.parse(localStorage.getItem(NEXT_ART_KEY) || 'null');
  } catch {
    return null;
  }
}

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Wider panel for long forms (DMCA). */
  wide?: boolean;
}) {
  const [art, setArt] = useState<Art | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Show last visit's prefetched art instantly, then prefetch the next one.
    const stored = readStored();
    const show = (a: Art | null) => !cancelled && a && setArt(a);
    if (stored?.url) show(stored);
    else fetchArt().then(show);

    fetchArt().then((next) => {
      if (!next) return;
      try {
        localStorage.setItem(NEXT_ART_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable – fine
      }
      new Image().src = next.thumbnail_url;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] w-full bg-[#050505]">
      {/* Artwork */}
      <div className="overflow-hidden bg-black max-md:pointer-events-none max-md:fixed max-md:inset-0 max-md:z-0 md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:flex-1 md:self-start">
        {art && (
          <>
            {/* The 320px thumbnail, blurred, shows instantly while the full image loads */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.thumbnail_url} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" />
            <NextImage
              key={art.url}
              src={art.url}
              alt={`Artwork by ${art.artist}`}
              fill
              sizes="(max-width: 768px) 100vw, calc(100vw - 520px)"
              className={cn('object-cover object-top transition-opacity duration-700', loaded ? 'opacity-100' : 'opacity-0')}
              onLoad={() => setLoaded(true)}
              preload
            />
            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-transparent via-transparent to-black/70 md:block" />
            <Link
              href={`/image/${art.post_id}`}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-[#121215]/75 px-4 py-[0.45rem] text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.4)] backdrop-blur-md transition-opacity hover:opacity-80 max-md:fixed max-md:left-1/2 max-md:top-20 max-md:z-20 max-md:-translate-x-1/2 max-md:whitespace-nowrap max-md:px-[0.85rem] max-md:py-[0.35rem] max-md:text-xs md:absolute md:bottom-5 md:left-6"
            >
              <Brush className="h-4 w-4 text-violet-400" />
              Art by {art.artist}
            </Link>
          </>
        )}
      </div>

      {/* Form panel */}
      <div
        className={cn(
          'relative z-10 flex w-full flex-col px-6 py-10 md:shrink-0 md:border-l md:border-white/[0.08] md:bg-[#0a0a0c] md:px-12 md:shadow-[-10px_0_40px_rgba(0,0,0,0.5)] max-md:min-h-[calc(100dvh-4rem)] max-md:justify-end max-md:px-0 max-md:pb-0',
          wide ? 'md:w-[520px] lg:w-[640px] lg:px-14' : 'md:w-[440px] lg:w-[520px] lg:px-16'
        )}
      >
        <div className="mb-8 hidden flex-col items-center text-center md:flex">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Serika Booru" className="h-10" />
          </Link>
          <p className="mt-2 text-sm text-gray-400">The modern anime art image board</p>
        </div>

        <div
          className={cn(
            'mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300 md:my-auto',
            wide ? 'max-w-[520px]' : 'max-w-[380px]',
            'max-md:max-w-full max-md:rounded-t-[1.5rem] max-md:border max-md:border-b-0 max-md:border-white/20 max-md:bg-[#0a0a0c] max-md:px-6 max-md:pt-8 max-md:pb-[calc(2rem+env(safe-area-inset-bottom,0px))] max-md:shadow-[0_-10px_40px_rgba(0,0,0,0.3)]'
          )}
        >
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            {subtitle && <p className="mt-2 text-gray-400">{subtitle}</p>}
          </div>
          {children}
        </div>

        <p className="mt-8 hidden text-center text-xs text-gray-500 md:block">© {new Date().getFullYear()} Serika.art</p>
      </div>
    </div>
  );
}

// Shared form styling for pages using AuthShell
export const authInputClass =
  'w-full pl-12 pr-4 py-3 bg-[#111114] border border-[#2f2b3a]/50 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors disabled:opacity-60';
export const authPlainInputClass = authInputClass.replace('pl-12', 'pl-4');
export const authButtonClass =
  'w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-[0_0_20px_rgba(139,92,246,0.25)] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';
export const authIconClass = 'pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 [&_svg]:h-5 [&_svg]:w-5';
