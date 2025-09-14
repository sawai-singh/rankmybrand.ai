"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { 
  ArrowUp, 
  ArrowDown, 
  Target, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Globe,
  Users,
  BarChart,
  Zap
} from "lucide-react";

interface DashboardData {
  company_name: string;
  overall_score: number;
  geo_score: number;
  sov_score: number;
  brand_mention_rate: number;
  executive_summary: string;
  top_recommendations: any[];
  quick_wins: string[];
  main_competitors: string[];
  provider_scores: any;
  key_insights: any[];
}

export default function DashboardPage() {
  const params = useParams();
  const auditId = params.id as string;
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [auditId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from intelligence engine API
      const response = await fetch(`http://localhost:8082/api/dashboard/detailed/${auditId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const text = await response.text();
      console.log('Response status:', response.status);
      console.log('Response text:', text.substring(0, 200));
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
      }
      
      const result = JSON.parse(text);
      
      if (result.status === 'success' && result.data) {
        console.log('Dashboard data received:', result.data);
        setDashboardData(result.data);
      } else {
        throw new Error('Invalid data format received');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">No data available</div>
      </div>
    );
  }

  // Parse JSON fields
  const recommendations = typeof dashboardData.top_recommendations === 'string' 
    ? JSON.parse(dashboardData.top_recommendations) 
    : dashboardData.top_recommendations || [];
    
  const quickWins = typeof dashboardData.quick_wins === 'string'
    ? JSON.parse(dashboardData.quick_wins)
    : dashboardData.quick_wins || [];
    
  const insights = typeof dashboardData.key_insights === 'string'
    ? JSON.parse(dashboardData.key_insights)
    : dashboardData.key_insights || [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{dashboardData.company_name}</h1>
        <p className="text-gray-400">AI Visibility Audit Dashboard</p>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Overall Score</span>
            <BarChart className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold">
            {parseFloat(dashboardData.overall_score || '0').toFixed(1)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800 rounded-lg p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">GEO Score</span>
            <Globe className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold">
            {parseFloat(dashboardData.geo_score || '0').toFixed(1)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800 rounded-lg p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">SOV Score</span>
            <Users className="h-5 w-5 text-purple-400" />
          </div>
          <div className="text-3xl font-bold">
            {parseFloat(dashboardData.sov_score || '0').toFixed(1)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800 rounded-lg p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Brand Mention Rate</span>
            <Target className="h-5 w-5 text-orange-400" />
          </div>
          <div className="text-3xl font-bold">
            {parseFloat(dashboardData.brand_mention_rate || '0').toFixed(1)}%
          </div>
        </motion.div>
      </div>

      {/* Executive Summary */}
      {dashboardData.executive_summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800 rounded-lg p-6 mb-8"
        >
          <h2 className="text-2xl font-bold mb-4">Executive Summary</h2>
          <p className="text-gray-300 leading-relaxed">
            {dashboardData.executive_summary}
          </p>
        </motion.div>
      )}

      {/* Top Recommendations */}
      {recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-800 rounded-lg p-6 mb-8"
        >
          <h2 className="text-2xl font-bold mb-4">Top Recommendations</h2>
          <div className="space-y-4">
            {recommendations.slice(0, 3).map((rec, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-lg font-semibold mb-2">{rec.headline}</h3>
                <p className="text-gray-300 text-sm mb-2">{rec.executive_pitch}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-400">
                    Priority: {rec.priority_score?.toFixed(1) || 'N/A'}
                  </span>
                  <span className="text-yellow-400">
                    Impact: {typeof rec.expected_impact === 'object' 
                      ? rec.expected_impact?.on_brand || 'High'
                      : rec.expected_impact || 'High'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-800 rounded-lg p-6 mb-8"
        >
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-400" />
            Quick Wins (This Week)
          </h2>
          <ul className="space-y-2">
            {quickWins.slice(0, 5).map((win, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <span className="text-gray-300">{win}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Key Insights */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gray-800 rounded-lg p-6"
        >
          <h2 className="text-2xl font-bold mb-4">Key Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-3">
                {insight.type === 'critical' && (
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-1" />
                )}
                {insight.type === 'opportunity' && (
                  <TrendingUp className="h-5 w-5 text-green-400 mt-1" />
                )}
                {insight.type === 'warning' && (
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mt-1" />
                )}
                <div>
                  <p className="text-sm font-semibold">{insight.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{insight.action}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}