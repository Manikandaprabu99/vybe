export interface Track {
  id: string; // YouTube video ID, or a generated id for local files
  title: string;
  artist: string; // YouTube channel name, or "My Files" for local tracks
  thumbnail: string;
  source: 'youtube' | 'local';
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}
