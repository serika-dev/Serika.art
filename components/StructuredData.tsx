'use client';

import { useEffect } from 'react';

export default function StructuredData() {
  useEffect(() => {
    // Organization schema
    const organizationSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://serika.art/#organization',
      name: 'Serika.art',
      url: 'https://serika.art',
      logo: {
        '@type': 'ImageObject',
        url: 'https://serika.art/logo.svg',
        width: 512,
        height: 512,
      },
      description: 'A modern, clean image board for sharing and discovering over 1.5 million artworks',
      foundingDate: '2024',
      sameAs: [
        'https://twitter.com/serika_art',
        'https://discord.gg/serika',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        url: 'https://serika.art/contact',
      },
    };

    // Website schema with enhanced search
    const websiteSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': 'https://serika.art/#website',
      name: 'Serika.art',
      url: 'https://serika.art',
      description: 'Modern art image board with over 1.5 million artworks',
      publisher: {
        '@id': 'https://serika.art/#organization',
      },
      potentialAction: [
        {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://serika.art/posts?tags={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      ],
      inLanguage: 'en-US',
    };

    // ImageGallery schema for the whole site
    const gallerySchema = {
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      '@id': 'https://serika.art/#gallery',
      name: 'Serika.art Image Gallery',
      description: 'Browse over 1.5 million artworks including anime, illustrations, digital art, and fan art',
      url: 'https://serika.art/posts',
      numberOfItems: 1500000,
      provider: {
        '@id': 'https://serika.art/#organization',
      },
    };

    // WebApplication schema
    const webAppSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': 'https://serika.art/#webapp',
      name: 'Serika.art',
      url: 'https://serika.art',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Browse millions of artworks',
        'Advanced tag filtering',
        'Content ratings (Safe, Sketchy, Explicit)',
        'Favorites and collections',
        'Upvote and downvote system',
        'Artist and character tags',
        'User uploads',
        'API access',
      ],
    };

    // BreadcrumbList for site structure
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://serika.art',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Browse',
          item: 'https://serika.art/posts',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Tags',
          item: 'https://serika.art/tags',
        },
      ],
    };

    // Add schemas to head
    const addSchema = (schema: any, id: string) => {
      const existingScript = document.getElementById(id);
      if (existingScript) existingScript.remove();
      
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    };

    addSchema(organizationSchema, 'schema-organization');
    addSchema(websiteSchema, 'schema-website');
    addSchema(gallerySchema, 'schema-gallery');
    addSchema(webAppSchema, 'schema-webapp');
    addSchema(breadcrumbSchema, 'schema-breadcrumb');

    return () => {
      // Cleanup
      ['schema-organization', 'schema-website', 'schema-gallery', 'schema-webapp', 'schema-breadcrumb'].forEach(id => {
        const script = document.getElementById(id);
        if (script) script.remove();
      });
    };
  }, []);

  return null;
}
