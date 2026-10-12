'use client';

import { useEffect } from 'react';
import { useVybeStore } from '@/lib/store';

// Restores playlists, liked songs, My Files and the last listening session
// from localStorage — right after the first render instead of during it.
// The server renders every page with an empty library (it can't see this
// phone's storage), so restoring while the page first renders made the
// browser's markup disagree with the server's: React reports that as a
// hydration error and recovers by re-rendering the whole page. Restoring
// after mount avoids that; the library and mini player simply fill in a
// moment later.
export default function StoreHydrator() {
  useEffect(() => {
    void useVybeStore.persist.rehydrate();
  }, []);

  return null;
}
