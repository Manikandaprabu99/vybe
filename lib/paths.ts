// VYBE is served from a sub-path on GitHub Pages (https://<user>.github.io/vybe/),
// set at build time by .github/workflows/deploy.yml. Next.js adds it to
// <Link> and its own assets by itself, but not to hand-written URLs — the
// manifest, icons, the service worker, lock-screen artwork — which go
// through withBase(). Empty locally, so `npm run dev` serves from "/".
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBase(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
