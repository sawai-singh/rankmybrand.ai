import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TokenValidator from './TokenValidator';
import LoadingRedirect from './LoadingRedirect';

type PageProps = {
  params: { token: string };
  searchParams: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    [key: string]: string | undefined;
  };
};

const TOKEN_REGEX = /^[A-Za-z0-9_-]{32,256}$/;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Accessing Your Report | RankMyBrand',
    description: 'Securely accessing your AI visibility report',
    robots: 'noindex, nofollow, noarchive',
    other: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
  };
}

export default function SignedLinkPage({ params, searchParams }: PageProps) {
  const { token } = params;

  if (!token || !TOKEN_REGEX.test(token)) {
    notFound();
  }

  // Pass through only string values (defensive)
  const utmParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams || {})) {
    if (typeof v === 'string') utmParams[k] = v;
  }

  return (
    <Suspense fallback={<LoadingRedirect />}>
      <TokenValidator token={token} utmParams={utmParams} />
    </Suspense>
  );
}
