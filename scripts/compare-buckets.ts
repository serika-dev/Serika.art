import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) process.env[key] = valueParts.join('=');
  }
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const b2Region = process.env.B2_ENDPOINT!.replace('s3.', '').replace('.backblazeb2.com', '');
const b2Client = new S3Client({
  region: b2Region,
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
});

async function scanBucket(client: S3Client, bucketName: string, name: string, limit = 100000) {
  const prefixes = new Map<string, { count: number; examples: string[]; totalSize: number }>();
  let continuationToken: string | undefined;
  let total = 0;
  
  console.log(`\nScanning ${name} bucket (${bucketName})...`);
  
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    
    for (const obj of response.Contents || []) {
      total++;
      const key = obj.Key || '';
      const prefix = key.split('/')[0];
      if (!prefixes.has(prefix)) {
        prefixes.set(prefix, { count: 0, examples: [], totalSize: 0 });
      }
      const data = prefixes.get(prefix)!;
      data.count++;
      data.totalSize += obj.Size || 0;
      if (data.examples.length < 3) {
        data.examples.push(key);
      }
    }
    
    continuationToken = response.NextContinuationToken;
    process.stdout.write(`\rScanned ${total.toLocaleString()} objects...`);
  } while (continuationToken && total < limit);
  
  console.log(`\n\n=== ${name} BUCKET PREFIXES ===`);
  console.log(`Total objects scanned: ${total.toLocaleString()}`);
  if (total >= limit) {
    console.log(`(limited to first ${limit.toLocaleString()} objects)`);
  }
  console.log('');
  
  const sortedPrefixes = [...prefixes.entries()].sort((a, b) => b[1].count - a[1].count);
  
  for (const [prefix, data] of sortedPrefixes) {
    const sizeMB = (data.totalSize / 1024 / 1024).toFixed(2);
    console.log(`${prefix}/ : ${data.count.toLocaleString()} files (${sizeMB} MB)`);
    data.examples.forEach(ex => console.log(`    ${ex}`));
  }
  
  return { prefixes: sortedPrefixes, total };
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '100000');
  
  // Scan R2
  const r2Result = await scanBucket(r2Client, process.env.R2_BUCKET_NAME!, 'R2', limit);
  
  // Scan B2
  const b2Result = await scanBucket(b2Client, process.env.B2_BUCKET_NAME!, 'B2', limit);
  
  // Compare
  console.log('\n\n=== COMPARISON ===');
  console.log(`R2 total (scanned): ${r2Result.total.toLocaleString()}`);
  console.log(`B2 total (scanned): ${b2Result.total.toLocaleString()}`);
  
  const r2Prefixes = new Set(r2Result.prefixes.map(p => p[0]));
  const b2Prefixes = new Set(b2Result.prefixes.map(p => p[0]));
  
  const onlyInR2 = [...r2Prefixes].filter(p => !b2Prefixes.has(p));
  const onlyInB2 = [...b2Prefixes].filter(p => !r2Prefixes.has(p));
  
  if (onlyInR2.length > 0) {
    console.log('\nPrefixes only in R2 (not migrated to B2):');
    onlyInR2.forEach(p => {
      const data = r2Result.prefixes.find(x => x[0] === p)?.[1];
      console.log(`  - ${p}/ : ${data?.count.toLocaleString()} files`);
    });
  }
  
  if (onlyInB2.length > 0) {
    console.log('\nPrefixes only in B2:');
    onlyInB2.forEach(p => {
      const data = b2Result.prefixes.find(x => x[0] === p)?.[1];
      console.log(`  - ${p}/ : ${data?.count.toLocaleString()} files`);
    });
  }
}

main().catch(console.error);
