'use client';

import { useEffect } from 'react';

export default function StructuredData() {
  useEffect(() => {
    // Organization schema
    const organizationSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Serika.art',
      url: 'https://serika.art',
      logo: 'https://serika.art/logo.svg',
      description: 'A modern, clean image board for sharing and discovering art',
      sameAs: [
        'https://twitter.com/serika_art',
        'https://discord.gg/serika',
      ],
    };

    // Website schema
    const websiteSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Serika.art',
      url: 'https://serika.art',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://serika.art/posts?tags={search_term_string}',
        },
        query_input: 'required name=search_term_string',
      },
    };

    // Add schemas to head
    const addSchema = (schema: any) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    };

    addSchema(organizationSchema);
    addSchema(websiteSchema);

    return () => {
      // Cleanup is optional but helps in dev mode with hot reload
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach((script) => {
        if (
          script.textContent?.includes('Serika.art') &&
          !script.textContent?.includes('imageSchema')
        ) {
          script.remove();
        }
      });
    };
  }, []);

  return null;
}
