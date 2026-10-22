import React from 'react';
import { jsonLdHtml } from '@/lib/jsonLd';

// Site-level structured data. Rendered on the home page only: Google reads
// Organization/WebSite (sitelinks search box) from there, and repeating a
// generic breadcrumb on every page competed with each page's real one.
export default function StructuredData() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://serika.art/#organization',
    name: 'Serika.art',
    alternateName: ['Serika Booru', 'Serika Art'],
    url: 'https://serika.art',
    logo: { '@type': 'ImageObject', url: 'https://serika.art/logo.svg' },
    description: 'Serika.art is an anime art image board (booru) with millions of tagged illustrations and fan art.',
    sameAs: ['https://twitter.com/serika_art', 'https://discord.gg/5s2zgwn35y'],
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', url: 'https://serika.art/contact' },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://serika.art/#website',
    name: 'Serika.art',
    alternateName: ['Serika Booru', 'Serika Art'],
    url: 'https://serika.art',
    publisher: { '@id': 'https://serika.art/#organization' },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: 'https://serika.art/posts?tags={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: 'en-US',
  };

  return (
    <>
      <script id="schema-organization" type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(organizationSchema) }} />
      <script id="schema-website" type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(websiteSchema) }} />
    </>
  );
}
