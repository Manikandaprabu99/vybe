import { NextRequest, NextResponse } from 'next/server';
import { searchYouTube } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
  }

  try {
    const results = await searchYouTube(q, { order: 'relevance', maxResults: 25 });
    return NextResponse.json({ results });
  } catch (error) {
    console.error('search route failed', error);
    return NextResponse.json(
      { error: 'Search failed. Check that YOUTUBE_API_KEY is set correctly.' },
      { status: 500 }
    );
  }
}
