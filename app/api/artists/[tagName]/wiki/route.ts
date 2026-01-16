import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// GET wiki content for an artist
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const { tagName } = await params;
    // Next.js automatically decodes URL parameters, so tagName is already decoded
    const normalized = tagName.toLowerCase().trim();
    // Create variations with both spaces and underscores to match database storage
    const possibleNames = Array.from(new Set([
      normalized,
      normalized.replace(/ /g, '_'),
      normalized.replace(/_/g, ' '),
    ]));

    const tagsCollection = await getCollection('tags');
    const tag = await tagsCollection.findOne({ 
      name: { $in: possibleNames },
      type: 'artist'
    });

    if (!tag) {
      return NextResponse.json(
        { success: false, error: 'Artist not found' },
        { status: 404 }
      );
    }

    const wikiCollection = await getCollection('artistWikis');
    const wiki = await wikiCollection.findOne({ artistTagId: tag._id });

    return NextResponse.json({
      success: true,
      wiki: wiki ? {
        content: wiki.content,
        infobox: wiki.infobox,
        lastEditedBy: wiki.lastEditedByUsername,
        lastEditedAt: wiki.updatedAt,
        editCount: wiki.editHistory?.length || 0,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching wiki:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wiki' },
      { status: 500 }
    );
  }
}

// POST/Update wiki content
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to edit the wiki' },
        { status: 401 }
      );
    }

    const { tagName } = await params;
    // Next.js automatically decodes URL parameters, so tagName is already decoded
    const normalized = tagName.toLowerCase().trim();
    // Create variations with both spaces and underscores to match database storage
    const possibleNames = Array.from(new Set([
      normalized,
      normalized.replace(/ /g, '_'),
      normalized.replace(/_/g, ' '),
    ]));
    const primaryName = possibleNames[0];
    const body = await request.json();
    const { content, infobox } = body;

    if (typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    const tagsCollection = await getCollection('tags');
    const tag = await tagsCollection.findOne({ 
      name: { $in: possibleNames },
      type: 'artist'
    });

    if (!tag) {
      return NextResponse.json(
        { success: false, error: 'Artist not found' },
        { status: 404 }
      );
    }

    const wikiCollection = await getCollection('artistWikis');
    const existingWiki = await wikiCollection.findOne({ artistTagId: tag._id });

    if (existingWiki) {
      // Update existing wiki and save history
      await wikiCollection.updateOne(
        { _id: existingWiki._id },
        {
          $set: {
            content: content.trim(),
            infobox: infobox,
            lastEditedBy: new ObjectId(user.id),
            lastEditedByUsername: user.username,
            updatedAt: new Date(),
          },
          $push: {
            editHistory: {
              $each: [{
                userId: new ObjectId(user.id),
                username: user.username,
                content: existingWiki.content, // Save previous content
                editedAt: new Date(),
              }],
              $slice: -50, // Keep last 50 edits
            } as any,
          },
        }
      );
    } else {
      // Create new wiki
      await wikiCollection.insertOne({
        artistTagId: tag._id,
        artistTagName: primaryName,
        content: content.trim(),
        infobox: infobox,
        lastEditedBy: new ObjectId(user.id),
        lastEditedByUsername: user.username,
        editHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Wiki updated',
    });
  } catch (error) {
    console.error('Error updating wiki:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update wiki' },
      { status: 500 }
    );
  }
}
