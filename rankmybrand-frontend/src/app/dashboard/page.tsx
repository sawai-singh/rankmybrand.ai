'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DNAHelixLoader } from '@/components/ui/advanced-loading-states';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // This is a temporary redirect page
    // In production, this would be the actual dashboard
    // For now, redirect to the generating page if feature flag is enabled
    const enableQueuedReport = process.env.NEXT_PUBLIC_ENABLE_QUEUED_REPORT === 'true';
    
    console.log('Dashboard redirect - Feature flag:', process.env.NEXT_PUBLIC_ENABLE_QUEUED_REPORT);
    console.log('Dashboard redirect - enableQueuedReport:', enableQueuedReport);
    
    if (enableQueuedReport) {
      // Store any auth data from URL params
      const token = searchParams.get('token');
      const user = searchParams.get('user');
      
      if (token) localStorage.setItem('auth_token', token);
      if (user) localStorage.setItem('user', user);
      
      // Redirect to generating page
      router.push('/generating');
    } else {
      // Redirect to actual dashboard (port 3000)
      if (typeof window !== 'undefined') {
        window.location.href = `http://localhost:3000${window.location.search}`;
      }
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <DNAHelixLoader className="mx-auto mb-8" />
        <h1 className="text-2xl font-bold mb-2">Redirecting...</h1>
        <p className="text-gray-600">Please wait while we redirect you to your dashboard.</p>
      </div>
    </div>
  );
}

export default function DashboardRedirect() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <DNAHelixLoader className="mx-auto mb-8" />
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}