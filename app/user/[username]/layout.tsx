import { Metadata } from 'next';

interface Props {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decodedName = decodeURIComponent(username);

  const title = `${decodedName} | User Profile | Serika.art`;
  const description = `Check out ${decodedName}'s profile on Serika.art. Browse their uploads, favorites, and activity in our art community of 1.5M+ images.`;
  const keywords = [
    decodedName, `${decodedName} profile`, `${decodedName} art uploads`,
    'art community', 'serika artist', 'art uploader', 'serika.art',
  ];

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `https://serika.art/user/${username}`,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://serika.art/user/${username}`,
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function UserLayout({ children }: Props) {
  return children;
}
