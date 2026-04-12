import { MetadataRoute } from "next";
import { getCollection } from "@/lib/db";

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

  // Query ALL images directly from the database (no limit)
  let imageRoutes: MetadataRoute.Sitemap = [];
  try {
    const imagesCollection = await getCollection("images");
    const images = await imagesCollection
      .find(
        { deleted: { $ne: true }, unlisted: { $ne: true } },
        { projection: { sequentialId: 1, updatedAt: 1, createdAt: 1 } }
      )
      .sort({ sequentialId: -1 })
      .toArray();

    imageRoutes = images
      .filter((img: any) => img.sequentialId)
      .map((image: any) => ({
        url: `${baseUrl}/image/${image.sequentialId}`,
        lastModified: new Date(image.updatedAt || image.createdAt || new Date()),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch (error) {
    console.error("Failed to generate image sitemap entries:", error);
  }

  // Query ALL tags directly from the database (no limit)
  let tagRoutes: MetadataRoute.Sitemap = [];
  let artistRoutes: MetadataRoute.Sitemap = [];
  try {
    const tagsCollection = await getCollection("tags");
    const tags = await tagsCollection
      .find({}, { projection: { name: 1, type: 1 } })
      .toArray();

    tagRoutes = tags.map((tag: any) => ({
      url: `${baseUrl}/posts?tags=${encodeURIComponent(tag.name)}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.75,
    }));

    // Artist tags get their own landing pages
    artistRoutes = tags
      .filter((tag: any) => tag.type === "artist")
      .map((tag: any) => ({
        url: `${baseUrl}/artist/${encodeURIComponent(tag.name.replace(/ /g, "_"))}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch (error) {
    console.error("Failed to generate tag sitemap entries:", error);
  }

  return [...staticRoutes, ...artistRoutes, ...tagRoutes, ...imageRoutes];
}
