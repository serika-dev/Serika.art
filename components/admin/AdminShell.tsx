'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Tags, Users, History, Scale, Palette, Upload, Loader2, ShieldCheck, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export interface AdminOverview {
  totals: { images: number; tags: number; users: number; uploadsDay: number; uploadsWeek: number };
  pending: { dmca: number; claims: number; imports: number; importRunning: boolean };
  recentModeration: { id: number; action: string; target_id: number; performed_by_username: string; reason: string | null; created_at: string }[];
  autotag: { enabled: boolean; cursor: number; maxImageId: number; processed: number; tagsAdded: number; lastPassCompletedAt: string | null } | null;
  tagMigration: { enabled: boolean; done: boolean; renamed: number; merged: number; linksMoved: number } | null;
}

const OverviewContext = createContext<{ overview: AdminOverview | null; refresh: () => void }>({ overview: null, refresh: () => {} });
export const useAdminOverview = () => useContext(OverviewContext);

const NAV: { href: string; label: string; icon: typeof Tags; badge?: (o: AdminOverview) => number }[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/tags', label: 'Tags', icon: Tags },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/moderation', label: 'Moderation log', icon: History },
  { href: '/admin/dmca', label: 'DMCA', icon: Scale, badge: (o) => o.pending.dmca },
  { href: '/admin/artists', label: 'Artist claims', icon: Palette, badge: (o) => o.pending.claims },
  { href: '/admin/import', label: 'Import', icon: Upload, badge: (o) => o.pending.imports },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const isAdmin = !!user && (user.rank === 'admin' || user.rank === 'owner');

  useEffect(() => {
    if (!loading && !isAdmin) router.push('/posts');
  }, [loading, isAdmin, router]);

  const refresh = useCallback(() => {
    fetch('/api/admin/overview')
      .then((r) => r.json())
      .then((d) => d.success && setOverview(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [isAdmin, refresh]);

  if (loading || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
      </div>
    );
  }

  const active = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  return (
    <OverviewContext.Provider value={{ overview, refresh }}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <aside className="lg:sticky lg:top-[5.5rem] lg:h-[calc(100vh-7rem)] lg:w-60 lg:shrink-0">
          <div className="mb-4 hidden items-center gap-3 px-2 lg:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Admin</p>
              <p className="text-xs capitalize text-muted-foreground">{user.username} · {user.rank}</p>
            </div>
          </div>
          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {NAV.map(({ href, label, icon: Icon, badge }) => {
              const count = overview && badge ? badge(overview) : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    active(href)
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-muted-foreground hover:bg-card hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {count > 0 && (
                    <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-400">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              href="/api-docs"
              className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground lg:mt-4"
            >
              <ExternalLink className="h-4 w-4" />
              API docs
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </OverviewContext.Provider>
  );
}
