import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || 'serika-art';

if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set');
  process.exit(1);
}

async function fixTagNamesAndImages() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(MONGO_DB);
    const tagsCollection = db.collection('tags');
    const imagesCollection = db.collection('images');

    // 1. Find all tags with underscores
    const tagsWithUnderscores = await tagsCollection.find({ name: /_/ }).toArray();
    console.log(`Found ${tagsWithUnderscores.length} tags with underscores`);

    // 2. For each tag with underscores, create/merge with normalized version
    for (const tag of tagsWithUnderscores) {
      const normalizedName = tag.name.replace(/_/g, ' ');

      if (normalizedName === tag.name) continue; // Skip if no change

      // Check if normalized tag already exists
      const existingTag = await tagsCollection.findOne({ name: normalizedName });

      if (existingTag) {
        // Merge counts
        const newCount = tag.count + existingTag.count;
        await tagsCollection.updateOne({ _id: existingTag._id }, { $set: { count: newCount } });
        console.log(`Merged tag "${tag.name}" into "${normalizedName}" (new count: ${newCount})`);

        // Update images to use normalized tag name
        await imagesCollection.updateMany(
          { 'tags.name': tag.name },
          { $set: { 'tags.$[elem].name': normalizedName } },
          { arrayFilters: [{ 'elem.name': tag.name }] }
        );

        // Delete old tag
        await tagsCollection.deleteOne({ _id: tag._id });
      } else {
        // Just rename the tag
        await tagsCollection.updateOne({ _id: tag._id }, { $set: { name: normalizedName } });
        console.log(`Renamed tag "${tag.name}" to "${normalizedName}"`);

        // Update images to use normalized tag name
        await imagesCollection.updateMany(
          { 'tags.name': tag.name },
          { $set: { 'tags.$[elem].name': normalizedName } },
          { arrayFilters: [{ 'elem.name': tag.name }] }
        );
      }
    }

    console.log('✓ Tag normalization complete');

    // 3. Verify all images use normalized tag names
    const imagesWithBadTags = await imagesCollection
      .find({ 'tags.name': /_/ })
      .toArray();

    if (imagesWithBadTags.length > 0) {
      console.log(`Fixing ${imagesWithBadTags.length} images with underscored tags...`);
      for (const image of imagesWithBadTags) {
        const normalizedTags = image.tags.map((t: any) => ({
          ...t,
          name: t.name.replace(/_/g, ' '),
        }));
        await imagesCollection.updateOne({ _id: image._id }, { $set: { tags: normalizedTags } });
      }
      console.log('✓ Images updated');
    } else {
      console.log('✓ All images already have normalized tags');
    }

    console.log('Database update complete!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

fixTagNamesAndImages();
