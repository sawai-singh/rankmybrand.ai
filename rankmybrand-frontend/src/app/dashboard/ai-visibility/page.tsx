'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useQuery, useMutation, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Zap,
  Globe,
  BarChart3,
  LineChart,
  Activity,
  Target,
  Sparkles,
  Eye,
  Search,
  Bot,
  Trophy,
  Shield,
  Users,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

// Dynamic imports for heavy components
const VisibilityRadar = dynamic(() => import('./components/VisibilityRadar'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg" />,
  ssr: false
});

const CompetitiveLandscape = dynamic(() => import('./components/CompetitiveLandscape'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg" />,
  ssr: false
});

const QueryPerformance = dynamic(() => import('./components/QueryPerformance'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg" />,
  ssr: false
});

const ResponseAnalysisTable = dynamic(() => import('./components/ResponseAnalysisTable'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg" />,
  ssr: false
});

const InsightsFeed = dynamic(() => import('./components/InsightsFeed'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg" />,
  ssr: false
});

interface AuditData {
  id: string;
  status: string;
  overallScore: number;
  brandMentionRate: number;
  competitivePosition: number;
  scores: {
    visibility: number;
    sentiment: number;
    recommendation: number;
    seo: number;
  };
  insights: Array<{
    type: string;
    message: string;
    importance: 'high' | 'medium' | 'low';
  }>;
  competitors: Array<{
    name: string;
    mentionCount: number;
    sentiment: number;
  }>;
}

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AIVisibilityDashboardContent() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState(0);
  const [isAuditRunning, setIsAuditRunning] = useState(false);
  
  // WebSocket connection for real-time updates
  const { messages, sendMessage, connectionStatus } = useWebSocket(
    process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws'
  );

  // Fetch current audit data
  const { data: auditData, isLoading, refetch } = useQuery<AuditData>({
    queryKey: ['ai-visibility-audit', 'current'],
    queryFn: async () => {
      const response = await api.get('/audit/current');
      return response.data;
    },
    refetchInterval: isAuditRunning ? 5000 : false,
  });

  // Start new audit mutation
  const startAuditMutation = useMutation({
    mutationFn: async () => {
      return api.post('/audit/start');
    },
    onSuccess: () => {
      setIsAuditRunning(true);
      refetch();
    },
  });

  // Process WebSocket messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      switch (lastMessage.event) {
        case 'audit.progress':
          setAuditProgress(lastMessage.data.percentage);
          break;
        case 'audit.completed':
          setIsAuditRunning(false);
          refetch();
          break;
        case 'insight.discovered':
          // Handle real-time insights
          break;
      }
    }
  }, [messages, refetch]);

  // Animated score display
  const AnimatedScore = ({ value, label, icon: Icon, color }: any) => {
    const [displayValue, setDisplayValue] = useState(0);
    
    useEffect(() => {
      const timer = setTimeout(() => {
        setDisplayValue(value);
      }, 100);
      return () => clearTimeout(timer);
    }, [value]);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden"
      >
        <Card className="p-6 border-2 hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition-opacity"
               style={{ backgroundImage: `linear-gradient(135deg, ${color}33 0%, ${color}11 100%)` }} />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br`}
                     style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <span className="text-sm font-medium text-gray-600">{label}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {value > 75 ? 'Excellent' : value > 50 ? 'Good' : value > 25 ? 'Fair' : 'Poor'}
              </Badge>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <motion.span 
                  className="text-3xl font-bold"
                  animate={{ 
                    opacity: [0.5, 1],
                    scale: [0.95, 1],
                  }}
                  transition={{ duration: 0.3 }}
                  key={displayValue}
                >
                  {displayValue}
                </motion.span>
                <span className="text-lg text-gray-500 mb-1">/ 100</span>
              </div>
              
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${color}88 0%, ${color} 100%)` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${displayValue}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {value > 50 ? (
                  <ArrowUp className="w-3 h-3 text-green-500" />
                ) : value === 50 ? (
                  <Minus className="w-3 h-3 text-gray-400" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-red-500" />
                )}
                <span>{value > 50 ? '+' : ''}{(value - 50).toFixed(1)}% vs industry avg</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  // Platform status indicators
  const PlatformStatus = ({ platform, status, responseTime }: any) => {
    const statusColors = {
      online: 'bg-green-500',
      slow: 'bg-yellow-500',
      offline: 'bg-red-500'
    };

    const platformIcons = {
      openai: '🤖',
      anthropic: '🧠',
      google: '🔍',
      perplexity: '🌐'
    };

    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center justify-between p-3 bg-white rounded-lg border cursor-pointer hover:shadow-md transition-all"
        onClick={() => setSelectedProvider(platform)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{platformIcons[platform]}</span>
          <div>
            <p className="font-medium capitalize">{platform}</p>
            <p className="text-xs text-gray-500">{responseTime}ms avg</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[status]} animate-pulse`} />
          <span className="text-xs text-gray-500 capitalize">{status}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-b sticky top-0 z-50 backdrop-blur-lg bg-white/90"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  AI Visibility Intelligence
                </h1>
                <p className="text-sm text-gray-500">Real-time brand presence across AI platforms</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant={connectionStatus === 'connected' ? 'default' : 'secondary'}>
                <Activity className="w-3 h-3 mr-1" />
                {connectionStatus}
              </Badge>
              
              <Button
                onClick={() => startAuditMutation.mutate()}
                disabled={isAuditRunning}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isAuditRunning ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Audit Running...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Start New Audit
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <AnimatePresence>
            {isAuditRunning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <div className="flex items-center gap-4">
                  <Progress value={auditProgress} className="flex-1" />
                  <span className="text-sm font-medium">{auditProgress.toFixed(1)}%</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <AnimatedScore
            value={auditData?.overallScore || 0}
            label="Overall Visibility"
            icon={Eye}
            color="#8B5CF6"
          />
          <AnimatedScore
            value={auditData?.scores?.sentiment || 0}
            label="Sentiment Score"
            icon={TrendingUp}
            color="#EC4899"
          />
          <AnimatedScore
            value={auditData?.scores?.recommendation || 0}
            label="Recommendation Rate"
            icon={Trophy}
            color="#10B981"
          />
          <AnimatedScore
            value={auditData?.scores?.seo || 0}
            label="SEO Optimization"
            icon={Search}
            color="#3B82F6"
          />
        </div>

        {/* Platform Status */}
        <Card className="p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Platform Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <PlatformStatus platform="openai" status="online" responseTime={234} />
            <PlatformStatus platform="anthropic" status="online" responseTime={189} />
            <PlatformStatus platform="google" status="slow" responseTime={567} />
            <PlatformStatus platform="perplexity" status="online" responseTime={345} />
          </div>
        </Card>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="queries">Queries</TabsTrigger>
            <TabsTrigger value="responses">Responses</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="competitive">Competitive</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VisibilityRadar data={auditData} />
              <CompetitiveLandscape competitors={auditData?.competitors} />
            </div>
          </TabsContent>

          <TabsContent value="queries" className="space-y-6">
            <QueryPerformance auditId={auditData?.id} />
          </TabsContent>

          <TabsContent value="responses" className="space-y-6">
            <ResponseAnalysisTable auditId={auditData?.id} />
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <InsightsFeed insights={auditData?.insights} />
          </TabsContent>

          <TabsContent value="competitive" className="space-y-6">
            <CompetitiveLandscape 
              competitors={auditData?.competitors} 
              detailed={true} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Export wrapped component
export default function AIVisibilityDashboard() {
  return (
    <QueryClientProvider client={queryClient}>
      <AIVisibilityDashboardContent />
    </QueryClientProvider>
  );
}