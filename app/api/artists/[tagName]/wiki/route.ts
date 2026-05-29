import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const { tagName } = await params;
    const normalized = tagName.toLowerCase().trim();
    const possibleNames = Array.from(new Set([
      normalized, normalized.replace(/ /g, '_'), normalized.replace(/_/g, ' '),
    ]));

    const tagResult = await query(
      `SELECT id FROM tags WHERE name = ANY($1) AND type = 'artist'`,
      [possibleNames]
    );

    if (tagResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Artist not found' }, { status: 404 });
    }

    const wikiResult = await query(
      `SELECT * FROM artist_wikis WHERE artist_tag_id = $1`,
      [tagResult.rows[0].id]
    );

    const wiki = wikiResult.rows[0] || null;

    return NextResponse.json({
      success: true,
      wiki: wiki ? {
        content: wiki.content,
        infobox: wiki.infobox,
        lastEditedBy: wiki.last_edited_by_username,
        lastEditedAt: wiki.updated_at,
        editCount: Array.isArray(wiki.edit_history) ? wiki.edit_history.length : 0,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching wiki:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch wiki' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
    }

    const { tagName } = await params;
    const normalized = tagName.toLowerCase().trim();
    const possibleNames = Array.from(new Set([
      normalized, normalized.replace(/ /g, '_'), normalized.replace(/_/g, ' '),
    ]));
    const body = await request.json();
    const { content, infobox } = body;

    if (typeof content !== 'string') {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    const tagResult = await query(
      `SELECT id, name FROM tags WHERE name = ANY($1) AND type = 'artist'`,
      [possibleNames]
    );

    if (tagResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Artist not found' }, { status: 404 });
    }

    const tag = tagResult.rows[0];
    const existingWiki = await query(
      `SELECT * FROM artist_wikis WHERE artist_tag_id = $1`,
      [tag.id]
    );

    if (existingWiki.rows.length > 0) {
      const wiki = existingWiki.rows[0];
      const editHistory = Array.isArray(wiki.edit_history) ? wiki.edit_history : [];
      editHistory.push({
        userId: user.id,
        username: user.username,
        content: wiki.content,
        editedAt: new Date().toISOString(),
      });
      // Keep last 50
      const trimmedHistory = editHistory.slice(-50);

      await query(
        `UPDATE artist_wikis SET content = $1, infobox = $2, last_edited_by = $3,
         last_edited_by_username = $4, edit_history = $5, updated_at = NOW()
         WHERE id = $6`,
        [content.trim(), infobox ? JSON.stringify(infobox) : null, user.id, user.username,
         JSON.stringify(trimmedHistory), wiki.id]
      );
    } else {
      await query(
        `INSERT INTO artist_wikis (artist_tag_id, artist_tag_name, content, infobox,
         last_edited_by, last_edited_by_username, edit_history, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, '[]', NOW(), NOW())`,
        [tag.id, tag.name, content.trim(), infobox ? JSON.stringify(infobox) : null,
         user.id, user.username]
      );
    }

    return NextResponse.json({ success: true, message: 'Wiki updated' });
  } catch (error) {
    console.error('Error updating wiki:', error);
    return NextResponse.json({ success: false, error: 'Failed to update wiki' }, { status: 500 });
  }
}
