import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://serika.art";

  // Static routes
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
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tags`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Try to fetch images for dynamic routes
  let dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const response = await fetch(`${baseUrl}/api/images?limit=50000`, {
      next: { revalidate: 86400 },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.images && Array.isArray(data.images)) {
        dynamicRoutes = data.images.map((image: any) => ({
          url: `${baseUrl}/image/${image._id}`,
          lastModified: new Date(image.updatedAt || image.createdAt),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
      }
    }
  } catch (error) {
    console.error("Failed to generate dynamic sitemap entries:", error);
  }

  return [...staticRoutes, ...dynamicRoutes];
}
