import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/r2';
import { uploadLocally } from '@/lib/localStorage';
import { getCurrentUser } from '@/lib/auth';
import sharp from 'sharp';

const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

// Dedicated endpoint for profile images (avatar/banner)
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
    const type = formData.get('type') as 'avatar' | 'banner';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!['avatar', 'banner'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "avatar" or "banner"' },
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

    // Size limits: 5MB for avatar, 10MB for banner
    const maxSize = type === 'avatar' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File too large. Max ${type === 'avatar' ? '5MB' : '10MB'}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${type}_${user.id}_${Date.now()}.webp`;

    // Process image with sharp
    let processedBuffer: Buffer;
    
    if (type === 'avatar') {
      // Avatar: resize to 256x256, crop to square
      processedBuffer = await sharp(buffer)
        .resize(256, 256, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toBuffer();
    } else {
      // Banner: resize to max 1920 width, maintain aspect ratio
      processedBuffer = await sharp(buffer)
        .resize(1920, 480, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toBuffer();
    }

    // Upload to storage
    let url: string;
    const folder = 'profiles';

    if (USE_LOCAL_STORAGE) {
      url = await uploadLocally(processedBuffer, filename, 'image/webp', folder);
    } else {
      url = await uploadToR2(processedBuffer, filename, 'image/webp', folder);
    }

    return NextResponse.json({
      success: true,
      url,
    });

  } catch (error) {
    console.error('Profile upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}
