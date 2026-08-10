import type { Metadata } from 'next';
import { Source_Serif_4, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap', weight: ['400', '600', '700'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'MIPC Digital Campus', template: '%s | MIPC' },
  description: 'The secure digital campus for Muhabura Integrated Polytechnic College in Musanze, Rwanda.',
  metadataBase: new URL('https://mipc.ac.rw'),
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${inter.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-parchment-50 font-body text-ink-950 antialiased selection:bg-brass-300 selection:text-ink-950">
        <a href="#main-content" className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
