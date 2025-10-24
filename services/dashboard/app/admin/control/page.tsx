'use client';

/**
 * System Control Center - Comprehensive Admin Dashboard
 * Real-time monitoring, management, and emergency controls
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  Database,
  Server,
  HardDrive,
  Cpu,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  PlayCircle,
  StopCircle,
  FileText,
  Terminal,
  Power,
  ShieldAlert,
  TrendingUp,
  Clock,
  Settings,
  AlertCircle,
  RotateCw,
  Info,
  DollarSign,
  TrendingDown,
  Shield,
  Save,
  ArrowLeft
} from 'lucide-react';

const API_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';

// ========================================
// Types
// ========================================

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface SystemHealth {
  timestamp: string;
  services: {
    database?: {
      status: string;
      latency_ms: number;
      connections?: any;
    };
    redis?: {
      status: string;
      latency_ms: number;
      memory_used?: string;
    };
    intelligence_engine?: {
      status: string;
      url: string;
    };
    api_gateway?: {
      status: string;
      pid?: number;
      memory_rss_mb?: number;
      memory_vsz_mb?: number;
    };
  };
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

interface CacheStats {
  total_connections: number;
  total_commands: number;
  memory_used: string;
  memory_max: string;
}

interface PerformanceMetrics {
  avg_completion_time_seconds: number;
  completed_last_24h: number;
  processing_rate_per_hour: number;
}

interface ActiveAudit {
  id: string;
  company_name: string;
  status: string;
  current_phase: string;
  phase_progress: number;
  responses_collected: number;
  response_count_limit: number;
  running_time_seconds: number;
  phase_running_time: number;
}

interface LogLine {
  timestamp: string;
  level: string;
  message: string;
}

interface FeatureFlag {
  name: string;
  key: string;
  enabled: boolean;
  description: string;
  impact: {
    type: "cost" | "performance" | "quality";
    value: string;
    icon: any;
    color: string;
  };
  requiresRestart: boolean;
  category: string;
}

interface InfiniteLoop {
  audit_id: string;
  company_name: string;
  status: string;
  current_phase: string;
  reprocess_count: number;
  last_reprocess_at: string;
  first_reprocess_at: string;
  duration_minutes: number;
  severity: 'warning' | 'critical';
  is_infinite_loop: boolean;
  avg_reprocess_interval_minutes: number;
}

interface StuckAudit {
  audit_id: string;
  company_name: string;
  status: string;
  current_phase: string;
  reprocess_count: number;
  responses_collected: number;
  dashboard_exists: boolean;
  should_auto_fix: boolean;
  risk_level: 'high' | 'medium';
  running_minutes: number;
}

interface ReprocessHistoryEntry {
  id: number;
  audit_id: string;
  company_name: string;
  reprocess_attempt: number;
  reason: string;
  triggered_by: string;
  status_before: string;
  phase_before: string;
  status_after: string;
  phase_after: string;
  admin_user: string;
  notes: string;
  created_at: string;
  current_status: string;
  current_phase: string;
}

// ========================================
// Main Component
// ========================================

export default function SystemControlCenter() {
  // URL params
  const searchParams = useSearchParams();

  // State
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'health' | 'queue' | 'cache' | 'logs' | 'audits' | 'performance' | 'settings' | 'emergency' | 'loop-detection'>(() => {
    const tab = searchParams.get('tab');
    if (tab && ['health', 'queue', 'cache', 'logs', 'audits', 'performance', 'settings', 'emergency', 'loop-detection'].includes(tab)) {
      return tab as any;
    }
    return 'health';
  });

  // System Health State
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Queue State
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // Cache State
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cachePattern, setCachePattern] = useState('*');

  // Logs State
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logService, setLogService] = useState<'intelligence-engine' | 'api-gateway'>('intelligence-engine');
  const [logLevel, setLogLevel] = useState<string>('');
  const [logLines, setLogLines] = useState(100);

  // Active Audits State
  const [activeAudits, setActiveAudits] = useState<ActiveAudit[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);

  // Performance State
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  // Maintenance Mode State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  // Feature Flags State
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  // Loop Detection State
  const [loopDetection, setLoopDetection] = useState<InfiniteLoop[]>([]);
  const [stuckCandidates, setStuckCandidates] = useState<StuckAudit[]>([]);
  const [reprocessHistory, setReprocessHistory] = useState<ReprocessHistoryEntry[]>([]);
  const [loopLoading, setLoopLoading] = useState(false);
  const [historyHours, setHistoryHours] = useState(24);

  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  // ========================================
  // Utility Functions
  // ========================================

  const showToast = (type: ToastMessage['type'], message: string, details?: string) => {
    const id = Date.now().toString();
    const toast: ToastMessage = { id, type, message, details };
    setToasts(prev => [...prev, toast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);
      return response;
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  };

  // ========================================
  // Data Fetching Functions
  // ========================================

  const fetchSystemHealth = async () => {
    setHealthLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/health/detailed`);
      if (response.ok) {
        const data = await response.json();
        setSystemHealth(data);
      } else {
        showToast('error', 'Failed to fetch system health', `Status: ${response.status}`);
        // Mark API Gateway as down since it responded with error
        setSystemHealth(prev => prev ? {
          ...prev,
          services: {
            ...prev.services,
            api_gateway: { status: 'unhealthy' }
          }
        } : null);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch system health', error.message);
      // API Gateway is completely unreachable
      setSystemHealth(prev => prev ? {
        ...prev,
        services: {
          ...prev.services,
          api_gateway: { status: 'down' }
        }
      } : null);
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchQueueStats = async () => {
    setQueueLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/queue/stats`);
      if (response.ok) {
        const data = await response.json();
        setQueueStats(data.queue);
      } else {
        showToast('error', 'Failed to fetch queue stats', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch queue stats', error.message);
    } finally {
      setQueueLoading(false);
    }
  };

  const fetchCacheStats = async () => {
    setCacheLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/cache/stats`);
      if (response.ok) {
        const data = await response.json();
        setCacheStats(data.stats);
      } else {
        showToast('error', 'Failed to fetch cache stats', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch cache stats', error.message);
    } finally {
      setCacheLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({
        lines: logLines.toString(),
        service: logService,
        ...(logLevel && { level: logLevel })
      });

      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/logs/recent?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        showToast('error', 'Failed to fetch logs', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch logs', error.message);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchActiveAudits = async () => {
    setAuditsLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/audits/active`);
      if (response.ok) {
        const data = await response.json();
        setActiveAudits(data.active_audits || []);
      } else {
        showToast('error', 'Failed to fetch active audits', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch active audits', error.message);
    } finally {
      setAuditsLoading(false);
    }
  };

  const fetchPerformanceMetrics = async () => {
    setPerfLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/metrics/performance`);
      if (response.ok) {
        const data = await response.json();
        setPerformanceMetrics(data.metrics);
      } else {
        showToast('error', 'Failed to fetch performance metrics', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch performance metrics', error.message);
    } finally {
      setPerfLoading(false);
    }
  };

  const fetchMaintenanceStatus = async () => {
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/maintenance/status`);
      if (response.ok) {
        const data = await response.json();
        setMaintenanceMode(data.maintenance_mode);
        setMaintenanceMessage(data.message);
      }
    } catch (error: any) {
      console.error('Failed to fetch maintenance status:', error);
    }
  };

  const fetchFeatureFlags = async () => {
    setFlagsLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/feature-flags`);
      if (response.ok) {
        const data = await response.json();
        setFlags(data.flags || []);
      } else {
        showToast('error', 'Failed to fetch feature flags', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch feature flags', error.message);
    } finally {
      setFlagsLoading(false);
    }
  };

  const fetchLoopDetection = async () => {
    setLoopLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/audits/infinite-loop-detection`);
      if (response.ok) {
        const data = await response.json();
        setLoopDetection(data.potential_loops || []);
      } else {
        showToast('error', 'Failed to fetch loop detection', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch loop detection', error.message);
    } finally {
      setLoopLoading(false);
    }
  };

  const fetchStuckCandidates = async () => {
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/audits/stuck-candidates`);
      if (response.ok) {
        const data = await response.json();
        setStuckCandidates(data.stuck_candidates || []);
      } else {
        showToast('error', 'Failed to fetch stuck candidates', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch stuck candidates', error.message);
    }
  };

  const fetchReprocessHistory = async () => {
    try {
      const response = await fetchWithTimeout(`${API_GATEWAY}/api/admin/control/system/audits/reprocess-history?hours=${historyHours}`);
      if (response.ok) {
        const data = await response.json();
        setReprocessHistory(data.reprocess_history || []);
      } else {
        showToast('error', 'Failed to fetch reprocess history', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fetch reprocess history', error.message);
    }
  };

  const fetchAllLoopData = async () => {
    setLoopLoading(true);
    await Promise.all([
      fetchLoopDetection(),
      fetchStuckCandidates(),
      fetchReprocessHistory()
    ]);
    setLoopLoading(false);
  };

  // ========================================
  // Action Functions
  // ========================================

  const toggleFlag = async (flagKey: string) => {
    const flag = flags.find(f => f.key === flagKey);
    if (!flag) return;

    const oldValue = flag.enabled;
    const newValue = !oldValue;

    // Optimistic UI update
    setFlags(flags.map(f =>
      f.key === flagKey ? { ...f, enabled: newValue } : f
    ));

    setSaving(true);
    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/feature-flags/${flagKey}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: newValue })
        }
      );

      if (response.ok) {
        showToast('success', `Feature flag ${flag.name} ${newValue ? 'enabled' : 'disabled'}`);
        if (flag.requiresRestart) {
          setRestartRequired(true);
        }
      } else {
        // Rollback on error
        setFlags(flags.map(f =>
          f.key === flagKey ? { ...f, enabled: oldValue } : f
        ));
        const errorData = await response.json().catch(() => ({}));
        showToast('error', 'Failed to update feature flag', errorData.error || `Status: ${response.status}`);
      }
    } catch (error: any) {
      // Rollback on error
      setFlags(flags.map(f =>
        f.key === flagKey ? { ...f, enabled: oldValue } : f
      ));
      showToast('error', 'Failed to update feature flag', error.message);
    } finally {
      setSaving(false);
    }
  };

  const restartServices = async () => {
    if (!confirm('⚠️ WARNING: Restart Intelligence Engine?\n\n' +
                 'This will:\n' +
                 '• Interrupt any running audits\n' +
                 '• Take 10-15 seconds to complete\n' +
                 '• Require all active processes to restart\n\n' +
                 'Are you sure you want to proceed?')) {
      return;
    }

    setSaving(true);
    showToast('info', 'Initiating service restart...', 'This may take up to 15 seconds');

    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/services/restart`,
        { method: 'POST' },
        30000
      );

      if (response.ok) {
        showToast('info', 'Service restart initiated', 'Waiting for service to come online...');
        setRestartRequired(false);

        // Poll health endpoint
        let attempts = 0;
        const maxAttempts = 30;
        const pollInterval = setInterval(async () => {
          attempts++;

          try {
            const healthResponse = await fetchWithTimeout(
              `${API_GATEWAY}/api/admin/control/system/health/detailed`,
              {},
              5000
            );

            if (healthResponse.ok) {
              const healthData = await healthResponse.json();
              if (healthData.services?.intelligence_engine?.status === 'healthy') {
                clearInterval(pollInterval);
                showToast('success', 'Service restarted successfully!', 'Intelligence Engine is healthy');
                fetchFeatureFlags();
                setSaving(false);
                return;
              }
            }
          } catch (error) {
            // Continue polling
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            showToast('warning', 'Restart verification timed out', 'Service may still be starting. Check manually.');
            setSaving(false);
          }
        }, 1000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast('error', 'Failed to restart service', errorData.error || 'Please restart manually');
        setSaving(false);
      }
    } catch (error: any) {
      showToast('error', 'Failed to restart service', error.message);
      setSaving(false);
    }
  };

  const retryFailedJobs = async () => {
    if (!confirm('Retry all failed jobs? This will re-queue them for processing.')) {
      return;
    }

    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/system/queue/retry-failed`,
        { method: 'POST' }
      );

      if (response.ok) {
        const data = await response.json();
        showToast('success', 'Failed jobs retried', `Retried ${data.retried_count} jobs`);
        fetchQueueStats();
      } else {
        showToast('error', 'Failed to retry jobs', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to retry jobs', error.message);
    }
  };

  const clearDeadJobs = async () => {
    if (!confirm('Clear completed jobs older than 1 hour?')) {
      return;
    }

    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/system/queue/clear-dead`,
        { method: 'POST' }
      );

      if (response.ok) {
        const data = await response.json();
        showToast('success', 'Dead jobs cleared', `Cleared ${data.cleared_count} old jobs`);
        fetchQueueStats();
      } else {
        showToast('error', 'Failed to clear dead jobs', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to clear dead jobs', error.message);
    }
  };

  const clearAllCache = async () => {
    if (!confirm('⚠️ WARNING: Clear ALL cache?\n\nThis will:\n• Remove all cached data\n• Impact performance temporarily\n• Require fresh data fetches\n\nAre you sure?')) {
      return;
    }

    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/system/cache/clear-all`,
        { method: 'POST' }
      );

      if (response.ok) {
        showToast('success', 'All cache cleared successfully');
        fetchCacheStats();
      } else {
        showToast('error', 'Failed to clear cache', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to clear cache', error.message);
    }
  };

  const clearCacheByPattern = async () => {
    if (!cachePattern.trim()) {
      showToast('warning', 'Please enter a cache pattern', 'Example: bull:*, user:*');
      return;
    }

    if (!confirm(`Clear cache keys matching pattern: ${cachePattern}?`)) {
      return;
    }

    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/system/cache/clear-pattern`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pattern: cachePattern })
        }
      );

      if (response.ok) {
        const data = await response.json();
        showToast('success', 'Cache cleared', `Cleared ${data.cleared_count} keys`);
        fetchCacheStats();
      } else {
        showToast('error', 'Failed to clear cache', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to clear cache', error.message);
    }
  };

  const killAudit = async (auditId: string, companyName: string) => {
    if (!confirm(`⚠️ WARNING: Kill audit for "${companyName}"?\n\nThis will:\n• Stop the audit immediately\n• Mark it as cancelled\n• Cannot be undone\n\nAre you sure?`)) {
      return;
    }

    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/system/audits/${auditId}/kill`,
        { method: 'POST' }
      );

      if (response.ok) {
        showToast('success', 'Audit killed successfully', `Stopped audit for ${companyName}`);
        fetchActiveAudits();
      } else {
        showToast('error', 'Failed to kill audit', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to kill audit', error.message);
    }
  };

  const killAllAudits = async () => {
    if (!confirm('⚠️⚠️⚠️ EMERGENCY: Kill ALL running audits?\n\nThis will:\n• Stop ALL active audits immediately\n• Mark them all as cancelled\n• Cannot be undone\n• Should only be used in emergencies\n\nARE YOU ABSOLUTELY SURE?')) {
      return;
    }

    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/system/emergency/kill-all-audits`,
        { method: 'POST' }
      );

      if (response.ok) {
        const data = await response.json();
        showToast('success', 'All audits killed', `Stopped ${data.killed_count} audits`);
        fetchActiveAudits();
      } else {
        showToast('error', 'Failed to kill audits', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to kill audits', error.message);
    }
  };

  const toggleMaintenanceMode = async () => {
    const newMode = !maintenanceMode;

    if (newMode && !confirm('Enable maintenance mode? This will block new audit requests.')) {
      return;
    }

    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/system/maintenance/toggle`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: newMode,
            message: maintenanceMessage || 'System is currently under maintenance. Please try again later.'
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMaintenanceMode(data.maintenance_mode);
        showToast('success', `Maintenance mode ${data.maintenance_mode ? 'enabled' : 'disabled'}`);
      } else {
        showToast('error', 'Failed to toggle maintenance mode', `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to toggle maintenance mode', error.message);
    }
  };

  const fixStuckAudit = async (auditId: string, companyName: string) => {
    if (!confirm(`Fix stuck audit for "${companyName}"?\n\nThis will:\n• Update status to completed\n• Update phase to completed\n• Log the manual fix\n\nContinue?`)) {
      return;
    }

    try {
      const response = await fetchWithTimeout(
        `${API_GATEWAY}/api/admin/control/system/audits/${auditId}/fix-stuck`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            admin_user: 'admin',
            notes: 'Manual fix via Loop Detection dashboard'
          })
        }
      );

      if (response.ok) {
        showToast('success', 'Audit fixed successfully', `Fixed audit for ${companyName}`);
        fetchAllLoopData(); // Refresh all loop data
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast('error', 'Failed to fix audit', errorData.error || `Status: ${response.status}`);
      }
    } catch (error: any) {
      showToast('error', 'Failed to fix audit', error.message);
    }
  };

  // ========================================
  // Effects
  // ========================================

  useEffect(() => {
    // Initial data fetch
    fetchSystemHealth();
    fetchQueueStats();
    fetchCacheStats();
    fetchActiveAudits();
    fetchPerformanceMetrics();
    fetchMaintenanceStatus();
    fetchFeatureFlags();
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (activeTab === 'health') fetchSystemHealth();
      if (activeTab === 'queue') fetchQueueStats();
      if (activeTab === 'cache') fetchCacheStats();
      if (activeTab === 'audits') fetchActiveAudits();
      if (activeTab === 'performance') fetchPerformanceMetrics();
      if (activeTab === 'settings') fetchFeatureFlags();
      if (activeTab === 'loop-detection') fetchAllLoopData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, activeTab]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, logService, logLevel, logLines]);

  useEffect(() => {
    if (activeTab === 'loop-detection') {
      fetchAllLoopData();
    }
  }, [activeTab, historyHours]);

  // ========================================
  // Helper Functions
  // ========================================

  const getStatusColor = (status: string) => {
    if (status === 'healthy' || status === 'completed') return 'text-green-400 border-green-500/50 bg-green-500/10';
    if (status === 'unhealthy' || status === 'failed') return 'text-red-400 border-red-500/50 bg-red-500/10';
    if (status === 'down') return 'text-red-400 border-red-500/50 bg-red-500/10';
    return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'healthy' || status === 'completed') return <CheckCircle className="w-5 h-5" />;
    if (status === 'unhealthy' || status === 'failed') return <XCircle className="w-5 h-5" />;
    if (status === 'down') return <AlertTriangle className="w-5 h-5" />;
    return <AlertCircle className="w-5 h-5" />;
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // ========================================
  // Render Functions
  // ========================================

  const renderHealthTab = () => (
    <div className="space-y-6">
      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`glassmorphism rounded-lg p-4 border ${systemHealth?.services.database ? getStatusColor(systemHealth.services.database.status) : 'border-gray-500/30'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              <h3 className="font-semibold">Database</h3>
            </div>
            {systemHealth?.services.database && getStatusIcon(systemHealth.services.database.status)}
          </div>
          {systemHealth?.services.database && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Latency:</span>
                <span className="font-mono">{systemHealth.services.database.latency_ms}ms</span>
              </div>
              {systemHealth.services.database.connections && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total:</span>
                    <span className="font-mono">{systemHealth.services.database.connections.total_connections}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active:</span>
                    <span className="font-mono">{systemHealth.services.database.connections.active_connections}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>

        {/* Redis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`glassmorphism rounded-lg p-4 border ${systemHealth?.services.redis ? getStatusColor(systemHealth.services.redis.status) : 'border-gray-500/30'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              <h3 className="font-semibold">Redis</h3>
            </div>
            {systemHealth?.services.redis && getStatusIcon(systemHealth.services.redis.status)}
          </div>
          {systemHealth?.services.redis && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Latency:</span>
                <span className="font-mono">{systemHealth.services.redis.latency_ms}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Memory:</span>
                <span className="font-mono">{systemHealth.services.redis.memory_used}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Intelligence Engine */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`glassmorphism rounded-lg p-4 border ${systemHealth?.services.intelligence_engine ? getStatusColor(systemHealth.services.intelligence_engine.status) : 'border-gray-500/30'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              <h3 className="font-semibold">Intelligence</h3>
            </div>
            {systemHealth?.services.intelligence_engine && getStatusIcon(systemHealth.services.intelligence_engine.status)}
          </div>
          {systemHealth?.services.intelligence_engine && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">URL:</span>
                <span className="font-mono text-xs truncate">{systemHealth.services.intelligence_engine.url?.replace('http://', '') || 'N/A'}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* API Gateway */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`glassmorphism rounded-lg p-4 border ${systemHealth?.services.api_gateway ? getStatusColor(systemHealth.services.api_gateway.status) : 'border-gray-500/30'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              <h3 className="font-semibold">API Gateway</h3>
            </div>
            {systemHealth?.services.api_gateway && getStatusIcon(systemHealth.services.api_gateway.status)}
          </div>
          {systemHealth?.services.api_gateway && systemHealth.services.api_gateway.pid && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">PID:</span>
                <span className="font-mono">{systemHealth.services.api_gateway.pid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Memory:</span>
                <span className="font-mono">{systemHealth.services.api_gateway.memory_rss_mb}MB</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={fetchSystemHealth}
          disabled={healthLoading}
          className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-2 text-sm font-medium transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${healthLoading ? 'animate-spin' : ''}`} />
          Refresh Health
        </button>
      </div>
    </div>
  );

  const renderQueueTab = () => (
    <div className="space-y-6">
      {/* Queue Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glassmorphism rounded-lg p-4 border border-yellow-500/30">
          <div className="text-sm text-gray-400 mb-1">Waiting</div>
          <div className="text-2xl font-bold text-yellow-400">{queueStats?.waiting || 0}</div>
        </div>
        <div className="glassmorphism rounded-lg p-4 border border-blue-500/30">
          <div className="text-sm text-gray-400 mb-1">Active</div>
          <div className="text-2xl font-bold text-blue-400">{queueStats?.active || 0}</div>
        </div>
        <div className="glassmorphism rounded-lg p-4 border border-green-500/30">
          <div className="text-sm text-gray-400 mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-400">{queueStats?.completed || 0}</div>
        </div>
        <div className="glassmorphism rounded-lg p-4 border border-red-500/30">
          <div className="text-sm text-gray-400 mb-1">Failed</div>
          <div className="text-2xl font-bold text-red-400">{queueStats?.failed || 0}</div>
        </div>
        <div className="glassmorphism rounded-lg p-4 border border-purple-500/30">
          <div className="text-sm text-gray-400 mb-1">Delayed</div>
          <div className="text-2xl font-bold text-purple-400">{queueStats?.delayed || 0}</div>
        </div>
        <div className="glassmorphism rounded-lg p-4 border border-gray-500/30">
          <div className="text-sm text-gray-400 mb-1">Total</div>
          <div className="text-2xl font-bold">{queueStats?.total || 0}</div>
        </div>
      </div>

      {/* Queue Actions */}
      <div className="glassmorphism rounded-lg p-6 border border-gray-500/30">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Queue Management
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={retryFailedJobs}
            className="px-4 py-3 rounded-lg bg-green-500/20 border border-green-500/50 hover:bg-green-500/30 flex items-center justify-center gap-2 font-medium transition-all"
          >
            <PlayCircle className="w-5 h-5" />
            Retry Failed Jobs
          </button>
          <button
            onClick={clearDeadJobs}
            className="px-4 py-3 rounded-lg bg-orange-500/20 border border-orange-500/50 hover:bg-orange-500/30 flex items-center justify-center gap-2 font-medium transition-all"
          >
            <Trash2 className="w-5 h-5" />
            Clear Dead Jobs
          </button>
          <button
            onClick={fetchQueueStats}
            disabled={queueLoading}
            className="px-4 py-3 rounded-lg bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${queueLoading ? 'animate-spin' : ''}`} />
            Refresh Stats
          </button>
        </div>
      </div>
    </div>
  );

  const renderCacheTab = () => (
    <div className="space-y-6">
      {/* Cache Stats */}
      {cacheStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glassmorphism rounded-lg p-4 border border-blue-500/30">
            <div className="text-sm text-gray-400 mb-1">Total Connections</div>
            <div className="text-2xl font-bold text-blue-400">{cacheStats.total_connections.toLocaleString()}</div>
          </div>
          <div className="glassmorphism rounded-lg p-4 border border-purple-500/30">
            <div className="text-sm text-gray-400 mb-1">Total Commands</div>
            <div className="text-2xl font-bold text-purple-400">{cacheStats.total_commands.toLocaleString()}</div>
          </div>
          <div className="glassmorphism rounded-lg p-4 border border-green-500/30">
            <div className="text-sm text-gray-400 mb-1">Memory Used</div>
            <div className="text-2xl font-bold text-green-400">{cacheStats.memory_used}</div>
          </div>
          <div className="glassmorphism rounded-lg p-4 border border-yellow-500/30">
            <div className="text-sm text-gray-400 mb-1">Memory Max</div>
            <div className="text-2xl font-bold text-yellow-400">{cacheStats.memory_max || 'N/A'}</div>
          </div>
        </div>
      )}

      {/* Cache Actions */}
      <div className="glassmorphism rounded-lg p-6 border border-gray-500/30 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Cache Management
        </h3>

        {/* Pattern-based clear */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Clear by pattern (e.g., bull:*, user:*)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={cachePattern}
              onChange={(e) => setCachePattern(e.target.value)}
              placeholder="bull:*"
              className="flex-1 px-4 py-2 rounded-lg bg-black/30 border border-gray-500/30 focus:border-blue-500/50 focus:outline-none"
            />
            <button
              onClick={clearCacheByPattern}
              className="px-6 py-2 rounded-lg bg-orange-500/20 border border-orange-500/50 hover:bg-orange-500/30 font-medium transition-all"
            >
              Clear Pattern
            </button>
          </div>
        </div>

        {/* Clear all */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={clearAllCache}
            className="px-4 py-3 rounded-lg bg-red-500/20 border-2 border-red-500/50 hover:bg-red-500/30 flex items-center justify-center gap-2 font-medium transition-all shadow-lg shadow-red-500/20"
          >
            <Trash2 className="w-5 h-5" />
            Clear ALL Cache
          </button>
          <button
            onClick={fetchCacheStats}
            disabled={cacheLoading}
            className="px-4 py-3 rounded-lg bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${cacheLoading ? 'animate-spin' : ''}`} />
            Refresh Stats
          </button>
        </div>
      </div>
    </div>
  );

  const renderLogsTab = () => (
    <div className="space-y-6">
      {/* Log Controls */}
      <div className="glassmorphism rounded-lg p-6 border border-gray-500/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Service</label>
            <select
              value={logService}
              onChange={(e) => setLogService(e.target.value as any)}
              className="w-full px-4 py-2 rounded-lg bg-black/30 border border-gray-500/30 focus:border-blue-500/50 focus:outline-none"
            >
              <option value="intelligence-engine">Intelligence Engine</option>
              <option value="api-gateway">API Gateway</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Log Level</label>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-black/30 border border-gray-500/30 focus:border-blue-500/50 focus:outline-none"
            >
              <option value="">All Levels</option>
              <option value="ERROR">ERROR</option>
              <option value="WARNING">WARNING</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Lines</label>
            <select
              value={logLines}
              onChange={(e) => setLogLines(parseInt(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-black/30 border border-gray-500/30 focus:border-blue-500/50 focus:outline-none"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              className="w-full px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Logs Display */}
      <div className="glassmorphism rounded-lg p-4 border border-gray-500/30">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold">Recent Logs ({logs.length})</h3>
        </div>
        <div className="bg-black/50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
          {logs.length > 0 ? (
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
              {logs.join('\n')}
            </pre>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No logs available
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAuditsTab = () => (
    <div className="space-y-6">
      {/* Active Audits Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Active Audits ({activeAudits.length})
        </h3>
        <button
          onClick={fetchActiveAudits}
          disabled={auditsLoading}
          className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-2 text-sm font-medium transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${auditsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Audits List */}
      {activeAudits.length > 0 ? (
        <div className="space-y-4">
          {activeAudits.map((audit) => (
            <motion.div
              key={audit.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glassmorphism rounded-lg p-6 border border-gray-500/30"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-lg font-semibold">{audit.company_name}</h4>
                  <div className="text-sm text-gray-400 mt-1">ID: {audit.id}</div>
                </div>
                <button
                  onClick={() => killAudit(audit.id, audit.company_name)}
                  className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 flex items-center gap-2 text-sm font-medium transition-all"
                >
                  <StopCircle className="w-4 h-4" />
                  Kill Audit
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-400">Phase</div>
                  <div className="font-medium">{audit.current_phase}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Progress</div>
                  <div className="font-medium">{audit.phase_progress}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Responses</div>
                  <div className="font-medium">{audit.responses_collected} / {audit.response_count_limit}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Running Time</div>
                  <div className="font-medium">{formatSeconds(audit.running_time_seconds)}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700/30 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${audit.phase_progress}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glassmorphism rounded-lg p-12 border border-gray-500/30 text-center">
          <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <div className="text-gray-400">No active audits running</div>
        </div>
      )}
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="space-y-6">
      {/* Performance Metrics */}
      {performanceMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glassmorphism rounded-lg p-6 border border-blue-500/30"
          >
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-8 h-8 text-blue-400" />
              <div>
                <div className="text-sm text-gray-400">Avg Completion Time</div>
                <div className="text-3xl font-bold text-blue-400">{formatSeconds(performanceMetrics.avg_completion_time_seconds)}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glassmorphism rounded-lg p-6 border border-green-500/30"
          >
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div>
                <div className="text-sm text-gray-400">Completed (24h)</div>
                <div className="text-3xl font-bold text-green-400">{performanceMetrics.completed_last_24h}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism rounded-lg p-6 border border-purple-500/30"
          >
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <div>
                <div className="text-sm text-gray-400">Processing Rate</div>
                <div className="text-3xl font-bold text-purple-400">{performanceMetrics.processing_rate_per_hour}/hr</div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={fetchPerformanceMetrics}
          disabled={perfLoading}
          className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-2 text-sm font-medium transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${perfLoading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      {/* Restart Warning */}
      {restartRequired && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glassmorphism p-6 rounded-xl border-2 border-yellow-500/30 bg-yellow-500/10"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                  Service Restart Required
                </h3>
                <p className="text-sm text-gray-300 mb-4">
                  Changes to feature flags require a service restart to take effect.
                </p>
                <button
                  onClick={restartServices}
                  disabled={saving}
                  className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                  Restart Services Now
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Feature Flags */}
      <div className="space-y-6">
        {flags.map((flag, index) => (
          <motion.div
            key={flag.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glassmorphism rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{flag.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      flag.enabled
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {flag.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{flag.description}</p>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => toggleFlag(flag.key)}
                  disabled={saving}
                  className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                    flag.enabled ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      flag.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Impact Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${flag.impact.color}`}>
                    <flag.impact.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">{flag.impact.type}</p>
                    <p className="font-semibold">{flag.impact.value}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${flag.enabled ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                    {flag.enabled ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <Activity className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Status</p>
                    <p className="font-semibold">{flag.enabled ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${flag.requiresRestart ? 'bg-yellow-500/20' : 'bg-blue-500/20'}`}>
                    {flag.requiresRestart ? (
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Zap className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Restart</p>
                    <p className="font-semibold">{flag.requiresRestart ? 'Required' : 'Not Needed'}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {flags.length === 0 && !flagsLoading && (
        <div className="glassmorphism rounded-xl p-12 text-center">
          <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Feature Flags Found</h3>
          <p className="text-sm text-gray-400">Feature flags will appear here when configured.</p>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-between items-center">
        <button
          onClick={restartServices}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-red-500/20 border-2 border-red-500/50 hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-2 text-sm font-medium text-red-400 transition-all shadow-lg shadow-red-500/20"
        >
          <RotateCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
          Restart Intelligence Engine
        </button>
        <button
          onClick={fetchFeatureFlags}
          disabled={flagsLoading}
          className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-2 text-sm font-medium transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${flagsLoading ? 'animate-spin' : ''}`} />
          Refresh Flags
        </button>
      </div>
    </div>
  );

  const renderLoopDetectionTab = () => {
    const criticalLoops = loopDetection.filter(l => l.severity === 'critical');

    return (
      <div className="space-y-6">
        {/* Critical Alert Banner */}
        {criticalLoops.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glassmorphism p-6 rounded-xl border-2 border-red-500/50 bg-red-500/10"
          >
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-red-400 mb-2">
                  Critical: {criticalLoops.length} Infinite Loop{criticalLoops.length > 1 ? 's' : ''} Detected!
                </h3>
                <p className="text-sm text-gray-300 mb-3">
                  {criticalLoops.length} audit{criticalLoops.length > 1 ? 's have' : ' has'} been reprocessed ≥5 times in the last hour. Immediate action required to prevent cost waste.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={fetchAllLoopData}
                    disabled={loopLoading}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2 text-sm font-medium"
                  >
                    <RefreshCw className={`w-4 h-4 ${loopLoading ? 'animate-spin' : ''}`} />
                    Refresh Now
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Infinite Loop Detection Section */}
        <div className="glassmorphism rounded-lg p-6 border border-gray-500/30">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <RotateCw className="w-6 h-6 text-purple-400" />
              <div>
                <h3 className="text-xl font-semibold">Infinite Loop Detection</h3>
                <p className="text-sm text-gray-400 mt-1">Audits reprocessed ≥3 times in last hour</p>
              </div>
            </div>
            <button
              onClick={fetchAllLoopData}
              disabled={loopLoading}
              className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-2 text-sm font-medium transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loopLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loopDetection.length > 0 ? (
            <div className="space-y-3">
              {loopDetection.map((loop, index) => (
                <motion.div
                  key={loop.audit_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`glassmorphism rounded-lg p-4 border ${
                    loop.severity === 'critical'
                      ? 'border-red-500/50 bg-red-500/5'
                      : 'border-yellow-500/30 bg-yellow-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold">{loop.company_name}</h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          loop.severity === 'critical'
                            ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                        }`}>
                          {loop.severity.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 rounded bg-gray-700/50 text-xs font-mono">
                          {loop.reprocess_count} reprocesses
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        Audit ID: <span className="font-mono text-gray-300">{loop.audit_id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Status</div>
                      <div className="font-medium">{loop.status}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Phase</div>
                      <div className="font-medium">{loop.current_phase}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Duration</div>
                      <div className="font-medium">{loop.duration_minutes.toFixed(1)} min</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Avg Interval</div>
                      <div className="font-medium">{loop.avg_reprocess_interval_minutes.toFixed(1)} min</div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400">
                    Last reprocess: {new Date(loop.last_reprocess_at).toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <div className="font-medium">No infinite loops detected</div>
              <div className="text-sm mt-1">All audits are processing normally</div>
            </div>
          )}
        </div>

        {/* Stuck Audit Candidates Section */}
        <div className="glassmorphism rounded-lg p-6 border border-gray-500/30">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-6 h-6 text-orange-400" />
            <div>
              <h3 className="text-xl font-semibold">Stuck Audit Candidates</h3>
              <p className="text-sm text-gray-400 mt-1">Audits at risk of becoming infinite loops</p>
            </div>
          </div>

          {stuckCandidates.length > 0 ? (
            <div className="space-y-3">
              {stuckCandidates.map((audit, index) => (
                <motion.div
                  key={audit.audit_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`glassmorphism rounded-lg p-4 border ${
                    audit.risk_level === 'high'
                      ? 'border-orange-500/50'
                      : 'border-yellow-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold">{audit.company_name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          audit.risk_level === 'high'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {audit.risk_level.toUpperCase()} RISK
                        </span>
                        {audit.dashboard_exists && (
                          <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/30">
                            Dashboard Exists
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        Audit ID: <span className="font-mono text-gray-300">{audit.audit_id}</span>
                      </div>
                    </div>
                    {audit.should_auto_fix && (
                      <button
                        onClick={() => fixStuckAudit(audit.audit_id, audit.company_name)}
                        className="px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/50 hover:bg-green-500/30 flex items-center gap-2 text-sm font-medium transition-all"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Fix Now
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Status</div>
                      <div className="font-medium text-sm">{audit.status}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Phase</div>
                      <div className="font-medium text-sm">{audit.current_phase}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Reprocess Count</div>
                      <div className="font-medium text-sm">{audit.reprocess_count}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Responses</div>
                      <div className="font-medium text-sm">{audit.responses_collected}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Running Time</div>
                      <div className="font-medium text-sm">{audit.running_minutes.toFixed(1)} min</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-10 h-10 mx-auto mb-2 text-green-400" />
              <div className="text-sm">No stuck candidates detected</div>
            </div>
          )}
        </div>

        {/* Reprocess History Section */}
        <div className="glassmorphism rounded-lg p-6 border border-gray-500/30">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="text-xl font-semibold">Reprocess History</h3>
                <p className="text-sm text-gray-400 mt-1">Recent audit reprocessing attempts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={historyHours}
                onChange={(e) => setHistoryHours(parseInt(e.target.value))}
                className="px-4 py-2 rounded-lg bg-black/30 border border-gray-500/30 focus:border-blue-500/50 focus:outline-none text-sm"
              >
                <option value="1">Last 1 hour</option>
                <option value="6">Last 6 hours</option>
                <option value="24">Last 24 hours</option>
                <option value="72">Last 3 days</option>
              </select>
            </div>
          </div>

          {reprocessHistory.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-700">
                <div className="col-span-2">Time</div>
                <div className="col-span-2">Company</div>
                <div className="col-span-1">Attempt</div>
                <div className="col-span-2">Triggered By</div>
                <div className="col-span-2">Status Change</div>
                <div className="col-span-2">Phase Change</div>
                <div className="col-span-1">Current</div>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-1">
                {reprocessHistory.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="grid grid-cols-12 gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors text-sm"
                  >
                    <div className="col-span-2 text-gray-400 text-xs">
                      {new Date(entry.created_at).toLocaleTimeString()}
                    </div>
                    <div className="col-span-2 font-medium truncate" title={entry.company_name}>
                      {entry.company_name || 'Unknown'}
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-mono">
                        #{entry.reprocess_attempt}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.triggered_by === 'stuck_monitor'
                          ? 'bg-purple-500/20 text-purple-400'
                          : entry.triggered_by === 'manual'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {entry.triggered_by}
                      </span>
                    </div>
                    <div className="col-span-2 text-xs">
                      <span className="text-gray-500">{entry.status_before}</span>
                      <span className="mx-1 text-gray-600">→</span>
                      <span className="text-gray-300">{entry.status_after || '?'}</span>
                    </div>
                    <div className="col-span-2 text-xs">
                      <span className="text-gray-500">{entry.phase_before}</span>
                      <span className="mx-1 text-gray-600">→</span>
                      <span className="text-gray-300">{entry.phase_after || '?'}</span>
                    </div>
                    <div className="col-span-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.current_status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : entry.current_status === 'failed'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {entry.current_status || entry.status_after}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Info className="w-10 h-10 mx-auto mb-2" />
              <div className="text-sm">No reprocess history in selected timeframe</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEmergencyTab = () => (
    <div className="space-y-6">
      {/* Maintenance Mode */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glassmorphism rounded-lg p-6 border border-yellow-500/30"
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Maintenance Mode
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Status: {maintenanceMode ? 'ENABLED' : 'DISABLED'}</div>
              <div className="text-sm text-gray-400 mt-1">Blocks new audit requests when enabled</div>
            </div>
            <button
              onClick={toggleMaintenanceMode}
              className={`px-6 py-3 rounded-lg border-2 font-medium transition-all ${
                maintenanceMode
                  ? 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30 text-green-400'
                  : 'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30 text-yellow-400'
              }`}
            >
              {maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Emergency Stop */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glassmorphism rounded-lg p-6 border-2 border-red-500/50 bg-red-500/5"
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-400">
          <ShieldAlert className="w-5 h-5" />
          Emergency Controls
        </h3>
        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            Use these controls only in emergency situations. Actions cannot be undone.
          </div>
          <button
            onClick={killAllAudits}
            className="w-full px-6 py-4 rounded-lg bg-red-500/20 border-2 border-red-500/50 hover:bg-red-500/30 flex items-center justify-center gap-2 font-bold text-red-400 transition-all shadow-lg shadow-red-500/20"
          >
            <Power className="w-5 h-5" />
            KILL ALL RUNNING AUDITS
          </button>
        </div>
      </motion.div>
    </div>
  );

  // ========================================
  // Main Render
  // ========================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
          <div className="text-gray-400">Loading System Control Center...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Back Button */}
            <a
              href="/admin"
              className="p-3 rounded-lg bg-gradient-to-r from-gray-700/50 to-gray-600/50 border border-gray-500/50 hover:from-gray-700/70 hover:to-gray-600/70 hover:border-gray-400/70 transition-all shadow-lg hover:shadow-gray-500/20 group"
              title="Back to Admin Dashboard"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </a>

            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                System Control Center
              </h1>
              <p className="text-gray-400">Real-time monitoring and management dashboard</p>
            </div>
          </div>

          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">Auto-refresh ({refreshInterval / 1000}s)</span>
            </label>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'health', label: 'Health', icon: Activity },
            { id: 'queue', label: 'Queue', icon: Zap },
            { id: 'cache', label: 'Cache', icon: HardDrive },
            { id: 'logs', label: 'Logs', icon: FileText },
            { id: 'audits', label: 'Active Audits', icon: Server },
            { id: 'performance', label: 'Performance', icon: TrendingUp },
            { id: 'loop-detection', label: 'Loop Detection', icon: RotateCw },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'emergency', label: 'Emergency', icon: ShieldAlert }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-500/30 border-2 border-blue-500/50 text-blue-400'
                  : 'bg-black/30 border border-gray-500/30 hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'health' && renderHealthTab()}
            {activeTab === 'queue' && renderQueueTab()}
            {activeTab === 'cache' && renderCacheTab()}
            {activeTab === 'logs' && renderLogsTab()}
            {activeTab === 'audits' && renderAuditsTab()}
            {activeTab === 'performance' && renderPerformanceTab()}
            {activeTab === 'loop-detection' && renderLoopDetectionTab()}
            {activeTab === 'settings' && renderSettingsTab()}
            {activeTab === 'emergency' && renderEmergencyTab()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              className={`glassmorphism rounded-lg p-4 border shadow-lg ${
                toast.type === 'success' ? 'border-green-500/50 bg-green-500/10' :
                toast.type === 'error' ? 'border-red-500/50 bg-red-500/10' :
                toast.type === 'warning' ? 'border-yellow-500/50 bg-yellow-500/10' :
                'border-blue-500/50 bg-blue-500/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                  {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                  {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                  {toast.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold ${
                    toast.type === 'success' ? 'text-green-400' :
                    toast.type === 'error' ? 'text-red-400' :
                    toast.type === 'warning' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`}>
                    {toast.message}
                  </div>
                  {toast.details && (
                    <div className="text-sm text-gray-400 mt-1">{toast.details}</div>
                  )}
                </div>
                <button
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
