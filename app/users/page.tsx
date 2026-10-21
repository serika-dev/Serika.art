import Link from 'next/link';
import { Suspense } from 'react';
import { Crown, Shield, Search, ChevronLeft, ChevronRight, Upload, Users as UsersIcon } from 'lucide-react';
import { listDirectory, isDirectorySort, type DirectoryUser } from '@/lib/userDirectory';
import UsersSortSelect from '@/components/users/UsersSortSelect';
import { cn } from '@/lib/utils';

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

// Deterministic accent per username for people without an avatar
const ACCENTS = [
  'from-violet-500 to-fuchsia-500', 'from-sky-500 to-indigo-500', 'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500', 'from-cyan-500 to-blue-500',
];
const accentFor = (name: string) => ACCENTS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % ACCENTS.length];

function RankBadge({ rank }: { rank: DirectoryUser['rank'] }) {
  if (rank === 'user') return null;
  const styles = {
    owner: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-transparent',
    admin: 'bg-red-500/10 text-red-400 border-red-500/20',
    moderator: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }[rank];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', styles)}>
      {rank === 'owner' ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
      {rank}
    </span>
  );
}

function UserCard({ user }: { user: DirectoryUser }) {
  return (
    <Link
      href={`/user/${encodeURIComponent(user.username.trim())}`}
      className="group flex items-center gap-4 rounded-2xl border border-border/40 bg-card/50 p-4 transition-all hover:border-primary/40 hover:bg-card"
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full border-2 border-border object-cover" />
      ) : (
        <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xl font-black text-white', accentFor(user.username))}>
          {user.username.trim()[0]?.toUpperCase() || '?'}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-bold transition-colors group-hover:text-primary">{user.username}</h3>
          <RankBadge rank={user.rank} />
        </div>
        <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
            <Upload className="h-3 w-3" />
            {user.uploadCount.toLocaleString()} {user.uploadCount === 1 ? 'upload' : 'uploads'}
          </span>
          <span>Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        </p>
      </div>
    </Link>
  );
}

export default async function UsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const view = first(params.view) === 'all' ? 'all' : 'contributors';
  const sortParam = first(params.sort);
  const sort = isDirectorySort(sortParam) ? sortParam : view === 'all' ? 'newest' : 'uploads';
  const q = first(params.q).slice(0, 100);
  const page = parseInt(first(params.page) || '1', 10) || 1;

  const { users, pagination, totals } = await listDirectory({ page, sort, q, contributorsOnly: view === 'contributors' });

  const href = (overrides: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    const merged = { view: view === 'all' ? 'all' : undefined, sort: sortParam || undefined, q: q || undefined, page: undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== '' && !(k === 'page' && Number(v) <= 1)) next.set(k, String(v));
    const s = next.toString();
    return `/users${s ? `?${s}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          {totals.contributors.toLocaleString()} contributors · {totals.members.toLocaleString()} members
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="inline-flex rounded-xl border border-border/50 bg-card/50 p-1">
          {([['contributors', 'Contributors', Upload], ['all', 'All members', UsersIcon]] as const).map(([key, label, Icon]) => (
            <Link
              key={key}
              href={href({ view: key === 'all' ? 'all' : undefined, sort: undefined })}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                view === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>

        <form action="/users" className="relative flex-1">
          {view === 'all' && <input type="hidden" name="view" value="all" />}
          {sortParam && <input type="hidden" name="sort" value={sortParam} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search users…"
            aria-label="Search users"
            className="h-10 w-full rounded-xl border border-border/50 bg-card/50 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>

        <Suspense>
          <UsersSortSelect value={sort} />
        </Suspense>
      </div>

      {q && (
        <p className="mb-4 text-sm text-muted-foreground">
          {pagination.total.toLocaleString()} result{pagination.total === 1 ? '' : 's'} for “{q}” ·{' '}
          <Link href={href({ q: undefined })} className="underline hover:text-foreground">clear</Link>
        </p>
      )}

      {users.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/50 py-16 text-center">
          <UsersIcon className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-1 text-lg font-semibold">No users found</h3>
          <p className="text-muted-foreground">{q ? 'Try a different search.' : 'Nobody here yet.'}</p>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {users.map((user) => <UserCard key={user.id} user={user} />)}
          </div>

          {pagination.pages > 1 && (
            <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
              <Link
                href={href({ page: pagination.page - 1 })}
                aria-disabled={pagination.page <= 1}
                className={cn('inline-flex h-9 items-center gap-1 rounded-lg border border-border/50 px-3 text-sm font-medium hover:bg-card', pagination.page <= 1 && 'pointer-events-none opacity-40')}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
              <span className="px-2 text-sm text-muted-foreground">
                Page <span className="font-medium text-foreground">{pagination.page}</span> of{' '}
                <span className="font-medium text-foreground">{pagination.pages}</span>
              </span>
              <Link
                href={href({ page: pagination.page + 1 })}
                aria-disabled={pagination.page >= pagination.pages}
                className={cn('inline-flex h-9 items-center gap-1 rounded-lg border border-border/50 px-3 text-sm font-medium hover:bg-card', pagination.page >= pagination.pages && 'pointer-events-none opacity-40')}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
