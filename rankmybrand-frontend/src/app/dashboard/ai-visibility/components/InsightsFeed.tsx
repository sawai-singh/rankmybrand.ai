'use client';

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

  const getIconColor = (type: string, importance?: string) => {
    if (importance === 'high') return 'text-red-500 bg-red-50';
    if (importance === 'medium') return 'text-yellow-600 bg-yellow-50';
    if (importance === 'low') return 'text-blue-500 bg-blue-50';

    switch (type) {
      case 'recommendation':
        return 'text-purple-600 bg-purple-50';
      case 'opportunity':
        return 'text-green-500 bg-green-50';
      case 'risk':
        return 'text-red-500 bg-red-50';
      case 'key':
        return 'text-blue-500 bg-blue-50';
      case 'theme':
        return 'text-purple-500 bg-purple-50';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'recommendation':
        return { label: 'Strategic Recommendation', color: 'bg-purple-100 text-purple-800' };
      case 'opportunity':
        return { label: 'Opportunity', color: 'bg-green-100 text-green-800' };
      case 'risk':
        return { label: 'Risk', color: 'bg-red-100 text-red-800' };
      case 'key':
        return { label: 'Key Insight', color: 'bg-blue-100 text-blue-800' };
      case 'theme':
        return { label: 'Theme', color: 'bg-purple-100 text-purple-800' };
      default:
        return { label: 'Insight', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getPriorityBadge = (importance?: string) => {
    if (!importance) return null;

    const config: Record<string, { label: string; color: string }> = {
      high: { label: 'High Priority', color: 'bg-red-100 text-red-800 border-red-200' },
      medium: { label: 'Medium Priority', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      low: { label: 'Low Priority', color: 'bg-blue-100 text-blue-800 border-blue-200' },
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1">Strategic Recommendations</p>
                  <p className="text-3xl font-bold text-purple-700">{counts.recommendations}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Lightbulb className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1">High Priority Items</p>
                  <p className="text-3xl font-bold text-green-700">{counts.opportunities}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Target className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1">Total Insights</p>
                  <p className="text-3xl font-bold text-blue-700">{propInsights.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Insights Feed */}
      <Card className="shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-white">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Lightbulb className="w-5 h-5 text-purple-600" />
            </div>
            AI Insights & Recommendations
          </CardTitle>
          <CardDescription>
            {propInsights.length} AI-powered insights discovered from your visibility analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {propInsights.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <Lightbulb className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No insights available for this audit.</p>
                <p className="text-sm text-gray-400 mt-1">Insights will appear here once the analysis is complete.</p>
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
                    <div className={`border rounded-xl transition-all duration-200 ${
                      isExpanded
                        ? 'border-purple-300 shadow-lg bg-purple-50/30'
                        : 'border-gray-200 hover:border-purple-200 hover:shadow-md bg-white'
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

                            <p className="text-base font-semibold text-gray-900 leading-relaxed">
                              {insight.message}
                            </p>

                            {insight.details?.executive_pitch && !isExpanded && (
                              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
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
                            <div className="px-5 pb-5 pt-2 border-t border-gray-200 bg-gradient-to-b from-white to-gray-50">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                                {/* Executive Pitch */}
                                {insight.details.executive_pitch && (
                                  <div className="lg:col-span-2">
                                    <div className="flex items-start gap-2 mb-2">
                                      <Zap className="w-4 h-4 text-purple-600 mt-0.5" />
                                      <h4 className="text-sm font-semibold text-gray-900">Executive Summary</h4>
                                    </div>
                                    <p className="text-sm text-gray-700 leading-relaxed bg-purple-50 p-3 rounded-lg">
                                      {insight.details.executive_pitch}
                                    </p>
                                  </div>
                                )}

                                {/* Quick Wins */}
                                {insight.details.quick_wins && insight.details.quick_wins.length > 0 && (
                                  <div>
                                    <div className="flex items-start gap-2 mb-3">
                                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                                      <h4 className="text-sm font-semibold text-gray-900">Quick Wins</h4>
                                    </div>
                                    <ul className="space-y-2">
                                      {insight.details.quick_wins.map((win: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                          <span className="text-green-500 mt-0.5">✓</span>
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
                                      <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
                                      <h4 className="text-sm font-semibold text-gray-900">Next Steps</h4>
                                    </div>
                                    <ul className="space-y-2">
                                      {insight.details.next_steps.map((step: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                          <span className="text-blue-500 font-semibold mt-0.5">{i + 1}.</span>
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
                                      <DollarSign className="w-4 h-4 text-green-600 mt-0.5" />
                                      <h4 className="text-sm font-semibold text-gray-900">ROI Projection</h4>
                                    </div>
                                    <p className="text-sm text-gray-700 leading-relaxed bg-green-50 p-3 rounded-lg">
                                      {insight.details.roi_calculation}
                                    </p>
                                  </div>
                                )}

                                {/* Strategic Rationale */}
                                {insight.details.strategic_rationale && (
                                  <div className="lg:col-span-2">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Strategic Rationale</h4>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                      {insight.details.strategic_rationale}
                                    </p>
                                  </div>
                                )}

                                {/* Implementation Approach */}
                                {insight.details.implementation_approach && (
                                  <div className="lg:col-span-2">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Implementation Approach</h4>
                                    <p className="text-sm text-gray-700 leading-relaxed bg-blue-50 p-3 rounded-lg">
                                      {insight.details.implementation_approach}
                                    </p>
                                  </div>
                                )}

                                {/* Priority Score */}
                                {insight.details.priority_score && (
                                  <div className="lg:col-span-2">
                                    <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                                      <span className="text-sm font-medium text-gray-700">Priority Score</span>
                                      <div className="flex items-center gap-3">
                                        <div className="flex-1 max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-gradient-to-r from-yellow-400 to-green-500"
                                            style={{ width: `${insight.details.priority_score}%` }}
                                          />
                                        </div>
                                        <span className="text-lg font-bold text-gray-900">{insight.details.priority_score}/100</span>
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
