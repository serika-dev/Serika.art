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

/** B2 refused or could not be reached; the file was not stored. */
export class B2UploadError extends Error {
  readonly code = 'STORAGE_REFUSED';
}

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
      throw new B2UploadError('SSL/TLS connection error with B2. Please check your B2 credentials and network connection.');
    }
    
    throw new B2UploadError(`Failed to upload to B2: ${error.message}`);
  }
}

/** Bucket key for a URL returned by uploadToB2. */
export function b2KeyFromUrl(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

/**
 * Uploads several files; if B2 refuses any of them, removes the ones that did
 * go up and throws, so a post is never created with a missing file.
 */
export async function uploadAllToB2(
  files: { file: Buffer; filename: string; contentType: string; folder?: string }[]
): Promise<string[]> {
  const results = await Promise.allSettled(
    files.map((f) => uploadToB2(f.file, f.filename, f.contentType, f.folder))
  );
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (!failed) return results.map((r) => (r as PromiseFulfilledResult<string>).value);

  await Promise.all(
    results.map((r) =>
      r.status === 'fulfilled'
        ? deleteFromB2(b2KeyFromUrl(r.value)).catch((err) =>
            console.error('B2 cleanup after failed upload:', r.value, err?.message || err)
          )
        : null
    )
  );
  throw failed.reason;
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
