"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, Database, Activity, Mail, Building, 
  Target, Brain, Calendar, RefreshCw, Search,
  Filter, Download, Eye, ChevronRight
} from "lucide-react";

interface UserData {
  email: string;
  first_seen: string;
  last_activity: string;
  onboarding_status: string;
  steps_completed: any;
  onboarding_completed: boolean;
  company_name: string;
  company_domain: string;
  latest_geo_score: number;
  total_actions: number;
  email_validation_attempts: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    completedOnboarding: 0,
    activeToday: 0,
    totalCompanies: 0
  });

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/users`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setStats(data.stats || {
          totalUsers: data.users?.length || 0,
          completedOnboarding: data.users?.filter((u: UserData) => u.onboarding_completed).length || 0,
          activeToday: data.users?.filter((u: UserData) => {
            const lastActivity = new Date(u.last_activity);
            const today = new Date();
            return lastActivity.toDateString() === today.toDateString();
          }).length || 0,
          totalCompanies: new Set(data.users?.map((u: UserData) => u.company_domain).filter(Boolean)).size || 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (email: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/admin/user/${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        setUserDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.company_domain?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === "all" ||
                         (filterStatus === "completed" && user.onboarding_completed) ||
                         (filterStatus === "incomplete" && !user.onboarding_completed);
    
    return matchesSearch && matchesFilter;
  });

  const exportData = () => {
    const csv = [
      ["Email", "First Seen", "Last Activity", "Company", "Domain", "Onboarding Status", "GEO Score", "Total Actions"],
      ...filteredUsers.map(user => [
        user.email,
        new Date(user.first_seen).toLocaleString(),
        new Date(user.last_activity).toLocaleString(),
        user.company_name || "",
        user.company_domain || "",
        user.onboarding_status || "not_started",
        user.latest_geo_score?.toString() || "",
        user.total_actions?.toString() || "0"
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rankmybrand-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading admin data...</p>
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
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <span className="text-sm text-muted-foreground">User Tracking Overview</span>
            </div>
            <button
              onClick={fetchAdminData}
              className="p-2 rounded-lg glassmorphism glassmorphism-hover"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-purple-400" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalUsers}</div>
            <div className="text-sm text-muted-foreground">Tracked Users</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-green-400" />
              <span className="text-xs text-muted-foreground">Completed</span>
            </div>
            <div className="text-3xl font-bold">{stats.completedOnboarding}</div>
            <div className="text-sm text-muted-foreground">Onboarded</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-8 h-8 text-blue-400" />
              <span className="text-xs text-muted-foreground">Today</span>
            </div>
            <div className="text-3xl font-bold">{stats.activeToday}</div>
            <div className="text-sm text-muted-foreground">Active Users</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glassmorphism p-6 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <Building className="w-8 h-8 text-orange-400" />
              <span className="text-xs text-muted-foreground">Unique</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalCompanies}</div>
            <div className="text-sm text-muted-foreground">Companies</div>
          </motion.div>
        </div>

        {/* Filters and Search */}
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
                All Users
              </button>
              <button
                onClick={() => setFilterStatus("completed")}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterStatus === "completed" 
                    ? "bg-green-500/20 border border-green-500" 
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
              onClick={exportData}
              className="px-4 py-2 rounded-lg glassmorphism glassmorphism-hover flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="glassmorphism rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Company</th>
                  <th className="text-left p-4 font-medium">First Seen</th>
                  <th className="text-left p-4 font-medium">Last Activity</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">GEO Score</th>
                  <th className="text-left p-4 font-medium">Actions</th>
                  <th className="text-left p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <motion.tr
                    key={user.email}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedUser(user.email);
                      fetchUserDetails(user.email);
                    }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{user.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{user.company_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{user.company_domain || "—"}</div>
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      {new Date(user.first_seen).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-sm">
                      {new Date(user.last_activity).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.onboarding_status === 'completed' || user.onboarding_completed
                          ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                          : user.onboarding_status === 'competitors_selected'
                          ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                          : user.onboarding_status === 'description_generated'
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : user.onboarding_status === 'company_enriched'
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : user.onboarding_status === 'email_validated'
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : user.onboarding_status === 'email_entered'
                          ? "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                          : "bg-gray-600/20 text-gray-300 border border-gray-600/30"
                      }`}>
                        {user.onboarding_status === 'completed' || user.onboarding_completed
                          ? '✓ completed'
                          : user.onboarding_status === 'competitors_selected'
                          ? '◐ competitors selected'
                          : user.onboarding_status === 'description_generated'
                          ? '◐ description created'
                          : user.onboarding_status === 'company_enriched'
                          ? '◐ company enriched'
                          : user.onboarding_status === 'email_validated'
                          ? '◐ email validated'
                          : user.onboarding_status === 'email_entered'
                          ? '○ email entered'
                          : '○ not started'}
                      </span>
                    </td>
                    <td className="p-4">
                      {user.latest_geo_score ? (
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-400" />
                          <span className="font-medium">{user.latest_geo_score}</span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="p-4">
                      <span className="text-sm">{user.total_actions || 0}</span>
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

        {/* User Details Modal */}
        {selectedUser && userDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glassmorphism rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">User Details: {selectedUser}</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Activity Log</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {userDetails.activities?.map((activity: any, i: number) => (
                      <div key={i} className="glassmorphism p-3 rounded-lg text-sm">
                        <div className="flex justify-between items-start">
                          <span className="font-medium">{activity.action_type}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.created_at).toLocaleString()}
                          </span>
                        </div>
                        {activity.action_details && (
                          <pre className="text-xs mt-2 text-muted-foreground overflow-x-auto">
                            {JSON.stringify(activity.action_details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-2 glassmorphism glassmorphism-hover rounded-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </main>
    </div>
  );
}