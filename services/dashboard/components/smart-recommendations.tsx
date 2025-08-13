"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { 
  Zap, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  FileText, 
  Users, 
  CheckCircle,
  PlayCircle,
  AlertTriangle,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: "content" | "technical" | "social" | "competitor";
  priority: "high" | "medium" | "low";
  impact: number; // 0-100
  effort: "low" | "medium" | "high";
  timeToImplement: string;
  successProbability: number; // 0-100
  status: "pending" | "in-progress" | "completed";
  autoExecutable: boolean;
  preview?: string;
}

const recommendations: Recommendation[] = [
  {
    id: "1",
    title: "Create comparison page for top competitors",
    description: "AI analysis shows 78% of queries ask for comparisons. Creating this page will capture high-intent traffic.",
    type: "content",
    priority: "high",
    impact: 85,
    effort: "low",
    timeToImplement: "2 hours",
    successProbability: 92,
    status: "pending",
    autoExecutable: true,
    preview: "## TechCorp vs Your Brand: Complete Comparison Guide\n\nDiscover why leading companies choose..."
  },
  {
    id: "2",
    title: "Optimize meta descriptions for AI snippets",
    description: "Current descriptions are too long for AI platforms. Shortening to 155 chars will improve visibility.",
    type: "technical",
    priority: "high",
    impact: 72,
    effort: "low",
    timeToImplement: "30 mins",
    successProbability: 88,
    status: "pending",
    autoExecutable: true
  },
  {
    id: "3",
    title: "Respond to trending industry discussion",
    description: "Major discussion on Reddit about your product category. Quick response could gain 10K+ impressions.",
    type: "social",
    priority: "high",
    impact: 68,
    effort: "low",
    timeToImplement: "15 mins",
    successProbability: 75,
    status: "pending",
    autoExecutable: false
  },
  {
    id: "4",
    title: "Add structured data for product reviews",
    description: "Missing schema markup is hurting AI understanding. Adding review schema will improve citations.",
    type: "technical",
    priority: "medium",
    impact: 65,
    effort: "medium",
    timeToImplement: "3 hours",
    successProbability: 95,
    status: "in-progress",
    autoExecutable: true
  },
  {
    id: "5",
    title: "Create FAQ section for common queries",
    description: "Analysis shows 40+ repeated questions across AI platforms. FAQ page will capture this traffic.",
    type: "content",
    priority: "medium",
    impact: 58,
    effort: "medium",
    timeToImplement: "4 hours",
    successProbability: 82,
    status: "pending",
    autoExecutable: true
  }
];

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high": return "text-red-500 bg-red-500/10";
    case "medium": return "text-yellow-500 bg-yellow-500/10";
    case "low": return "text-green-500 bg-green-500/10";
    default: return "text-gray-500 bg-gray-500/10";
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "content": return <FileText className="w-4 h-4" />;
    case "technical": return <BarChart3 className="w-4 h-4" />;
    case "social": return <Users className="w-4 h-4" />;
    case "competitor": return <TrendingUp className="w-4 h-4" />;
    default: return <Zap className="w-4 h-4" />;
  }
}

function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [executing, setExecuting] = useState(false);

  const handleExecute = () => {
    setExecuting(true);
    setTimeout(() => {
      setExecuting(false);
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glassmorphism glassmorphism-hover rounded-xl p-4 mb-4"
    >
      <div className="flex items-start gap-4">
        <div className={cn("p-2 rounded-lg", getPriorityColor(rec.priority).replace("text-", "bg-").replace("/10", "/20"))}>
          {getTypeIcon(rec.type)}
        </div>
        
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-sm mb-1">{rec.title}</h3>
              <p className="text-xs text-muted-foreground">{rec.description}</p>
            </div>
            <span className={cn("text-xs px-2 py-1 rounded-full", getPriorityColor(rec.priority))}>
              {rec.priority}
            </span>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-4 mt-3 mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Impact</p>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${rec.impact}%` }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  />
                </div>
                <span className="text-xs font-medium">{rec.impact}%</span>
              </div>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground">Success</p>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${rec.successProbability}%` }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                  />
                </div>
                <span className="text-xs font-medium">{rec.successProbability}%</span>
              </div>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground">Effort</p>
              <p className="text-xs font-medium mt-1">{rec.effort}</p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="text-xs font-medium mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {rec.timeToImplement}
              </p>
            </div>
          </div>

          {/* Preview (if expanded) */}
          {expanded && rec.preview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 p-3 bg-white/5 rounded-lg"
            >
              <p className="text-xs font-mono text-muted-foreground">{rec.preview}</p>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            {rec.autoExecutable && (
              <button
                onClick={handleExecute}
                disabled={executing || rec.status === "completed"}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                  executing 
                    ? "bg-yellow-500/20 text-yellow-500" 
                    : rec.status === "completed"
                    ? "bg-green-500/20 text-green-500"
                    : "bg-purple-500/20 text-purple-500 hover:bg-purple-500/30"
                )}
              >
                {executing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    Executing...
                  </>
                ) : rec.status === "completed" ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Completed
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-3 h-3" />
                    Execute Now
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 transition-all flex items-center gap-1"
            >
              {expanded ? "Hide" : "Preview"}
              <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
            </button>

            {rec.status === "in-progress" && (
              <span className="px-2 py-1 rounded-lg text-xs bg-blue-500/20 text-blue-500 flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                In Progress
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function SmartRecommendations() {
  const [filter, setFilter] = useState<"all" | "high" | "auto">("all");
  
  const filteredRecs = recommendations.filter(rec => {
    if (filter === "high") return rec.priority === "high";
    if (filter === "auto") return rec.autoExecutable;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glassmorphism rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-bold">Smart Recommendations</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs transition-all",
              filter === "all" ? "bg-purple-500/20 text-purple-500" : "glassmorphism glassmorphism-hover"
            )}
          >
            All ({recommendations.length})
          </button>
          <button
            onClick={() => setFilter("high")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs transition-all",
              filter === "high" ? "bg-red-500/20 text-red-500" : "glassmorphism glassmorphism-hover"
            )}
          >
            High Priority
          </button>
          <button
            onClick={() => setFilter("auto")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs transition-all",
              filter === "auto" ? "bg-green-500/20 text-green-500" : "glassmorphism glassmorphism-hover"
            )}
          >
            Auto-Executable
          </button>
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
        {filteredRecs.map((rec, index) => (
          <RecommendationCard key={rec.id} rec={rec} index={index} />
        ))}
      </div>
    </motion.div>
  );
}