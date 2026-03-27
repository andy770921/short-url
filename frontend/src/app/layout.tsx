import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zap — URL Shortener',
  description: 'Instant short links. Share fast, everywhere.',
  openGraph: {
    title: 'Zap — URL Shortener',
    description: 'Instant short links. Share fast, everywhere.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Zap — URL Shortener',
    description: 'Instant short links. Share fast, everywhere.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
