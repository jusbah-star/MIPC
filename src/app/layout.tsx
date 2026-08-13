import type { Metadata } from 'next';
import { Lora, Inter, IBM_Plex_Mono } from 'next/font/google';
import { AuthLinkCompleter } from '@/components/auth-link-completer';
import './globals.css';

const lora = Lora({ subsets: ['latin'], variable: '--font-serif', display: 'swap', weight: ['400', '500', '600', '700'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'MIPC Digital Campus', template: '%s | MIPC' },
  description: 'The secure digital campus for Muhabura Integrated Polytechnic College in Musanze, Rwanda.',
  metadataBase: new URL('https://mipc.ac.rw'),
  icons: {
    icon: '/mipc-logo.png',
    shortcut: '/mipc-logo.png',
    apple: '/mipc-logo.png'
  },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${inter.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-parchment-50 font-body text-ink-950 antialiased selection:bg-brass-300 selection:text-ink-950">
        <a href="#main-content" className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
        <AuthLinkCompleter />
        {children}
      </body>
    </html>
  );
}
