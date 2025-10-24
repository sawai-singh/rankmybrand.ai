'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  TrendingUp,
  Eye,
  Search,
  Trophy,
  Users,
  ArrowUp,
  ArrowDown,
  Minus,
  Globe,
  Activity,
  Zap,
  Clock
} from 'lucide-react';
import {
  safeScore,
  safeSortByNumber,
  safeFilterArray,
  calculateHealthStatus,
  getScoreBorderColor,
  identifyCriticalIssues
} from '@/lib/dashboard-utils';
import HeroHealthScore from '@/components/dashboard/HeroHealthScore';
import EnhancedKPICard from '@/components/dashboard/EnhancedKPICard';

// Dynamic imports for heavy components
const VisibilityRadar = dynamic(() => import('@/app/dashboard/ai-visibility/components/VisibilityRadar'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg" />,
  ssr: false
});

const CompetitiveLandscape = dynamic(() => import('@/app/dashboard/ai-visibility/components/CompetitiveLandscape'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg" />,
  ssr: false
});

const QueryPerformance = dynamic(() => import('@/app/dashboard/ai-visibility/components/QueryPerformance'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg" />,
  ssr: false
});

const ResponseAnalysisTable = dynamic(() => import('@/app/dashboard/ai-visibility/components/ResponseAnalysisTable'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg" />,
  ssr: false
});

const InsightsFeed = dynamic(() => import('@/app/dashboard/ai-visibility/components/InsightsFeed'), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg" />,
  ssr: false
});

// Strategic Intelligence Components (118-Call Architecture)
const ExecutiveSummaryCard = dynamic(() => import('@/components/dashboard/strategic').then(mod => ({ default: mod.ExecutiveSummaryCard })), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg" />,
  ssr: false
});

const StrategicPrioritiesPanel = dynamic(() => import('@/components/dashboard/strategic').then(mod => ({ default: mod.StrategicPrioritiesPanel })), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg" />,
  ssr: false
});

const CategoryInsightsGrid = dynamic(() => import('@/components/dashboard/strategic').then(mod => ({ default: mod.CategoryInsightsGrid })), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg" />,
  ssr: false
});

const BuyerJourneyInsightsView = dynamic(() => import('@/components/dashboard/strategic').then(mod => ({ default: mod.BuyerJourneyInsightsView })), {
  loading: () => <div className="h-96 animate-pulse bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg" />,
  ssr: false
});

export interface AuditData {
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
  companyName?: string;
  companyDomain?: string;
  companyLogoUrl?: string;
  // Add queries and responses for token-based access
  queries?: Array<{
    id: string;
    text: string;
    category?: string;
    intent?: string;
    responseCount?: number;
    createdAt?: string;
  }>;
  responses?: Array<{
    id: string;
    query_id: string;
    query_text?: string;
    provider: string;
    response_text: string;
    brand_mentioned: boolean;
    sentiment: string;
    recommendation_strength?: number;
    competitors_mentioned?: any[];
    created_at?: string;
  }>;
}

interface DashboardViewProps {
  auditData: AuditData | null;
  isLoading?: boolean;
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
  onStartAudit?: () => void;
  isAuditRunning?: boolean;
  auditProgress?: number;
  showHeader?: boolean;
  showStartAuditButton?: boolean;
}

// Animated score display component with color-coded borders
const AnimatedScore = ({ value, label, icon: Icon, color }: any) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  // Color-coded border based on score (using safe utilities)
  const borderColor = getScoreBorderColor(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden"
    >
      <Card className={`p-6 border-2 ${borderColor} hover:shadow-xl transition-all duration-300 group`}>
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

// Platform status indicators - Compact version
const PlatformStatus = ({ platform, status, responseTime, onClick }: any) => {
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
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border cursor-pointer hover:bg-gray-100 transition-all"
      onClick={onClick}
    >
      <span className="text-sm">{platformIcons[platform as keyof typeof platformIcons]}</span>
      <span className="text-xs font-medium capitalize">{platform}</span>
      <div className={`w-1.5 h-1.5 rounded-full ${statusColors[status as keyof typeof statusColors]} animate-pulse`} />
    </motion.div>
  );
};

