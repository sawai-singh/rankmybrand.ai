"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Zap,
  Activity,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProviderStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  health_score: number;
  performance: {
    avg_response_time: string;
    success_rate: string;
    errors: number;
  };
  configuration: {
    priority: number;
    weight: number;
  };
  last_check: string;
}

interface SystemStatus {
  operational: boolean;
  providers: ProviderStatus[];
  alert?: string;
  recommendation?: string;
}

export function ApiStatusIndicator() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch LLM provider status
  const fetchStatus = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/intelligence/llm/status`);
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch API status:', error);
      // Set a fallback status
      setStatus({
        operational: false,
        providers: [],
        alert: "Unable to fetch API status",
        recommendation: "Check network connection"
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Refresh status
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStatus();
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational": return "text-green-500";
      case "degraded": return "text-yellow-500";
      case "down": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "degraded": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "down": return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get overall system health
  const getSystemHealth = () => {
    if (!status || !status.providers || status.providers.length === 0) return 0;
    
    const operational = status.providers.filter(p => p.status === "operational").length;
    return (operational / status.providers.length) * 100;
  };

  // Get provider logo
  const getProviderLogo = (name: string) => {
    const logos: { [key: string]: string } = {
      "openai": "🤖",
      "anthropic": "🧠", 
      "gemini": "💎",
      "perplexity": "🔍",
      "cohere": "🌊",
      "huggingface": "🤗"
    };
    return logos[name.toLowerCase()] || "🔮";
  };

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="glassmorphism rounded-lg p-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-400">Checking API status...</span>
        </div>
      </div>
    );
  }

  const systemHealth = getSystemHealth();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="glassmorphism rounded-xl p-4 mb-2 w-96 max-h-[500px] overflow-y-auto custom-scrollbar"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-500" />
                AI Provider Status
              </h3>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1 rounded glassmorphism glassmorphism-hover"
              >
                <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
              </button>
            </div>

            {/* System Health Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400">System Health</span>
                <span className="font-medium">{systemHealth.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${systemHealth}%` }}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    "h-full",
                    systemHealth >= 75 ? "bg-green-500" :
                    systemHealth >= 50 ? "bg-yellow-500" :
                    systemHealth >= 25 ? "bg-orange-500" :
                    "bg-red-500"
                  )}
                />
              </div>
            </div>

            {/* Alert Message */}
            {status?.alert && (
              <div className={cn(
                "p-2 rounded-lg text-xs mb-3",
                status.alert.includes("CRITICAL") ? "bg-red-500/10 text-red-400" :
                status.alert.includes("WARNING") ? "bg-yellow-500/10 text-yellow-400" :
                "bg-green-500/10 text-green-400"
              )}>
                <p className="font-medium">{status.alert}</p>
                {status.recommendation && (
                  <p className="mt-1 opacity-80">{status.recommendation}</p>
                )}
              </div>
            )}

            {/* Provider List */}
            <div className="space-y-2">
              {status?.providers.map((provider, index) => (
                <motion.div
                  key={provider.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glassmorphism rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getProviderLogo(provider.name)}</span>
                      <span className="text-sm font-medium capitalize">{provider.name}</span>
                    </div>
                    {getStatusIcon(provider.status)}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Response</p>
                      <p className="font-medium">{provider.performance.avg_response_time}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Success</p>
                      <p className="font-medium">{provider.performance.success_rate}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Priority</p>
                      <p className="font-medium">#{provider.configuration.priority}</p>
                    </div>
                  </div>

                  {/* Health Score Bar */}
                  <div className="mt-2">
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          provider.health_score >= 0.8 ? "bg-green-500" :
                          provider.health_score >= 0.5 ? "bg-yellow-500" :
                          "bg-red-500"
                        )}
                        style={{ width: `${provider.health_score * 100}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Last Update */}
            <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
              <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
              <Info className="w-3 h-3" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Status Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "glassmorphism rounded-lg p-3 flex items-center gap-2 transition-all",
          "hover:bg-white/10"
        )}
      >
        <div className="relative">
          <Activity className="w-4 h-4" />
          <div className={cn(
            "absolute -top-1 -right-1 w-2 h-2 rounded-full",
            systemHealth >= 75 ? "bg-green-500" :
            systemHealth >= 50 ? "bg-yellow-500" :
            systemHealth >= 25 ? "bg-orange-500" :
            "bg-red-500",
            "animate-pulse"
          )} />
        </div>
        
        <div className="text-left">
          <p className="text-xs font-medium">AI Status</p>
          <p className={cn(
            "text-xs",
            systemHealth >= 75 ? "text-green-500" :
            systemHealth >= 50 ? "text-yellow-500" :
            systemHealth >= 25 ? "text-orange-500" :
            "text-red-500"
          )}>
            {systemHealth >= 75 ? "Operational" :
             systemHealth >= 50 ? "Degraded" :
             systemHealth >= 25 ? "Limited" :
             "Critical"}
          </p>
        </div>
        
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>
    </div>
  );
}