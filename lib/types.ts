export type TrackSource = 'youtube' | 'local' | 'radio';

export interface Track {
  id: string; // YouTube video ID, a generated id for local files, or "radio:<station uuid>"
  title: string;
  artist: string; // YouTube channel name; for local files the artist from an "Artist - Title" file name, else "My Files"; "Live · <country>" for radio
  thumbnail: string;
  source: TrackSource;
  // Radio stations only: the station's direct stream URL. Radio plays through
  // the same <audio> element as My Files, which is why it keeps going when the
  // screen locks — see lib/audioEngine.ts.
  streamUrl?: string;
  // YouTube only, used by autoplay to find similar songs: the movie/album the
  // title names (lib/format.ts extractAlbum) and the uploading channel.
  album?: string;
  channelId?: string;
  // Queue entries only: added with "Play next" / "Add to queue", so they play
  // before the rest of what you started. Stripped before a track is saved
  // anywhere else (likes, playlists, recently played).
  queued?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

// Sources that play through VYBE's own <audio> element — and therefore keep
// playing in the background — as opposed to the YouTube embed, which doesn't.
export function isDirectAudio(track: Track | null | undefined): boolean {
  return track?.source === 'local' || track?.source === 'radio';
}
