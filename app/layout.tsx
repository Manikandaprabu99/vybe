import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Player from '@/components/Player';
import BottomNav from '@/components/BottomNav';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import StoreHydrator from '@/components/StoreHydrator';
import Toaster from '@/components/Toaster';
import { withBase } from '@/lib/paths';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

// Hand-written URLs carry the GitHub Pages sub-path (lib/paths.ts) — Next.js
// doesn't add it to these by itself.
export const metadata: Metadata = {
  title: 'VYBE — Tamil & English Music',
  description: 'Free Tamil & English music. No login, no subscription — just songs.',
  manifest: withBase('/manifest.webmanifest'),
  icons: { icon: withBase('/icon.svg'), apple: withBase('/icon-192.png') },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'VYBE' },
};

export const viewport: Viewport = {
  themeColor: '#0E0913',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="bg-ink text-paper font-sans antialiased">
        <ServiceWorkerRegister />
        {/* Before <Player />, so the saved session is restored before the
            playback engine starts up and looks at the queue. */}
        <StoreHydrator />
        {/* Room at the bottom for the floating mini player and the nav bar. */}
        <main className="mx-auto min-h-dvh max-w-2xl pb-[calc(10.5rem+env(safe-area-inset-bottom))]">{children}</main>
        <Player />
        <BottomNav />
        <Toaster />
      </body>
    </html>
  );
}
