"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Trash2, RotateCcw, AlertCircle, CheckCircle,
  Clock, Activity, Database, TrendingUp, RefreshCw, XCircle,
  FileText, Layers, Zap, ArrowLeft, ChevronDown, ChevronRight,
  Server, Code, Workflow, Eye, Terminal, AlertTriangle,
  CheckCircle2, Circle, Loader2, ExternalLink, Copy, Download,
  FastForward, Repeat, Link
} from "lucide-react";

interface Audit {
  audit_id: string;
  company_name: string;
  company_id: number;
  status: string;
  query_count: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  error_message: string | null;
  queries_generated: number;
  responses_collected: number;
  responses_analyzed: number;
  responses_migrated: number;
  dashboard_populated: number;
  domain: string;
  industry: string;
  pipeline_stage: string;
  pipeline_progress: number;
  is_stuck: boolean;
}

interface SystemHealth {
  timestamp: string;
  services: {
    database: { status: string };
    redis: { status: string };
    intelligence_engine: { status: string };
  };
  audit_stats: {
    total_audits: number;
    completed_audits: number;
    failed_audits: number;
    running_audits: number;
  };
  overall_status: string;
}

interface AuditLog {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  metadata?: any;
}

interface WorkflowStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  file?: string;
  function?: string;
  error?: string;
  details?: string;
}

