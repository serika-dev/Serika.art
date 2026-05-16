import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../lib/db';

async function fetchDanbooruUsernames(count: number): Promise<string[]> {
  const usernames = new Set<string>();
  let page = 1;
  while (usernames.size < count) {
    try {
      const res = await fetch(`https://danbooru.donmai.us/users.json?limit=1000&page=${page}`, {
        headers: { 'User-Agent': 'SerikaBot/1.0' }
      });
      if (!res.ok) break;
      const data = await res.json();
      if (data.length === 0) break;
      for (const user of data) {
        if (user.name) {
          usernames.add(user.name);
        }
      }
      page++;
    } catch (error) {
      console.error('Failed to fetch Danbooru users:', error);
      break;
    }
  }
  return Array.from(usernames).slice(0, count);
}

async function fetchNekosImages(count: number): Promise<string[]> {
  const urls: string[] = [];
  try {
    const batches = Math.ceil(count / 100);
    for (let i = 0; i < batches; i++) {
      const limit = Math.min(100, count - i * 100);
      const res = await fetch(`https://api.nekosapi.com/v4/images/random?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        urls.push(...data.map((img: any) => img.url));
      }
    }
  } catch (error) {
    console.error('Failed to fetch nekos api images:', error);
  }
  return urls;
}

async function main() {
  console.log('Connecting to database...');
  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');
  const imagesCollection = db.collection('images');
  const votesCollection = db.collection('votes');
  const favoritesCollection = db.collection('favorites');

  console.log('Cleaning up previously generated fake users...');
  // Delete any user with the specific bot email domain
  const deleteResult = await usersCollection.deleteMany({ email: { $regex: /@bot\.serika\.art$/ } });
  // Also delete users from the previous run with @example.com to clean up the crash
  const deleteCrashResult = await usersCollection.deleteMany({ email: { $regex: /@example\.com$/ } });
  console.log(`Deleted ${deleteResult.deletedCount + deleteCrashResult.deletedCount} previous fake users.`);

  const NUM_FAKE_USERS = 5000;
  
  console.log(`Fetching ${NUM_FAKE_USERS} usernames from Danbooru...`);
  const danbooruUsernames = await fetchDanbooruUsernames(NUM_FAKE_USERS);
  console.log(`Successfully fetched ${danbooruUsernames.length} usernames.`);
  
  const numAvatars = Math.floor(NUM_FAKE_USERS * 0.4);
  console.log(`Fetching ${numAvatars} profile pictures from NekosAPI...`);
  const avatarUrls = await fetchNekosImages(numAvatars);
  console.log(`Successfully fetched ${avatarUrls.length} avatars.`);
  
  // Generate fake users and insert them into the users collection
  let avatarIndex = 0;
  const fakeUsers = Array.from({ length: danbooruUsernames.length }, (_, i) => {
    const username = danbooruUsernames[i];
    let avatarUrl = undefined;
    if (Math.random() < 0.4 && avatarIndex < avatarUrls.length) {
      avatarUrl = avatarUrls[avatarIndex++];
    }

    return {
      _id: new ObjectId(),
      username: username,
      email: `${username.toLowerCase()}@bot.serika.art`,
      avatarUrl: avatarUrl,
      rank: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });
  
  console.log(`Inserting ${NUM_FAKE_USERS} fake users into the database in batches...`);
  for (let i = 0; i < fakeUsers.length; i += 1000) {
    const batch = fakeUsers.slice(i, i + 1000);
    if (batch.length > 0) {
      await usersCollection.insertMany(batch);
    }
  }

  const fakeUserIds = fakeUsers.map(u => u._id);
  console.log(`Generated and inserted ${NUM_FAKE_USERS} fake users.`);
  console.log('Fetching all images...');

  // Using projection to only fetch _id to save memory
  const images = await imagesCollection.find({}, { projection: { _id: 1 } }).toArray();
  console.log(`Found ${images.length} images.`);

  let totalViewsAdded = 0;
  let totalUpvotesAdded = 0;
  let totalDownvotesAdded = 0;
  let totalFavoritesAdded = 0;

  const votesToInsert: any[] = [];
  const favoritesToInsert: any[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    
    // Boost views (500 to 15,000)
    const viewsToAdd = Math.floor(Math.random() * (15000 - 500 + 1)) + 500;
    
    let newUpvotes = 0;
    let newDownvotes = 0;
    let newFavorites = 0;

    for (const userId of fakeUserIds) {
      const randVote = Math.random();
      const randFav = Math.random();
      
      // 15% chance upvote, 2% chance downvote
      if (randVote < 0.15) {
        votesToInsert.push({
          _id: new ObjectId(),
          userId,
          imageId: image._id,
          type: 'upvote',
          createdAt: new Date(),
        });
        newUpvotes++;
      } else if (randVote < 0.17) {
        votesToInsert.push({
          _id: new ObjectId(),
          userId,
          imageId: image._id,
          type: 'downvote',
          createdAt: new Date(),
        });
        newDownvotes++;
      }

      // 8% chance favorite
      if (randFav < 0.08) {
        favoritesToInsert.push({
          _id: new ObjectId(),
          userId,
          imageId: image._id,
          createdAt: new Date(),
        });
        newFavorites++;
      }
    }

    // Update image counts
    await imagesCollection.updateOne(
      { _id: image._id },
      { 
        $inc: { 
          views: viewsToAdd,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          favorites: newFavorites
        } 
      }
    );

    totalViewsAdded += viewsToAdd;
    totalUpvotesAdded += newUpvotes;
    totalDownvotesAdded += newDownvotes;
    totalFavoritesAdded += newFavorites;

    // To prevent memory crash on 5000 users * N images, insert periodically
    if (votesToInsert.length >= 10000) {
      await votesCollection.insertMany(votesToInsert);
      votesToInsert.length = 0; // Clear array to free memory
    }

    if (favoritesToInsert.length >= 10000) {
      await favoritesCollection.insertMany(favoritesToInsert);
      favoritesToInsert.length = 0;
    }

    if ((i + 1) % 100 === 0 || i === images.length - 1) {
      console.log(`Processed ${i + 1} / ${images.length} images...`);
    }
  }

  // Insert remaining votes and favorites
  const batchSize = 1000;
  console.log(`Inserting ${votesToInsert.length} votes...`);
  for (let i = 0; i < votesToInsert.length; i += batchSize) {
    const batch = votesToInsert.slice(i, i + batchSize);
    if (batch.length > 0) {
      await votesCollection.insertMany(batch);
    }
  }

  console.log(`Inserting ${favoritesToInsert.length} favorites...`);
  for (let i = 0; i < favoritesToInsert.length; i += batchSize) {
    const batch = favoritesToInsert.slice(i, i + batchSize);
    if (batch.length > 0) {
      await favoritesCollection.insertMany(batch);
    }
  }

  console.log('\n--- Done! ---');
  console.log(`Images processed: ${images.length}`);
  console.log(`Total views added: ${totalViewsAdded}`);
  console.log(`Total upvotes added: ${totalUpvotesAdded}`);
  console.log(`Total downvotes added: ${totalDownvotesAdded}`);
  console.log(`Total favorites added: ${totalFavoritesAdded}`);
  
  process.exit(0);
}

main().catch(console.error);
