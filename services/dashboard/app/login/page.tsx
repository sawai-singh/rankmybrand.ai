'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Login() {
  const router = useRouter();

  useEffect(() => {
    // Check if we already have a token
    const token = localStorage.getItem('auth_token');
    if (token) {
      // If we have a token, redirect back to dashboard
      router.push('/');
    } else {
      // If no token, redirect to the main app's login/onboarding
      window.location.href = 'http://localhost:3003/';
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Redirecting...</h1>
        <p className="text-gray-400">
          If you are not redirected, <a href="http://localhost:3003/" className="text-blue-500 hover:underline">click here</a>
        </p>
      </div>
    </div>
  );
}