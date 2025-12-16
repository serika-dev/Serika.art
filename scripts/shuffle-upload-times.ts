import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || '';
const MONGO_DB = process.env.MONGO_DB || 'serika-art';

if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  // --mode: "same-day" | "range" | "spread" | "full-random"
  mode: 'same-day',
  // --days: number of days to spread across (for "spread" and "range" modes)
  days: 30,
  // --start: start date (for "range" mode)
  start: '',
  // --end: end date (for "range" mode)
  end: '',
  // --dry-run: don't actually update, just show what would happen
  dryRun: false,
  // --help: show help
  help: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mode' && args[i + 1]) {
    flags.mode = args[++i];
  } else if (args[i] === '--days' && args[i + 1]) {
    flags.days = parseInt(args[++i]);
  } else if (args[i] === '--start' && args[i + 1]) {
    flags.start = args[++i];
  } else if (args[i] === '--end' && args[i + 1]) {
    flags.end = args[++i];
  } else if (args[i] === '--dry-run') {
    flags.dryRun = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    flags.help = true;
  }
}

if (flags.help) {
  console.log(`
Shuffle Upload Times Script
===========================

Usage: bun run scripts/shuffle-upload-times.ts [options]

Options:
  --mode <mode>       Shuffle mode (default: same-day)
                      - same-day: Randomize time within the same day
                      - range: Spread images across a date range
                      - spread: Spread images evenly over last N days
                      - full-random: Completely random dates within last N days
                      - week-shuffle: Shuffle within ±3 days of original date

  --days <number>     Number of days for spread/full-random modes (default: 30)

  --start <date>      Start date for range mode (YYYY-MM-DD)
  --end <date>        End date for range mode (YYYY-MM-DD, defaults to today)

  --dry-run           Preview changes without applying them

  --help, -h          Show this help message

Examples:
  bun run scripts/shuffle-upload-times.ts --mode same-day
  bun run scripts/shuffle-upload-times.ts --mode spread --days 60
  bun run scripts/shuffle-upload-times.ts --mode range --start 2024-01-01 --end 2024-12-31
  bun run scripts/shuffle-upload-times.ts --mode full-random --days 90 --dry-run
  bun run scripts/shuffle-upload-times.ts --mode week-shuffle
`);
  process.exit(0);
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate random time on a specific day
function randomTimeOnDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const secondsInDay = 24 * 60 * 60;
  const randomSeconds = Math.floor(Math.random() * secondsInDay);
  const randomized = new Date(day.getTime() + randomSeconds * 1000);

  // Ensure we never set a future time
  const now = new Date();
  if (randomized.getTime() > now.getTime()) {
    return new Date(now.getTime() - Math.floor(Math.random() * 60 * 60 * 1000));
  }

  return randomized;
}

// Generate random date within a range
function randomDateInRange(start: Date, end: Date): Date {
  const startTime = start.getTime();
  const endTime = Math.min(end.getTime(), Date.now());
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
}

