'use client';

import { useEffect } from 'react';
import { withBase } from '@/lib/paths';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Scoped to the app's own sub-path on GitHub Pages ("/vybe/").
      navigator.serviceWorker.register(withBase('/sw.js'), { scope: withBase('/') }).catch(() => {
        // Non-fatal — the app still works without offline caching.
      });
    }
  }, []);

  return null;
}
