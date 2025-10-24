"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Database, Activity, Mail, Building,
  Target, Brain, Calendar, RefreshCw, Search,
  Filter, Download, Eye, ChevronRight, Edit3,
  Clock, TrendingUp, Shield, Zap, CheckCircle,
  XCircle, AlertCircle, FileText, GitBranch,
  Sparkles, MessageSquare, Hash, Layers,
  Trash2, Pause, RotateCcw, Settings
} from "lucide-react";

interface CompanyJourneyData {
  // Session information
  session_id: string;
  email: string;
  session_status: string;
  session_started: string;
  session_completed: string;
  last_activity: string;
  
  // Company basic info
  company_id: number;
  domain: string;
  company_name: string;
  company_description: string;
  industry: string;
  latest_geo_score: number;
  
  // Original vs Final tracking
  original_name: string;
  original_description: string;
  original_industry: string;
  final_name: string;
  final_description: string;
  final_industry: string;
  
  // Edit tracking
  user_edited: boolean;
  edit_count: number;
  description_edit_count: number;
  total_edits: number;
  
  // Data quality
  data_completeness: number;
  confidence_score: number;
  data_quality_score: number;
  completeness_score: number;
  
  // Journey tracking
  time_on_company_step: number;
  time_on_description_step: number;
  time_on_competitor_step: number;
  onboarding_completed?: boolean;
  
  // Competitor tracking
  competitor_journey: {
    suggested?: string[];
    added?: string[];
    removed?: string[];
    final?: string[];
  };
  
  // Enrichment and activity data
  enrichment_attempts: number;
  activity_count: number;
  activities: any;
  edit_history: any;
  
  // User info
  user_id: number;
  user_email: string;
  user_created_at: string;
  
  // Journey-specific data
  original_company_data: any;
  edited_company_data: any;
  final_company_data: any;
  metadata: any;
  
  // AI Visibility data
  ai_visibility?: {
    audit_id?: string;
    queries_generated?: number;
    last_audit_date?: string;
    audit_status?: string;
  };

  // Additional fields
  query_count?: number;
}

interface AIQuery {
  id: string;
  query_text: string;
  intent: string;
  complexity_score: number;
  competitive_relevance: number;
  buyer_journey_stage: string;
  priority_score: number;
  responses?: {
    provider: string;
    brand_mentioned: boolean;
    sentiment: string;
    response_snippet?: string;
  }[];
}

interface EditHistory {
  id: number;
  field_name: string;
  old_value: string;
  new_value: string;
  edit_source: string;
  created_at: string;
}

