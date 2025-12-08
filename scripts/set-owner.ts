import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGO_URI!;
const DB_NAME = process.env.MONGO_DB!;
const OWNER_ID = '692ad0df032c62f79b57a08d';

async function setOwner() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');
    
    // Update user rank to owner
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(OWNER_ID) },
      { 
        $set: { 
          rank: 'owner',
          updatedAt: new Date(),
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      console.error(`User with ID ${OWNER_ID} not found`);
      return;
    }
    
    console.log(`Successfully set user ${OWNER_ID} to owner rank`);
    
    // Fetch and display user
    const user = await usersCollection.findOne({ _id: new ObjectId(OWNER_ID) });
    console.log('\nUser details:');
    console.log(JSON.stringify(user, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

setOwner();
