import { NextRequest, NextResponse } from 'next/server';
import { getRelatedTracks } from '@/lib/youtube';
import { Track } from '@/lib/types';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const title = req.nextUrl.searchParams.get('title');
  const artist = req.nextUrl.searchParams.get('artist');
  const thumbnail = req.nextUrl.searchParams.get('thumbnail') ?? '';
  const excludeParam = req.nextUrl.searchParams.get('exclude') ?? '';

  if (!id || !title || !artist) {
    return NextResponse.json({ error: 'Missing id, title or artist' }, { status: 400 });
  }

  const seedTrack: Track = { id, title, artist, thumbnail, source: 'youtube' };
  const excludeIds = new Set(excludeParam.split(',').filter(Boolean));

  try {
    const results = await getRelatedTracks(seedTrack, excludeIds, 10);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('related route failed', error);
    return NextResponse.json({ error: 'Could not load related songs.' }, { status: 500 });
  }
}
