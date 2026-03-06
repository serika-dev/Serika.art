import { NextRequest, NextResponse } from 'next/server';
import { uploadToB2 } from '@/lib/b2';
import { uploadLocally } from '@/lib/localStorage';
import { getCurrentUser } from '@/lib/auth';
import sharp from 'sharp';

const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

// Dedicated endpoint for wiki images
// This uploads to storage but does NOT create a post
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
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

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File too large. Max 10MB' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `wiki_${user.id}_${Date.now()}.webp`;

    // Process image with sharp
    // For wiki images, we just want to optimize them but keep reasonable size
    const processedBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // Upload to storage
    let url: string;
    const folder = 'wiki';

    if (USE_LOCAL_STORAGE) {
      url = await uploadLocally(processedBuffer, filename, 'image/webp', folder);
    } else {
      url = await uploadToB2(processedBuffer, filename, 'image/webp', folder);
    }

    return NextResponse.json({
      success: true,
      url,
    });

  } catch (error) {
    console.error('Wiki upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}
