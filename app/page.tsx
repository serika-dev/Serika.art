import { Metadata } from 'next';
import { query } from '@/lib/db';
import HomePageClient from '@/components/HomePageClient';

export const metadata: Metadata = {
  title: 'Serika.art - Modern Anime Art Image Board & Serika Booru | 1.5M+ Artworks',
  description: 'Serika.art (Serika Booru) is the ultimate modern anime art image board. Discover and share over 1.5 million artworks, illustrations, and fan art. Explore by tags, artists, and characters on Serika Art.',
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
    description: 'Discover and share over 1.5 million anime artworks on Serika Booru. The most advanced image board for Serika Art.',
    type: 'website',
    url: 'https://serika.art',
    siteName: 'Serika Booru',
  },
};

async function getStats() {
  try {
    const imagesCountRes = await query(`SELECT COUNT(*) FROM images WHERE deleted = FALSE`);
    const tagsCountRes = await query(`SELECT COUNT(*) FROM tags`);
    
    const imageCount = parseInt(imagesCountRes.rows[0].count, 10);
    const tagCount = parseInt(tagsCountRes.rows[0].count, 10);
    
    return { imageCount, tagCount };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { imageCount: 1500000, tagCount: 50000 };
  }
}

export default async function HomePage() {
  const stats = await getStats();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Serika.art',
    alternateName: ['Serika Booru', 'Serika Art'],
    url: 'https://serika.art',
    description: `Modern anime art image board (Serika Booru) with ${stats.imageCount.toLocaleString()} artworks`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://serika.art/posts?tags={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageClient imageCount={stats.imageCount} tagCount={stats.tagCount} />
    </>
  );
}
