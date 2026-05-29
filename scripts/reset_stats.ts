import { connectToDatabase } from '../lib/db';

async function main() {
  console.log('Connecting to database...');
  const { db } = await connectToDatabase();
  const imagesCollection = db.collection('images');
  const usersCollection = db.collection('users');
  const votesCollection = db.collection('votes');
  const favoritesCollection = db.collection('favorites');

  console.log('Resetting all image stats to 0...');
  const updateRes = await imagesCollection.updateMany(
    {},
    { $set: { views: 0, upvotes: 0, downvotes: 0, favorites: 0 } }
  );
  console.log(`Reset stats on ${updateRes.modifiedCount} images.`);

  console.log('Finding bot users to clean up...');
  const botUsers = await usersCollection.find({ email: { $regex: /@bot\.serika\.art$/ } }).toArray();
  const botUserIds = botUsers.map(u => u._id);

  if (botUserIds.length > 0) {
    console.log(`Found ${botUserIds.length} bot users. Deleting their votes and favorites...`);
    const deletedVotes = await votesCollection.deleteMany({ userId: { $in: botUserIds } });
    console.log(`Deleted ${deletedVotes.deletedCount} bot votes.`);

    const deletedFavs = await favoritesCollection.deleteMany({ userId: { $in: botUserIds } });
    console.log(`Deleted ${deletedFavs.deletedCount} bot favorites.`);

    console.log('Re-assigning their images back to Anonymous...');
    const reassignRes = await imagesCollection.updateMany(
      { userId: { $in: botUserIds } },
      { $set: { username: 'Anonymous' } }, // Note: userId isn't changing back to an anon ID unless anon has a specific ID. Just setting username to Anonymous.
    );
    console.log(`Reverted ${reassignRes.modifiedCount} images back to Anonymous.`);

    console.log('Deleting bot users...');
    const deletedUsers = await usersCollection.deleteMany({ _id: { $in: botUserIds } });
    console.log(`Deleted ${deletedUsers.deletedCount} bot users.`);
  }

  console.log('\n--- Reset Complete! ---');
  process.exit(0);
}

main().catch(console.error);
