import type { CapacitorConfig } from '@capacitor/cli';

// The Android app (android/) is a thin native shell around the deployed
// website: it opens VYBE_APP_URL full-screen and adds what a browser tab
// can't — native lock-screen controls, and a foreground media service that
// keeps My Files and radio playing with the screen off (lib/mediaControls.ts).
// Because it loads the live site, web changes reach the app as soon as
// they're deployed; a new APK is only needed when something in android/
// changes.
//
// Build: VYBE_APP_URL=https://your-user.github.io/vybe/ npm run android:sync,
// or let .github/workflows/android.yml do it on GitHub (it defaults to this
// repo's GitHub Pages address). scripts/android-sync.mjs normalises the URL.
const appUrl = process.env.VYBE_APP_URL || undefined;

const config: CapacitorConfig = {
  appId: 'io.github.manikandaprabu99.vybe',
  appName: 'VYBE',
  // Only used for the "can't reach VYBE" page — the app itself is the site.
  webDir: 'android-shell',
  backgroundColor: '#0E0913',
  server: appUrl ? { url: appUrl, errorPath: 'offline.html' } : undefined,
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // The site already pads itself with env(safe-area-inset-*).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
  },
};

export default config;
