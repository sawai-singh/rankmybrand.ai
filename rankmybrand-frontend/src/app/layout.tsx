import type { Metadata } from 'next';
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'RankMyBrand - AI Visibility Analytics Platform',
  description: 'Track and optimize your brand visibility across AI platforms like ChatGPT, Claude, Gemini, and Perplexity',
  keywords: 'AI visibility, brand tracking, ChatGPT optimization, AI analytics',
  openGraph: {
    title: 'RankMyBrand - AI Visibility Analytics Platform',
    description: 'Track and optimize your brand visibility across AI platforms',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RankMyBrand - AI Visibility Analytics Platform',
    description: 'Track and optimize your brand visibility across AI platforms',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#8B5CF6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className={cn(
        inter.variable,
        outfit.variable,
        jetbrainsMono.variable,
        'font-sans'
      )}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={cn(
        'min-h-screen bg-background text-foreground antialiased',
        'selection:bg-violet-600/20 selection:text-violet-900 dark:selection:bg-violet-400/20 dark:selection:text-violet-100'
      )}>
        {/* Removed all providers that might interfere with navigation */}
        {children}
      </body>
    </html>
  );
}