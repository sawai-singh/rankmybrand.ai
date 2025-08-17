"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, Database, Activity, Mail, Building, 
  Target, Brain, Calendar, RefreshCw, Search,
  Filter, Download, Eye, ChevronRight, Edit3,
  Clock, TrendingUp, Shield, Zap, CheckCircle,
  XCircle, AlertCircle, FileText, GitBranch
} from "lucide-react";

interface CompanyJourneyData {
  // Basic info
  email: string;
  company_id: number;
  domain: string;
  
  // Name journey
  current_name: string;
  original_name: string;
  final_name: string;
  
  // Description journey
  current_description: string;
  original_description: string;
  final_description: string;
  
  // Edit tracking
  user_edited: boolean;
  edit_count: number;
  last_edited_at: string;
  
  // Quality metrics
  data_completeness: number;
  data_quality_score: number;
  latest_geo_score: number;
  
  // Journey tracking
  onboarding_completed: boolean;
  total_edits: number;
  time_on_company_step: number;
  time_on_description_step: number;
  time_on_competitor_step: number;
  total_journey_time: number;
  
  // Enrichment data
  enrichment_attempts: number;
  best_enrichment_quality: number;
  
  // User info
  user_email: string;
  user_created_at: string;
  session_id: string;
  current_step: string;
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
  const [activeTab, setActiveTab] = useState<"overview" | "journey" | "edits" | "enrichment">("overview");
  
  const [stats, setStats] = useState({
    totalCompanies: 0,
    editedCompanies: 0,
    averageCompleteness: 0,
    averageGeoScore: 0,
    totalEdits: 0,
    completedJourneys: 0
  });

  useEffect(() => {
    fetchEnhancedData();
  }, []);

  const fetchEnhancedData = async () => {
    setLoading(true);
    try {
      // Fetch from the new view
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/companies/journey`);
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
        
        // Calculate stats
        const companies = data.companies || [];
        setStats({
          totalCompanies: companies.length,
          editedCompanies: companies.filter((c: CompanyJourneyData) => c.user_edited).length,
          averageCompleteness: companies.reduce((acc: number, c: CompanyJourneyData) => 
            acc + (c.data_completeness || 0), 0) / (companies.length || 1),
          averageGeoScore: companies.reduce((acc: number, c: CompanyJourneyData) => 
            acc + (c.latest_geo_score || 0), 0) / (companies.length || 1),
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

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = 
      company.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.current_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.domain?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterStatus === "all" ||
      (filterStatus === "completed" && company.onboarding_completed) ||
      (filterStatus === "edited" && company.user_edited) ||
      (filterStatus === "incomplete" && !company.onboarding_completed);
    
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
      company.current_name || "",
      company.final_name || "",
      (company.original_description || "").substring(0, 100),
      (company.final_description || "").substring(0, 100),
      company.user_edited ? "Yes" : "No",
      company.edit_count?.toString() || "0",
      company.data_completeness?.toFixed(2) || "0",
      company.latest_geo_score?.toString() || "0",
      ((company.total_journey_time || 0) / 60).toFixed(2),
      company.onboarding_completed ? "Completed" : "In Progress"
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
            <button
              onClick={fetchEnhancedData}
              className="p-2 rounded-lg glassmorphism glassmorphism-hover"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
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
            <div className="text-3xl font-bold">{stats.averageCompleteness.toFixed(0)}%</div>
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
            <div className="text-3xl font-bold">{stats.averageGeoScore.toFixed(0)}</div>
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
                  <th className="text-left p-4 font-medium">Company</th>
                  <th className="text-left p-4 font-medium">Name Journey</th>
                  <th className="text-left p-4 font-medium">Description</th>
                  <th className="text-left p-4 font-medium">Edits</th>
                  <th className="text-left p-4 font-medium">Quality</th>
                  <th className="text-left p-4 font-medium">Journey Time</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((company, index) => (
                  <motion.tr
                    key={company.company_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedCompany(company);
                      fetchCompanyDetails(company.company_id);
                    }}
                  >
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{company.domain}</div>
                        <div className="text-xs text-muted-foreground">{company.user_email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {company.original_name !== company.final_name ? (
                          <>
                            <div className="text-xs text-gray-400">
                              Original: {company.original_name || "—"}
                            </div>
                            <div className="text-sm font-medium text-green-400">
                              Final: {company.final_name || company.current_name}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm">{company.current_name || "—"}</div>
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
                            {(company.current_description || "No description").substring(0, 50)}...
                          </span>
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
                              style={{ width: `${company.data_completeness || 0}%` }}
                            />
                          </div>
                          <span className="text-xs">{company.data_completeness?.toFixed(0) || 0}%</span>
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
                      {company.total_journey_time ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span className="text-xs">
                            {Math.round((company.total_journey_time || 0) / 60)}m
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        company.onboarding_completed
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      }`}>
                        {company.onboarding_completed ? '✓ Complete' : '◐ In Progress'}
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
              <div className="flex gap-2 mb-6">
                {["overview", "journey", "edits", "enrichment"].map((tab) => (
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
                            {selectedCompany.data_completeness?.toFixed(0) || 0}%
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
                            {selectedCompany.data_quality_score?.toFixed(0) || 0}%
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
                              Total Journey: {Math.round((selectedCompany.total_journey_time || 0) / 60)} minutes
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
                      <h4 className="font-medium mb-3">Edit History ({editHistory.length} changes)</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {editHistory.map((edit, i) => (
                          <div key={edit.id} className="glassmorphism p-3 rounded-lg text-sm">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium capitalize">{edit.field_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(edit.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-400">From:</span>
                                <p className="mt-1 text-gray-300">{edit.old_value || "Empty"}</p>
                              </div>
                              <div>
                                <span className="text-green-400">To:</span>
                                <p className="mt-1 text-green-300">{edit.new_value}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {editHistory.length === 0 && (
                          <p className="text-center text-muted-foreground py-4">No edits recorded</p>
                        )}
                      </div>
                    </div>
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
                          <span className="text-sm">Best Quality Score:</span>
                          <span className="font-medium">
                            {selectedCompany.best_enrichment_quality?.toFixed(2) || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </main>
    </div>
  );
}