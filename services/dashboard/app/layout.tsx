import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "RankMyBrand.ai - AI-Era GEO Platform",
  description: "Track and optimize your brand's visibility across AI platforms. Real-time monitoring, auto-execution, and intelligence-driven insights.",
  keywords: ["GEO", "AI visibility", "brand monitoring", "ChatGPT", "Claude", "Perplexity", "Gemini", "SEO"],
  authors: [{ name: "RankMyBrand.ai" }],
  creator: "RankMyBrand.ai",
  publisher: "RankMyBrand.ai",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://rankmybrand.ai",
    siteName: "RankMyBrand.ai",
    title: "RankMyBrand.ai - AI-Era GEO Platform",
    description: "Track and optimize your brand's visibility across AI platforms",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RankMyBrand.ai",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RankMyBrand.ai - AI-Era GEO Platform",
    description: "Track and optimize your brand's visibility across AI platforms",
    images: ["/og-image.png"],
    creator: "@rankmybrand",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
