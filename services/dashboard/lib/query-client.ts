import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: Data considered fresh for 30 seconds
      staleTime: 30 * 1000,
      // Cache time: Keep inactive data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: (failureCount, error: any) => {
        if (error?.status === 404) return false;
        if (error?.status === 401) return false;
        return failureCount < 3;
      },
      // Refetch on window focus
      refetchOnWindowFocus: false,
      // Refetch on reconnect
      refetchOnReconnect: 'always',
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      // Optimistic updates
      onError: (error, variables, context: any) => {
        // Rollback optimistic updates on error
        if (context?.rollback) {
          context.rollback();
        }
      },
    },
  },
});

// Prefetch commonly used queries
export const prefetchCommonQueries = async () => {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['user', 'current'],
      queryFn: () => fetch('/api/auth/me').then(res => res.json()),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'metrics'],
      queryFn: () => fetch('/api/dashboard/metrics').then(res => res.json()),
    }),
  ]);
};

// Invalidation helpers
export const invalidateUserQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['user'] });
};

export const invalidateDashboardQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
};

export const invalidateGeoQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['geo'] });
};