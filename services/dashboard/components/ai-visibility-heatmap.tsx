"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Info, TrendingUp, TrendingDown, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface PlatformData {
  platform: string;
  logo: string;
  queries: string[];
  visibility: number[];
  avgPosition: number;
  trend: "up" | "down" | "neutral";
  status: "excellent" | "good" | "warning" | "critical";
}

const platforms: PlatformData[] = [
  {
    platform: "ChatGPT",
    logo: "🤖",
    queries: ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"],
    visibility: [95, 88, 92, 78, 85],
    avgPosition: 2.3,
    trend: "up",
    status: "excellent"
  },
  {
    platform: "Claude",
    logo: "🧠",
    queries: ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"],
    visibility: [92, 85, 88, 75, 82],
    avgPosition: 2.8,
    trend: "up",
    status: "excellent"
  },
  {
    platform: "Gemini",
    logo: "💎",
    queries: ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"],
    visibility: [88, 82, 85, 70, 78],
    avgPosition: 3.1,
    trend: "neutral",
    status: "good"
  },
  {
    platform: "Perplexity",
    logo: "🔍",
    queries: ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"],
    visibility: [85, 78, 82, 65, 75],
    avgPosition: 3.5,
    trend: "down",
    status: "good"
  },
  {
    platform: "Copilot",
    logo: "✈️",
    queries: ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"],
    visibility: [78, 72, 75, 58, 68],
    avgPosition: 4.2,
    trend: "down",
    status: "warning"
  },
  {
    platform: "You.com",
    logo: "🎯",
    queries: ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"],
    visibility: [65, 58, 62, 45, 55],
    avgPosition: 5.8,
    trend: "down",
    status: "warning"
  },
  {
    platform: "Phind",
    logo: "🔧",
    queries: ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"],
    visibility: [45, 38, 42, 25, 35],
    avgPosition: 7.2,
    trend: "neutral",
    status: "critical"
  },
  {
    platform: "Poe",
    logo: "📜",
    queries: ["Brand mentions", "Product reviews", "Industry analysis", "Competitor comparison", "Best solutions"],
    visibility: [40, 35, 38, 22, 30],
    avgPosition: 7.8,
    trend: "down",
    status: "critical"
  }
];

function getColorByValue(value: number): string {
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

export function AIVisibilityHeatmap() {
  const [selectedCell, setSelectedCell] = useState<{ platform: number; query: number } | null>(null);
  const [hoveredPlatform, setHoveredPlatform] = useState<number | null>(null);

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
          <p className="text-sm text-muted-foreground">Real-time presence across AI platforms</p>
        </div>
        <div className="flex items-center gap-4">
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

      <div className="overflow-x-auto custom-scrollbar">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-[200px_repeat(5,1fr)] gap-2 mb-2">
            <div />
            {platforms[0].queries.map((query, index) => (
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
                  {getStatusIcon(platform.status)}
                  {platform.trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
                  {platform.trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
                </div>
              </div>

              {/* Visibility Cells */}
              {platform.visibility.map((value, queryIndex) => (
                <motion.div
                  key={queryIndex}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "relative flex items-center justify-center h-12 rounded-lg border cursor-pointer transition-all",
                    getColorByValue(value),
                    selectedCell?.platform === platformIndex && selectedCell?.query === queryIndex &&
                    "ring-2 ring-purple-500 ring-offset-2 ring-offset-background"
                  )}
                  onClick={() => setSelectedCell({ platform: platformIndex, query: queryIndex })}
                >
                  <span className="text-sm font-medium">{value}%</span>
                  {hoveredPlatform === platformIndex && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 rounded-lg bg-white/5 pointer-events-none"
                    />
                  )}
                  {/* Live pulse indicator */}
                  {value >= 80 && (
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
      {selectedCell && (
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
                Average Position: {platforms[selectedCell.platform].avgPosition} • 
                Last updated: 2 minutes ago
              </p>
              <div className="mt-2">
                <p className="text-xs text-purple-400">
                  💡 Recommendation: Consider creating more targeted content for this query to improve visibility.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}