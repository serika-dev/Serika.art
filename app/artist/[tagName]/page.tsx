import { notFound } from 'next/navigation';
import { getArtistProfile } from '@/lib/artistProfile';
import ArtistPageClient from './ArtistPageClient';

export default async function ArtistPage({ params }: { params: Promise<{ tagName: string }> }) {
  const { tagName: raw } = await params;
  let tagName = raw;
  try {
    tagName = decodeURIComponent(raw);
  } catch {}
  const profile = await getArtistProfile(tagName);
  if (!profile) notFound();
  // key: a different artist is a fresh page, not a state update of this one
  return <ArtistPageClient key={tagName} tagName={tagName} initial={profile} />;
}
