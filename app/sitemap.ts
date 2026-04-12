import { MetadataRoute } from "next";
import { getCollection } from "@/lib/db";

const SITEMAP_SIZE = 45000; // Safely under 50k limit

export async function generateSitemaps() {
  try {
    const imagesCollection = await getCollection("images");
    const totalImages = await imagesCollection.countDocuments({ 
      deleted: { $ne: true }, 
      unlisted: { $ne: true } 
    });
    
    const totalChunks = Math.ceil(totalImages / SITEMAP_SIZE);
    
    // Return array of ids for each chunk [0, 1, 2, ...]
    return Array.from({ length: totalChunks }, (_, i) => ({ id: i }));
  } catch (error) {
    console.error("Error generating sitemap list:", error);
    return [{ id: 0 }];
  }
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://serika.art";
  const routes: MetadataRoute.Sitemap = [];

  // Index 0: Static routes, top tags, and first chunk of images
  if (id === 0) {
    routes.push(
      { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
      { url: `${baseUrl}/posts`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.95 },
      { url: `${baseUrl}/tags`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
      { url: `${baseUrl}/users`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
      { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
      { url: `${baseUrl}/dmca`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
      { url: `${baseUrl}/api-docs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 }
    );

    // Fetch popular tags for the first sitemap
    try {
      const tagsCollection = await getCollection("tags");
      const topTags = await tagsCollection
        .find({ count: { $gt: 10 } }, { projection: { name: 1, type: 1 } })
        .sort({ count: -1 })
        .limit(1000)
        .toArray();

      topTags.forEach(tag => {
        routes.push({
          url: `${baseUrl}/posts?tags=${encodeURIComponent(tag.name)}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.75,
        });
        
        if (tag.type === "artist") {
          routes.push({
            url: `${baseUrl}/artist/${encodeURIComponent(tag.name.replace(/ /g, "_"))}`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
          });
        }
      });
    } catch (e) {}
  }

  // Fetch images for this specific chunk
  try {
    const imagesCollection = await getCollection("images");
    const images = await imagesCollection
      .find(
        { deleted: { $ne: true }, unlisted: { $ne: true } },
        { projection: { sequentialId: 1, updatedAt: 1, createdAt: 1 } }
      )
      .sort({ sequentialId: -1 })
      .skip(id * SITEMAP_SIZE)
      .limit(SITEMAP_SIZE)
      .toArray();

    const imageRoutes = images
      .filter((img: any) => img.sequentialId)
      .map((image: any) => ({
        url: `${baseUrl}/image/${image.sequentialId}`,
        lastModified: new Date(image.updatedAt || image.createdAt || new Date()),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    
    routes.push(...imageRoutes);
  } catch (error) {
    console.error(`Failed to generate sitemap chunk ${id}:`, error);
  }

  return routes;
}
