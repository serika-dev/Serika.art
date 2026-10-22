import { Metadata } from 'next';
import StructuredData from '@/components/StructuredData';
import { getCachedCount } from '@/lib/db';
import HomePageClient from '@/components/HomePageClient';

// ISR: cache this page for 60s — stats don't need to be real-time
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Serika.art - Modern Anime Art Image Board & Serika Booru | 4M+ Artworks',
  description: 'Serika.art (Serika Booru) is the ultimate modern anime art image board. Discover and share over 4 million artworks, illustrations, and fan art. Explore by tags, artists, and characters on Serika Art.',
  keywords: [
    'serika booru', 'serika art', 'anime art', 'image board', 'booru', 'illustrations', 'digital art', 'fan art',
    'anime wallpapers', 'manga art', 'art gallery', 'art community', 'serika.art',
    'anime illustrations', 'character art', 'artist portfolio', 'gelbooru alternative', 'danbooru clone'
  ],
  alternates: {
    canonical: 'https://serika.art',
  },
  openGraph: {
    title: 'Serika.art - Modern Anime Art Image Board & Serika Booru',
    description: 'Discover and share over 4 million anime artworks on Serika Booru. The most advanced image board for Serika Art.',
    type: 'website',
    url: 'https://serika.art',
    siteName: 'Serika Booru',
  },
};

async function getStats() {
  try {
    // Use cached counts — backed by Redis with 5-min TTL, avoids raw COUNT(*) on 1.5M rows
    const [imageCount, tagCount] = await Promise.all([
      getCachedCount('images', 'deleted = FALSE'),
      getCachedCount('tags'),
    ]);
    return { imageCount, tagCount };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { imageCount: 4000000, tagCount: 700000 };
  }
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <>
      <StructuredData />
      <HomePageClient imageCount={stats.imageCount} tagCount={stats.tagCount} />
    </>
  );
}
