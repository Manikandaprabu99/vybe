import { NextResponse } from 'next/server';
import { searchYouTube } from '@/lib/youtube';

export async function GET() {
  try {
    const [tamil, english] = await Promise.all([
      searchYouTube('Tamil official audio', { order: 'date', maxResults: 12 }),
      searchYouTube('English official audio', { order: 'date', maxResults: 12 }),
    ]);
    return NextResponse.json({ tamil, english });
  } catch (error) {
    console.error('latest route failed', error);
    return NextResponse.json({ error: 'Could not load new releases.' }, { status: 500 });
  }
}
