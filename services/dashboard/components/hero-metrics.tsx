"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, AlertCircle, Zap, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercentage } from "@/lib/utils";
import { useRealtimeMetrics } from "@/hooks/use-realtime-data";

interface Metric {
  id: string;
  label: string;
  value: number | string;
  change: number;
  trend: "up" | "down" | "neutral";
  sparkline: number[];
  insight?: string;
  icon: React.ReactNode;
  color: string;
}

const mockMetrics: Metric[] = [
  {
    id: "geo-score",
    label: "GEO Score",
    value: 87,
    change: 12.5,
    trend: "up",
    sparkline: [65, 70, 68, 75, 80, 82, 87],
    insight: "Top 10% in your industry",
    icon: <Target className="w-5 h-5" />,
    color: "from-purple-500 to-pink-500"
  },
  {
    id: "ai-visibility",
    label: "AI Visibility",
    value: "94%",
    change: 8.3,
    trend: "up",
    sparkline: [85, 87, 89, 90, 92, 93, 94],
    insight: "Appearing in 7/8 AI platforms",
    icon: <Zap className="w-5 h-5" />,
    color: "from-blue-500 to-cyan-500"
  },
  {
    id: "sov",
    label: "Share of Voice",
    value: "32.4%",
    change: -2.1,
    trend: "down",
    sparkline: [35, 34, 33, 34, 33, 32, 32.4],
    insight: "Competitor gaining ground",
    icon: <Users className="w-5 h-5" />,
    color: "from-green-500 to-emerald-500"
  },
  {
    id: "recommendations",
    label: "Active Actions",
    value: 23,
    change: 0,
    trend: "neutral",
    sparkline: [20, 21, 22, 23, 23, 23, 23],
    insight: "5 high-priority items",
    icon: <AlertCircle className="w-5 h-5" />,
    color: "from-orange-500 to-amber-500"
  }
];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  const height = 40;
  const width = 100;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" className={cn("text-purple-500", color)} stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" className={cn("text-pink-500", color)} stopColor="currentColor" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={`url(#gradient-${color})`}
        strokeWidth="2"
        points={points}
        className="drop-shadow-sm"
      />
      <polyline
        fill={`url(#gradient-${color})`}
        fillOpacity="0.1"
        stroke="none"
        points={`0,${height} ${points} ${width},${height}`}
      />
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="3"
        className={cn("fill-purple-500", color)}
        fillOpacity="0.8"
      >
        <animate
          attributeName="r"
          values="3;5;3"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

function MetricCard({ metric, index }: { metric: Metric; index: number }) {
  const getTrendIcon = () => {
    switch (metric.trend) {
      case "up":
        return <TrendingUp className="w-4 h-4" />;
      case "down":
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getTrendColor = () => {
    if (metric.trend === "neutral") return "text-gray-500";
    if (metric.trend === "up") {
      return metric.change > 0 ? "text-green-500" : "text-red-500";
    }
    return metric.change < 0 ? "text-red-500" : "text-green-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="group relative"
    >
      <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl blur-xl -z-10"
           style={{
             backgroundImage: `linear-gradient(135deg, ${metric.color.includes('purple') ? '#667eea' : metric.color.includes('blue') ? '#3b82f6' : metric.color.includes('green') ? '#10b981' : '#f59e0b'} 0%, ${metric.color.includes('pink') ? '#764ba2' : metric.color.includes('cyan') ? '#06b6d4' : metric.color.includes('emerald') ? '#059669' : '#f97316'} 100%)`
           }} />
      
      <div className="glassmorphism glassmorphism-hover rounded-xl p-6 h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-gradient-to-r", metric.color, "bg-opacity-20")}>
              {metric.icon}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">{metric.value}</h3>
                <div className={cn("flex items-center gap-1 text-sm", getTrendColor())}>
                  {getTrendIcon()}
                  <span>{Math.abs(metric.change)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <Sparkline data={metric.sparkline} color={metric.color} />
        </div>

        {metric.insight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="pt-3 border-t border-white/10"
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-purple-500 animate-pulse" />
              {metric.insight}
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export function HeroMetrics() {
  const { metrics: realtimeMetrics, loading, connected } = useRealtimeMetrics();
  const [displayMetrics, setDisplayMetrics] = useState(mockMetrics);

  useEffect(() => {
    if (realtimeMetrics) {
      // Update metrics with real-time data
      setDisplayMetrics(prev => [
        {
          ...prev[0],
          value: Math.round(realtimeMetrics.geoScore),
          change: 12.5, // Calculate from historical data
          trend: realtimeMetrics.geoScore > 80 ? "up" : "down",
        },
        {
          ...prev[1],
          value: `${Math.round((Object.keys(realtimeMetrics.platformScores).filter(p => realtimeMetrics.platformScores[p] > 0).length / 8) * 100)}%`,
          change: 8.3,
          trend: "up",
        },
        {
          ...prev[2],
          value: `${realtimeMetrics.shareOfVoice.toFixed(1)}%`,
          change: -2.1,
          trend: realtimeMetrics.shareOfVoice > 30 ? "up" : "down",
        },
        {
          ...prev[3],
          value: realtimeMetrics.citationCount || 23,
          change: 0,
          trend: "neutral",
        }
      ]);
    }
  }, [realtimeMetrics]);

  return (
    <div className="space-y-4">
      {connected && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Live data streaming</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayMetrics.map((metric, index) => (
          <MetricCard key={metric.id} metric={metric} index={index} />
        ))}
      </div>
    </div>
  );
}