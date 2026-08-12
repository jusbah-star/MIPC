import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter, Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '600', '700', '800']
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap'
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: { default: 'MIPC Digital Campus', template: '%s | MIPC' },
  description: 'The secure digital campus for Muhabura Integrated Polytechnic College in Musanze, Rwanda.',
  metadataBase: new URL('https://mipc.ac.rw'),
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-parchment-50 font-body text-ink-950 antialiased selection:bg-mipc-green-100 selection:text-mipc-green-950">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-xl bg-white px-4 py-3 font-semibold text-ink-950 shadow-academic focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
