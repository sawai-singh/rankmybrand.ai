"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Bot,
  Users,
  FileText,
  Zap,
  RefreshCw
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

interface ActivityFeedProps {
  companyId?: string;
  limit?: number;
}

export function ActivityFeed({ companyId, limit = 50 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  // Fetch activities from API
  const fetchActivities = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
      
      const queryParams = new URLSearchParams();
      if (companyId) queryParams.append('companyId', companyId);
      queryParams.append('limit', limit.toString());
      if (filter !== 'all') queryParams.append('category', filter);
      
      const response = await fetch(`${apiUrl}/api/activities?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(transformActivities(data));
        setError(null);
      } else if (response.status === 404) {
        // No activities yet
        setActivities([]);
        setError(null);
      } else {
        throw new Error('Failed to fetch activities');
      }
    } catch (err) {
      console.error('Failed to fetch activities:', err);
      setError('Unable to load activities');
      // Don't show fake data - just show error or empty state
      setActivities([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Transform API data to ActivityItem format
  const transformActivities = (data: any[]): ActivityItem[] => {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => ({
      id: item.id || `activity-${Date.now()}-${Math.random()}`,
      type: item.type || 'info',
      category: item.category || 'system',
      title: item.title || item.message || 'Activity',
      description: item.description || item.details,
      timestamp: new Date(item.timestamp || item.created_at || Date.now()),
      icon: getIconForCategory(item.category)
    }));
  };

  // Get icon based on category
  const getIconForCategory = (category: string) => {
    switch (category) {
      case 'ai': return <Bot className="w-4 h-4" />;
      case 'competitor': return <Users className="w-4 h-4" />;
      case 'content': return <FileText className="w-4 h-4" />;
      case 'system': return <Zap className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
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
          console.log('Activity feed WebSocket connected');
          // Subscribe to activity updates
          ws?.send(JSON.stringify({ 
            type: 'subscribe', 
            channel: 'activities',
            companyId: companyId 
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'activity' && data.payload) {
              const newActivity = transformActivities([data.payload])[0];
              setActivities(prev => [newActivity, ...prev].slice(0, limit));
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
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
      } catch (err) {
        console.error('Failed to connect WebSocket:', err);
      }
    };

    // Initial fetch
    fetchActivities();
    
    // Connect WebSocket for real-time updates
    connectWebSocket();

    // Cleanup
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [companyId, filter, limit]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchActivities();
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "success": return "text-green-500 bg-green-500/10";
      case "warning": return "text-yellow-500 bg-yellow-500/10";
      case "error": return "text-red-500 bg-red-500/10";
      default: return "text-blue-500 bg-blue-500/10";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle className="w-4 h-4" />;
      case "warning": return <AlertCircle className="w-4 h-4" />;
      case "error": return <XCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="glassmorphism rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Activity Feed</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-700 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glassmorphism rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Activity Feed
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-1 text-sm"
          >
            <option value="all">All</option>
            <option value="ai">AI Updates</option>
            <option value="competitor">Competitors</option>
            <option value="content">Content</option>
            <option value="system">System</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg glassmorphism glassmorphism-hover"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No activities yet</p>
            <p className="text-sm mt-1">Activities will appear here as they happen</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-800/30 transition-colors"
              >
                <div className={cn("p-2 rounded-lg", getTypeStyles(activity.type))}>
                  {activity.icon || getTypeIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200">{activity.title}</p>
                  {activity.description && (
                    <p className="text-xs text-gray-400 mt-1">{activity.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {getRelativeTime(activity.timestamp)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}