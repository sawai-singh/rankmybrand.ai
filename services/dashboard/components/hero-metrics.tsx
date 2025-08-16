"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, AlertCircle, Zap, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercentage } from "@/lib/utils";

interface Metric {
  id: string;
  label: string;
  value: number | string | null;
  change: number;
  trend: "up" | "down" | "neutral";
  sparkline: number[];
  insight?: string;
  icon: React.ReactNode;
  color: string;
}

interface HeroMetricsProps {
  data?: any;
}

export function HeroMetrics({ data }: HeroMetricsProps) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch real metrics from API
    fetchRealMetrics();
  }, [data]);

  const fetchRealMetrics = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/metrics/current`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const realData = await response.json();
        setMetrics(transformToMetrics(realData));
      } else {
        // No data available, show empty state
        setMetrics(getEmptyMetrics());
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      // Use provided data or empty metrics
      if (data) {
        setMetrics(transformToMetrics(data));
      } else {
        setMetrics(getEmptyMetrics());
      }
    } finally {
      setLoading(false);
    }
  };

  const transformToMetrics = (data: any): Metric[] => {
    return [
      {
        id: "geo-score",
        label: "GEO Score",
        value: data?.geoScore || null,
        change: data?.geoChange || 0,
        trend: data?.geoChange > 0 ? "up" : data?.geoChange < 0 ? "down" : "neutral",
        sparkline: data?.geoHistory || [],
        insight: data?.geoInsight || null,
        icon: <Target className="w-5 h-5" />,
        color: "from-purple-500 to-pink-500"
      },
      {
        id: "ai-visibility",
        label: "AI Visibility",
        value: data?.visibility ? `${data.visibility}%` : null,
        change: data?.visibilityChange || 0,
        trend: data?.visibilityChange > 0 ? "up" : "neutral",
        sparkline: data?.visibilityHistory || [],
        insight: data?.platformCount ? `Appearing in ${data.platformCount} AI platforms` : null,
        icon: <Zap className="w-5 h-5" />,
        color: "from-blue-500 to-cyan-500"
      },
      {
        id: "sov",
        label: "Share of Voice",
        value: data?.shareOfVoice ? `${data.shareOfVoice}%` : null,
        change: data?.sovChange || 0,
        trend: data?.sovChange > 0 ? "up" : data?.sovChange < 0 ? "down" : "neutral",
        sparkline: data?.sovHistory || [],
        insight: data?.sovRank ? `Rank #${data.sovRank} in category` : null,
        icon: <Users className="w-5 h-5" />,
        color: "from-green-500 to-emerald-500"
      },
      {
        id: "actions",
        label: "Action Items",
        value: data?.actionCount || null,
        change: 0,
        trend: "neutral",
        sparkline: [],
        insight: data?.priorityActions ? `${data.priorityActions} high-priority items` : null,
        icon: <AlertCircle className="w-5 h-5" />,
        color: "from-orange-500 to-amber-500"
      }
    ];
  };

  const getEmptyMetrics = (): Metric[] => {
    return [
      {
        id: "geo-score",
        label: "GEO Score",
        value: null,
        change: 0,
        trend: "neutral",
        sparkline: [],
        insight: "No data available",
        icon: <Target className="w-5 h-5" />,
        color: "from-gray-400 to-gray-500"
      },
      {
        id: "ai-visibility",
        label: "AI Visibility",
        value: null,
        change: 0,
        trend: "neutral",
        sparkline: [],
        insight: "Run analysis to see results",
        icon: <Zap className="w-5 h-5" />,
        color: "from-gray-400 to-gray-500"
      },
      {
        id: "sov",
        label: "Share of Voice",
        value: null,
        change: 0,
        trend: "neutral",
        sparkline: [],
        insight: "Awaiting data",
        icon: <Users className="w-5 h-5" />,
        color: "from-gray-400 to-gray-500"
      },
      {
        id: "actions",
        label: "Action Items",
        value: 0,
        change: 0,
        trend: "neutral",
        sparkline: [],
        insight: "No actions required",
        icon: <AlertCircle className="w-5 h-5" />,
        color: "from-gray-400 to-gray-500"
      }
    ];
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-32 bg-gray-800 rounded-xl"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className="relative"
        >
          <div className="p-6 rounded-xl bg-gray-900/50 backdrop-blur-sm border border-gray-800 hover:border-gray-700 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-2 rounded-lg bg-gradient-to-br", metric.color)}>
                {metric.icon}
              </div>
              <div className="flex items-center gap-1">
                {metric.trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
                {metric.trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
                {metric.trend === "neutral" && <Minus className="w-4 h-4 text-gray-500" />}
                {metric.change !== 0 && (
                  <span className={cn(
                    "text-xs font-medium",
                    metric.trend === "up" && "text-green-500",
                    metric.trend === "down" && "text-red-500",
                    metric.trend === "neutral" && "text-gray-500"
                  )}>
                    {metric.change > 0 ? "+" : ""}{formatPercentage(metric.change)}
                  </span>
                )}
              </div>
            </div>
            
            <div className="mb-2">
              <p className="text-xs text-gray-400 mb-1">{metric.label}</p>
              <p className="text-2xl font-bold">
                {metric.value !== null ? (
                  typeof metric.value === 'number' ? formatNumber(metric.value) : metric.value
                ) : (
                  <span className="text-gray-500">--</span>
                )}
              </p>
            </div>

            {metric.insight && (
              <p className="text-xs text-gray-400">{metric.insight}</p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}