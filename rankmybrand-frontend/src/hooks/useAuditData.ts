import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AuditData } from '@/components/dashboard/DashboardView';

interface UseAuditDataOptions {
  // For JWT-authenticated users
  auditId?: string;
  // For token-based access (shareable links)
  token?: string;
  // Auth mode
  authMode?: 'jwt' | 'token';
  // Polling interval
  refetchInterval?: number | false;
}

interface TokenBasedAuditData extends AuditData {
  // Additional fields from token validation
  userEmail?: string;
  brandName?: string;
  expiresAt?: string;
}

/**
 * Custom hook for fetching audit data with dual authentication support
 *
 * Supports two modes:
 * 1. JWT mode - uses /api/audit/current for authenticated users
 * 2. Token mode - uses /api/audit/by-token for shareable link access
 */
export function useAuditData({
  auditId,
  token,
  authMode = 'jwt',
  refetchInterval = false,
}: UseAuditDataOptions) {
  // JWT-based query (for logged-in users)
  const jwtQuery = useQuery<AuditData>({
    queryKey: ['audit', 'current', auditId],
    queryFn: async () => {
      const endpoint = auditId ? `/audit/${auditId}` : '/audit/current';
      const response = await api.get(endpoint);
      return response.data;
    },
    enabled: authMode === 'jwt',
    refetchInterval,
    retry: 1,
  });

  // Token-based query (for shareable links)
  const tokenQuery = useQuery<TokenBasedAuditData>({
    queryKey: ['audit', 'token', token],
    queryFn: async () => {
      if (!token) throw new Error('Token is required for token-based authentication');

      // First, validate the token to get the audit ID
      const validateResponse = await fetch('/api/report/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!validateResponse.ok) {
        throw new Error('Invalid or expired token');
      }

      const validationData = await validateResponse.json();

      if (!validationData.valid || !validationData.auditId) {
        throw new Error('Token validation failed');
      }

      // Now fetch the audit data using the audit ID from validation
      // We'll create a new endpoint for this: /api/audit/by-token
      const auditResponse = await fetch(`/api/audit/by-token/${validationData.auditId}`, {
        headers: {
          'X-Access-Token': token,
        },
      });

      if (!auditResponse.ok) {
        throw new Error('Failed to fetch audit data');
      }

      const auditData = await auditResponse.json();

      // Merge validation data with audit data
      return {
        ...auditData,
        userEmail: validationData.userEmail,
        brandName: validationData.brandName,
        expiresAt: validationData.expiresAt,
      };
    },
    enabled: authMode === 'token' && !!token,
    refetchInterval,
    retry: 1,
    // Cache token-based queries for 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  // Return the appropriate query based on auth mode
  if (authMode === 'token') {
    return {
      data: tokenQuery.data,
      isLoading: tokenQuery.isLoading,
      error: tokenQuery.error,
      refetch: tokenQuery.refetch,
      isError: tokenQuery.isError,
    };
  }

  return {
    data: jwtQuery.data,
    isLoading: jwtQuery.isLoading,
    error: jwtQuery.error,
    refetch: jwtQuery.refetch,
    isError: jwtQuery.isError,
  };
}
