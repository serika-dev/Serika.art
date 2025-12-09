# SEO Enhancements Documentation

## Overview
Serika.art now has comprehensive SEO optimizations to improve search engine visibility and social media sharing.

## Implemented SEO Features

### 1. **Meta Tags & Metadata**
- ✅ Comprehensive metadata in `app/layout.tsx`:
  - Title tags with keywords
  - Meta descriptions
  - Canonical URLs
  - Keywords (image board, art sharing, booru, anime art, community, tags, artwork)
  - Author and creator information
  - Theme color (#09090b for dark mode consistency)

### 2. **Open Graph (OG) Tags**
- ✅ OG metadata for social sharing:
  - Discord embeds
  - Twitter/X cards
  - Facebook shares
  - All with proper images, titles, and descriptions
  - Dynamic OG images for individual artwork

### 3. **Twitter/X Cards**
- ✅ Twitter Card meta tags:
  - `summary_large_image` card type
  - Custom titles and descriptions
  - Dynamic image previews

### 4. **Structured Data (JSON-LD)**
- ✅ `components/StructuredData.tsx`:
  - Organization schema with logo, URL, and description
  - Website schema with search action support
  - Rich snippets for search results
  - Proper context and type definitions

### 5. **Dynamic Metadata**
- ✅ Page-specific metadata:
  - Posts page: "Browse Artwork | Serika.art"
  - Tags page: "Browse Tags | Serika.art"
  - Image pages: Dynamic titles with tags and descriptions
  - Image layout with `generateMetadata()` function

### 6. **Sitemap**
- ✅ `app/sitemap.ts`:
  - Automatically generated sitemap.xml
  - Includes all static routes
  - Dynamically fetches and includes all image pages
  - Proper change frequency and priority values
  - Updates hourly for posts page, daily for static pages

### 7. **Robots.txt**
- ✅ `public/robots.txt`:
  - Allows all crawlers except `/api/` and `/admin/` routes
  - Specific rules for Googlebot and Bingbot
  - Sitemap location specified
  - Crawl delay set to 1 second

### 8. **Dynamic OG Images**
- ✅ Route handlers for generating images:
  - `app/og-image/route.tsx`: Homepage OG image
  - `app/image/[id]/og/route.tsx`: Dynamic images for individual artworks
  - Uses `next/og` for server-side image generation
  - Fallback images for error handling

### 9. **Search Engine Optimization**
- ✅ Robots configuration:
  - `index: true` - Allow indexing
  - `follow: true` - Follow links
  - `max-snippet: -1` - No limit on search result snippets
  - `max-image-preview: large` - Allow large image previews
  - `max-video-preview: -1` - Unlimited video previews

### 10. **Layout & Navigation**
- ✅ Proper HTML structure:
  - Semantic HTML tags
  - Proper meta charset (UTF-8)
  - Viewport meta for responsive design
  - Language attribute on html tag (lang="en")

## Page-Specific Optimization

### Homepage
- **Title**: "Serika.art - Modern Art Image Board Community"
- **Meta Description**: Comprehensive description of the platform
- **OG Image**: Static branded image with logo
- **Canonical**: https://serika.art

### Posts Page
- **Title**: "Browse Artwork | Serika.art"
- **Meta Description**: "Browse and discover beautiful artwork..."
- **Change Frequency**: hourly (fresh content)
- **Priority**: 0.9

### Tags Page
- **Title**: "Browse Tags | Serika.art"
- **Meta Description**: "Explore all tags on Serika.art..."
- **Change Frequency**: daily
- **Priority**: 0.8

### Image Pages
- **Dynamic Title**: "{tags} | Serika.art"
- **Dynamic Description**: From image description or auto-generated
- **Dynamic OG Image**: Generated with tag information
- **Keywords**: All image tags plus rating
- **Change Frequency**: weekly
- **Priority**: 0.7

## Integration Points

### Discord Embed Support
When a Serika.art image link is shared on Discord:
1. Bot fetches the page metadata
2. Displays OG title, description, and image
3. Shows image preview with tag information

### Twitter/X Embed Support
When shared on Twitter:
1. Twitter card displays with `summary_large_image` format
2. Shows custom title and description
3. Displays image preview

### Search Engine Crawling
1. Googlebot respects `max-image-preview: large`
2. Images show in Google Images with proper alt text
3. Structured data helps with rich snippets
4. Sitemap ensures all pages are discovered

## Performance Considerations

### Caching Strategy
- OG image generation: Cached with next/og
- Sitemap: Revalidates every 24 hours
- Image metadata: Revalidates every 1 hour

### Image Optimization
- OG images use server-side generation (fast, no client overhead)
- Fallback images for error handling
- Proper dimensions (1200x630 for OG standard)

## Tools for Verification

### SEO Checkers
- Google Search Console: Submit sitemap and monitor crawling
- Google PageSpeed Insights: Check performance metrics
- GTmetrix: Analyze page speed and SEO

### Social Sharing Testers
- Discord: Copy image URL and paste in chat
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/

### Structured Data Validators
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/

## Future Enhancements

### Possible additions:
1. **Image Schema**: Add `https://schema.org/ImageObject` for individual images
2. **Breadcrumb Navigation**: Implement breadcrumb schema
3. **FAQ Schema**: If FAQ content is added
4. **Review/Rating Schema**: If review system is enhanced
5. **Video Schema**: If video support is added
6. **Hreflang Tags**: For multi-language support (if needed)
7. **AMP Pages**: For mobile optimization (optional)
8. **WebSub**: For real-time sitemap updates

## Monitoring & Maintenance

### Regular Tasks
1. Monitor Google Search Console for crawl errors
2. Check sitemap generation in logs
3. Verify OG images render correctly on social platforms
4. Monitor Core Web Vitals
5. Track keyword rankings

### Troubleshooting
- If images don't appear in Discord: Check OG metadata in DevTools
- If sitemap isn't updating: Verify API is responding with image data
- If structured data fails validation: Use Google Rich Results Test

---

**Last Updated**: December 9, 2025
**Serika.art Version**: 16.0.7 (Next.js)
