import { Metadata } from 'next';

interface Props {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decodedName = decodeURIComponent(username);

  const title = `${decodedName} | User Profile | Serika.art`;
  const description = `Check out ${decodedName}'s profile on Serika.art. See their uploads, liked artworks, and comments in our community of art enthusiasts.`;

  return {
    title,
    description,
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
