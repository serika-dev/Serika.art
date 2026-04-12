import { MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local manually
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join('=');
        }
      }
    }
  }
}

loadEnvFile();

const MONGO_URI = process.env.MONGO_URI!;
const MONGO_DB = process.env.MONGO_DB!;

if (!MONGO_URI || !MONGO_DB) {
  console.error('❌ MongoDB configuration is incomplete. Check your .env.local file.');
  process.exit(1);
}

function convertDanbooruToMarkdown(text: string): string {
  if (!text) return '';
  
  return text
    // [[tag_name|display_text]] -> [display_text](/posts?tags=tag_name)
    .replace(/\[\[([^|\]\n]+)\|([^\]\n]+)\]\]/g, '[$2](/posts?tags=$1)')
    // [[tag_name]] -> [tag_name](/posts?tags=tag_name)
    .replace(/\[\[([^\]\n]+)\]\]/g, '[$1](/posts?tags=$1)')
    // [https://url] -> [https://url](https://url)
    .replace(/\[(https?:\/\/[^\]\r\n]+)\]/g, '[$1]($1)')
    // "text":https://url -> [text](https://url)
    .replace(/"([^"]+)":(https?:\/\/[^\s\r\n]+)/g, '[$1]($2)')
    // h1. h2. etc. (Danbooru headers)
    .replace(/^h([1-6])\.\s+(.*)$/gm, (match, level, title) => {
        return '#'.repeat(parseInt(level)) + ' ' + title;
    })
    // bullet points
    .replace(/^\*\s+/gm, '- ');
}

async function main() {
  console.log('🚀 Starting Artist Wiki Seeder from Danbooru');
  
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db(MONGO_DB);
  
  const tagsCollection = db.collection('tags');
  const artistsCollection = db.collection('artists');
  const wikisCollection = db.collection('artistWikis');
  const usersCollection = db.collection('users');

  // Find a system/admin user to attribute edits to
  let adminUser = await usersCollection.findOne({ rank: { $in: ['owner', 'admin', 'moderator'] } });
  if (!adminUser) {
    console.log('⚠️ No admin user found, using fallback system ID');
    adminUser = { _id: new ObjectId('000000000000000000000001'), username: 'System' } as any;
  }

  // Get all artist tags sorted by count to prioritize popular artists
  const artistTags = await tagsCollection.find({ type: 'artist' }).sort({ count: -1 }).toArray();
  console.log(`📊 Found ${artistTags.length} artist tags to process.`);

  const CONCURRENCY = 4; // Keep it low to stay safe with Danbooru's rate limits
  let processedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  async function processArtist(tag: any) {
    const tagName = tag.name;
    const normalizedTagName = tagName.toLowerCase().replace(/ /g, '_');
    
    // Check if wiki already exists to skip
    const existing = await wikisCollection.findOne({ artistTagId: tag._id });
    if (existing && !process.argv.includes('--force')) {
      return;
    }

    try {
      // 1. Fetch Wiki Data
      const wikiRes = await axios.get(`https://danbooru.donmai.us/wiki_pages.json`, {
        params: { 'search[title]': normalizedTagName },
        headers: { 'User-Agent': 'Serika-Art-Seeder/1.0 (contact: admin@serika.art)' },
        timeout: 10000,
        validateStatus: (status) => status < 500 // Don't throw on 404/403
      });

      if (wikiRes.status === 429) {
          console.error(`  ⚠️ Rate Limited! Waiting...`);
          await new Promise(r => setTimeout(r, 10000));
          return;
      }

      const wikiPage = wikiRes.data && Array.isArray(wikiRes.data) 
        ? wikiRes.data.find((p: any) => p.title.toLowerCase() === normalizedTagName)
        : null;

      if (wikiPage && wikiPage.body) {
        // Convert Danbooru format to Markdown
        const markdownContent = convertDanbooruToMarkdown(wikiPage.body);

        // Update ArtistWiki
        const wikiData = {
          artistTagId: tag._id,
          artistTagName: tagName,
          content: markdownContent,
          lastEditedBy: adminUser?._id,
          lastEditedByUsername: adminUser?.username,
          editHistory: [{
            userId: adminUser?._id,
            username: adminUser?.username,
            content: markdownContent,
            editedAt: new Date()
          }],
          updatedAt: new Date()
        };

        await wikisCollection.updateOne(
          { artistTagId: tag._id },
          { $set: wikiData, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );

        // Update/Create Artist info if missing bio
        // Clean markdown for bio
        const cleanBio = markdownContent.split('\n')[0].replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
        
        await artistsCollection.updateOne(
          { tagId: tag._id },
          { 
            $set: { 
              tagName: tagName, 
              updatedAt: new Date() 
            },
            $setOnInsert: { 
              tagId: tag._id,
              bio: cleanBio,
              verified: false,
              socials: {},
              createdAt: new Date()
            }
          },
          { upsert: true }
        );

        updatedCount++;
        process.stdout.write(`\r✅ [${updatedCount}] Seeded: ${tagName.padEnd(25)}`);
      } else {
        skippedCount++;
      }

      // 2. Fetch Artist Socials/Links
      const artistRes = await axios.get(`https://danbooru.donmai.us/artists.json`, {
        params: { 'search[any_name_matches]': tagName },
        headers: { 'User-Agent': 'Serika-Art-Seeder/1.0' },
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      const danbooruArtist = artistRes.data && Array.isArray(artistRes.data)
        ? artistRes.data.find((a: any) => a.name.toLowerCase() === tagName.toLowerCase())
        : null;

      if (danbooruArtist && danbooruArtist.urls && danbooruArtist.urls.length > 0) {
        const urls = danbooruArtist.urls.map((u: any) => u.url);
        const socials: any = {};
        
        urls.forEach((url: string) => {
          if (url.includes('pixiv.net')) socials.pixiv = url;
          else if (url.includes('twitter.com') || url.includes('x.com')) socials.twitter = url;
          else if (url.includes('artstation.com')) socials.artstation = url;
          else if (url.includes('deviantart.com')) socials.deviantart = url;
          else if (url.includes('patreon.com')) socials.patreon = url;
          else if (url.includes('youtube.com')) socials.youtube = url;
          else if (url.includes('linktr.ee')) socials.linktree = url;
        });

        if (Object.keys(socials).length > 0) {
            await artistsCollection.updateOne(
                { tagId: tag._id },
                { $set: { socials: socials, updatedAt: new Date() } }
            );
        }
      }

    } catch (error: any) {
      errorCount++;
    }

    processedCount++;
    // Regular rate limit wait
    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  // Worker pool logic
  const workers = Array(CONCURRENCY).fill(null).map(async () => {
    while (artistTags.length > 0) {
        const tag = artistTags.shift();
        if (!tag) break;
        await processArtist(tag);
    }
  });

  await Promise.all(workers);

  console.log('\n--- Final Summary ---');
  console.log(`Total Tags: ${artistTags.length}`);
  console.log(`Updated:    ${updatedCount}`);
  console.log(`Skipped:    ${skippedCount}`);
  console.log(`Processed:  ${processedCount}`);
  
  await client.close();
  console.log('\n✅ Task finished.');
}

main().catch(console.error);
