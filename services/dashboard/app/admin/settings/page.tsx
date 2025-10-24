'use client';

/**
 * Legacy Settings Page - Redirects to Unified Control Center
 * This page now redirects to /admin/control with the Settings tab active
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to control center with settings tab
    router.replace('/admin/control?tab=settings');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Redirecting to System Control Center...</p>
      </div>
    </div>
  );
}
