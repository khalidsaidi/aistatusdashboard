import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';

export const geistSans = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
  preload: true,
  fallback: ['ui-sans-serif', 'sans-serif'],
});

export const geistMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
  preload: true,
  fallback: [
    'ui-monospace',
    'monospace',
  ],
});
