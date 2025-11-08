'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ControlsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the correct singular form
    router.replace('/admin/control');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-gray-400">Redirecting to System Control Center...</div>
      </div>
    </div>
  );
}
