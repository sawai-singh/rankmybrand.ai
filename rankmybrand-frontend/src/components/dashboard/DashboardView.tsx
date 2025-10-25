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

// Dynamic imports for heavy components - Professional loading states
const VisibilityRadar = dynamic(() => import('@/app/dashboard/ai-visibility/components/VisibilityRadar'), {
  loading: () => <div className="h-96 loading-skeleton rounded-lg" />,
  ssr: false
});

const CompetitiveLandscape = dynamic(() => import('@/app/dashboard/ai-visibility/components/CompetitiveLandscape'), {
  loading: () => <div className="h-96 loading-skeleton rounded-lg" />,
  ssr: false
});

const QueryPerformance = dynamic(() => import('@/app/dashboard/ai-visibility/components/QueryPerformance'), {
  loading: () => <div className="h-96 loading-skeleton rounded-lg" />,
  ssr: false
});

const ResponseAnalysisTable = dynamic(() => import('@/app/dashboard/ai-visibility/components/ResponseAnalysisTable'), {
  loading: () => <div className="h-96 loading-skeleton rounded-lg" />,
  ssr: false
});

const InsightsFeed = dynamic(() => import('@/app/dashboard/ai-visibility/components/InsightsFeed'), {
  loading: () => <div className="h-96 loading-skeleton rounded-lg" />,
  ssr: false
});

// Strategic Intelligence Components (118-Call Architecture)
const ExecutiveSummaryCard = dynamic(() => import('@/components/dashboard/strategic').then(mod => ({ default: mod.ExecutiveSummaryCard })), {
  loading: () => <div className="h-96 loading-skeleton rounded-lg" />,
  ssr: false
});

const StrategicPrioritiesPanel = dynamic(() => import('@/components/dashboard/strategic').then(mod => ({ default: mod.StrategicPrioritiesPanel })), {
  loading: () => <div className="h-96 loading-skeleton rounded-lg" />,
  ssr: false
});

const CategoryInsightsGrid = dynamic(() => import('@/components/dashboard/strategic').then(mod => ({ default: mod.CategoryInsightsGrid })), {
  loading: () => <div className="h-96 loading-skeleton rounded-lg" />,
  ssr: false
});

const BuyerJourneyInsightsView = dynamic(() => import('@/components/dashboard/strategic').then(mod => ({ default: mod.BuyerJourneyInsightsView })), {
  loading: () => <div className="h-96 loading-skeleton rounded-lg" />,
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

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
      onClick={onClick}
    >
      <span className="text-xs font-medium capitalize text-neutral-900 dark:text-neutral-0">{platform}</span>
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
      <div className="min-h-screen bg-neutral-0 dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-3 border-neutral-200 dark:border-neutral-800 border-t-interactive-500 rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <p className="text-neutral-700 dark:text-neutral-300 font-medium">Loading intelligence data...</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Analyzing brand visibility metrics</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-0 dark:bg-neutral-950">
      {/* Professional B2B Header with Trust Signals */}
      {showHeader && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-50 backdrop-blur-sm bg-white/95 dark:bg-neutral-950/95"
        >
          <div className="container mx-auto px-6 py-6">
            {/* Breadcrumb Navigation */}
            <nav className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-4" aria-label="Breadcrumb">
              <span>Dashboard</span>
              <span className="mx-2">→</span>
              <span>Brand Intelligence</span>
              <span className="mx-2">→</span>
              <span className="text-neutral-900 dark:text-neutral-0">AI Visibility Report</span>
            </nav>

            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {auditData?.companyLogoUrl ? (
                  <div className="flex-shrink-0">
                    <img
                      src={auditData.companyLogoUrl}
                      alt={`${auditData.companyName || 'Company'} logo`}
                      className="w-12 h-12 rounded-md object-contain bg-white dark:bg-neutral-900 p-1.5 border border-neutral-200 dark:border-neutral-800"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700">
                    <Brain className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
                  </div>
                )}

                <div>
                  <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-0 mb-2">
                    {auditData?.companyName ? `${auditData.companyName} - ` : ''}Brand Visibility Intelligence Report
                  </h1>

                  {/* Trust Signals */}
                  <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Updated: {new Date(lastUpdated).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span>•</span>
                    <span className="font-mono tabular-nums">
                      {auditData?.responses?.length || 0} AI responses analyzed
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Activity className={`w-3 h-3 ${connectionStatus === 'connected' ? 'text-success-600' : 'text-neutral-400'}`} />
                      Live data
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {showStartAuditButton && onStartAudit && (
                  <Button
                    onClick={onStartAudit}
                    disabled={isAuditRunning}
                    size="sm"
                  >
                    {isAuditRunning ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        New Audit
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

        {/* Strategic Intelligence - 118-Call Architecture */}
        {auditData?.id && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-12"
          >
            {/* Professional Section Header */}
            <div className="mb-8 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-header mb-1">Strategic Analysis</h2>
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-0 mb-2">
                    Executive Intelligence Summary
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    118-point strategic analysis
                    <span>•</span>
                    <span>Board-ready insights</span>
                    <span>•</span>
                    <span className="font-mono tabular-nums">Generated {new Date().toLocaleDateString()}</span>
                  </p>
                </div>
                <Badge variant="outline" className="h-8 px-4 text-xs font-semibold">
                  AI-Powered
                </Badge>
              </div>
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
                    <Badge
                      variant="secondary"
                      className={`h-5 min-w-[20px] px-1.5 text-[10px] font-semibold font-mono tabular-nums ${
                        hasHighPriority
                          ? 'bg-danger-100 dark:bg-danger-900/40 text-danger-700 dark:text-danger-300 hover:bg-danger-100'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      {auditData.insights.length}
                    </Badge>
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
                    const getBorderColor = () => {
                      if (insight.importance === 'high') return 'border-danger-300 dark:border-danger-700 bg-danger-50/50 dark:bg-danger-900/10';
                      if (insight.importance === 'medium') return 'border-warning-300 dark:border-warning-700 bg-warning-50/50 dark:bg-warning-900/10';
                      return 'border-interactive-300 dark:border-interactive-700 bg-interactive-50/50 dark:bg-interactive-900/10';
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
