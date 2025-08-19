'use client';

/**
 * Providers - Application-wide context providers
 * [79:Theming] Theme management with system preference support
 * [3:Feedback] Query state management with optimistic updates
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  /* [3:Feedback] Optimized query client for better UX */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
            /* [13:Doherty] Keep interactions under 400ms */
            networkMode: 'offlineFirst',
          },
          mutations: {
            /* [3:Feedback] Optimistic updates for instant feedback */
            networkMode: 'offlineFirst',
            retry: 1,
          },
        },
      })
  );
  
  /* [3:Feedback] Monitor connection status */
  useEffect(() => {
    const handleOnline = () => {
      queryClient.resumePausedMutations();
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* [79:Theming] System-aware theme with smooth transitions */}
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
        /* [11:Aesthetic-Usability] Store preference for consistency */
        storageKey="rankmybrand-theme"
      >
        {/* [40:Semantic HTML] Children include skip links and main content */}
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}