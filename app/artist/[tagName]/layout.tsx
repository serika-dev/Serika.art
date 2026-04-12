import { Metadata } from 'next';

interface Props {
  params: Promise<{ tagName: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tagName } = await params;
  const decodedName = decodeURIComponent(tagName).replace(/_/g, ' ');

  const title = `${decodedName} | Artist Profile & Artwork | Serika.art`;
  const description = `View the artist profile for ${decodedName} on Serika.art. Explore their illustrations, fan art, and digital creations from our 1.5M+ image collection. Browse, favorite, and discover ${decodedName}'s complete portfolio.`;
  const keywords = [
    decodedName, `${decodedName} art`, `${decodedName} artist`, `${decodedName} artwork`,
    `${decodedName} illustrations`, `${decodedName} fan art`, `${decodedName} portfolio`,
    'anime artist', 'digital art', 'illustration', 'serika.art',
  ];

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `https://serika.art/artist/${tagName}`,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://serika.art/artist/${tagName}`,
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function ArtistLayout({ children }: Props) {
  return children;
}
