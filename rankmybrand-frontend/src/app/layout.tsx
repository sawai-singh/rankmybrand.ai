import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({ 
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RankMyBrand - AI Visibility in 10 Seconds | Beat AthenaHQ',
  description: 'Get instant AI visibility scores across ChatGPT, Claude, Perplexity & more. 50% cheaper than AthenaHQ with 3x faster results. Start free.',
  keywords: 'GEO platform, AI visibility, ChatGPT ranking, Claude optimization, Perplexity SEO, brand visibility, AI search optimization',
  authors: [{ name: 'RankMyBrand' }],
  creator: 'RankMyBrand',
  publisher: 'RankMyBrand',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://rankmybrand.ai'),
  openGraph: {
    title: 'RankMyBrand - AI Visibility in 10 Seconds',
    description: 'Instant AI visibility scores. 50% cheaper than AthenaHQ.',
    url: 'https://rankmybrand.ai',
    siteName: 'RankMyBrand',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RankMyBrand - AI Visibility Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RankMyBrand - AI Visibility in 10 Seconds',
    description: 'Instant AI visibility scores. 50% cheaper than AthenaHQ.',
    creator: '@rankmybrand',
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google-verification-code',
    yandex: 'yandex-verification-code',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster 
            position="bottom-right"
            toastOptions={{
              className: 'font-sans',
              duration: 4000,
            }}
          />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}