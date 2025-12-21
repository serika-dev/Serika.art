import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all'; // 'likes', 'comments', or 'all'

    const usersCollection = await getCollection('users');
    const votesCollection = await getCollection('votes');
    const commentsCollection = await getCollection('comments');
    const imagesCollection = await getCollection('images');
    const tagsCollection = await getCollection('tags');

    // Try to find user by ID or username
    let user;
    if (ObjectId.isValid(id)) {
      user = await usersCollection.findOne({ _id: new ObjectId(id) });
    }
    if (!user) {
      user = await usersCollection.findOne({ 
        username: { $regex: new RegExp(`^${id}$`, 'i') } 
      });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = user._id;
    const result: any = { success: true };

    // Get liked posts (upvotes only, public)
    if (type === 'likes' || type === 'all') {
      const likes = await votesCollection
        .find({ userId, type: 'upvote' })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      const likedImageIds = likes.map(l => l.imageId);
      const likedImages = await imagesCollection
        .find({ _id: { $in: likedImageIds } })
        .toArray();

      // Populate tags
      const allTagIds = new Set<string>();
      likedImages.forEach(img => {
        if (Array.isArray(img.tags)) {
          img.tags.forEach((tagId: any) => allTagIds.add(tagId.toString()));
        }
      });

      let tagMap = new Map();
      if (allTagIds.size > 0) {
        const tagDocs = await tagsCollection
          .find({ _id: { $in: Array.from(allTagIds).map(tid => new ObjectId(tid)) } })
          .toArray();
        tagMap = new Map(tagDocs.map(t => [t._id.toString(), t]));
      }

      const populatedLikedImages = likedImages.map((img: any) => ({
        ...img,
        tags: (img.tags || []).map((tagId: any) => {
          const tag = tagMap.get(tagId.toString());
          return {
            _id: tagId,
            name: tag?.name || 'unknown',
            type: tag?.type || 'general',
            count: tag?.count || 0,
          };
        }),
      }));

      result.likes = populatedLikedImages;
    }

    // Get comments (public)
    if (type === 'comments' || type === 'all') {
      const comments = await commentsCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      // Get image info for each comment
      const commentImageIds = [...new Set(comments.map(c => c.imageId.toString()))];
      const commentImages = await imagesCollection
        .find({ _id: { $in: commentImageIds.map(id => new ObjectId(id)) } })
        .toArray();
      const imageMap = new Map(commentImages.map(img => [img._id.toString(), img]));

      result.comments = comments.map(c => {
        const image = imageMap.get(c.imageId.toString());
        return {
          _id: c._id.toString(),
          content: c.content,
          createdAt: c.createdAt,
          image: image ? {
            sequentialId: image.sequentialId,
            thumbnailUrl: image.thumbnailUrl || image.url,
          } : null,
        };
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching user activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user activity' },
      { status: 500 }
    );
  }
}
