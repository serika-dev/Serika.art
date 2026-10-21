'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavGroup {
  title: string;
  items: { id: string; label: string; method?: string }[];
}

const methodColor: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-sky-400',
  PATCH: 'text-amber-400',
  PUT: 'text-amber-400',
  DELETE: 'text-rose-400',
};

/** Sidebar: filter box + highlights the section currently on screen. */
export default function DocsNav({ groups }: { groups: NavGroup[] }) {
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(groups[0]?.items[0]?.id);

  useEffect(() => {
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [groups]);

  const needle = filter.trim().toLowerCase();
  return (
    <nav aria-label="API reference">
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter endpoints…"
          aria-label="Filter endpoints"
          className="h-9 w-full rounded-lg border border-border/50 bg-card/50 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>
      <div className="space-y-6">
        {groups.map((group) => {
          const items = group.items.filter((i) => !needle || i.label.toLowerCase().includes(needle) || i.id.includes(needle));
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                        active === item.id ? 'bg-violet-500/10 font-medium text-violet-200' : 'text-muted-foreground hover:bg-card hover:text-foreground'
                      )}
                    >
                      {item.method && (
                        <span className={cn('w-11 shrink-0 font-mono text-[10px] font-bold', methodColor[item.method])}>{item.method}</span>
                      )}
                      <span className="truncate">{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
