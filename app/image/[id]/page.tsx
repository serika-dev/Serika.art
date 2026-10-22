import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import ImageDetailContent from '@/components/ImageDetailContent';
import RelatedPosts from '@/components/RelatedPosts';
import { postSeo, displayTag, shareImageUrl } from '@/lib/seo';
import { jsonLdHtml } from '@/lib/jsonLd';

interface PageProps {
  params: Promise<{ id: string }>;
}

// ISR: each image page is rendered on first visit, then served from cache and
// regenerated in the background at most every 5 minutes (and immediately via
// revalidatePath when the image is edited or moderated). Views are counted by
// the client (POST /api/images/:id/view), not during render.
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

// React cache() deduplicates calls within the same request so
// generateMetadata + ImagePage share one DB round-trip instead of two.
const getImageData = cache(async (id: string) => {
  const sequentialId = parseInt(id, 10);
  if (isNaN(sequentialId)) return null;

  // Explicit columns — avoid pulling metadata JSONB, moderation fields, etc.
  const imageResult = await query(
    `SELECT i.id, i.sequential_id, i.user_id, i.username, i.url, i.thumbnail_url,
            i.original_filename, i.file_size, i.width, i.height, i.content_type,
            i.rating, i.is_ai_generated, i.source, i.description,
            i.upvotes, i.downvotes, i.favorites, i.views,
            i.deleted, i.unlisted, i.created_at, i.updated_at,
            i.metadata->'aiProvenance' AS ai_provenance,
            u.username as u_username
     FROM images i
     LEFT JOIN users u ON u.id = i.user_id
     WHERE i.sequential_id = $1`,
    [sequentialId]
  );
  if (imageResult.rows.length === 0) return null;
  const image = imageResult.rows[0];

  // Fetch populated tags
  const tagsResult = await query(
    `SELECT t.id, t.name, t.type
     FROM image_tags it
     JOIN tags t ON t.id = it.tag_id
     WHERE it.image_id = $1`,
    [image.id]
  );

  const populatedTags = tagsResult.rows.map(t => ({
    _id: String(t.id),
    name: t.name,
    type: t.type,
  }));

  // Return compatible object structure
  return {
    ...image,
    _id: String(image.id),
    id: image.id,
    userId: image.user_id,
    username: image.u_username || image.username || 'Anonymous',
    sequentialId: image.sequential_id,
    isAIGenerated: image.is_ai_generated,
    aiProvenance: image.ai_provenance || null,
    thumbnailUrl: image.thumbnail_url,
    originalFilename: image.original_filename,
    fileSize: image.file_size,
    contentType: image.content_type,
    createdAt: image.created_at,
    updatedAt: image.updated_at,
    tags: populatedTags,
  };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const image = await getImageData(id);
  
  if (!image) {
    return {
      title: 'Image Not Found | Serika.art',
      robots: { index: false, follow: true },
    };
  }

  const seo = postSeo(image);
  const tagNames = image.tags.map((t: any) => t.name);
  const artistTags = image.tags.filter((t: any) => t.type === 'artist').map((t: any) => displayTag(t.name));
  // Straight from the CDN when it's small enough to embed (no origin CPU per
  // crawler); only huge originals go through the resizer.
  const shareOriginal = image.fileSize > 0 && image.fileSize < 5_000_000 && image.width > 0;
  const shareImage = shareOriginal ? image.url : shareImageUrl(image.url);
  const shareWidth = shareOriginal ? image.width : 1200;
  const shareHeight = shareOriginal ? image.height : image.width > 0 ? Math.round((image.height / image.width) * 1200) : 630;

  return {
    // absolute: the root layout's "%s | Serika Booru" template would add the site name twice
    title: { absolute: seo.title },
    description: seo.description,
    keywords: tagNames.slice(0, 25).map(displayTag),
    authors: artistTags.length > 0 ? artistTags.map((a: string) => ({ name: a })) : undefined,
    creator: artistTags[0],
    publisher: 'Serika.art',
    alternates: {
      canonical: `https://serika.art/image/${image.sequentialId}`,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      images: [{ url: shareImage, width: shareWidth, height: shareHeight, alt: seo.alt }],
      type: 'article',
      url: `https://serika.art/image/${image.sequentialId}`,
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: [shareImage],
    },
    other: {
      // SafeSearch: label adult posts individually so the rest of the site isn't filtered
      ...(seo.isAdult && { rating: 'adult' }),
      // Discord embed accent colour + article metadata
      'theme-color': image.rating === 'safe' ? '#22c55e' : image.rating === 'questionable' ? '#eab308' : '#ef4444',
      'og:locale': 'en_US',
      'article:published_time': new Date(image.createdAt).toISOString(),
      'article:author': artistTags[0] || 'Anonymous',
      'article:section': 'Artwork',
      'article:tag': tagNames.slice(0, 8).map(displayTag).join(','),
    },
  };
}

export default async function ImagePage({ params }: PageProps) {
  const { id } = await params;
  const image = await getImageData(id);

  if (!image) {
    notFound();
  }

  const seo = postSeo(image);
  const byType = (type: string) => image.tags.filter((t: any) => t.type === type).map((t: any) => t.name as string);
  const artistTags = byType('artist');
  const characterTags = byType('character');
  const copyrightTags = byType('copyright');
  // The tag page this post belongs to most: series, else artist, else character
  const parentTag = copyrightTags[0] ?? artistTags[0] ?? characterTags[0];

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Serika.art', item: 'https://serika.art' },
      parentTag
        ? { '@type': 'ListItem', position: 2, name: displayTag(parentTag), item: `https://serika.art/posts?tags=${encodeURIComponent(parentTag)}` }
        : { '@type': 'ListItem', position: 2, name: 'Posts', item: 'https://serika.art/posts' },
      { '@type': 'ListItem', position: 3, name: seo.headline, item: `https://serika.art/image/${image.sequentialId}` },
    ],
  };

  // Structured data for Google Images (creator / credit) and rich results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    '@id': `https://serika.art/image/${image.sequentialId}`,
    name: seo.headline,
    caption: seo.alt,
    description: image.description || seo.description,
    contentUrl: image.url,
    url: `https://serika.art/image/${image.sequentialId}`,
    thumbnailUrl: image.thumbnailUrl || image.url,
    width: { '@type': 'QuantitativeValue', value: image.width, unitCode: 'E37' },
    height: { '@type': 'QuantitativeValue', value: image.height, unitCode: 'E37' },
    encodingFormat: image.contentType || undefined,
    uploadDate: image.createdAt,
    datePublished: image.createdAt,
    ...(artistTags.length > 0
      ? {
          creator: artistTags.map((a: string) => ({
            '@type': 'Person',
            name: displayTag(a),
            url: `https://serika.art/artist/${encodeURIComponent(a)}`,
          })),
          creditText: artistTags.map(displayTag).join(', '),
        }
      : {}),
    ...(image.source && /^https?:\/\//.test(image.source) ? { isBasedOn: image.source } : {}),
    keywords: image.tags.map((t: any) => displayTag(t.name)).join(', '),
    genre: 'Illustration',
    contentRating: image.rating,
    isFamilyFriendly: image.rating === 'safe',
    isPartOf: { '@type': 'WebSite', name: 'Serika.art', url: 'https://serika.art' },
    interactionStatistic: [
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/ViewAction', userInteractionCount: image.views },
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: image.favorites },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <ImageDetailContent initialImage={image} imageId={id} headline={seo.headline} summary={seo.summary} imageAlt={seo.alt} />
      <RelatedPosts post={image} artist={artistTags[0]} character={characterTags[0]} series={copyrightTags[0]} />
    </>
  );
}
