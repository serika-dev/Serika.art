import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';

// Backblaze B2 configuration
const keyId = process.env.B2_KEY_ID!;
const applicationKey = process.env.B2_APPLICATION_KEY!;
const bucketName = process.env.B2_BUCKET_NAME!;
const endpoint = process.env.B2_ENDPOINT!;
const customDomain = process.env.B2_CUSTOM_DOMAIN;

if (!keyId || !applicationKey || !bucketName || !endpoint) {
  throw new Error('Backblaze B2 configuration is incomplete. Check your .env.local file.');
}

// Create custom HTTPS agent with better TLS configuration
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
});

// Extract region from endpoint (e.g., "s3.eu-central-003.backblazeb2.com" -> "eu-central-003")
const region = endpoint.replace('s3.', '').replace('.backblazeb2.com', '');

export const b2Client = new S3Client({
  region: region,
  endpoint: `https://${endpoint}`,
  credentials: {
    accessKeyId: keyId,
    secretAccessKey: applicationKey,
  },
  forcePathStyle: false,
  requestHandler: new NodeHttpHandler({
    httpsAgent,
    connectionTimeout: 60000,
    requestTimeout: 60000,
  }),
});

export async function uploadToB2(
  file: Buffer,
  filename: string,
  contentType: string,
  folder = 'uploads'
): Promise<string> {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${folder}/${Date.now()}-${sanitizedFilename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    });

    await b2Client.send(command);

    // Return the public URL
    if (customDomain) {
      return `https://${customDomain}/${key}`;
    }
    // Backblaze B2 public URL format
    return `https://${bucketName}.${endpoint}/${key}`;
  } catch (error: any) {
    console.error('B2 Upload Error Details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      name: error.name,
      stack: error.stack,
    });
    
    // Provide more helpful error messages
    if (error.code === 'EPROTO' || error.code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
      throw new Error('SSL/TLS connection error with B2. Please check your B2 credentials and network connection.');
    }
    
    throw new Error(`Failed to upload to B2: ${error.message}`);
  }
}

export async function deleteFromB2(key: string): Promise<void> {
  await b2Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
}

// Backward-compatible aliases for gradual migration
export const uploadToR2 = uploadToB2;
export const deleteFromR2 = deleteFromB2;
