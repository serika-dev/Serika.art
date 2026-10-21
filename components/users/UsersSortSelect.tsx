'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const OPTIONS = [
  { value: 'uploads', label: 'Most uploads' },
  { value: 'newest', label: 'Newest members' },
  { value: 'oldest', label: 'Oldest members' },
  { value: 'alphabetical', label: 'Username A–Z' },
  { value: 'alphabetical-reverse', label: 'Username Z–A' },
];

export default function UsersSortSelect({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <select
      aria-label="Sort users"
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('sort', e.target.value);
        params.delete('page');
        router.push(`/users?${params.toString()}`);
      }}
      className="h-10 rounded-xl border border-border/50 bg-card/50 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
