import { NextRequest, NextResponse } from 'next/server';
import { uploadToB2 } from '@/lib/b2';
import { uploadLocally } from '@/lib/localStorage';
import { getCurrentUser } from '@/lib/auth';

const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

// Upload a PSD/project file for artist claim verification
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to upload files' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file extension
    const allowedExtensions = ['.psd', '.sai', '.clip', '.kra', '.xcf', '.ai', '.sketch'];
    const filename = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => filename.endsWith(ext));

    if (!hasValidExtension) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: PSD, SAI, CLIP, KRA, XCF, AI, SKETCH' },
        { status: 400 }
      );
    }

    // Max file size: 500MB for project files
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 500MB' },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Get content type
    const contentType = file.type || 'application/octet-stream';

    // Generate unique filename
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const finalFilename = `${user.id}_${timestamp}_${safeFilename}`;

    let fileUrl: string;

    if (USE_LOCAL_STORAGE) {
      fileUrl = await uploadLocally(buffer, finalFilename, contentType, 'claim-files');
    } else {
      fileUrl = await uploadToB2(buffer, finalFilename, contentType, 'claim-files');
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: file.name,
      size: file.size,
    });
  } catch (error: any) {
    console.error('Error uploading claim file:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}
