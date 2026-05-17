import { connectToDatabase } from './lib/db';
async function main() {
  const { db } = await connectToDatabase();
  const images = db.collection('images');
  console.log('Building missing indexes...');
  await Promise.all([
    db.collection('users').createIndex({ username: 1 }, { background: true, unique: true }).catch(console.error),
    images.createIndex({ userId: 1, createdAt: -1 }, { background: true }).catch(console.error),
    images.createIndex({ username: 1, createdAt: -1 }, { background: true }).catch(console.error),
    db.collection('votes').createIndex({ userId: 1, createdAt: -1 }, { background: true }).catch(console.error),
    db.collection('favorites').createIndex({ userId: 1, createdAt: -1 }, { background: true }).catch(console.error),
    db.collection('comments').createIndex({ userId: 1, createdAt: -1 }, { background: true }).catch(console.error),
    db.collection('comments').createIndex({ imageId: 1, createdAt: -1 }, { background: true }).catch(console.error),
  ]);
  console.log('Indexes requested!');
  process.exit(0);
}
main();
