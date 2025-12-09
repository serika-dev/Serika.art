# SEO Quick Reference

## 🔍 Test Your SEO Implementation

### Discord Embed Test
1. Copy any Serika.art link
2. Paste in Discord channel
3. Should show: Title, Description, Image preview

### Twitter Card Test
1. Visit: https://cards-dev.twitter.com/validator
2. Paste URL from Serika.art
3. Check preview on right side

### Google Rich Results
1. Visit: https://search.google.com/test/rich-results
2. Paste URL
3. Should validate successfully

### Facebook Sharing
1. Visit: https://developers.facebook.com/tools/debug/
2. Paste URL
3. Preview sharing appearance

---

## 📋 Sitemap & Robots

**Sitemap**: `https://serika.art/sitemap.xml`
- Auto-updates every 24 hours
- Includes all images + static pages
- Proper priority levels

**Robots.txt**: `https://serika.art/robots.txt`
- Allows public crawling
- Blocks API and admin routes
- Specifies sitemap location

---

## 🏷️ Page Metadata

### Homepage
```
Title: Serika.art - Modern Art Image Board Community
Description: Discover and share beautiful artwork...
OG Image: https://serika.art/og-image
```

### Posts Page
```
Title: Browse Artwork | Serika.art
Description: Browse and discover beautiful artwork...
Change Frequency: hourly
```

### Individual Images
```
Title: {tags} | Serika.art
Description: Auto-generated from image data
OG Image: Dynamic, generated from image
```

---

## 📊 Files to Know

| File | Purpose |
|------|---------|
| `/app/layout.tsx` | Main metadata + StructuredData |
| `/app/sitemap.ts` | Dynamic sitemap generation |
| `/app/image/[id]/layout.tsx` | Image page metadata |
| `/public/robots.txt` | Search engine rules |
| `/components/StructuredData.tsx` | JSON-LD schemas |
| `/SEO_ENHANCEMENTS.md` | Detailed documentation |

---

## 🚀 Deployment Checklist

- [ ] Build successful: `bun run build`
- [ ] Test local: `bun dev` → open http://localhost:3000
- [ ] Deploy to production
- [ ] Submit sitemap to Google Search Console
- [ ] Submit to Bing Webmaster Tools
- [ ] Test Discord embed with real link
- [ ] Test Twitter card validator
- [ ] Wait 24-48 hours for initial indexing
- [ ] Monitor Search Console for errors

---

## 📧 Submit Sitemap

**Google Search Console**:
1. https://search.google.com/search-console
2. Add property for serika.art
3. Go to Sitemaps
4. Add new sitemap: `https://serika.art/sitemap.xml`
5. Submit

**Bing Webmaster Tools**:
1. https://www.bing.com/webmaster
2. Add site for serika.art
3. Submit sitemaps: `https://serika.art/sitemap.xml`

---

## 💬 JSON-LD Schemas Included

1. **Organization Schema**
   - Name, URL, logo
   - Social media links
   - General description

2. **Website Schema**
   - Site name and URL
   - Search action support
   - Search query template

---

## 🎯 Expected SEO Benefits

**Short Term (1-7 days)**
- Proper metadata in search results
- Rich previews in social media
- Sitemap indexed by crawlers

**Medium Term (1-4 weeks)**
- Image pages start ranking
- Improved click-through rates
- Better snippet appearance

**Long Term (1-3 months)**
- Higher rankings for image searches
- More organic traffic
- Better user engagement
- Improved discoverability

---

## ⚡ Performance Notes

- OG images: Server-generated (fast, no client overhead)
- Sitemap: Cached for 24 hours
- Metadata: Generated at build time
- JSON-LD: Injected client-side after render

---

## 🔒 Privacy & Security

All SEO enhancements respect:
- No tracking pixels
- No third-party analytics (optional)
- GDPR compliant
- User privacy protected

---

**Last Updated**: December 9, 2025
**Status**: ✅ Production Ready
