import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCollection } from '@/lib/db';
import ImageDetailContent from '@/components/ImageDetailContent';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getImageData(id: string) {
  const collection = await getCollection('images');
  const tagsCollection = await getCollection('tags');
  
  const sequentialId = parseInt(id, 10);
  if (isNaN(sequentialId)) return null;

  const image = await collection.findOne({ sequentialId });
  if (!image) return null;

  // Populate tags
  const tags = image.tags || [];
  let populatedTags: any[] = [];
  
  if (Array.isArray(tags) && tags.length > 0) {
    const tagDocs = await tagsCollection
      .find({ _id: { $in: tags } })
      .toArray();
    
    const tagMap = new Map(tagDocs.map(t => [t._id.toString(), t]));
    
    populatedTags = tags.map(tagId => {
      const tag = tagMap.get(tagId.toString());
      return {
        _id: tagId.toString(),
        name: tag?.name || 'unknown',
        type: tag?.type || 'general',
      };
    });
  }

  // Increment views in background (non-blocking for initial render)
  collection.updateOne({ sequentialId }, { $inc: { views: 1 } }).catch(console.error);

  // Serialize for Client Component
  return JSON.parse(JSON.stringify({
    ...image,
    _id: image._id.toString(),
    userId: image.userId?.toString(),
    tags: populatedTags,
    views: image.views + 1
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const image = await getImageData(id);
  
  if (!image) {
    return {
      title: 'Image Not Found | Serika.art',
    };
  }

  const tags = image.tags.map((t: any) => t.name).join(', ');
  const title = `Image #${image.sequentialId} - ${tags} | Serika.art`;
  const description = `Discover art on Serika.art. Tags: ${tags}. Rating: ${image.rating}. Dimensions: ${image.width}x${image.height}.`;

  return {
    title,
    description,
    keywords: image.tags.map((t: any) => t.name),
    openGraph: {
      title,
      description,
      images: [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: tags,
        },
      ],
      type: 'article',
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };
}

export default async function ImagePage({ params }: PageProps) {
  const { id } = await params;
  const image = await getImageData(id);

  if (!image) {
    notFound();
  }

  // Structured Data for Google Images
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    name: `Artwork #${image.sequentialId}`,
    description: image.description || `Illustration shared on Serika.art with tags: ${image.tags.map((t: any) => t.name).join(', ')}`,
    contentUrl: image.url,
    thumbnailUrl: image.thumbnailUrl || image.url,
    width: image.width,
    height: image.height,
    uploadDate: image.createdAt,
    author: {
      '@type': 'Person',
      name: image.username,
      url: `https://serika.art/user/${image.username}`,
    },
    keywords: image.tags.map((t: any) => t.name).join(', '),
    genre: 'Art',
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ViewAction',
        userInteractionCount: image.views,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: image.favorites,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ImageDetailContent initialImage={image} imageId={id} />
    </>
  );
}
