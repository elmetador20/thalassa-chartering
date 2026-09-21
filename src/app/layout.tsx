import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { IBM_Plex_Mono } from 'next/font/google';
import StyledComponentsRegistry from '@/lib/registry';
import Providers from '@/lib/providers';

// Type system.
//
// Maersk Headline, the client's licensed corporate face, self-hosted. The
// supplied TTFs were converted to WOFF2 (71 KB -> 28 KB each, 61% smaller);
// the originals are kept in media-src/fonts/ as the build source.
//
// It ships as two static faces — Regular (400) and Bold (700) — with no Light
// and no Medium, so the weight ranges below map the design system's 300/400/500
// onto Regular and 600/700 onto Bold. Declaring the ranges explicitly matters:
// global-style.ts sets `font-synthesis-weight: none`, so without them a
// `font-weight: 300` heading would have no declared face to resolve to.
//
// Nothing in the site currently uses 600+, so in practice only the Regular file
// is fetched; Bold is declared so emphasis is available without a code change.
const sans = localFont({
  src: [
    { path: '../fonts/MaerskHeadline-Regular.woff2', weight: '300 500', style: 'normal' },
    { path: '../fonts/MaerskHeadline-Bold.woff2', weight: '600 700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
  // Metrics measured from the binary, so the fallback occupies the same space
  // as the real face and swapping it in does not shift the layout.
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

// Reserved for genuinely technical annotations only — coordinates, process
// flows, the chartering read-out. Never for section labels or body copy.
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://incworx.in'),
  title: {
    default: 'INCWORX Intelligence Group — Intelligence that moves markets',
    template: '%s — INCWORX Intelligence Group',
  },
  description:
    'INCWORX Intelligence Group is a market intelligence, analytics, infrastructure and technology platform spanning Intelligence, Datamatics, Tectonics and Digitronics.',
  keywords: [
    'market intelligence',
    'dry bulk chartering',
    'commodity research',
    'port infrastructure',
    'marine construction',
    'data analytics',
    'INCWORX',
  ],
  openGraph: {
    type: 'website',
    siteName: 'INCWORX Intelligence Group',
    title: 'INCWORX Intelligence Group — Intelligence that moves markets',
    description:
      'A market intelligence, analytics, infrastructure and technology platform. Better intelligence leads to better decisions. Better decisions create better execution.',
    images: ['/assets/hero-poster.jpg'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#002240',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
    >
      <body>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
