/** @type {import('next').NextConfig} */
const nextConfig = {
  // A fully static site for GitHub Pages: every page is built ahead of time
  // (Home, Radio and the artist pages with their YouTube/radio data baked
  // in), and the rest runs in the browser. See .github/workflows/deploy.yml.
  output: 'export',
  // GitHub Pages serves project sites from https://<user>.github.io/<repo>/;
  // the deploy workflow sets this to "/<repo>". Empty for local development.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // /library/index.html instead of /library.html — what static hosts expect.
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    // Build pages one at a time: Home and each artist page ask YouTube for
    // the same artist songs, and only a sequential build lets the second ask
    // reuse the first answer (~400 quota units a day saved).
    cpus: 1,
  },
};

module.exports = nextConfig;
