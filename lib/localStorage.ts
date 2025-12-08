import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function uploadLocally(
  file: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  await ensureUploadDir();
  
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${Date.now()}-${sanitizedFilename}`;
  const filePath = path.join(UPLOAD_DIR, key);
  
  await fs.writeFile(filePath, file);
  
  return `/uploads/${key}`;
}

export async function deleteLocal(url: string): Promise<void> {
  try {
    const filename = url.replace('/uploads/', '');
    const filePath = path.join(UPLOAD_DIR, filename);
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error deleting local file:', error);
  }
}
