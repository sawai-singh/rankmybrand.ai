"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Bot,
  Users,
  FileText,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getRelativeTime } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "success" | "warning" | "error" | "info";
  category: "ai" | "competitor" | "content" | "system";
  title: string;
  description?: string;
  timestamp: Date;
  icon?: React.ReactNode;
}

const activities: ActivityItem[] = [
  {
    id: "1",
    type: "success",
    category: "ai",
    title: "Improved visibility on ChatGPT",
    description: "Now ranking #2 for 'best tech solutions'",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    icon: <Bot className="w-4 h-4" />
  },
  {
    id: "2",
    type: "info",
    category: "content",
    title: "Blog post auto-published",
    description: "AI Comparison Guide went live",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    icon: <FileText className="w-4 h-4" />
  },
  {
    id: "3",
    type: "warning",
    category: "competitor",
    title: "TechCorp gained position",
    description: "They overtook you for 'enterprise solutions'",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    icon: <Users className="w-4 h-4" />
  },
  {
    id: "4",
    type: "success",
    category: "system",
    title: "5 recommendations executed",
    description: "All completed successfully",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: "5",
    type: "error",
    category: "ai",
    title: "Lost visibility on Perplexity",
    description: "Dropped from page 1 to page 2",
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    icon: <Bot className="w-4 h-4" />
  },
  {
    id: "6",
    type: "info",
    category: "content",
    title: "Content gap identified",
    description: "Missing coverage for 'pricing comparison'",
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    icon: <AlertCircle className="w-4 h-4" />
  },
  {
    id: "7",
    type: "success",
    category: "system",
    title: "GEO Score increased",
    description: "Up 5 points to 87",
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    icon: <TrendingUp className="w-4 h-4" />
  }
];

function getActivityColor(type: string) {
  switch (type) {
    case "success": return "text-green-500 bg-green-500/10";
    case "warning": return "text-yellow-500 bg-yellow-500/10";
    case "error": return "text-red-500 bg-red-500/10";
    case "info": return "text-blue-500 bg-blue-500/10";
    default: return "text-gray-500 bg-gray-500/10";
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case "success": return <CheckCircle className="w-4 h-4" />;
    case "warning": return <AlertCircle className="w-4 h-4" />;
    case "error": return <XCircle className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
}

export function ActivityFeed() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glassmorphism rounded-xl p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-purple-500" />
        <h2 className="text-xl font-bold">Activity Feed</h2>
        <span className="ml-auto text-xs text-muted-foreground">Live</span>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group"
          >
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
              <div className={cn("p-1.5 rounded-lg", getActivityColor(activity.type))}>
                {activity.icon || getActivityIcon(activity.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{activity.title}</p>
                {activity.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {mounted ? getRelativeTime(activity.timestamp) : "Loading..."}
                </p>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <button className="p-1 rounded hover:bg-white/10 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            </div>

            {index < activities.length - 1 && (
              <div className="ml-7 border-l border-white/10 h-3" />
            )}
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <button className="w-full py-2 rounded-lg glassmorphism glassmorphism-hover text-sm font-medium">
          View All Activity
        </button>
      </div>
    </motion.div>
  );
}

// Add missing import
import { ChevronRight } from "lucide-react";