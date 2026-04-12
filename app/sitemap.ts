import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://serika.art";

  // Static routes with high priority
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/posts`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/tags`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/users`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/dmca`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/api-docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  // Fetch popular/recent images for dynamic routes (limit to most relevant)
  let imageRoutes: MetadataRoute.Sitemap = [];
  try {
    const response = await fetch(`${baseUrl}/api/images?limit=10000&sort=popularity`, {
      next: { revalidate: 86400 },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.images && Array.isArray(data.images)) {
        imageRoutes = data.images.map((image: any) => {
          const id = image.sequentialId || (image._id ? image._id.toString() : null);
          if (!id) return null;
          
          return {
            url: `${baseUrl}/image/${id}`,
            lastModified: new Date(image.updatedAt || image.createdAt || new Date()),
            changeFrequency: "weekly" as const,
            priority: 0.7,
          };
        }).filter(Boolean);
      }
    }
  } catch (error) {
    console.error("Failed to generate image sitemap entries:", error);
  }

  // Fetch popular tags — generate both tag search pages AND artist landing pages
  let tagRoutes: MetadataRoute.Sitemap = [];
  let artistRoutes: MetadataRoute.Sitemap = [];
  try {
    const response = await fetch(`${baseUrl}/api/tags?limit=1000&sort=count`, {
      next: { revalidate: 86400 },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.tags && Array.isArray(data.tags)) {
        tagRoutes = data.tags.map((tag: any) => ({
          url: `${baseUrl}/posts?tags=${encodeURIComponent(tag.name)}`,
          lastModified: new Date(),
          changeFrequency: "daily" as const,
          priority: 0.75,
        }));

        // Artist tags get their own landing pages
        artistRoutes = data.tags
          .filter((tag: any) => tag.type === 'artist')
          .map((tag: any) => ({
            url: `${baseUrl}/artist/${encodeURIComponent(tag.name.replace(/ /g, '_'))}`,
            lastModified: new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.8,
          }));
      }
    }
  } catch (error) {
    console.error("Failed to generate tag sitemap entries:", error);
  }

  return [...staticRoutes, ...artistRoutes, ...tagRoutes, ...imageRoutes];
}
