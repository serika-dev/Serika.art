'use client';

import Link from 'next/link';
import { Image as ImageIcon, Tags, Users, UploadCloud, Scale, Palette, Upload, Wand2, History, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAdminOverview } from '@/components/admin/AdminShell';
import { cn } from '@/lib/utils';

const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString());

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function Stat({ icon: Icon, label, value, hint, accent }: { icon: typeof Tags; label: string; value: string; hint?: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Task({ href, icon: Icon, title, count, empty, busy }: { href: string; icon: typeof Tags; title: string; count?: number; empty: string; busy?: boolean }) {
  const has = (count ?? 0) > 0;
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border p-4 transition-colors',
        has ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10' : 'border-border/40 bg-card/50 hover:bg-card'
      )}
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', has ? 'bg-amber-500/15 text-amber-400' : 'bg-muted text-muted-foreground')}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">
          {count === undefined ? 'Loading…' : has ? `${count.toLocaleString()} waiting${busy ? ' · running now' : ''}` : empty}
        </p>
      </div>
      {has ? <ArrowRight className="h-4 w-4 text-amber-400 transition-transform group-hover:translate-x-0.5" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500/70" />}
    </Link>
  );
}

export default function AdminDashboard() {
  const { overview, refresh } = useAdminOverview();
  const t = overview?.totals;
  const a = overview?.autotag;
  const progress = a && a.maxImageId ? Math.min(100, (a.cursor / a.maxImageId) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">What&apos;s happening on Serika.art</p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat icon={ImageIcon} label="Posts" value={fmt(t?.images)} hint="approximate" accent="bg-violet-500/15 text-violet-300" />
        <Stat icon={Tags} label="Tags" value={fmt(t?.tags)} accent="bg-sky-500/15 text-sky-300" />
        <Stat icon={Users} label="Members" value={fmt(t?.users)} accent="bg-emerald-500/15 text-emerald-300" />
        <Stat icon={UploadCloud} label="New posts, 24h" value={fmt(t?.uploadsDay)} hint={t ? `${t.uploadsWeek.toLocaleString()} in the last 7 days` : undefined} accent="bg-amber-500/15 text-amber-300" />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Needs attention</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Task href="/admin/dmca" icon={Scale} title="DMCA requests" count={overview?.pending.dmca} empty="Nothing pending" />
          <Task href="/admin/artists" icon={Palette} title="Artist claims" count={overview?.pending.claims} empty="Nothing pending" />
          <Task href="/admin/import" icon={Upload} title="Import queue" count={overview?.pending.imports} busy={overview?.pending.importRunning} empty="Queue is empty" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="rounded-2xl border border-border/40 bg-card/50 p-5 xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-violet-300" />
            <h2 className="font-semibold">Autotag backfill</h2>
            <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs font-semibold', a?.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground')}>
              {a ? (a.enabled ? 'Running' : 'Off') : '—'}
            </span>
          </div>
          {a ? (
            <>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="mb-4 text-xs text-muted-foreground">{progress.toFixed(1)}% of posts scanned</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-background/50 p-3">
                  <dt className="text-muted-foreground">Posts tagged</dt>
                  <dd className="text-xl font-bold tabular-nums">{a.processed.toLocaleString()}</dd>
                </div>
                <div className="rounded-xl bg-background/50 p-3">
                  <dt className="text-muted-foreground">Tags added</dt>
                  <dd className="text-xl font-bold tabular-nums">{a.tagsAdded.toLocaleString()}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">Adds confident tags to posts with fewer than 5 tags. New uploads are tagged as they arrive.</p>
              {overview?.tagMigration && (overview.tagMigration.enabled || overview.tagMigration.done) && (
                <div className="mt-4 rounded-xl border border-border/40 bg-background/50 p-3 text-xs">
                  <p className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                    Underscore tag names
                    <span className={cn('rounded-full px-2 py-0.5', overview.tagMigration.done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-300')}>
                      {overview.tagMigration.done ? 'Done' : 'Migrating'}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {overview.tagMigration.renamed.toLocaleString()} renamed · {overview.tagMigration.merged.toLocaleString()} merged ·{' '}
                    {overview.tagMigration.linksMoved.toLocaleString()} post links moved
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{overview ? 'The autotagger is not configured.' : 'Loading…'}</p>
          )}
        </section>

        <section className="rounded-2xl border border-border/40 bg-card/50 p-5 xl:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Recent moderation</h2>
            <Link href="/admin/moderation" className="ml-auto text-sm text-violet-300 hover:text-violet-200">View all</Link>
          </div>
          {!overview ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : overview.recentModeration.length === 0 ? (
            <p className="text-sm text-muted-foreground">No moderation actions yet.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {overview.recentModeration.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span
                    className={cn(
                      'w-24 shrink-0 rounded-md px-2 py-0.5 text-center text-xs font-semibold capitalize',
                      m.action === 'restore' ? 'bg-emerald-500/15 text-emerald-400'
                        : m.action === 'unlist' ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-rose-500/15 text-rose-400'
                    )}
                  >
                    {m.action.replace(/_/g, ' ')}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{m.performed_by_username || 'system'}</span>
                    <span className="text-muted-foreground"> · post {m.target_id}{m.reason ? ` · ${m.reason}` : ''}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(m.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
