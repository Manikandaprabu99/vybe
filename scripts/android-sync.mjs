// Prepares the Android app for a build: bakes the site URL into the offline
// page, then copies config and plugins into android/ (npx cap sync).
//
//   VYBE_APP_URL=https://your-user.github.io/vybe/ npm run android:sync
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Normalised: lowercase host (GitHub Pages hostnames are lowercase, and
// Capacitor compares hosts exactly) and a trailing slash (otherwise GitHub
// Pages answers "/vybe" with a redirect to "/vybe/").
let url = '';
try {
  const parsed = new URL(process.env.VYBE_APP_URL ?? '');
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  url = parsed.href;
} catch {
  // reported below
}
if (!url.startsWith('https://')) {
  console.error(
    'Set VYBE_APP_URL to your deployed VYBE site, e.g.\n' +
      '  VYBE_APP_URL=https://your-user.github.io/vybe/ npm run android:sync'
  );
  process.exit(1);
}

// android-shell/offline.html shows when the app can't reach the site at all
// (first launch with no connection) — its "Try again" needs to know where
// the site is.
writeFileSync(
  new URL('../android-shell/app-url.js', import.meta.url),
  `window.VYBE_APP_URL = ${JSON.stringify(url)};\n`
);

execSync('npx cap sync android', { stdio: 'inherit', env: { ...process.env, VYBE_APP_URL: url } });