export default function EnhancedAdminPage() {
  const [companies, setCompanies] = useState<CompanyJourneyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState<CompanyJourneyData | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "journey" | "edits" | "competitors" | "enrichment" | "queries" | "audits">("overview");
  const [aiQueries, setAiQueries] = useState<AIQuery[]>([]);
  const [loadingQueries, setLoadingQueries] = useState(false);
  const [queryStats, setQueryStats] = useState({
    total: 0,
    highPriority: 0,
    brandMentions: 0,
    averageComplexity: 0
  });
  
  const [stats, setStats] = useState({
    totalCompanies: 0,
    editedCompanies: 0,
    averageCompleteness: 0,
    averageGeoScore: 0,
    totalEdits: 0,
    completedJourneys: 0
  });

  // Audit control states
  const [audits, setAudits] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [auditActionLoading, setAuditActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchEnhancedData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchEnhancedData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Fetch audits when audits tab is selected
  useEffect(() => {
    if (activeTab === "audits") {
      fetchAudits();
      // Auto-refresh audits every 10 seconds when tab is active
      const interval = setInterval(fetchAudits, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchEnhancedData = async () => {
    setLoading(true);
    try {
      // Fetch ALL companies including test companies without sessions
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/test/admin/all-companies`);
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
        
        // Calculate stats
        const companies = data.companies || [];

        // Calculate averages only for companies that have valid values
        const companiesWithCompleteness = companies.filter((c: CompanyJourneyData) => c.data_completeness && c.data_completeness > 0);
        const companiesWithGeoScore = companies.filter((c: CompanyJourneyData) => c.latest_geo_score && c.latest_geo_score > 0);

        const avgCompleteness = companiesWithCompleteness.length > 0
          ? companiesWithCompleteness.reduce((acc: number, c: CompanyJourneyData) => acc + (c.data_completeness || 0), 0) / companiesWithCompleteness.length
          : 0;

        const avgGeoScore = companiesWithGeoScore.length > 0
          ? companiesWithGeoScore.reduce((acc: number, c: CompanyJourneyData) => acc + (c.latest_geo_score || 0), 0) / companiesWithGeoScore.length
          : 0;

        setStats({
          totalCompanies: companies.length,
          editedCompanies: companies.filter((c: CompanyJourneyData) => c.user_edited).length,
          averageCompleteness: avgCompleteness,
          averageGeoScore: avgGeoScore,
          totalEdits: companies.reduce((acc: number, c: CompanyJourneyData) =>
            acc + (c.edit_count || 0), 0),
          completedJourneys: companies.filter((c: CompanyJourneyData) =>
            c.onboarding_completed).length
        });
      }
    } catch (error) {
      console.error('Failed to fetch enhanced data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyDetails = async (companyId: number) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/company/${companyId}/journey`
      );
      if (response.ok) {
        const data = await response.json();
        setEditHistory(data.edits || []);
      }
    } catch (error) {
      console.error('Failed to fetch company details:', error);
    }
  };

  const fetchAIQueries = async (companyId: number) => {
    setLoadingQueries(true);
    try {
      // Fetch HISTORICAL queries that were generated for this company's reports
      // Using test endpoint temporarily until auth is fixed
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/test/company/${companyId}/queries`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAiQueries(data.queries || []);
        
        // Calculate stats from historical data
        const queries = data.queries || [];
        setQueryStats({
          total: queries.length,
          highPriority: queries.filter((q: any) => q.priority_score > 0.7).length,
          brandMentions: 0, // No response data yet
          averageComplexity: queries.reduce((acc: number, q: any) => 
            acc + (parseFloat(q.complexity_score) || 0), 0) / (queries.length || 1)
        });
      } else {
        setAiQueries([]);
        setQueryStats({
          total: 0,
          highPriority: 0,
          brandMentions: 0,
          averageComplexity: 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch historical queries:', error);
      setAiQueries([]);
      setQueryStats({
        total: 0,
        highPriority: 0,
        brandMentions: 0,
        averageComplexity: 0
      });
    } finally {
      setLoadingQueries(false);
    }
  };

  // Admin dashboard only views historical queries - no generation

  // Fetch audit data
  const fetchAudits = async () => {
    setLoadingAudits(true);
    try {
      const [auditsRes, healthRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/control/audits`),
        fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/control/system/health`)
      ]);

      if (auditsRes.ok) {
        const data = await auditsRes.json();
        setAudits(data.audits || []);
      }

      if (healthRes.ok) {
        const data = await healthRes.json();
        setSystemHealth(data);
      }
    } catch (error) {
      console.error('Failed to fetch audit data:', error);
    } finally {
      setLoadingAudits(false);
    }
  };

  // Audit control actions
  const handleStopAudit = async (auditId: string) => {
    if (!confirm("Stop this audit?")) return;
    setAuditActionLoading(auditId);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/control/audits/${auditId}/stop`, {
        method: "POST",
      });
      if (response.ok) await fetchAudits();
      else alert("Failed to stop audit");
    } catch (error) {
      console.error("Failed to stop audit:", error);
    } finally {
      setAuditActionLoading(null);
    }
  };

  const handleDeleteAudit = async (auditId: string) => {
    if (!confirm("DELETE this audit? Cannot be undone.")) return;
    setAuditActionLoading(auditId);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/control/audits/${auditId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchAudits();
        alert("Audit deleted successfully");
      } else {
        const errorText = await response.text();
        console.error("Delete failed:", response.status, errorText);
        alert(`Failed to delete audit: ${response.status} - ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      console.error("Failed to delete audit:", error);
      alert(`Failed to delete audit: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAuditActionLoading(null);
    }
  };

  const handleRetryAudit = async (auditId: string) => {
    if (!confirm("Retry this audit?")) return;
    setAuditActionLoading(auditId);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/control/audits/${auditId}/retry`, {
        method: "POST",
      });
      if (response.ok) await fetchAudits();
      else alert("Failed to retry audit");
    } catch (error) {
      console.error("Failed to retry audit:", error);
    } finally {
      setAuditActionLoading(null);
    }
  };

  const handlePopulateDashboard = async (auditId: string) => {
    if (!confirm("Trigger dashboard population?")) return;
    setAuditActionLoading(auditId);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/control/audits/${auditId}/populate-dashboard`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchAudits();
        alert("Dashboard population triggered");
      } else alert("Failed to populate dashboard");
    } catch (error) {
      console.error("Failed to populate dashboard:", error);
    } finally {
      setAuditActionLoading(null);
    }
  };

  const handleDeleteFailed = async () => {
    if (!confirm("DELETE ALL FAILED AUDITS? Cannot be undone.")) return;
    setAuditActionLoading("bulk-delete");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/control/audits/bulk/failed`, {
        method: "DELETE",
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Deleted ${data.deleted_count} failed audits`);
        await fetchAudits();
      } else alert("Failed to delete failed audits");
    } catch (error) {
      console.error("Failed to delete failed audits:", error);
    } finally {
      setAuditActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-400 bg-green-500/20";
      case "processing": return "text-blue-400 bg-blue-500/20";
      case "failed": return "text-red-400 bg-red-500/20";
      case "stopped": return "text-gray-400 bg-gray-500/20";
      default: return "text-gray-400 bg-gray-500/20";
    }
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = 
      company.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.domain?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterStatus === "all" ||
      (filterStatus === "completed" && (company.session_status === 'completed')) ||
      (filterStatus === "edited" && company.user_edited) ||
      (filterStatus === "incomplete" && !(company.session_status === 'completed'));
    
    return matchesSearch && matchesFilter;
  });

  const exportEnhancedData = () => {
    const headers = [
      "Email", "Domain", "Original Name", "Current Name", "Final Name",
      "Original Description", "Final Description", "Edited", "Edit Count",
      "Data Completeness", "GEO Score", "Journey Time (min)", "Onboarding Status"
    ];
    
    const rows = filteredCompanies.map(company => [
      company.user_email,
      company.domain,
      company.original_name || "",
      company.company_name || "",
      company.final_name || "",
      (company.original_description || "").substring(0, 100),
      (company.final_description || "").substring(0, 100),
      company.user_edited ? "Yes" : "No",
      company.edit_count?.toString() || "0",
      Number(company.data_completeness || 0).toFixed(2),
      company.latest_geo_score?.toString() || "0",
      (((company.time_on_company_step || 0) + (company.time_on_description_step || 0) + (company.time_on_competitor_step || 0)) / 60).toFixed(2),
      (company.session_status === 'completed') ? "Completed" : "In Progress"
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rankmybrand-company-journey-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading enhanced company data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 glassmorphism border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Company Journey Admin</h1>
              <span className="text-sm text-muted-foreground">Enhanced Tracking Dashboard</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/admin/audits"
                className="px-4 py-2 rounded-lg glassmorphism glassmorphism-hover flex items-center gap-2 text-sm font-medium"
              >
                <Activity className="w-4 h-4" />
                View Audits
              </a>
              <a
                href="/admin/control"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/50 hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-500/70 transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-blue-500/10"
              >
                <Settings className="w-4 h-4" />
                Controls
              </a>
              <button
                onClick={fetchEnhancedData}
                className="p-2 rounded-lg glassmorphism glassmorphism-hover"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <Building className="w-8 h-8 text-purple-400" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalCompanies}</div>
            <div className="text-sm text-muted-foreground">Companies</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <Edit3 className="w-8 h-8 text-green-400" />
              <span className="text-xs text-muted-foreground">Edited</span>
            </div>
            <div className="text-3xl font-bold">{stats.editedCompanies}</div>
            <div className="text-sm text-muted-foreground">User Edited</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-blue-400" />
              <span className="text-xs text-muted-foreground">Quality</span>
            </div>
            <div className="text-3xl font-bold">
              {stats.averageCompleteness > 0 ? `${stats.averageCompleteness.toFixed(0)}%` : '-'}
            </div>
            <div className="text-sm text-muted-foreground">Avg Complete</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <Brain className="w-8 h-8 text-orange-400" />
              <span className="text-xs text-muted-foreground">GEO</span>
            </div>
            <div className="text-3xl font-bold">
              {stats.averageGeoScore > 0 ? stats.averageGeoScore.toFixed(0) : '-'}
            </div>
            <div className="text-sm text-muted-foreground">Avg Score</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <GitBranch className="w-8 h-8 text-indigo-400" />
              <span className="text-xs text-muted-foreground">Edits</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalEdits}</div>
            <div className="text-sm text-muted-foreground">Total Edits</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Complete</span>
            </div>
            <div className="text-3xl font-bold">{stats.completedJourneys}</div>
            <div className="text-sm text-muted-foreground">Journeys</div>
          </motion.div>
        </div>

        {/* Enhanced Filters */}
        <div className="glassmorphism p-4 rounded-xl mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by email, company name, or domain..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterStatus === "all" 
                    ? "bg-purple-500/20 border border-purple-500" 
                    : "glassmorphism glassmorphism-hover"
                }`}
              >
                All Companies
              </button>
              <button
                onClick={() => setFilterStatus("edited")}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterStatus === "edited" 
                    ? "bg-green-500/20 border border-green-500" 
                    : "glassmorphism glassmorphism-hover"
                }`}
              >
                Edited
              </button>
              <button
                onClick={() => setFilterStatus("completed")}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterStatus === "completed" 
                    ? "bg-blue-500/20 border border-blue-500" 
                    : "glassmorphism glassmorphism-hover"
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setFilterStatus("incomplete")}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterStatus === "incomplete" 
                    ? "bg-orange-500/20 border border-orange-500" 
                    : "glassmorphism glassmorphism-hover"
                }`}
              >
                Incomplete
              </button>
            </div>

            <button
              onClick={exportEnhancedData}
              className="px-4 py-2 rounded-lg glassmorphism glassmorphism-hover flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Enhanced CSV
            </button>
          </div>
        </div>

        {/* Enhanced Company Table */}
        <div className="glassmorphism rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left p-4 font-medium">Session / Email</th>
                  <th className="text-left p-4 font-medium">Company</th>
                  <th className="text-left p-4 font-medium">Description</th>
                  <th className="text-left p-4 font-medium">Competitors</th>
                  <th className="text-left p-4 font-medium">Queries</th>
                  <th className="text-left p-4 font-medium">Edits</th>
                  <th className="text-left p-4 font-medium">Quality</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((company, index) => (
                  <motion.tr
                    key={company.session_id || `${company.email}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedCompany(company);
                      setEditHistory(company.edit_history || []);
                      fetchAIQueries(company.company_id);
                    }}
                  >
                    <td className="p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-blue-400" />
                          <span className="font-medium">{company.email}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(company.session_started).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Status: <span className={company.session_status === 'completed' ? 'text-green-400' : 'text-yellow-400'}>
                            {company.session_status || 'in_progress'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-purple-400" />
                          <span className="font-medium">{company.company_name || company.domain}</span>
                        </div>
                        {company.original_name !== company.final_name ? (
                          <>
                            <div className="text-xs text-gray-400">
                              Original: {company.original_name || "—"}
                            </div>
                            <div className="text-sm font-medium text-green-400">
                              Final: {company.final_name || company.company_name}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm">{company.company_name || company.original_name || "—"}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="max-w-xs">
                        {company.user_edited && company.original_description !== company.final_description ? (
                          <div className="flex items-center gap-2">
                            <Edit3 className="w-3 h-3 text-green-400" />
                            <span className="text-xs text-green-400">Edited</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 truncate">
                            {(company.company_description || "No description").substring(0, 50)}...
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {company.competitor_journey?.final ? (
                          <>
                            <div className="flex items-center gap-1">
                              <Target className="w-3 h-3 text-purple-400" />
                              <span className="text-xs">{company.competitor_journey.final?.length || 0} selected</span>
                            </div>
                            {company.competitor_journey.added && company.competitor_journey.added.length > 0 && (
                              <span className="text-xs text-green-400">+{company.competitor_journey.added.length} added</span>
                            )}
                            {company.competitor_journey.removed && company.competitor_journey.removed.length > 0 && (
                              <span className="text-xs text-red-400">-{company.competitor_journey.removed.length} removed</span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {company.query_count > 0 ? (
                          <>
                            <span className="font-medium text-blue-400">{company.query_count}</span>
                            <Sparkles className="w-4 h-4 text-blue-400" />
                          </>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {company.edit_count > 0 ? (
                          <>
                            <span className="font-medium text-yellow-400">{company.edit_count}</span>
                            <Edit3 className="w-4 h-4 text-yellow-400" />
                          </>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                              style={{ width: `${Number(company.data_completeness || 0)}%` }}
                            />
                          </div>
                          <span className="text-xs">{Number(company.data_completeness || 0).toFixed(0)}%</span>
                        </div>
                        {company.latest_geo_score && (
                          <div className="flex items-center gap-1">
                            <Brain className="w-3 h-3 text-purple-400" />
                            <span className="text-xs">{company.latest_geo_score}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        (company.session_status === 'completed')
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      }`}>
                        {(company.session_status === 'completed') ? '✓ Complete' : '◐ In Progress'}
                      </span>
                    </td>
                    <td className="p-4">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Company Details Modal */}
        {selectedCompany && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedCompany(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glassmorphism rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">
                    {selectedCompany.final_name || selectedCompany.current_name || selectedCompany.domain}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedCompany.user_email}</p>
                </div>
                <button
                  onClick={() => setSelectedCompany(null)}
                  className="p-2 glassmorphism glassmorphism-hover rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {["overview", "journey", "edits", "competitors", "enrichment", "queries", "audits"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-4 py-2 rounded-lg capitalize ${
                      activeTab === tab
                        ? "bg-purple-500/20 border border-purple-500"
                        : "glassmorphism glassmorphism-hover"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="space-y-4">
                {activeTab === "overview" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glassmorphism p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Company Names</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Original:</span>{" "}
                          <span>{selectedCompany.original_name || "Not set"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Current:</span>{" "}
                          <span>{selectedCompany.current_name || "Not set"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Final:</span>{" "}
                          <span className="text-green-400 font-medium">
                            {selectedCompany.final_name || "Not set"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="glassmorphism p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Quality Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Data Completeness:</span>
                          <span className="font-medium">
                            {Number(selectedCompany.data_completeness || 0).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>GEO Score:</span>
                          <span className="font-medium">
                            {selectedCompany.latest_geo_score || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Quality Score:</span>
                          <span className="font-medium">
                            {Number(selectedCompany.data_quality_score || 0).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="glassmorphism p-4 rounded-lg col-span-2">
                      <h4 className="font-medium mb-2">Description Evolution</h4>
                      <div className="space-y-3 text-sm">
                        {selectedCompany.original_description && (
                          <div>
                            <span className="text-gray-400 block mb-1">Original:</span>
                            <p className="text-xs bg-black/20 p-2 rounded">
                              {selectedCompany.original_description}
                            </p>
                          </div>
                        )}
                        {selectedCompany.final_description && 
                         selectedCompany.final_description !== selectedCompany.original_description && (
                          <div>
                            <span className="text-green-400 block mb-1">Final (Edited):</span>
                            <p className="text-xs bg-green-900/20 p-2 rounded border border-green-500/20">
                              {selectedCompany.final_description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "journey" && (
                  <div className="space-y-4">
                    <div className="glassmorphism p-4 rounded-lg">
                      <h4 className="font-medium mb-3">Journey Timeline</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-blue-400" />
                          <span className="text-sm">Company Step: {selectedCompany.time_on_company_step || 0}s</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">Description Step: {selectedCompany.time_on_description_step || 0}s</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Target className="w-4 h-4 text-green-400" />
                          <span className="text-sm">Competitor Step: {selectedCompany.time_on_competitor_step || 0}s</span>
                        </div>
                        <div className="border-t border-white/10 pt-3 mt-3">
                          <div className="flex items-center gap-3">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm font-medium">
                              Total Journey: {Math.round(((selectedCompany.time_on_company_step || 0) + (selectedCompany.time_on_description_step || 0) + (selectedCompany.time_on_competitor_step || 0)) / 60)} minutes
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "edits" && (
                  <div className="space-y-4">
                    <div className="glassmorphism p-4 rounded-lg">
                      <h4 className="font-medium mb-3">Edit History ({(selectedCompany?.edit_history || []).length} changes)</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(selectedCompany?.edit_history || []).map((edit: any, i: number) => (
                          <div key={i} className="glassmorphism p-3 rounded-lg text-sm">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium capitalize">{edit.field}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(edit.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-400">From:</span>
                                <p className="mt-1 text-gray-300 break-words">
                                  {edit.old_value ? 
                                    (edit.old_value.length > 100 ? 
                                      edit.old_value.substring(0, 100) + '...' : 
                                      edit.old_value) : 
                                    "Empty"}
                                </p>
                              </div>
                              <div>
                                <span className="text-green-400">To:</span>
                                <p className="mt-1 text-green-300 break-words">
                                  {edit.new_value ? 
                                    (edit.new_value.length > 100 ? 
                                      edit.new_value.substring(0, 100) + '...' : 
                                      edit.new_value) : 
                                    "Empty"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(!selectedCompany?.edit_history || selectedCompany.edit_history.length === 0) && (
                          <p className="text-center text-muted-foreground py-4">No edits recorded</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "competitors" && (
                  <div className="space-y-4">
                    <div className="glassmorphism p-4 rounded-lg">
                      <h4 className="font-medium mb-3">Competitor Journey</h4>
                      {selectedCompany.competitor_journey ? (
                        <div className="space-y-4">
                          {selectedCompany.competitor_journey.suggested && selectedCompany.competitor_journey.suggested.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-400 mb-2">AI Suggested Competitors</h5>
                              <div className="flex flex-wrap gap-2">
                                {selectedCompany.competitor_journey.suggested.map((comp: any, idx: number) => (
                                  <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
                                    {typeof comp === 'string' ? comp : comp.name || comp.domain || comp}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {selectedCompany.competitor_journey.added && selectedCompany.competitor_journey.added.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-green-400 mb-2">Manually Added</h5>
                              <div className="flex flex-wrap gap-2">
                                {selectedCompany.competitor_journey.added.map((comp: any, idx: number) => (
                                  <span key={idx} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm">
                                    + {typeof comp === 'string' ? comp : comp.name || comp.domain || comp}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {selectedCompany.competitor_journey.removed && selectedCompany.competitor_journey.removed.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-red-400 mb-2">Removed</h5>
                              <div className="flex flex-wrap gap-2">
                                {selectedCompany.competitor_journey.removed.map((comp: any, idx: number) => (
                                  <span key={idx} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm line-through">
                                    {typeof comp === 'string' ? comp : comp.name || comp.domain || comp}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {selectedCompany.competitor_journey.final && selectedCompany.competitor_journey.final.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-purple-400 mb-2">Final Selection</h5>
                              <div className="flex flex-wrap gap-2">
                                {selectedCompany.competitor_journey.final.map((comp: any, idx: number) => (
                                  <span key={idx} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium">
                                    ✓ {typeof comp === 'string' ? comp : comp.name || comp.domain || comp}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-4">No competitor data tracked</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "queries" && (
                  <div className="space-y-4">
                    {/* Query Stats */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="glassmorphism p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Hash className="w-4 h-4 text-purple-400" />
                          <span className="text-sm text-gray-400">Total Queries</span>
                        </div>
                        <div className="text-2xl font-bold">{queryStats.total}</div>
                      </div>
                      <div className="glassmorphism p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm text-gray-400">High Priority</span>
                        </div>
                        <div className="text-2xl font-bold">{queryStats.highPriority}</div>
                      </div>
                      <div className="glassmorphism p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-gray-400">Brand Mentions</span>
                        </div>
                        <div className="text-2xl font-bold">{queryStats.brandMentions}</div>
                      </div>
                      <div className="glassmorphism p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-gray-400">Avg Complexity</span>
                        </div>
                        <div className="text-2xl font-bold">{(queryStats.averageComplexity * 100).toFixed(0)}%</div>
                      </div>
                    </div>

                    {/* Historical Query Information */}
                    <div className="glassmorphism p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-400" />
                          Historical AI Queries
                        </h4>
                        <span className="text-sm text-gray-400">
                          Generated: {aiQueries.length > 0 ? new Date(aiQueries[0].created_at || Date.now()).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        Viewing historical queries that were automatically generated for this company&apos;s AI visibility reports.
                        These queries were sent to multiple LLMs to analyze brand presence.
                      </p>
                    </div>

                    {/* Historical Queries List */}
                    <div className="glassmorphism p-4 rounded-lg">
                      <h4 className="font-medium mb-3">Report Queries History ({aiQueries.length})</h4>
                      {loadingQueries ? (
                        <div className="text-center py-8">
                          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-sm text-gray-400">Loading queries...</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {aiQueries.map((query, idx) => (
                            <div key={query.id} className="glassmorphism p-3 rounded-lg hover:bg-white/5 transition-colors">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-gray-400">#{idx + 1}</span>
                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs capitalize">
                                      {query.intent}
                                    </span>
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs capitalize">
                                      {query.buyer_journey_stage}
                                    </span>
                                    {query.priority_score > 0.7 && (
                                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                                        High Priority
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium mb-1">{query.query_text}</p>
                                  <div className="flex gap-4 text-xs text-gray-400">
                                    <span>Complexity: {(query.complexity_score * 100).toFixed(0)}%</span>
                                    <span>Competitive Relevance: {(query.competitive_relevance * 100).toFixed(0)}%</span>
                                    <span>Priority Score: {(query.priority_score * 100).toFixed(0)}%</span>
                                  </div>
                                </div>
                              </div>
                              
                              {query.responses && query.responses.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                  <div className="text-xs text-gray-400 mb-2">AI Responses:</div>
                                  <div className="space-y-1">
                                    {query.responses.map((resp, ridx) => (
                                      <div key={ridx} className="flex items-center gap-2 text-xs">
                                        <span className="font-medium capitalize">{resp.provider}:</span>
                                        {resp.brand_mentioned ? (
                                          <span className="text-green-400">✓ Brand mentioned</span>
                                        ) : (
                                          <span className="text-gray-500">No mention</span>
                                        )}
                                        <span className="text-gray-400">({resp.sentiment})</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {aiQueries.length === 0 && (
                            <div className="text-center py-8">
                              <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                              <p className="text-gray-400">No historical queries found</p>
                              <p className="text-sm text-gray-500 mt-1">Queries will appear here after AI visibility reports are generated</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Export Queries Button */}
                    {aiQueries.length > 0 && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            const csv = [
                              ['Query', 'Intent', 'Stage', 'Complexity', 'Relevance', 'Priority'],
                              ...aiQueries.map(q => [
                                q.query_text,
                                q.intent,
                                q.buyer_journey_stage,
                                (q.complexity_score * 100).toFixed(0) + '%',
                                (q.competitive_relevance * 100).toFixed(0) + '%',
                                (q.priority_score * 100).toFixed(0) + '%'
                              ])
                            ].map(row => row.join(',')).join('\n');
                            
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `ai-queries-${selectedCompany?.company_name || 'company'}-${new Date().toISOString().split('T')[0]}.csv`;
                            a.click();
                          }}
                          className="px-4 py-2 glassmorphism glassmorphism-hover rounded-lg flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Export Queries CSV
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "enrichment" && (
                  <div className="space-y-4">
                    <div className="glassmorphism p-4 rounded-lg">
                      <h4 className="font-medium mb-3">Enrichment Data</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm">Enrichment Attempts:</span>
                          <span className="font-medium">{selectedCompany.enrichment_attempts || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Data Quality Score:</span>
                          <span className="font-medium">
                            {Number(selectedCompany.data_quality_score || 0).toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Confidence Score:</span>
                          <span className="font-medium">
                            {Number(selectedCompany.confidence_score || 0).toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Completeness Score:</span>
                          <span className="font-medium">
                            {Number(selectedCompany.completeness_score || 0).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {selectedCompany.original_company_data && (
                      <div className="glassmorphism p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Original Company Data</h4>
                        <pre className="text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedCompany.original_company_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {selectedCompany.activities && selectedCompany.activities.length > 0 && (
                      <div className="glassmorphism p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Activity Log</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {selectedCompany.activities.map((activity: any, i: number) => (
                            <div key={i} className="text-xs">
                              <span className="text-blue-400">{activity.action}</span>
                              <span className="text-gray-400 ml-2">
                                {new Date(activity.timestamp).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "audits" && selectedCompany && (
                  <div className="space-y-4">
                    <div className="glassmorphism p-4 rounded-lg">
                      <h4 className="font-medium mb-3">AI Visibility Audit Status</h4>
                      {selectedCompany.ai_visibility?.audit_id ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm">Audit ID:</span>
                            <span className="font-mono text-xs">{selectedCompany.ai_visibility.audit_id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Status:</span>
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedCompany.ai_visibility.audit_status || 'unknown')}`}>
                              {selectedCompany.ai_visibility.audit_status || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Queries Generated:</span>
                            <span className="font-medium">{selectedCompany.ai_visibility.queries_generated || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Last Audit:</span>
                            <span className="text-xs">
                              {selectedCompany.ai_visibility.last_audit_date
                                ? new Date(selectedCompany.ai_visibility.last_audit_date).toLocaleString()
                                : 'Never'
                              }
                            </span>
                          </div>
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <a
                              href={`/admin/audits?highlight=${selectedCompany.ai_visibility.audit_id}`}
                              className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              View Audit Details
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No audit data available for this company</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Global Audits View (no company selected) */}
        {!selectedCompany && activeTab === "audits" && (
          <div className="space-y-6">
            {/* System Health Stats */}
            {systemHealth && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glassmorphism p-6 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Database className="w-8 h-8 text-purple-400" />
                    <span className="text-xs text-muted-foreground">Total</span>
                  </div>
                  <div className="text-3xl font-bold">{systemHealth.audit_stats.total_audits}</div>
                  <div className="text-sm text-muted-foreground">Audits</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glassmorphism p-6 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Activity className="w-8 h-8 text-blue-400" />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-400">{systemHealth.audit_stats.running_audits}</div>
                  <div className="text-sm text-muted-foreground">Running</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glassmorphism p-6 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <span className="text-xs text-muted-foreground">Done</span>
                  </div>
                  <div className="text-3xl font-bold text-green-400">{systemHealth.audit_stats.completed_audits}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glassmorphism p-6 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <XCircle className="w-8 h-8 text-red-400" />
                    <span className="text-xs text-muted-foreground">Issues</span>
                  </div>
                  <div className="text-3xl font-bold text-red-400">{systemHealth.audit_stats.failed_audits}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </motion.div>
              </div>
            )}

            {/* Audits Table */}
            <div className="glassmorphism rounded-xl overflow-hidden">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-xl font-semibold">All Audits</h2>
                <button
                  onClick={handleDeleteFailed}
                  disabled={auditActionLoading === "bulk-delete"}
                  className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 disabled:opacity-50 text-sm"
                >
                  Delete Failed
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Company</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pipeline</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingAudits ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : audits.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                          No audits found. All audits have been cleaned up.
                        </td>
                      </tr>
                    ) : (
                      audits.map((audit: any) => (
                        <tr key={audit.audit_id} className="hover:bg-white/5">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium">{audit.company_name}</p>
                              <p className="text-sm text-gray-400">{audit.domain || audit.industry}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(audit.status)}`}>
                              {audit.is_stuck && <AlertCircle className="w-3 h-3" />}
                              {audit.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-purple-400 font-medium">
                              {audit.pipeline_stage}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-white/10 rounded-full h-2 max-w-[100px]">
                                <div
                                  className="bg-purple-500 h-2 rounded-full transition-all"
                                  style={{ width: `${audit.pipeline_progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400">{audit.pipeline_progress}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-gray-400 space-y-1">
                              <div>Q: {audit.queries_generated}/{audit.query_count || 0}</div>
                              <div>R: {audit.responses_collected}</div>
                              <div>M: {audit.responses_migrated}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-400">
                            {new Date(audit.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {audit.status === "processing" && (
                                <button
                                  onClick={() => handleStopAudit(audit.audit_id)}
                                  disabled={auditActionLoading === audit.audit_id}
                                  className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg disabled:opacity-50"
                                  title="Stop"
                                >
                                  <Pause className="w-4 h-4" />
                                </button>
                              )}
                              {(audit.status === "failed" || audit.status === "stopped") && (
                                <button
                                  onClick={() => handleRetryAudit(audit.audit_id)}
                                  disabled={auditActionLoading === audit.audit_id}
                                  className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg disabled:opacity-50"
                                  title="Retry"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              {audit.responses_migrated > 0 && audit.dashboard_populated === 0 && (
                                <button
                                  onClick={() => handlePopulateDashboard(audit.audit_id)}
                                  disabled={auditActionLoading === audit.audit_id}
                                  className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg disabled:opacity-50"
                                  title="Populate"
                                >
                                  <Zap className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteAudit(audit.audit_id)}
                                disabled={auditActionLoading === audit.audit_id}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}