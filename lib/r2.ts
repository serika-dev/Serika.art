import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';

const accountId = process.env.R2_ACCOUNT_ID!;
const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
const bucketName = process.env.R2_BUCKET_NAME!;
const customDomain = process.env.R2_CUSTOM_DOMAIN;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  throw new Error('R2 configuration is incomplete. Check your .env.local file.');
}

// Create custom HTTPS agent with better TLS configuration
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
});

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: false,
  requestHandler: new NodeHttpHandler({
    httpsAgent,
    connectionTimeout: 60000,
    requestTimeout: 60000,
  }),
});

export async function uploadToR2(
  file: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const key = `uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    });

    await r2Client.send(command);

    // Return the public URL
    if (customDomain) {
      return `https://${customDomain}/${key}`;
    }
    return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
  } catch (error: any) {
    console.error('R2 Upload Error Details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      name: error.name,
      stack: error.stack,
    });
    
    // Provide more helpful error messages
    if (error.code === 'EPROTO' || error.code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
      throw new Error('SSL/TLS connection error with R2. Please check your R2 credentials and network connection.');
    }
    
    throw new Error(`Failed to upload to R2: ${error.message}`);
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
}
