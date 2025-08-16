"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
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
  Sparkles,
  RefreshCw,
  Loader2,
  AlertCircle
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

interface SmartRecommendationsProps {
  companyId?: string;
  limit?: number;
}

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

function RecommendationCard({ rec, index, onExecute }: { rec: Recommendation; index: number; onExecute: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    await onExecute(rec.id);
    setExecuting(false);
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

export function SmartRecommendations({ companyId, limit = 20 }: SmartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "high" | "auto">("all");

  // Fetch recommendations from API
  const fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
      
      const queryParams = new URLSearchParams();
      if (companyId) queryParams.append('companyId', companyId);
      queryParams.append('limit', limit.toString());
      
      const response = await fetch(`${apiUrl}/api/recommendations?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(transformRecommendations(data));
        setError(null);
      } else if (response.status === 404) {
        // No recommendations yet
        setRecommendations([]);
        setError(null);
      } else {
        throw new Error('Failed to fetch recommendations');
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      setError('Unable to load recommendations');
      // Show empty state instead of fake data
      setRecommendations([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Transform API data to Recommendation format
  const transformRecommendations = (data: any[]): Recommendation[] => {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => ({
      id: item.id || `rec-${Date.now()}-${Math.random()}`,
      title: item.title || item.name || 'Recommendation',
      description: item.description || item.detail || '',
      type: item.type || 'content',
      priority: item.priority || 'medium',
      impact: item.impact || item.score || 0,
      effort: item.effort || 'medium',
      timeToImplement: item.timeToImplement || item.estimatedTime || 'Unknown',
      successProbability: item.successProbability || item.confidence || 0,
      status: item.status || 'pending',
      autoExecutable: item.autoExecutable || false,
      preview: item.preview || item.example
    }));
  };

  // Execute recommendation
  const executeRecommendation = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
      
      const response = await fetch(`${apiUrl}/api/recommendations/${id}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update recommendation status
        setRecommendations(prev => 
          prev.map(rec => 
            rec.id === id 
              ? { ...rec, status: 'in-progress' as const }
              : rec
          )
        );
        
        // Refresh after a delay to get updated status
        setTimeout(() => fetchRecommendations(), 3000);
      }
    } catch (err) {
      console.error('Failed to execute recommendation:', err);
    }
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
          console.log('Recommendations WebSocket connected');
          // Subscribe to recommendation updates
          ws?.send(JSON.stringify({ 
            type: 'subscribe', 
            channel: 'recommendations',
            companyId: companyId 
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'recommendation_update' && data.payload) {
              // Update or add new recommendation
              const newRec = transformRecommendations([data.payload])[0];
              setRecommendations(prev => {
                const existing = prev.findIndex(r => r.id === newRec.id);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = newRec;
                  return updated;
                }
                return [newRec, ...prev].slice(0, limit);
              });
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
    fetchRecommendations();
    
    // Connect WebSocket for real-time updates
    connectWebSocket();

    // Cleanup
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [companyId, limit]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRecommendations();
  };

  const filteredRecs = recommendations.filter(rec => {
    if (filter === "high") return rec.priority === "high";
    if (filter === "auto") return rec.autoExecutable;
    return true;
  });

  if (loading) {
    return (
      <div className="glassmorphism rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-bold">Smart Recommendations</h2>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="glassmorphism rounded-xl p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg glassmorphism glassmorphism-hover"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </button>
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

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
        {filteredRecs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No recommendations available</p>
            <p className="text-sm mt-1">
              {filter !== "all" 
                ? "Try changing your filter or run an analysis"
                : "Run an analysis to generate recommendations"}
            </p>
          </div>
        ) : (
          filteredRecs.map((rec, index) => (
            <RecommendationCard 
              key={rec.id} 
              rec={rec} 
              index={index} 
              onExecute={executeRecommendation}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}