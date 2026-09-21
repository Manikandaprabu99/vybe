import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VYBE — Tamil & English Music',
    short_name: 'VYBE',
    description: 'Free Tamil & English music. No login, no subscription — just songs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1B1023',
    theme_color: '#1B1023',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
