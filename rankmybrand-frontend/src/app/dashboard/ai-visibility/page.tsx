'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMutation, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuditData } from '@/hooks/useAuditData';
import DashboardView from '@/components/dashboard/DashboardView';

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
  const searchParams = useSearchParams();
  const [auditProgress, setAuditProgress] = useState(0);
  const [isAuditRunning, setIsAuditRunning] = useState(false);

  // Check if we have a token in URL (for shareable links)
  const urlToken = searchParams.get('token');
  const authMode = urlToken ? 'token' : 'jwt';

  // WebSocket connection for real-time updates (optional - polling used as fallback)
  const enableWebSocket = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === 'true';
  const { messages, connectionStatus } = useWebSocket(
    enableWebSocket ? (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws') : '',
    {
      maxReconnectAttempts: 3, // Reduce reconnection spam
      reconnectInterval: 10000, // Wait 10s between reconnects
    }
  );

  // Fetch current audit data using our dual-auth hook
  const { data: auditData, isLoading, refetch } = useAuditData({
    authMode,
    token: urlToken || undefined,
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

  return (
    <DashboardView
      auditData={auditData || null}
      isLoading={isLoading}
      connectionStatus={connectionStatus}
      onStartAudit={() => startAuditMutation.mutate()}
      isAuditRunning={isAuditRunning}
      auditProgress={auditProgress}
      showHeader={true}
      showStartAuditButton={true}
    />
  );
}

// Export wrapped component
export default function AIVisibilityDashboard() {
  return (
    <QueryClientProvider client={queryClient}>
      <React.Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      }>
        <AIVisibilityDashboardContent />
      </React.Suspense>
    </QueryClientProvider>
  );
}