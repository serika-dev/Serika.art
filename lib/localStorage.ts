import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

async function ensureDir(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function uploadLocally(
  file: Buffer,
  filename: string,
  contentType: string,
  folder = 'uploads'
): Promise<string> {
  const targetDir = path.join(PUBLIC_DIR, folder);
  await ensureDir(targetDir);
  
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${Date.now()}-${sanitizedFilename}`;
  const filePath = path.join(targetDir, key);
  
  await fs.writeFile(filePath, file);
  
  return `/${folder}/${key}`;
}

export async function deleteLocal(url: string): Promise<void> {
  try {
    const cleanedUrl = url.replace(/^\//, '');
    const filePath = path.join(PUBLIC_DIR, cleanedUrl);
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error deleting local file:', error);
  }
}