// Generate date offset by random days
function randomOffsetDate(original: Date, maxDays: number): Date {
  const offsetMs = (Math.random() * 2 - 1) * maxDays * 24 * 60 * 60 * 1000;
  const newDate = new Date(original.getTime() + offsetMs);
  
  // Clamp to not be in the future
  const now = new Date();
  if (newDate.getTime() > now.getTime()) {
    return new Date(now.getTime() - Math.floor(Math.random() * 60 * 60 * 1000));
  }
  
  return newDate;
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB);
    const images = db.collection('images');

    console.log(`\n🎲 Shuffle Mode: ${flags.mode}`);
    if (flags.dryRun) {
      console.log('🔍 DRY RUN - No changes will be made\n');
    }

    console.log('Fetching images...');
    const docs = await images.find({}, { projection: { _id: 1, createdAt: 1 } }).toArray();
    console.log(`Found ${docs.length} images\n`);

    if (docs.length === 0) {
      console.log('No images to shuffle');
      return;
    }

    const bulkOps: any[] = [];
    const now = new Date();

    // Calculate date range for various modes
    const endDate = flags.end ? new Date(flags.end) : now;
    const startDate = flags.start 
      ? new Date(flags.start) 
      : new Date(now.getTime() - flags.days * 24 * 60 * 60 * 1000);

    switch (flags.mode) {
      case 'same-day': {
        // Randomize time within the same day (original behavior)
        console.log('Mode: Keeping same dates, randomizing times...\n');
        for (const doc of docs) {
          const original = doc.createdAt ? new Date(doc.createdAt) : now;
          const newDate = randomTimeOnDay(original);
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id as ObjectId },
              update: { $set: { createdAt: newDate, updatedAt: newDate } },
            },
          });
        }
        break;
      }

      case 'range': {
        // Spread images evenly across a date range
        console.log(`Mode: Spreading images from ${startDate.toDateString()} to ${endDate.toDateString()}\n`);
        const shuffledDocs = shuffle(docs);
        const totalMs = endDate.getTime() - startDate.getTime();
        const interval = totalMs / shuffledDocs.length;

        for (let i = 0; i < shuffledDocs.length; i++) {
          const doc = shuffledDocs[i];
          // Add some jitter (±10% of interval)
          const jitter = (Math.random() - 0.5) * 0.2 * interval;
          const newTime = startDate.getTime() + i * interval + jitter;
          const newDate = new Date(Math.min(newTime, now.getTime() - 60000));
          
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id as ObjectId },
              update: { $set: { createdAt: newDate, updatedAt: newDate } },
            },
          });
        }
        break;
      }

      case 'spread': {
        // Spread images evenly over the last N days
        console.log(`Mode: Spreading images evenly over last ${flags.days} days\n`);
        const shuffledDocs = shuffle(docs);
        const spreadStart = new Date(now.getTime() - flags.days * 24 * 60 * 60 * 1000);
        const totalMs = now.getTime() - spreadStart.getTime();
        const interval = totalMs / shuffledDocs.length;

        for (let i = 0; i < shuffledDocs.length; i++) {
          const doc = shuffledDocs[i];
          const jitter = (Math.random() - 0.5) * 0.2 * interval;
          const newTime = spreadStart.getTime() + i * interval + jitter;
          const newDate = new Date(Math.min(newTime, now.getTime() - 60000));
          
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id as ObjectId },
              update: { $set: { createdAt: newDate, updatedAt: newDate } },
            },
          });
        }
        break;
      }

      case 'full-random': {
        // Completely random dates within the last N days
        console.log(`Mode: Fully randomizing dates over last ${flags.days} days\n`);
        const randomStart = new Date(now.getTime() - flags.days * 24 * 60 * 60 * 1000);
        
        for (const doc of docs) {
          const newDate = randomDateInRange(randomStart, now);
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id as ObjectId },
              update: { $set: { createdAt: newDate, updatedAt: newDate } },
            },
          });
        }
        break;
      }

      case 'week-shuffle': {
        // Shuffle within ±3 days of original date
        console.log('Mode: Shuffling within ±3 days of original dates\n');
        for (const doc of docs) {
          const original = doc.createdAt ? new Date(doc.createdAt) : now;
          const newDate = randomOffsetDate(original, 3);
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id as ObjectId },
              update: { $set: { createdAt: newDate, updatedAt: newDate } },
            },
          });
        }
        break;
      }

      default: {
        console.error(`Unknown mode: ${flags.mode}`);
        console.log('Use --help to see available modes');
        process.exit(1);
      }
    }

    // Preview some changes in dry-run mode
    if (flags.dryRun) {
      console.log('Preview of first 10 changes:');
      for (let i = 0; i < Math.min(10, bulkOps.length); i++) {
        const op = bulkOps[i];
        const originalDoc = docs.find(d => d._id.toString() === op.updateOne.filter._id.toString());
        const originalDate = originalDoc?.createdAt ? new Date(originalDoc.createdAt) : 'unknown';
        const newDate = op.updateOne.update.$set.createdAt;
        console.log(`  ${i + 1}. ${originalDate} → ${newDate}`);
      }
      console.log('\n✅ Dry run complete. No changes made.');
      return;
    }

    // Execute bulk operations in batches
    let processed = 0;
    const batchSize = 500;
    
    for (let i = 0; i < bulkOps.length; i += batchSize) {
      const batch = bulkOps.slice(i, i + batchSize);
      await images.bulkWrite(batch);
      processed += batch.length;
      const progress = Math.round((processed / bulkOps.length) * 100);
      console.log(`Progress: ${processed}/${bulkOps.length} images (${progress}%)`);
    }

    console.log(`\n✅ Done! Shuffled ${docs.length} images using "${flags.mode}" mode.`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
