/**
 * React hooks for API integration
 * Provides easy-to-use hooks for all backend services
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import type { GEOScore, CrawlJob, SearchIntelligence, RealTimeMetrics } from '@/lib/api';
import { toast } from 'sonner';

// ========================================
// GEO Calculator Hooks
// ========================================

/**
 * Hook to get instant GEO score
 */
export function useInstantScore(domain: string | null) {
  return useQuery({
    queryKey: ['instant-score', domain],
    queryFn: async () => {
      if (!domain) throw new Error('Domain is required');
      return api.getInstantScore(domain);
    },
    enabled: !!domain,
    staleTime: 60 * 1000, // 1 minute
    retry: 2,
  });
}

/**
 * Hook to get detailed analysis
 */
export function useDetailedAnalysis(domain: string | null, keywords?: string[]) {
  return useQuery({
    queryKey: ['detailed-analysis', domain, keywords],
    queryFn: async () => {
      if (!domain) throw new Error('Domain is required');
      return api.getDetailedAnalysis(domain, keywords);
    },
    enabled: !!domain,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to analyze domain (mutation)
 */
export function useAnalyzeDomain() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ domain, quick = true }: { domain: string; quick?: boolean }) => {
      if (quick) {
        return api.getInstantScore(domain);
      }
      return api.getDetailedAnalysis(domain);
    },
    onSuccess: (data, variables) => {
      // Update cache
      queryClient.setQueryData(['instant-score', variables.domain], data);
      toast.success('Analysis complete!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Analysis failed');
    },
  });
}

/**
 * Hook to get trending domains
 */
export function useTrendingDomains() {
  return useQuery({
    queryKey: ['trending-domains'],
    queryFn: api.getTrendingDomains,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to compare competitors
 */
export function useCompareCompetitors(domains: string[]) {
  return useQuery({
    queryKey: ['compare-competitors', domains],
    queryFn: () => api.compareCompetitors(domains),
    enabled: domains.length > 1,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get historical data
 */
export function useHistoricalData(domain: string | null, days: number = 30) {
  return useQuery({
    queryKey: ['historical-data', domain, days],
    queryFn: () => {
      if (!domain) throw new Error('Domain is required');
      return api.getHistoricalData(domain, days);
    },
    enabled: !!domain,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ========================================
// Web Crawler Hooks
// ========================================

/**
 * Hook to start crawl job
 */
export function useStartCrawl() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ url, depth, limit }: { url: string; depth?: number; limit?: number }) => {
      return api.startCrawl(url, { depth, limit });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['crawl-job', data.id], data);
      toast.success('Crawl started!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to start crawl');
    },
  });
}

/**
 * Hook to monitor crawl job
 */
export function useCrawlJob(jobId: string | null) {
  const [job, setJob] = useState<CrawlJob | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    // Get initial status
    api.getCrawlStatus(jobId).then(setJob).catch(console.error);

    // Subscribe to updates
    const unsubscribe = api.subscribeToCrawlUpdates(jobId, (data) => {
      setJob(data);
      if (data.status === 'completed') {
        toast.success('Crawl completed!');
      } else if (data.status === 'failed') {
        toast.error('Crawl failed');
      }
    });

    setIsSubscribed(true);

    return () => {
      unsubscribe();
      setIsSubscribed(false);
    };
  }, [jobId]);

  return { job, isSubscribed };
}

// ========================================
// Search Intelligence Hooks
// ========================================

/**
 * Hook to analyze search intelligence
 */
export function useSearchIntelligence() {
  return useMutation({
    mutationFn: ({ query, domain }: { query: string; domain: string }) => {
      return api.analyzeSearchIntelligence(query, domain);
    },
    onSuccess: () => {
      toast.success('Search analysis complete!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Search analysis failed');
    },
  });
}

/**
 * Hook to get content recommendations
 */
export function useContentRecommendations(domain: string | null) {
  return useQuery({
    queryKey: ['content-recommendations', domain],
    queryFn: () => {
      if (!domain) throw new Error('Domain is required');
      return api.getContentRecommendations(domain);
    },
    enabled: !!domain,
    staleTime: 10 * 60 * 1000,
  });
}

// ========================================
// Real-time Monitoring Hooks
// ========================================

/**
 * Hook for real-time metrics monitoring
 */
export function useRealTimeMetrics(domain: string | null) {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!domain) return;

    let stopMonitoring: (() => void) | null = null;

    const startMonitoring = async () => {
      try {
        stopMonitoring = await api.startMonitoring(domain, {
          onMetrics: (data) => {
            setMetrics(data);
            setIsConnected(true);
          },
          onAlert: (alert) => {
            setAlerts(prev => [alert, ...prev].slice(0, 10)); // Keep last 10 alerts
            
            // Show toast for high severity alerts
            if (alert.severity === 'high') {
              toast.error(alert.message);
            } else if (alert.severity === 'medium') {
              toast.warning(alert.message);
            }
          },
        });
      } catch (error) {
        console.error('Failed to start monitoring:', error);
        setIsConnected(false);
      }
    };

    startMonitoring();

    return () => {
      if (stopMonitoring) {
        stopMonitoring();
      }
    };
  }, [domain]);

  return { metrics, isConnected, alerts };
}

/**
 * Hook for competitor monitoring
 */
export function useCompetitorMonitoring(domains: string[]) {
  const [competitors, setCompetitors] = useState<Map<string, any>>(new Map());
  const [updates, setUpdates] = useState<any[]>([]);

  useEffect(() => {
    if (domains.length === 0) return;

    const unsubscribe = api.subscribe('competitor', (data: any) => {
      // Update competitor data
      setCompetitors(prev => {
        const updated = new Map(prev);
        updated.set(data.domain, data);
        return updated;
      });

      // Add to updates feed
      setUpdates(prev => [data, ...prev].slice(0, 20));

      // Show notification for significant changes
      if (data.changePercent > 10) {
        toast.info(`${data.domain} score changed by ${data.changePercent}%`);
      }
    });

    return unsubscribe;
  }, [domains]);

  return { competitors: Array.from(competitors.values()), updates };
}

// ========================================
// Combined Analysis Hook
// ========================================

/**
 * Hook for complete brand analysis
 */
export function useCompleteBrandAnalysis(domain: string | null) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!domain) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await api.getCompleteBrandAnalysis(domain);
      setAnalysis(result);
      toast.success('Complete analysis ready!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [domain]);

  return {
    analysis,
    isAnalyzing,
    error,
    analyze,
  };
}

// ========================================
// Utility Hooks
// ========================================

/**
 * Hook to manage WebSocket connection
 */
export function useWebSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await api.connectWebSocket();
      setIsConnected(true);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    api.disconnectWebSocket();
    setIsConnected(false);
  }, []);

  useEffect(() => {
    // Auto-connect on mount
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  return { isConnected, isConnecting, connect, disconnect };
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate<T>(
  queryKey: any[],
  updateFn: (old: T, optimisticValue: any) => T
) {
  const queryClient = useQueryClient();

  const optimisticUpdate = useCallback((optimisticValue: any) => {
    queryClient.setQueryData(queryKey, (old: T) => {
      if (!old) return old;
      return updateFn(old, optimisticValue);
    });
  }, [queryClient, queryKey, updateFn]);

  return optimisticUpdate;
}