'use client';

import { Heart } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

/** One-time Stripe payment link for the CDN bill. */
export const DONATE_URL = 'https://pay.serika.dev/b/5kQbJ2fms3Ly5EY7eZ8Zq09';
/** Serika+ plans on Serika Accounts. */
export const SERIKA_PLUS_URL = 'https://accounts.serika.dev/premium';

const TITLE = 'Help keep Serika online';
const BODY = 'Monthly CDN costs are getting hard to cover.';

function DonateLink({ className }: { className?: string }) {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      Donate
    </a>
  );
}

function PlusLink({ className }: { className?: string }) {
  return (
    <a
      href={SERIKA_PLUS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 text-xs font-bold text-foreground transition-colors hover:border-violet-400/50 hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40',
        className
      )}
    >
      Serika<span className="text-violet-300">+</span>
    </a>
  );
}

function Mark() {
  return <Heart className="h-4 w-4 shrink-0 fill-violet-400/15 text-violet-300" aria-hidden />;
}

/**
 * Support ask for the CDN bill, with a Serika+ plan link.
 * Hidden for accounts that already have Serika+ (`isPremium` from Serika Accounts).
 * `home` sits in the homepage column, `banner` above the post grid, `tile` in the grid.
 */
export default function DonationWidget({
  variant = 'banner',
  className,
}: {
  variant?: 'home' | 'banner' | 'tile';
  className?: string;
}) {
  const { user } = useAuth();
  if (user?.isPremium) return null;

  if (variant === 'tile') {
    return (
      <aside
        aria-label="Support Serika"
        className={cn(
          'flex h-full flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/50 text-card-foreground shadow-sm transition-all duration-300 hover:border-primary/30 hover:bg-card hover:shadow-2xl hover:shadow-primary/5',
          className
        )}
      >
        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(139,92,246,0.16),transparent_64%)]" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-background/60">
            <Heart className="h-4 w-4 fill-violet-400/20 text-violet-300" aria-hidden />
          </div>
          <div className="relative">
            <p className="text-sm font-bold tracking-tight">{TITLE}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{BODY}</p>
          </div>
        </div>
        <div className="flex gap-2 border-t border-border/40 p-3">
          <DonateLink className="flex-1" />
          <PlusLink className="flex-1" />
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Support Serika"
      className={cn(
        'rounded-xl border border-border/40 bg-card px-3.5 py-3 sm:px-4',
        variant === 'banner' && 'rounded-2xl bg-card/50',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <Mark />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold tracking-tight text-foreground">{TITLE}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            {BODY}{' '}
            <span className="text-foreground/80">
              Donate toward the bill, or support it with Serika<span className="text-violet-300">+</span>.
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DonateLink />
          <PlusLink />
        </div>
      </div>
    </aside>
  );
}
