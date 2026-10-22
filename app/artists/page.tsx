import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, ChevronLeft, ChevronRight, Palette, Search } from 'lucide-react';
import { query } from '@/lib/db';
import { swrCached } from '@/lib/swrCache';
import { displayTag } from '@/lib/seo';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Artists – Verified Artist Profiles',
  description: 'Browse artists who have claimed their profile on Serika.art: verified accounts, links, commissions and their artwork.',
  alternates: { canonical: 'https://serika.art/artists' },
};

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface ArtistRow {
  tag_name: string;
  verified: boolean;
  avatar_url: string | null;
  bio: string | null;
  claimed_by_username: string | null;
  post_count: number;
}

const PER_PAGE = 36;

// Claimed artist profiles: a small table, cached and refreshed every 5 minutes
async function claimedArtists(): Promise<ArtistRow[]> {
  return swrCached('artists:claimed:v1', { freshSeconds: 300, maxAgeSeconds: 86400 }, async () => {
    const res = await query<ArtistRow>(
      `SELECT a.tag_name, a.verified, a.avatar_url, a.bio, a.claimed_by_username, t.count AS post_count
       FROM artists a JOIN tags t ON t.id = a.tag_id
       WHERE a.claimed_by_user_id IS NOT NULL
       ORDER BY a.verified DESC, t.count DESC`
    );
    return res.rows;
  });
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
const initialOf = (name: string) => displayTag(name).trim()[0]?.toUpperCase() || '?';

export default async function ArtistsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q).trim().toLowerCase().slice(0, 80);
  const page = Math.max(1, parseInt(first(params.page) || '1', 10) || 1);

  const all = await claimedArtists().catch(() => [] as ArtistRow[]);
  const filtered = q ? all.filter((a) => displayTag(a.tag_name).toLowerCase().includes(q) || a.tag_name.includes(q)) : all;
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const verifiedCount = all.filter((a) => a.verified).length;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return `/artists${s ? `?${s}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Artists</h1>
        <p className="text-muted-foreground">
          {all.length.toLocaleString()} {all.length === 1 ? 'artist has' : 'artists have'} claimed their profile · {verifiedCount.toLocaleString()} verified.{' '}
          Are you an artist? Open your artist page and claim it.
        </p>
      </div>

      <form action="/artists" className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search artists…"
          aria-label="Search artists"
          className="h-10 w-full rounded-xl border border-border/50 bg-card/50 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </form>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/50 py-16 text-center">
          <Palette className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="mb-1 text-lg font-semibold">No artists found</h2>
          <p className="text-muted-foreground">{q ? 'Try a different search.' : 'No artist has claimed a profile yet.'}</p>
        </div>
      ) : (
        <ul className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => (
            <li key={a.tag_name}>
              <Link
                href={`/artist/${encodeURIComponent(a.tag_name)}`}
                className="group flex h-full items-start gap-4 rounded-2xl border border-border/40 bg-card/50 p-4 transition-all hover:border-primary/40 hover:bg-card"
              >
                {a.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatar_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full border-2 border-border object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-violet-500 text-xl font-black text-white">
                    {initialOf(a.tag_name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-1.5 truncate font-bold capitalize transition-colors group-hover:text-primary">
                    <span className="truncate">{displayTag(a.tag_name)}</span>
                    {a.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-label="Verified" />}
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                    {Number(a.post_count).toLocaleString()} works{a.claimed_by_username ? ` · @${a.claimed_by_username}` : ''}
                  </p>
                  {a.bio && <p className={cn('mt-2 line-clamp-2 text-sm text-muted-foreground')}>{a.bio.replace(/\s+/g, ' ')}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          <Link
            href={href(current - 1)}
            aria-disabled={current <= 1}
            className={cn('inline-flex h-9 items-center gap-1 rounded-lg border border-border/50 px-3 text-sm font-medium hover:bg-card', current <= 1 && 'pointer-events-none opacity-40')}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Link>
          <span className="px-2 text-sm text-muted-foreground">Page {current} of {pages}</span>
          <Link
            href={href(current + 1)}
            aria-disabled={current >= pages}
            className={cn('inline-flex h-9 items-center gap-1 rounded-lg border border-border/50 px-3 text-sm font-medium hover:bg-card', current >= pages && 'pointer-events-none opacity-40')}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        </nav>
      )}
    </div>
  );
}