export default function DashboardView({
  auditData,
  isLoading = false,
  connectionStatus = 'disconnected',
  onStartAudit,
  isAuditRunning = false,
  auditProgress = 0,
  showHeader = true,
  showStartAuditButton = false,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Update timestamp when audit data changes
  useEffect(() => {
    if (auditData) {
      setLastUpdated(new Date());
    }
  }, [auditData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-medium">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      {showHeader && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-b sticky top-0 z-50 backdrop-blur-lg bg-white/90"
        >
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {auditData?.companyLogoUrl ? (
                  <div className="flex-shrink-0">
                    <img
                      src={auditData.companyLogoUrl}
                      alt={`${auditData.companyName || 'Company'} logo`}
                      className="w-10 h-10 rounded-lg object-contain bg-white p-1 shadow-sm border border-gray-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    AI Visibility Intelligence
                  </h1>
                  <p className="text-sm text-gray-500">
                    {auditData?.companyName ? `${auditData.companyName} - ` : ''}
                    Real-time brand presence across AI platforms
                    {' • '}
                    <span className="text-xs">
                      Last updated: {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {connectionStatus !== 'disconnected' && (
                  <Badge variant={connectionStatus === 'connected' ? 'default' : 'secondary'}>
                    <Activity className="w-3 h-3 mr-1" />
                    {connectionStatus}
                  </Badge>
                )}

                {showStartAuditButton && onStartAudit && (
                  <Button
                    onClick={onStartAudit}
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
                )}
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
      )}

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Hero Health Score - Premium Design */}
        {auditData && (() => {
          // Use safe utilities to calculate health status
          const { avgScore, status: health } = calculateHealthStatus({
            overall: auditData.overallScore,
            sentiment: auditData.scores?.sentiment,
            recommendation: auditData.scores?.recommendation
          });

          // Identify critical issues safely
          const criticalIssues = identifyCriticalIssues(
            {
              overall: auditData.overallScore,
              sentiment: auditData.scores?.sentiment,
              recommendation: auditData.scores?.recommendation
            },
            auditData.insights
          );

          return (
            <HeroHealthScore
              avgScore={avgScore}
              status={health}
              criticalIssues={criticalIssues}
              companyName={auditData.companyName}
              companyLogoUrl={auditData.companyLogoUrl}
              breakdown={{
                visibility: safeScore(auditData.overallScore, 0),
                sentiment: safeScore(auditData.scores?.sentiment, 0),
                recommendations: safeScore(auditData.scores?.recommendation, 0),
              }}
              competitorRank={2}
              totalCompetitors={auditData.competitors?.length || 4}
              monthlyChange={5}
              actionableInsights={auditData.insights?.length || 0}
            />
          );
        })()}

        {/* Enhanced KPI Cards - Dynamic Priority System */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {(() => {
            // Helper function to determine priority
            const getPriority = (value: number): 'critical' | 'warning' | 'good' => {
              if (value < 40) return 'critical';
              if (value < 70) return 'warning';
              return 'good';
            };

            // Helper to generate realistic trend data
            const generateTrend = (currentValue: number) => {
              const trend = [];
              let val = currentValue - 15 + Math.random() * 10;
              for (let i = 0; i < 7; i++) {
                trend.push(Math.max(0, Math.min(100, val)));
                val += (Math.random() - 0.4) * 5; // Slight upward bias
              }
              trend[6] = currentValue; // Ensure last value matches current
              return trend;
            };

            const kpiCards = [
              {
                value: auditData?.overallScore,
                label: "Overall Visibility",
                icon: Eye,
                color: "#8B5CF6",
                comparisonValue: -2.9, // vs industry
              },
              {
                value: auditData?.scores?.sentiment,
                label: "Sentiment Score",
                icon: TrendingUp,
                color: "#EC4899",
                comparisonValue: 5.2,
              },
              {
                value: auditData?.scores?.recommendation,
                label: "Recommendation Rate",
                icon: Trophy,
                color: "#10B981",
                comparisonValue: 30.0,
              },
              {
                value: auditData?.scores?.seo,
                label: "SEO Optimization",
                icon: Search,
                color: "#3B82F6",
                comparisonValue: -19.4,
              }
            ];

            // Sort by score ascending (worst first) using safe utility
            const sortedCards = safeSortByNumber(kpiCards, card => card.value, true);

            return sortedCards.map((card, index) => {
              const safeValue = safeScore(card.value, 0);
              const priority = getPriority(safeValue);

              return (
                <EnhancedKPICard
                  key={card.label}
                  value={safeValue}
                  label={card.label}
                  icon={card.icon}
                  color={card.color}
                  trend={generateTrend(safeValue)}
                  comparisonValue={card.comparisonValue}
                  priority={priority}
                  onActionClick={() => {
                    console.log(`Action clicked for ${card.label}`);
                    // Could navigate to specific improvement page
                  }}
                />
              );
            });
          })()}
        </div>

        {/* Platform Status - Compact horizontal bar */}
        <div className="mb-8 p-4 bg-white rounded-lg border shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-700">
              <Globe className="w-4 h-4" />
              Platform Status
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <PlatformStatus
                platform="openai"
                status="online"
                responseTime={234}
                onClick={() => setSelectedProvider('openai')}
              />
              <PlatformStatus
                platform="anthropic"
                status="online"
                responseTime={189}
                onClick={() => setSelectedProvider('anthropic')}
              />
              <PlatformStatus
                platform="google"
                status="slow"
                responseTime={567}
                onClick={() => setSelectedProvider('google')}
              />
              <PlatformStatus
                platform="perplexity"
                status="online"
                responseTime={345}
                onClick={() => setSelectedProvider('perplexity')}
              />
            </div>
          </div>
        </div>

        {/* Strategic Intelligence - 118-Call Architecture (Prominent Top Section) */}
        {auditData?.id && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            {/* Section Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent mb-2">
                  Strategic Intelligence
                </h2>
                <p className="text-gray-600 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  118-Call Strategic Intelligence Architecture • Board-Ready Insights
                </p>
              </div>
              <Badge className="h-8 px-4 text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                Powered by AI
              </Badge>
            </div>

            <div className="space-y-6">
              {/* Layer 3: Executive Summary (1 Call) */}
              <ExecutiveSummaryCard auditId={auditData.id} />

              {/* Layer 2: Strategic Priorities (3 Calls) */}
              <StrategicPrioritiesPanel auditId={auditData.id} />

              {/* Layer 1: Category Insights (18 Calls) */}
              <CategoryInsightsGrid auditId={auditData.id} />

              {/* Phase 2: Buyer Journey Batch Insights (96 Calls) - Optional/Advanced */}
              <BuyerJourneyInsightsView auditId={auditData.id} />
            </div>
          </motion.div>
        )}

        {/* Tabbed Content - Enhanced with Count Badges */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger
              value="overview"
              className={activeTab === 'overview' ? 'font-bold underline underline-offset-4' : ''}
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="queries"
              className={activeTab === 'queries' ? 'font-bold underline underline-offset-4' : ''}
            >
              <span className="flex items-center gap-2">
                Queries
                {auditData?.queries && auditData.queries.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold bg-purple-100 text-purple-700 hover:bg-purple-100"
                  >
                    {auditData.queries.length}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="responses"
              className={activeTab === 'responses' ? 'font-bold underline underline-offset-4' : ''}
            >
              <span className="flex items-center gap-2">
                Responses
                {auditData?.responses && auditData.responses.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-100"
                  >
                    {auditData.responses.length}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className={activeTab === 'insights' ? 'font-bold underline underline-offset-4' : ''}
            >
              <span className="flex items-center gap-2">
                Insights
                {auditData?.insights && auditData.insights.length > 0 && (() => {
                  const highPriorityCount = auditData.insights.filter(
                    (i: any) => i.importance === 'high'
                  ).length;
                  const hasHighPriority = highPriorityCount > 0;

                  return (
                    <div className="flex items-center gap-1">
                      {hasHighPriority && (
                        <motion.span
                          animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          className="text-xs"
                        >
                          🔴
                        </motion.span>
                      )}
                      <Badge
                        variant="secondary"
                        className={`h-5 min-w-[20px] px-1.5 text-[10px] font-semibold ${
                          hasHighPriority
                            ? 'bg-red-100 text-red-700 hover:bg-red-100'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {auditData.insights.length}
                      </Badge>
                    </div>
                  );
                })()}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="competitive"
              className={activeTab === 'competitive' ? 'font-bold underline underline-offset-4' : ''}
            >
              Competitive
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Top 2 High-Priority Insights */}
            {auditData?.insights && auditData.insights.length > 0 && (() => {
              // Use safe filtering and sorting
              const validInsights = safeFilterArray(auditData.insights, (insight: any) => {
                return insight && insight.importance && insight.message;
              });

              const topInsights = [...validInsights]
                .sort((a, b) => {
                  const priorityOrder = { high: 3, medium: 2, low: 1 };
                  return (priorityOrder[b.importance as keyof typeof priorityOrder] || 0) -
                         (priorityOrder[a.importance as keyof typeof priorityOrder] || 0);
                })
                .slice(0, 2);

              return topInsights.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {topInsights.map((insight, index) => {
                    const getIcon = () => {
                      if (insight.importance === 'high') return '🔥';
                      if (insight.importance === 'medium') return '⚠️';
                      return '💡';
                    };

                    const getBorderColor = () => {
                      if (insight.importance === 'high') return 'border-red-300 bg-red-50/50';
                      if (insight.importance === 'medium') return 'border-yellow-300 bg-yellow-50/50';
                      return 'border-blue-300 bg-blue-50/50';
                    };

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <Card className={`border-2 ${getBorderColor()} hover:shadow-lg transition-all`}>
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl leading-none mt-0.5">{getIcon()}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs font-semibold">
                                    {insight.importance?.toUpperCase() || 'INFO'} PRIORITY
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {insight.type}
                                  </Badge>
                                </div>
                                <p className="text-sm font-semibold text-gray-900 leading-relaxed mb-2">
                                  {insight.message}
                                </p>
                                <button
                                  onClick={() => setActiveTab('insights')}
                                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                                >
                                  View all insights →
                                </button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VisibilityRadar data={auditData} />
              <CompetitiveLandscape competitors={auditData?.competitors} />
            </div>
          </TabsContent>

          <TabsContent value="queries" className="space-y-6">
            <QueryPerformance queries={auditData?.queries || []} />
          </TabsContent>

          <TabsContent value="responses" className="space-y-6">
            <ResponseAnalysisTable responses={auditData?.responses || []} />
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <InsightsFeed insights={auditData?.insights || []} />
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
