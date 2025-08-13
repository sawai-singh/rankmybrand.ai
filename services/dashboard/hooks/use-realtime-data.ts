/**
 * React hooks for real-time data updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketClient, initWebSocket } from '@/lib/websocket-client';

export interface MetricsData {
  geoScore: number;
  shareOfVoice: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  citationCount: number;
  platformScores: Record<string, number>;
  timestamp: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: number;
  effort: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'executing' | 'completed';
  type: 'content' | 'schema' | 'faq' | 'meta';
  createdAt: string;
}

export interface Activity {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
  timestamp: string;
  metadata?: any;
}

export interface CompetitorData {
  id: string;
  name: string;
  geoScore: number;
  shareOfVoice: number;
  position: [number, number, number];
  color: string;
}

/**
 * Hook for real-time metrics updates
 */
export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const wsClient = useRef(initWebSocket());

  useEffect(() => {
    const client = wsClient.current;
    
    const handleMetrics = (data: MetricsData) => {
      setMetrics(data);
      setLoading(false);
    };

    const handleConnected = () => {
      setConnected(true);
      // Request initial metrics
      client.send({ type: 'request', resource: 'metrics' });
    };

    const handleDisconnected = () => {
      setConnected(false);
    };

    client.on('metrics', handleMetrics);
    client.on('connected', handleConnected);
    client.on('disconnected', handleDisconnected);

    // Connect if not already connected
    if (!client.isConnected()) {
      client.connect();
    }

    return () => {
      client.off('metrics', handleMetrics);
      client.off('connected', handleConnected);
      client.off('disconnected', handleDisconnected);
    };
  }, []);

  return { metrics, loading, connected };
}

/**
 * Hook for real-time recommendations
 */
export function useRealtimeRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const wsClient = useRef(initWebSocket());

  useEffect(() => {
    const client = wsClient.current;
    
    const handleRecommendations = (data: Recommendation[]) => {
      setRecommendations(data);
      setLoading(false);
    };

    const handleNewRecommendation = (data: Recommendation) => {
      setRecommendations(prev => [data, ...prev].slice(0, 50)); // Keep last 50
    };

    client.on('recommendations', handleRecommendations);
    client.on('recommendation-new', handleNewRecommendation);

    // Request initial recommendations
    if (client.isConnected()) {
      client.send({ type: 'request', resource: 'recommendations' });
    }

    return () => {
      client.off('recommendations', handleRecommendations);
      client.off('recommendation-new', handleNewRecommendation);
    };
  }, []);

  const approveRecommendation = useCallback((id: string) => {
    const client = wsClient.current;
    client.send({ 
      type: 'action', 
      action: 'approve-recommendation',
      recommendationId: id 
    });
    
    // Optimistic update
    setRecommendations(prev => 
      prev.map(r => r.id === id ? { ...r, status: 'approved' } : r)
    );
  }, []);

  const rejectRecommendation = useCallback((id: string) => {
    const client = wsClient.current;
    client.send({ 
      type: 'action', 
      action: 'reject-recommendation',
      recommendationId: id 
    });
    
    // Remove from list
    setRecommendations(prev => prev.filter(r => r.id !== id));
  }, []);

  return { 
    recommendations, 
    loading, 
    approveRecommendation, 
    rejectRecommendation 
  };
}

/**
 * Hook for real-time activity feed
 */
export function useRealtimeActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const wsClient = useRef(initWebSocket());

  useEffect(() => {
    const client = wsClient.current;
    
    const handleActivity = (data: Activity) => {
      setActivities(prev => [data, ...prev].slice(0, 100)); // Keep last 100
    };

    client.on('activity', handleActivity);

    return () => {
      client.off('activity', handleActivity);
    };
  }, []);

  return activities;
}

/**
 * Hook for real-time competitor data
 */
export function useRealtimeCompetitors() {
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [loading, setLoading] = useState(true);
  const wsClient = useRef(initWebSocket());

  useEffect(() => {
    const client = wsClient.current;
    
    const handleCompetitors = (data: CompetitorData[]) => {
      setCompetitors(data);
      setLoading(false);
    };

    const handleCompetitorUpdate = (data: CompetitorData) => {
      setCompetitors(prev => {
        const index = prev.findIndex(c => c.id === data.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [...prev, data];
      });
    };

    client.on('competitors', handleCompetitors);
    client.on('competitor-update', handleCompetitorUpdate);

    // Request initial competitors
    if (client.isConnected()) {
      client.send({ type: 'request', resource: 'competitors' });
    }

    return () => {
      client.off('competitors', handleCompetitors);
      client.off('competitor-update', handleCompetitorUpdate);
    };
  }, []);

  return { competitors, loading };
}

/**
 * Hook for WebSocket connection status
 */
export function useWebSocketStatus() {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const wsClient = useRef(initWebSocket());

  useEffect(() => {
    const client = wsClient.current;
    
    const handleConnected = () => {
      setConnected(true);
      setReconnecting(false);
    };

    const handleDisconnected = () => {
      setConnected(false);
      setReconnecting(true);
    };

    const handleMaxReconnect = () => {
      setReconnecting(false);
    };

    client.on('connected', handleConnected);
    client.on('disconnected', handleDisconnected);
    client.on('max-reconnect-reached', handleMaxReconnect);

    // Check initial status
    setConnected(client.isConnected());

    return () => {
      client.off('connected', handleConnected);
      client.off('disconnected', handleDisconnected);
      client.off('max-reconnect-reached', handleMaxReconnect);
    };
  }, []);

  return { connected, reconnecting };
}

/**
 * Hook for AI platform visibility heatmap data
 */
export function useRealtimeHeatmap() {
  const [heatmapData, setHeatmapData] = useState<number[][]>([]);
  const wsClient = useRef(initWebSocket());

  useEffect(() => {
    const client = wsClient.current;
    
    const handleHeatmapUpdate = (data: { platform: string; hour: number; score: number }[]) => {
      // Convert to 2D array for heatmap (7 days x 24 hours)
      const heatmap: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
      
      data.forEach(entry => {
        const day = Math.floor(entry.hour / 24) % 7;
        const hour = entry.hour % 24;
        heatmap[day][hour] = entry.score;
      });
      
      setHeatmapData(heatmap);
    };

    client.on('heatmap-update', handleHeatmapUpdate);

    return () => {
      client.off('heatmap-update', handleHeatmapUpdate);
    };
  }, []);

  return heatmapData;
}