"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Info, TrendingUp, TrendingDown, CheckCircle, XCircle, AlertCircle, RefreshCw, Loader2 } from "lucide-react";

interface PlatformData {
  platform: string;
  logo: string;
  queries: string[];
  visibility: number[];
  avgPosition: number;
  trend: "up" | "down" | "neutral";
  status: "excellent" | "good" | "warning" | "critical";
}

interface AIVisibilityHeatmapProps {
  companyId?: string;
}

function getColorByValue(value: number | null): string {
  if (value === null) return "bg-gray-700/20 border-gray-700/40";
  if (value >= 80) return "bg-green-500/20 border-green-500/40 hover:bg-green-500/30";
  if (value >= 60) return "bg-yellow-500/20 border-yellow-500/40 hover:bg-yellow-500/30";
  if (value >= 40) return "bg-orange-500/20 border-orange-500/40 hover:bg-orange-500/30";
  return "bg-red-500/20 border-red-500/40 hover:bg-red-500/30";
}

function getStatusIcon(status: string) {
  switch (status) {
    case "excellent":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "good":
      return <CheckCircle className="w-4 h-4 text-yellow-500" />;
    case "warning":
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case "critical":
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
}

function determineStatus(avgVisibility: number): "excellent" | "good" | "warning" | "critical" {
  if (avgVisibility >= 80) return "excellent";
  if (avgVisibility >= 60) return "good";
  if (avgVisibility >= 40) return "warning";
  return "critical";
}

function determineTrend(currentScore: number, previousScore?: number): "up" | "down" | "neutral" {
  if (!previousScore) return "neutral";
  if (currentScore > previousScore + 5) return "up";
  if (currentScore < previousScore - 5) return "down";
  return "neutral";
}

export function AIVisibilityHeatmap({ companyId }: AIVisibilityHeatmapProps) {
  const [platforms, setPlatforms] = useState<PlatformData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ platform: number; query: number } | null>(null);
  const [hoveredPlatform, setHoveredPlatform] = useState<number | null>(null);

  // Fetch visibility data from API
  const fetchVisibilityData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
      
      const response = await fetch(`${apiUrl}/api/ai/visibility${companyId ? `?companyId=${companyId}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPlatforms(transformToPlatformData(data));
        setError(null);
      } else if (response.status === 404) {
        // No data yet - show empty state
        setPlatforms(getEmptyPlatforms());
        setError(null);
      } else {
        throw new Error('Failed to fetch visibility data');
      }
    } catch (err) {
      console.error('Failed to fetch AI visibility:', err);
      setError('Unable to load visibility data');
      // Show empty state instead of fake data
      setPlatforms(getEmptyPlatforms());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Transform API response to PlatformData format
  const transformToPlatformData = (data: any): PlatformData[] => {
    if (!data || !data.platforms) {
      return getEmptyPlatforms();
    }

    const defaultQueries = ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"];
    
    return Object.entries(data.platforms).map(([platformName, platformData]: [string, any]) => {
      const visibility = platformData.queries?.map((q: any) => q.visibility) || [null, null, null, null, null];
      const avgVisibility = visibility.filter((v: any) => v !== null).reduce((a: number, b: number) => a + b, 0) / (visibility.filter((v: any) => v !== null).length || 1);
      
      return {
        platform: platformName,
        logo: getPlatformLogo(platformName),
        queries: platformData.queries?.map((q: any) => q.name) || defaultQueries,
        visibility: visibility,
        avgPosition: platformData.avgPosition || null,
        trend: determineTrend(avgVisibility, platformData.previousScore),
        status: determineStatus(avgVisibility)
      };
    });
  };

  // Get platform logo emoji
  const getPlatformLogo = (platform: string): string => {
    const logos: { [key: string]: string } = {
      "ChatGPT": "🤖",
      "Claude": "🧠",
      "Gemini": "💎",
      "Perplexity": "🔍",
      "Copilot": "✈️",
      "You.com": "🎯",
      "Phind": "🔧",
      "Poe": "📜"
    };
    return logos[platform] || "🔮";
  };

  // Get empty platforms for no data state
  const getEmptyPlatforms = (): PlatformData[] => {
    const platformNames = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot", "You.com", "Phind", "Poe"];
    const defaultQueries = ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"];
    
    return platformNames.map(name => ({
      platform: name,
      logo: getPlatformLogo(name),
      queries: defaultQueries,
      visibility: [null, null, null, null, null],
      avgPosition: 0,
      trend: "neutral" as const,
      status: "critical" as const
    }));
  };

  // Set up WebSocket for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    
    const connectWebSocket = () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws';
      const token = localStorage.getItem('auth_token');
      
      try {
        ws = new WebSocket(`${wsUrl}?token=${token}`);
        
        ws.onopen = () => {
          console.log('AI visibility WebSocket connected');
          // Subscribe to visibility updates
          ws?.send(JSON.stringify({ 
            type: 'subscribe', 
            channel: 'ai_visibility',
            companyId: companyId 
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'visibility_update' && data.payload) {
              setPlatforms(transformToPlatformData(data.payload));
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected, attempting reconnect...');
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
      } catch (err) {
        console.error('Failed to connect WebSocket:', err);
      }
    };

    // Initial fetch
    fetchVisibilityData();
    
    // Connect WebSocket for real-time updates
    connectWebSocket();

    // Cleanup
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [companyId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchVisibilityData();
  };

  if (loading) {
    return (
      <div className="glassmorphism rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold mb-1">AI Platform Visibility Matrix</h2>
            <p className="text-sm text-muted-foreground">Loading visibility data...</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glassmorphism rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold mb-1">AI Platform Visibility Matrix</h2>
          <p className="text-sm text-muted-foreground">
            {platforms.some(p => p.visibility.some(v => v !== null)) 
              ? "Real-time presence across AI platforms" 
              : "No visibility data available yet"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg glassmorphism glassmorphism-hover"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </button>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-green-500/40" />
            <span>Excellent (80%+)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-yellow-500/40" />
            <span>Good (60-79%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-orange-500/40" />
            <span>Warning (40-59%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-red-500/40" />
            <span>Critical (&lt;40%)</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="overflow-x-auto custom-scrollbar">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-[200px_repeat(5,1fr)] gap-2 mb-2">
            <div />
            {platforms[0]?.queries.map((query, index) => (
              <div key={index} className="text-xs text-muted-foreground text-center">
                {query}
              </div>
            ))}
          </div>

          {/* Heatmap Grid */}
          {platforms.map((platform, platformIndex) => (
            <motion.div
              key={platform.platform}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: platformIndex * 0.05 }}
              className="grid grid-cols-[200px_repeat(5,1fr)] gap-2 mb-2"
              onMouseEnter={() => setHoveredPlatform(platformIndex)}
              onMouseLeave={() => setHoveredPlatform(null)}
            >
              {/* Platform Info */}
              <div className="flex items-center justify-between px-3 py-2 glassmorphism rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{platform.logo}</span>
                  <span className="text-sm font-medium">{platform.platform}</span>
                </div>
                <div className="flex items-center gap-2">
                  {platform.visibility.some(v => v !== null) && getStatusIcon(platform.status)}
                  {platform.visibility.some(v => v !== null) && (
                    <>
                      {platform.trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
                      {platform.trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
                    </>
                  )}
                </div>
              </div>

              {/* Visibility Cells */}
              {platform.visibility.map((value, queryIndex) => (
                <motion.div
                  key={queryIndex}
                  whileHover={{ scale: value !== null ? 1.05 : 1 }}
                  whileTap={{ scale: value !== null ? 0.95 : 1 }}
                  className={cn(
                    "relative flex items-center justify-center h-12 rounded-lg border cursor-pointer transition-all",
                    getColorByValue(value),
                    selectedCell?.platform === platformIndex && selectedCell?.query === queryIndex &&
                    "ring-2 ring-purple-500 ring-offset-2 ring-offset-background"
                  )}
                  onClick={() => value !== null && setSelectedCell({ platform: platformIndex, query: queryIndex })}
                >
                  <span className="text-sm font-medium">
                    {value !== null ? `${value}%` : '--'}
                  </span>
                  {hoveredPlatform === platformIndex && value !== null && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 rounded-lg bg-white/5 pointer-events-none"
                    />
                  )}
                  {/* Live pulse indicator for high visibility */}
                  {value !== null && value >= 80 && (
                    <div className="absolute top-1 right-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Selected Cell Details */}
      {selectedCell && platforms[selectedCell.platform].visibility[selectedCell.query] !== null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 glassmorphism rounded-lg"
        >
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">
                {platforms[selectedCell.platform].platform} - {platforms[0].queries[selectedCell.query]}
              </p>
              <p className="text-xs text-muted-foreground">
                Visibility: {platforms[selectedCell.platform].visibility[selectedCell.query]}% • 
                {platforms[selectedCell.platform].avgPosition > 0 && 
                  ` Average Position: ${platforms[selectedCell.platform].avgPosition} • `}
                Last updated: Real-time
              </p>
              <div className="mt-2">
                <p className="text-xs text-purple-400">
                  💡 Recommendation: {
                    platforms[selectedCell.platform].visibility[selectedCell.query]! < 40
                      ? "Critical visibility - Create targeted content immediately"
                      : platforms[selectedCell.platform].visibility[selectedCell.query]! < 60
                      ? "Consider creating more targeted content for this query"
                      : platforms[selectedCell.platform].visibility[selectedCell.query]! < 80
                      ? "Good visibility - Minor improvements recommended"
                      : "Excellent visibility - Maintain current strategy"
                  }
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty state message */}
      {platforms.every(p => p.visibility.every(v => v === null)) && (
        <div className="text-center py-8 text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No visibility data available</p>
          <p className="text-sm mt-1">Run an analysis to see your AI platform visibility</p>
        </div>
      )}
    </motion.div>
  );
}