export default function AuditControlPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, AuditLog[]>>({});
  const [auditWorkflows, setAuditWorkflows] = useState<Record<string, WorkflowStep[]>>({});

  const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:4000";

  // Get highlight parameter from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get('highlight');
    if (highlightId && audits.length > 0) {
      // Auto-expand and scroll to highlighted audit
      setExpandedAudit(highlightId);
      setTimeout(() => {
        const element = document.getElementById(`audit-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight animation
          element.classList.add('ring-4', 'ring-blue-500/50');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500/50');
          }, 3000);
        }
      }, 500);
    }
  }, [audits]);

  // Auto-refresh logs for expanded audit if it's processing
  useEffect(() => {
    if (!expandedAudit) return;

    const audit = audits.find(a => a.audit_id === expandedAudit);
    if (!audit || audit.status !== 'processing') return;

    // Fetch logs every 3 seconds for processing audits
    const interval = setInterval(() => {
      fetchAuditLogs(expandedAudit, true); // silent = true to avoid console spam
      fetchAuditWorkflow(expandedAudit);
    }, 3000);

    return () => clearInterval(interval);
  }, [expandedAudit, audits]);

  const fetchAudits = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits`);
      if (response.ok) {
        const data = await response.json();
        setAudits(data.audits || []);
      }
    } catch (error) {
      console.error("Failed to fetch audits:", error);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/system/health`);
      if (response.ok) {
        const data = await response.json();
        setSystemHealth(data);
      }
    } catch (error) {
      console.error("Failed to fetch system health:", error);
    }
  };

  const fetchAuditLogs = async (auditId: string, silent = false) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}/logs`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(prev => ({ ...prev, [auditId]: data.logs || [] }));
      }
    } catch (error) {
      if (!silent) console.error("Failed to fetch audit logs:", error);
      // Mock logs for demonstration
      setAuditLogs(prev => ({
        ...prev,
        [auditId]: [
          { timestamp: new Date().toISOString(), level: 'INFO', service: 'API Gateway', message: 'Audit created via onboarding completion' },
          { timestamp: new Date().toISOString(), level: 'INFO', service: 'Intelligence Engine', message: 'Query generation started', metadata: { file: 'ai_visibility_real.py', function: 'generate_queries' } },
          { timestamp: new Date().toISOString(), level: 'INFO', service: 'Intelligence Engine', message: '48 queries generated using GPT-5', metadata: { model: 'gpt-5-chat-latest' } },
          { timestamp: new Date().toISOString(), level: 'INFO', service: 'Database', message: 'Queries saved to audit_queries table', metadata: { count: 48 } },
        ]
      }));
    }
  };

  const fetchAuditWorkflow = async (auditId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}/workflow`);
      if (response.ok) {
        const data = await response.json();
        setAuditWorkflows(prev => ({ ...prev, [auditId]: data.steps || [] }));
      }
    } catch (error) {
      console.error("Failed to fetch workflow:", error);
      // Mock workflow for demonstration
      setAuditWorkflows(prev => ({
        ...prev,
        [auditId]: [
          {
            name: 'Job Processor Trigger',
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            file: 'job_processor.py',
            function: 'run_job_consumer',
            details: 'Job processor picked up audit from Redis queue'
          },
          {
            name: 'Query Generation',
            status: 'completed',
            file: 'query_generator.py',
            function: 'generate_queries',
            details: 'Generated 48 queries using GPT-5-chat-latest'
          },
          {
            name: 'Database Storage (audit_queries)',
            status: 'completed',
            file: 'ai_visibility_real.py',
            function: 'save_queries_to_db',
            details: 'Saved 48 queries to audit_queries table'
          },
          {
            name: 'LLM Query Execution',
            status: 'pending',
            file: 'job_processor.py',
            function: '_execute_queries',
            details: 'Waiting for manual trigger or automatic retry'
          },
          {
            name: 'Response Collection (OpenAI)',
            status: 'pending',
            file: 'llm_orchestrator.py',
            function: 'execute_audit_queries'
          },
          {
            name: 'Response Collection (Claude)',
            status: 'pending',
            file: 'llm_orchestrator.py',
            function: 'execute_audit_queries'
          },
          {
            name: 'Response Collection (Gemini)',
            status: 'pending',
            file: 'llm_orchestrator.py',
            function: 'execute_audit_queries'
          },
          {
            name: 'Response Collection (Perplexity)',
            status: 'pending',
            file: 'llm_orchestrator.py',
            function: 'execute_audit_queries'
          },
          {
            name: 'Response Analysis',
            status: 'pending',
            file: 'response_analyzer.py',
            function: 'analyze_response'
          },
          {
            name: 'Score Calculation',
            status: 'pending',
            file: 'job_processor.py',
            function: '_calculate_scores'
          },
          {
            name: 'Dashboard Population',
            status: 'pending',
            file: 'dashboard_data_populator.py',
            function: 'populate_dashboard_data'
          }
        ]
      }));
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchAudits(), fetchSystemHealth()]);
    setLoading(false);
  };

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([fetchAudits(), fetchSystemHealth()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleAuditDetails = async (auditId: string) => {
    if (expandedAudit === auditId) {
      setExpandedAudit(null);
    } else {
      setExpandedAudit(auditId);
      await fetchAuditLogs(auditId);
      await fetchAuditWorkflow(auditId);
    }
  };

  const handleExecuteAudit = async (auditId: string) => {
    if (!confirm("Trigger LLM query execution for this audit? This will send queries to all AI providers.")) return;

    setActionLoading(auditId);
    try {
      const INTELLIGENCE_ENGINE = process.env.NEXT_PUBLIC_INTELLIGENCE_ENGINE || "http://localhost:8002";
      const response = await fetch(`${INTELLIGENCE_ENGINE}/api/ai-visibility/execute-audit/${auditId}`, {
        method: "POST",
      });
      if (response.ok) {
        await refreshData();
        await fetchAuditLogs(auditId);
        await fetchAuditWorkflow(auditId);
        alert("Audit execution triggered successfully! Queries are being sent to AI providers.");
      } else {
        const error = await response.text();
        alert(`Failed to execute audit: ${error}`);
      }
    } catch (error) {
      console.error("Failed to execute audit:", error);
      alert("Failed to execute audit");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopAudit = async (auditId: string) => {
    if (!confirm("Are you sure you want to stop this audit?")) return;

    setActionLoading(auditId);
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}/stop`, {
        method: "POST",
      });
      if (response.ok) {
        await refreshData();
      } else {
        alert("Failed to stop audit");
      }
    } catch (error) {
      console.error("Failed to stop audit:", error);
      alert("Failed to stop audit");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAudit = async (auditId: string) => {
    if (!confirm("Are you sure you want to DELETE this audit? This cannot be undone.")) return;

    setActionLoading(auditId);
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await refreshData();
      } else {
        alert("Failed to delete audit");
      }
    } catch (error) {
      console.error("Failed to delete audit:", error);
      alert("Failed to delete audit");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryAudit = async (auditId: string) => {
    if (!confirm("Are you sure you want to retry this audit?")) return;

    setActionLoading(auditId);
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}/retry`, {
        method: "POST",
      });
      if (response.ok) {
        await refreshData();
      } else {
        alert("Failed to retry audit");
      }
    } catch (error) {
      console.error("Failed to retry audit:", error);
      alert("Failed to retry audit");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSkipPhase2 = async (auditId: string, responseCount: number) => {
    if (!confirm(`Skip Phase 2 and analyze ${responseCount} existing responses with GPT-5 Nano?\n\nThis will:\n✓ Skip expensive re-querying\n✓ Analyze existing data with 90% cost savings\n✓ Complete audit faster`)) return;

    setActionLoading(auditId);
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}/skip-phase-2`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        alert(`✓ ${data.message}`);
        await refreshData();
      } else {
        const error = await response.json();
        alert(`Failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Failed to skip phase 2:", error);
      alert("Failed to skip phase 2");
    } finally {
      setActionLoading(null);
    }
  };

  const handleForceReanalyze = async (auditId: string, responseCount: number) => {
    if (!confirm(`Force re-analyze ${responseCount} responses with GPT-5 Nano from scratch?\n\nThis will:\n✓ Clear existing analysis data\n✓ Re-analyze all responses with GPT-5 Nano\n✓ Useful for testing new analysis models\n\n⚠️ This cannot be undone!`)) return;

    setActionLoading(auditId);
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}/force-reanalyze`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        alert(`✓ ${data.message}`);
        await refreshData();
      } else {
        const error = await response.json();
        alert(`Failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Failed to force re-analyze:", error);
      alert("Failed to force re-analyze");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeAudit = async (auditId: string) => {
    if (!confirm(`Resume audit and finalize with existing scores?\n\nThis will:\n✓ Skip expensive re-querying and re-analysis\n✓ Use existing scores from database\n✓ Finalize audit and populate dashboard\n✓ Fastest way to complete stuck audits`)) return;

    setActionLoading(auditId);
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}/resume`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        alert(`✓ ${data.message}`);
        await refreshData();
      } else {
        const error = await response.json();
        alert(`Failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Failed to resume audit:", error);
      alert("Failed to resume audit");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePopulateDashboard = async (auditId: string) => {
    if (!confirm("Manually trigger dashboard population for this audit?")) return;

    setActionLoading(auditId);
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}/populate-dashboard`, {
        method: "POST",
      });
      if (response.ok) {
        await refreshData();
        alert("Dashboard population triggered successfully");
      } else {
        alert("Failed to populate dashboard");
      }
    } catch (error) {
      console.error("Failed to populate dashboard:", error);
      alert("Failed to populate dashboard");
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateLink = async (auditId: string) => {
    setActionLoading(auditId);
    try {
      console.log(`Generating link for audit: ${auditId}`);
      console.log(`API_BASE: ${API_BASE}`);

      const response = await fetch(`${API_BASE}/api/admin/control/audits/${auditId}/generate-link`, {
        method: "POST",
      });

      console.log(`Response status: ${response.status}, ok: ${response.ok}`);

      if (response.ok) {
        const data = await response.json();
        console.log("Response data:", data);
        const ADMIN_DASHBOARD_URL = process.env.NEXT_PUBLIC_ADMIN_DASHBOARD_URL || "http://localhost:3003";
        const link = `${ADMIN_DASHBOARD_URL}/r/${data.token}`;

        // Try to copy to clipboard first
        try {
          await navigator.clipboard.writeText(link);
          alert(`Link Generated and Copied!\n\n${link}\n\nThe link has been copied to your clipboard.`);
        } catch (clipboardError) {
          console.error("Clipboard error:", clipboardError);
          // Fallback: Show link in a prompt that can be manually copied
          prompt("Link Generated! Copy this link:", link);
        }
      } else {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        alert(`Failed to generate link: ${errorText}`);
      }
    } catch (error) {
      console.error("Failed to generate link - full error:", error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to generate link'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteFailed = async () => {
    if (!confirm("Are you sure you want to DELETE ALL FAILED AUDITS? This cannot be undone.")) return;

    setActionLoading("bulk-delete");
    try {
      const response = await fetch(`${API_BASE}/api/admin/control/audits/bulk/failed`, {
        method: "DELETE",
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Successfully deleted ${data.deleted_count} failed audits`);
        await refreshData();
      } else {
        alert("Failed to delete failed audits");
      }
    } catch (error) {
      console.error("Failed to delete failed audits:", error);
      alert("Failed to delete failed audits");
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600 bg-green-50 border-green-200";
      case "processing": return "text-blue-600 bg-blue-50 border-blue-200";
      case "failed": return "text-red-600 bg-red-50 border-red-200";
      case "stopped": return "text-gray-600 bg-gray-50 border-gray-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getPipelineStageColor = (stage: string) => {
    switch (stage) {
      case "completed": return "text-green-600 bg-green-100";
      case "migrating": return "text-purple-600 bg-purple-100";
      case "analyzing": return "text-blue-600 bg-blue-100";
      case "querying": return "text-yellow-600 bg-yellow-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR": return "text-red-600 bg-red-50";
      case "WARN": return "text-yellow-600 bg-yellow-50";
      case "INFO": return "text-blue-600 bg-blue-50";
      case "DEBUG": return "text-gray-600 bg-gray-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getWorkflowStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "running": return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case "failed": return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading audit control center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <a
                  href="/admin"
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-xl transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Admin
                </a>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                Audit Control Center
              </h1>
              <p className="text-gray-600 text-lg">Complete transparency into AI visibility audit pipeline</p>
            </div>
            <div className="flex gap-3">
              <a
                href="/admin"
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-blue-300 text-blue-700 rounded-xl hover:bg-blue-50 hover:border-blue-400 transition-all shadow-md hover:shadow-lg"
                title="Return to Journey Admin Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-semibold">Journey Admin</span>
              </a>
              <button
                onClick={refreshData}
                disabled={refreshing}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white border-2 border-blue-600 rounded-xl hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                title="Refresh all audit data and system health status"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="font-semibold">Refresh</span>
              </button>
              <button
                onClick={handleDeleteFailed}
                disabled={actionLoading === "bulk-delete"}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm hover:shadow"
                title="Delete all failed audits (cannot be undone)"
              >
                <Trash2 className="w-5 h-5" />
                <span className="font-medium">Delete Failed</span>
              </button>
            </div>
          </div>
        </div>

        {/* System Health */}
        {systemHealth && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-100 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 font-medium">Total Audits</span>
                <Database className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-4xl font-bold text-gray-900">{systemHealth.audit_stats.total_audits}</p>
              <p className="text-sm text-gray-500 mt-2">All-time audits</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-lg border-2 border-blue-100 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 font-medium">Running</span>
                <Activity className="w-6 h-6 text-blue-600 animate-pulse" />
              </div>
              <p className="text-4xl font-bold text-blue-600">{systemHealth.audit_stats.running_audits}</p>
              <p className="text-sm text-blue-600 mt-2">Active pipelines</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-6 shadow-lg border-2 border-green-100 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 font-medium">Completed</span>
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-4xl font-bold text-green-600">{systemHealth.audit_stats.completed_audits}</p>
              <p className="text-sm text-green-600 mt-2">Successfully finished</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-lg border-2 border-red-100 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 font-medium">Failed</span>
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-4xl font-bold text-red-600">{systemHealth.audit_stats.failed_audits}</p>
              <p className="text-sm text-red-600 mt-2">Need attention</p>
            </motion.div>
          </div>
        )}

        {/* Services Status */}
        {systemHealth && (
          <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-100 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-6 h-6 text-blue-600" />
              Service Health
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Database</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${systemHealth.services.database.status === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {systemHealth.services.database.status}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Layers className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Redis</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${systemHealth.services.redis.status === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {systemHealth.services.redis.status}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Intelligence Engine</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${systemHealth.services.intelligence_engine.status === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {systemHealth.services.intelligence_engine.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Audits */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100">
          <div className="p-6 border-b-2 border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Workflow className="w-7 h-7 text-blue-600" />
              Active Audits
            </h2>
          </div>

          <div className="divide-y-2 divide-gray-100">
            {audits.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No audits found. All audits have been cleaned up.</p>
              </div>
            ) : (
              audits.map((audit) => (
                <div
                  key={audit.audit_id}
                  id={`audit-${audit.audit_id}`}
                  className="hover:bg-gray-50 transition-all rounded-lg"
                >
                  {/* Main Row */}
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <button
                          onClick={() => toggleAuditDetails(audit.audit_id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title={expandedAudit === audit.audit_id ? "Collapse audit details" : "Expand to view workflow, logs, and detailed status"}
                        >
                          {expandedAudit === audit.audit_id ? (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">{audit.company_name}</h3>
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(audit.status)}`}>
                              {audit.is_stuck && <AlertCircle className="w-4 h-4" />}
                              {audit.status}
                            </span>
                            <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getPipelineStageColor(audit.pipeline_stage)}`}>
                              {audit.pipeline_stage}
                            </span>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <ExternalLink className="w-4 h-4" />
                              <span>{audit.domain || 'No domain'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span>{audit.industry}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>{new Date(audit.created_at).toLocaleString()}</span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(audit.audit_id)}
                              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                              title="Copy full audit ID to clipboard"
                            >
                              <Copy className="w-3 h-3" />
                              <span className="font-mono text-xs">{audit.audit_id.slice(0, 8)}</span>
                            </button>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="w-48">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">Progress</span>
                            <span className="text-xs font-bold text-gray-900">{audit.pipeline_progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all"
                              style={{ width: `${audit.pipeline_progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Data Stats */}
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Queries</div>
                            <div className="font-bold text-gray-900">{audit.queries_generated}/{audit.query_count}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Responses</div>
                            <div className="font-bold text-gray-900">{audit.responses_collected}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Analyzed</div>
                            <div className="font-bold text-blue-600">{audit.responses_analyzed || 0}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Migrated</div>
                            <div className="font-bold text-gray-900">{audit.responses_migrated}</div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {/* Only show Execute button AFTER queries are generated (queries_generated > 0) and before execution starts */}
                          {Number(audit.queries_generated) > 0 && Number(audit.responses_collected) === 0 && (audit.status === "pending" || audit.pipeline_stage === "created") && (
                            <button
                              onClick={() => handleExecuteAudit(audit.audit_id)}
                              disabled={actionLoading === audit.audit_id}
                              className="p-3 text-green-600 hover:bg-green-50 rounded-xl disabled:opacity-50 transition-all border-2 border-green-200"
                              title="Execute Audit - Send queries to all AI providers (OpenAI, Claude, Gemini, Perplexity)"
                            >
                              <Play className="w-5 h-5" />
                            </button>
                          )}
                          {audit.status === "processing" && (
                            <button
                              onClick={() => handleStopAudit(audit.audit_id)}
                              disabled={actionLoading === audit.audit_id}
                              className="p-3 text-yellow-600 hover:bg-yellow-50 rounded-xl disabled:opacity-50 transition-all border-2 border-yellow-200"
                              title="Stop Audit - Pause the currently running audit process"
                            >
                              <Pause className="w-5 h-5" />
                            </button>
                          )}
                          {/* Show Retry button for failed/stopped audits OR pending/processing audits with existing responses (stuck/incomplete) */}
                          {((audit.status === "failed" || audit.status === "stopped") ||
                            ((audit.status === "pending" || audit.status === "processing") && Number(audit.responses_collected) > 0)) && (
                            <button
                              onClick={() => handleRetryAudit(audit.audit_id)}
                              disabled={actionLoading === audit.audit_id}
                              className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl disabled:opacity-50 transition-all border-2 border-blue-200"
                              title="Retry Audit - Continue from where it failed or restart incomplete audit"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </button>
                          )}
                          {/* Skip Phase 2 - Show when audit has responses but not completed */}
                          {audit.responses_collected > 0 && audit.status !== 'completed' && audit.status !== 'processing' && (
                            <button
                              onClick={() => handleSkipPhase2(audit.audit_id, Number(audit.responses_collected))}
                              disabled={actionLoading === audit.audit_id}
                              className="p-3 text-emerald-600 hover:bg-emerald-50 rounded-xl disabled:opacity-50 transition-all border-2 border-emerald-200"
                              title={`Skip Phase 2 - Analyze ${audit.responses_collected} existing responses with GPT-5 Nano (90% cost savings)`}
                            >
                              <FastForward className="w-5 h-5" />
                            </button>
                          )}
                          {/* Force Re-analyze - Show when audit has responses */}
                          {audit.responses_collected > 0 && audit.status !== 'processing' && (
                            <button
                              onClick={() => handleForceReanalyze(audit.audit_id, Number(audit.responses_collected))}
                              disabled={actionLoading === audit.audit_id}
                              className="p-3 text-orange-600 hover:bg-orange-50 rounded-xl disabled:opacity-50 transition-all border-2 border-orange-200"
                              title={`Force Re-analyze ${audit.responses_collected} responses with GPT-5 Nano from scratch`}
                            >
                              <Repeat className="w-5 h-5" />
                            </button>
                          )}
                          {/* Resume Audit - Show for stopped/processing/completed/failed audits with existing scores */}
                          {(audit.status === 'stopped' || audit.status === 'processing' || audit.status === 'completed' || audit.status === 'failed') && audit.responses_analyzed > 0 && (
                            <button
                              onClick={() => handleResumeAudit(audit.audit_id)}
                              disabled={actionLoading === audit.audit_id}
                              className="p-3 text-cyan-600 hover:bg-cyan-50 rounded-xl disabled:opacity-50 transition-all border-2 border-cyan-200"
                              title="Resume audit - Finalize with existing scores (skip re-analysis)"
                            >
                              <Play className="w-5 h-5" />
                            </button>
                          )}
                          {audit.responses_migrated > 0 && audit.dashboard_populated === 0 && (
                            <button
                              onClick={() => handlePopulateDashboard(audit.audit_id)}
                              disabled={actionLoading === audit.audit_id}
                              className="p-3 text-purple-600 hover:bg-purple-50 rounded-xl disabled:opacity-50 transition-all border-2 border-purple-200"
                              title="Populate Dashboard - Generate dashboard data and metrics from analyzed responses"
                            >
                              <Zap className="w-5 h-5" />
                            </button>
                          )}
                          {audit.status === 'completed' && (
                            <button
                              onClick={() => handleGenerateLink(audit.audit_id)}
                              disabled={actionLoading === audit.audit_id}
                              className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-xl disabled:opacity-50 transition-all border-2 border-indigo-200"
                              title="Generate Shareable Link - Create a secure link to share this report"
                            >
                              <Link className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAudit(audit.audit_id)}
                            disabled={actionLoading === audit.audit_id}
                            className="p-3 text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-50 transition-all border-2 border-red-200"
                            title="Delete Audit - Permanently remove this audit and all its data (cannot be undone)"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedAudit === audit.audit_id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t-2 border-gray-100 bg-gray-50"
                      >
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Workflow Steps */}
                          <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <Workflow className="w-5 h-5 text-blue-600" />
                              Pipeline Workflow
                            </h3>
                            <div className="space-y-3">
                              {auditWorkflows[audit.audit_id]?.map((step, index) => (
                                <div key={index} className="flex items-start gap-3">
                                  <div className="mt-1">{getWorkflowStatusIcon(step.status)}</div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium text-gray-900">{step.name}</span>
                                      {step.status === 'running' && (
                                        <span className="text-xs text-blue-600 font-medium">IN PROGRESS</span>
                                      )}
                                    </div>
                                    {step.file && (
                                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                        <Code className="w-3 h-3" />
                                        <span className="font-mono">{step.file}</span>
                                        {step.function && <span>→ {step.function}()</span>}
                                      </div>
                                    )}
                                    {step.details && (
                                      <p className="text-sm text-gray-600">{step.details}</p>
                                    )}
                                    {step.error && (
                                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="flex items-start gap-2">
                                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                                          <p className="text-sm text-red-700">{step.error}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Logs */}
                          <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <Terminal className="w-5 h-5 text-blue-600" />
                              Execution Logs
                            </h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {auditLogs[audit.audit_id]?.map((log, index) => (
                                <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getLogLevelColor(log.level)}`}>
                                        {log.level}
                                      </span>
                                      <span className="text-xs font-medium text-blue-600">{log.service}</span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700">{log.message}</p>
                                  {log.metadata && (
                                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono text-gray-600 overflow-x-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
