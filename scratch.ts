import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://root:****@85.215.191.94:37282/?directConnection=true";
  const client = await MongoClient.connect(uri);
  const db = client.db('serika-art');
  const tag = await db.collection('tags').findOne({});
  console.log('Mongo tag:', JSON.stringify(tag, null, 2));
  await client.close();
}
main();
