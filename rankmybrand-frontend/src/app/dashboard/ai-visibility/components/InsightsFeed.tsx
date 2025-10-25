'use client';

/**
 * InsightsFeed - Professional B2B Insights Display
 * Design System: Monochrome + Semantic Colors
 * - Neutral UI with semantic colors for priority only
 * - Professional typography and trust signals
 * - Bloomberg Terminal aesthetic
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, AlertTriangle, Target, ChevronDown, ChevronUp, Zap, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Insight {
  type: string;
  message: string;
  importance?: 'high' | 'medium' | 'low';
  details?: any;
}

interface InsightsFeedProps {
  insights?: Insight[];
}

export default function InsightsFeed({ insights: propInsights = [] }: InsightsFeedProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const getIcon = (type: string) => {
    switch (type) {
      case 'recommendation':
        return <Lightbulb className="w-5 h-5" />;
      case 'opportunity':
        return <Target className="w-5 h-5" />;
      case 'risk':
        return <AlertTriangle className="w-5 h-5" />;
      case 'key':
        return <Lightbulb className="w-5 h-5" />;
      case 'theme':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  // Professional neutral styling - semantic colors for priority only
  const getIconColor = (type: string, importance?: string) => {
    // Semantic colors for priority levels only
    if (importance === 'high') return 'text-danger-700 dark:text-danger-500 bg-danger-50 dark:bg-danger-900/20';
    if (importance === 'medium') return 'text-warning-700 dark:text-warning-500 bg-warning-50 dark:bg-warning-900/20';
    if (importance === 'low') return 'text-interactive-700 dark:text-interactive-500 bg-interactive-50 dark:bg-interactive-900/20';

    // All types use neutral colors for consistency
    return 'text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800';
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'recommendation':
        return { label: 'Strategic Recommendation', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200' };
      case 'opportunity':
        return { label: 'Opportunity', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200' };
      case 'risk':
        return { label: 'Risk', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200' };
      case 'key':
        return { label: 'Key Insight', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200' };
      case 'theme':
        return { label: 'Theme', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200' };
      default:
        return { label: 'Insight', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200' };
    }
  };

  const getPriorityBadge = (importance?: string) => {
    if (!importance) return null;

    // Semantic colors for priority data only
    const config: Record<string, { label: string; color: string }> = {
      high: { label: 'High Priority', color: 'bg-danger-50 dark:bg-danger-900/20 text-danger-800 dark:text-danger-400 border-danger-200 dark:border-danger-700' },
      medium: { label: 'Medium Priority', color: 'bg-warning-50 dark:bg-warning-900/20 text-warning-800 dark:text-warning-400 border-warning-200 dark:border-warning-700' },
      low: { label: 'Low Priority', color: 'bg-interactive-50 dark:bg-interactive-900/20 text-interactive-800 dark:text-interactive-400 border-interactive-200 dark:border-interactive-700' },
    };

    const conf = config[importance];
    if (!conf) return null;
    return <Badge className={`${conf.color} border text-xs font-medium`}>{conf.label}</Badge>;
  };

  // Count by type
  const counts = {
    recommendations: propInsights.filter(i => i.type === 'recommendation').length,
    opportunities: propInsights.filter(i => i.importance === 'high').length,
    general: propInsights.filter(i => i.type === 'general' || i.type === 'key').length,
  };

  return (
    <div className="space-y-6">
      {/* Professional Summary Cards - Neutral Design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="section-header mb-2">Strategic Recommendations</p>
                  <p className="number-display-metric text-4xl">{counts.recommendations}</p>
                </div>
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                  <Lightbulb className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <Card className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="section-header mb-2">High Priority Items</p>
                  <p className="number-display-metric text-4xl">{counts.opportunities}</p>
                </div>
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                  <Target className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
        >
          <Card className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="section-header mb-2">Total Insights</p>
                  <p className="number-display-metric text-4xl">{propInsights.length}</p>
                </div>
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                  <TrendingUp className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Professional Insights Feed */}
      <Card className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <CardHeader className="border-b border-neutral-200 dark:border-neutral-800 p-6">
          <div className="section-header mb-2">Strategic Intelligence</div>
          <CardTitle className="text-2xl font-bold text-neutral-900 dark:text-neutral-0 flex items-center gap-2">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-md">
              <Lightbulb className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </div>
            AI Insights & Recommendations
          </CardTitle>
          <CardDescription className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            <span className="font-mono tabular-nums font-semibold">{propInsights.length}</span> AI-powered insights discovered from your visibility analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {propInsights.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full mb-4">
                  <Lightbulb className="w-8 h-8 text-neutral-400" />
                </div>
                <p className="text-neutral-700 dark:text-neutral-300 font-semibold">No insights available for this audit.</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Insights will appear here once the analysis is complete.</p>
              </div>
            ) : (
              propInsights.map((insight, index) => {
                const typeInfo = getTypeLabel(insight.type);
                const isExpanded = expandedIndex === index;
                const hasDetails = insight.details && Object.keys(insight.details).length > 0;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="group"
                  >
                    <div className={`border rounded-md transition-all duration-150 ${
                      isExpanded
                        ? 'border-neutral-300 dark:border-neutral-700 shadow-md bg-neutral-50 dark:bg-neutral-800/30'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm bg-white dark:bg-neutral-900'
                    }`}>
                      {/* Header */}
                      <div
                        className={`p-5 cursor-pointer ${hasDetails ? '' : 'cursor-default'}`}
                        onClick={() => hasDetails && setExpandedIndex(isExpanded ? null : index)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`flex-shrink-0 p-3 rounded-xl ${getIconColor(insight.type, insight.importance)}`}>
                            {getIcon(insight.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={`${typeInfo.color} text-xs font-semibold`}>
                                  {typeInfo.label}
                                </Badge>
                                {getPriorityBadge(insight.importance)}
                              </div>

                              {hasDetails && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-shrink-0"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>

                            <p className="text-base font-semibold text-neutral-900 dark:text-neutral-0 leading-relaxed">
                              {insight.message}
                            </p>

                            {insight.details?.executive_pitch && !isExpanded && (
                              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed">
                                {insight.details.executive_pitch}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {isExpanded && hasDetails && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/20">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                                {/* Executive Pitch */}
                                {insight.details.executive_pitch && (
                                  <div className="lg:col-span-2">
                                    <div className="flex items-start gap-2 mb-2">
                                      <Zap className="w-4 h-4 text-neutral-600 dark:text-neutral-400 mt-0.5" />
                                      <h4 className="section-header">Executive Summary</h4>
                                    </div>
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed bg-neutral-100 dark:bg-neutral-800 p-4 rounded-md border border-neutral-200 dark:border-neutral-700">
                                      {insight.details.executive_pitch}
                                    </p>
                                  </div>
                                )}

                                {/* Quick Wins */}
                                {insight.details.quick_wins && insight.details.quick_wins.length > 0 && (
                                  <div>
                                    <div className="flex items-start gap-2 mb-3">
                                      <CheckCircle2 className="w-4 h-4 text-success-600 mt-0.5" />
                                      <h4 className="section-header text-success-700 dark:text-success-500">Quick Wins</h4>
                                    </div>
                                    <ul className="space-y-2">
                                      {insight.details.quick_wins.map((win: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                          <CheckCircle2 className="w-4 h-4 text-success-600 mt-0.5 flex-shrink-0" />
                                          <span>{win}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Next Steps */}
                                {insight.details.next_steps && insight.details.next_steps.length > 0 && (
                                  <div>
                                    <div className="flex items-start gap-2 mb-3">
                                      <Clock className="w-4 h-4 text-neutral-600 dark:text-neutral-400 mt-0.5" />
                                      <h4 className="section-header">Next Steps</h4>
                                    </div>
                                    <ul className="space-y-2">
                                      {insight.details.next_steps.map((step: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                          <span className="font-mono tabular-nums font-semibold text-neutral-600 dark:text-neutral-400 mt-0.5 min-w-[1.5rem]">{i + 1}.</span>
                                          <span>{step}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* ROI Calculation */}
                                {insight.details.roi_calculation && (
                                  <div className="lg:col-span-2">
                                    <div className="flex items-start gap-2 mb-2">
                                      <DollarSign className="w-4 h-4 text-success-600 mt-0.5" />
                                      <h4 className="section-header text-success-700 dark:text-success-500">ROI Projection</h4>
                                    </div>
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed bg-success-50 dark:bg-success-900/10 p-4 rounded-md border border-success-200 dark:border-success-800">
                                      {insight.details.roi_calculation}
                                    </p>
                                  </div>
                                )}

                                {/* Strategic Rationale */}
                                {insight.details.strategic_rationale && (
                                  <div className="lg:col-span-2">
                                    <h4 className="section-header mb-2">Strategic Rationale</h4>
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                                      {insight.details.strategic_rationale}
                                    </p>
                                  </div>
                                )}

                                {/* Implementation Approach */}
                                {insight.details.implementation_approach && (
                                  <div className="lg:col-span-2">
                                    <h4 className="section-header mb-2">Implementation Approach</h4>
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed bg-neutral-100 dark:bg-neutral-800 p-4 rounded-md border border-neutral-200 dark:border-neutral-700">
                                      {insight.details.implementation_approach}
                                    </p>
                                  </div>
                                )}

                                {/* Priority Score */}
                                {insight.details.priority_score && (
                                  <div className="lg:col-span-2">
                                    <div className="flex items-center justify-between p-4 bg-neutral-100 dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700">
                                      <span className="section-header">Priority Score</span>
                                      <div className="flex items-center gap-3">
                                        <div className="flex-1 max-w-xs h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-neutral-900 dark:bg-neutral-0"
                                            style={{ width: `${insight.details.priority_score}%` }}
                                          />
                                        </div>
                                        <span className="font-mono tabular-nums text-lg font-bold text-neutral-900 dark:text-neutral-0">{insight.details.priority_score}/100</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
