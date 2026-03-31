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

function initTheme() {
  const theme = localStorage.getItem('theme');
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(${initTheme.toString()})()` }} />
      </head>
      <body className="bg-slate-50 dark:bg-zinc-950 transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
