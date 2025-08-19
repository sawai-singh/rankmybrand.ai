'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  TrendingUp,
  Users,
  Zap,
  Database,
  Server,
  Brain,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AIVisibilityMetrics {
  totalAudits: number;
  totalQueries: number;
  llmCalls: {
    openai: number;
    anthropic: number;
    google: number;
    perplexity: number;
  };
  costUsd: number;
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  averageAuditTime: number;
  errorRate: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, any>;
  metrics: Record<string, number>;
}

interface QueueStatus {
  size: number;
  processing: number;
  completedToday: number;
  failedToday: number;
  avgProcessingTime: number;
}

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AdminDashboardContent() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch AI Visibility metrics
  const { data: aiMetrics, refetch: refetchMetrics } = useQuery<AIVisibilityMetrics>({
    queryKey: ['ai-visibility-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/ai-visibility/metrics');
      return res.json();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Fetch system health
  const { data: systemHealth } = useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await fetch('/health/ai-visibility');
      return res.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch queue status
  const { data: queueStatus } = useQuery<QueueStatus>({
    queryKey: ['queue-status'],
    queryFn: async () => {
      const res = await fetch('/health/ai-visibility/queue');
      return res.json();
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch LLM providers health
  const { data: providersHealth } = useQuery({
    queryKey: ['llm-providers-health'],
    queryFn: async () => {
      const res = await fetch('/health/llm-providers');
      return res.json();
    },
    refetchInterval: autoRefresh ? 15000 : false,
  });

  // Prepare chart data
  const llmUsageData = aiMetrics ? Object.entries(aiMetrics.llmCalls).map(([provider, calls]) => ({
    provider: provider.charAt(0).toUpperCase() + provider.slice(1),
    calls,
    cost: provider === 'openai' ? calls * 0.05 : 
          provider === 'anthropic' ? calls * 0.03 : 
          provider === 'google' ? calls * 0.01 : 
          calls * 0.02
  })) : [];

  const costTrendData = [
    { time: '00:00', cost: 12.5 },
    { time: '04:00', cost: 18.3 },
    { time: '08:00', cost: 35.7 },
    { time: '12:00', cost: 52.4 },
    { time: '16:00', cost: 68.9 },
    { time: '20:00', cost: aiMetrics?.costUsd || 0 },
  ];

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" />Degraded</Badge>;
      default:
        return <Badge className="bg-red-500"><AlertCircle className="w-3 h-3 mr-1" />Unhealthy</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">AI Visibility System Monitoring</p>
          </div>
          <div className="flex gap-4">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            <Button onClick={() => refetchMetrics()}>
              Refresh Now
            </Button>
          </div>
        </div>

        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${aiMetrics?.costUsd.toFixed(2) || '0.00'}</div>
              <Progress value={(aiMetrics?.costUsd || 0) / 100 * 100} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                ${(100 - (aiMetrics?.costUsd || 0)).toFixed(2)} remaining
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiMetrics?.totalAudits || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Avg time: {aiMetrics?.averageAuditTime || 0}s
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiMetrics?.cacheStats.hitRate.toFixed(1) || 0}%</div>
              <p className="text-xs text-muted-foreground mt-2">
                {aiMetrics?.cacheStats.hits || 0} hits / {aiMetrics?.cacheStats.misses || 0} misses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{queueStatus?.size || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {queueStatus?.processing || 0} processing
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="ai-visibility" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ai-visibility">AI Visibility</TabsTrigger>
            <TabsTrigger value="llm-providers">LLM Providers</TabsTrigger>
            <TabsTrigger value="system-health">System Health</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-visibility" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LLM Usage Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>LLM Provider Usage</CardTitle>
                  <CardDescription>API calls by provider today</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={llmUsageData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="provider" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="calls" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Cost Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Cost Trend</CardTitle>
                  <CardDescription>Cumulative cost throughout the day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={costTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip formatter={(value) => `$${value}`} />
                      <Line type="monotone" dataKey="cost" stroke="#82ca9d" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Queue Analytics */}
            <Card>
              <CardHeader>
                <CardTitle>Queue Analytics</CardTitle>
                <CardDescription>Job processing statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Queue Size</p>
                    <p className="text-2xl font-bold">{queueStatus?.size || 0}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Processing</p>
                    <p className="text-2xl font-bold">{queueStatus?.processing || 0}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Completed Today</p>
                    <p className="text-2xl font-bold text-green-600">{queueStatus?.completedToday || 0}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Failed Today</p>
                    <p className="text-2xl font-bold text-red-600">{queueStatus?.failedToday || 0}</p>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm text-muted-foreground">
                    Average processing time: {queueStatus?.avgProcessingTime || 0}s
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Audits Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Audits</CardTitle>
                <CardDescription>Latest AI visibility audit jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* This would be populated with real audit data */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium">TechCorp Analysis</p>
                        <p className="text-sm text-muted-foreground">50 queries • 4 LLMs • Completed in 87s</p>
                      </div>
                    </div>
                    <Badge>Completed</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Clock className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="font-medium">StartupXYZ Audit</p>
                        <p className="text-sm text-muted-foreground">40 queries • 4 LLMs • Processing...</p>
                      </div>
                    </div>
                    <Badge className="bg-yellow-500">Processing</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="llm-providers" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {providersHealth?.providers && Object.entries(providersHealth.providers).map(([provider, health]: [string, any]) => (
                <Card key={provider}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{provider.toUpperCase()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {getHealthBadge(health.status)}
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Latency</span>
                        <span>{health.avgLatency || 0}ms</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Success Rate</span>
                        <span>{health.successRate || 0}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Calls Today</span>
                        <span>{providersHealth.usage[provider.toLowerCase()] || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="system-health" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Service Health Status</CardTitle>
                <CardDescription>All microservices and dependencies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemHealth?.services && Object.entries(systemHealth.services).map(([service, health]: [string, any]) => (
                    <div key={service} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Server className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium capitalize">{service}</p>
                          <p className="text-sm text-muted-foreground">
                            Response time: {health.responseTime || 'N/A'}ms
                          </p>
                        </div>
                      </div>
                      {getHealthBadge(health.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Active users and their activity</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">User management interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="companies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Company Journey Tracking</CardTitle>
                <CardDescription>Track company onboarding and analysis journey</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Company journey interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Export the wrapped component
export default function AdminDashboard() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminDashboardContent />
    </QueryClientProvider>
  );
}