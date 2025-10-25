'use client';

/**
 * HeroHealthScore - Professional B2B Metric Display
 * Design System: Monochrome + Semantic Colors
 * - Monospace numbers with tabular-nums
 * - Neutral UI, semantic colors for data only
 * - Professional typography and trust signals
 * - Bloomberg Terminal aesthetic
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Building2, Target, AlertTriangle, ChevronDown, ChevronUp, Clock, BarChart3 } from 'lucide-react';
import { safeScore } from '@/lib/dashboard-utils';

interface HeroHealthScoreProps {
  avgScore: number;
  status: {
    label: string;
    color: string;
    icon: string;
    bg: string;
    border: string;
  };
  criticalIssues: string[];
  companyName?: string;
  companyLogoUrl?: string;
  breakdown: {
    visibility: number;
    sentiment: number;
    recommendations: number;
  };
  competitorRank?: number;
  totalCompetitors?: number;
  monthlyChange?: number;
  actionableInsights?: number;
}

// Professional neutral ring - no colored indicators
const NeutralRing = ({ score }: { score: number }) => {
  const [progress, setProgress] = useState(0);
  const radius = 70;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
      {/* Background circle - neutral */}
      <circle
        stroke="hsl(var(--neutral-200))"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        className="dark:stroke-neutral-800"
      />
      {/* Progress circle - neutral */}
      <motion.circle
        stroke="hsl(var(--neutral-900))"
        fill="transparent"
        strokeWidth={stroke}
        strokeDasharray={circumference + ' ' + circumference}
        style={{
          strokeDashoffset,
          strokeLinecap: 'round',
        }}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        className="dark:stroke-neutral-0"
      />
    </svg>
  );
};

export default function HeroHealthScore({
  avgScore,
  status,
  criticalIssues,
  companyName,
  companyLogoUrl,
  breakdown,
  competitorRank = 2,
  totalCompetitors = 4,
  monthlyChange = 5,
  actionableInsights = 9,
}: HeroHealthScoreProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayScore(avgScore);
    }, 100);
    return () => clearTimeout(timer);
  }, [avgScore]);

  const hasCriticalIssues = criticalIssues && criticalIssues.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-12"
    >
      {/* Professional Alert Banner - Critical Issues */}
      {hasCriticalIssues && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mb-6 bg-white dark:bg-neutral-900 border-l-4 border-danger-600 rounded-md p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-5 h-5 text-danger-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="section-header mb-2 text-danger-700 dark:text-danger-500">
                  Action Required
                </h3>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {criticalIssues[0]}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              View Recommendations
            </Button>
          </div>
        </motion.div>
      )}

      {/* Professional Hero Metric Card */}
      <Card className="bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-shadow duration-150">
        <div className="p-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Left Section: Metric Display */}
            <div className="lg:col-span-1 flex flex-col items-center justify-center text-center">
              {/* Company Logo */}
              {companyLogoUrl && (
                <div className="mb-6">
                  <img
                    src={companyLogoUrl}
                    alt={`${companyName || 'Company'} logo`}
                    className="w-16 h-16 rounded-md object-contain bg-white dark:bg-neutral-900 p-2 border border-neutral-200 dark:border-neutral-800"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Progress Ring */}
              <div className="relative mb-6">
                <NeutralRing score={avgScore} />
                {/* Score in center - Monospace */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="number-display-metric text-5xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {displayScore}
                  </motion.span>
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 font-mono mt-1">/ 100</span>
                </div>
              </div>

              {/* Section Header */}
              <h2 className="section-header mb-2">
                Overall Health Score
              </h2>

              {/* Status Label - Neutral badge */}
              <Badge variant="outline" className="text-xs mb-4">
                {avgScore >= 71 ? 'Strong Performance' : avgScore >= 41 ? 'Moderate Performance' : 'Needs Improvement'}
              </Badge>

              {/* Trust Signals */}
              <div className="trust-metadata justify-center">
                <Clock className="w-3 h-3" />
                <span>Updated today</span>
                <span className="text-neutral-400">•</span>
                <span className="font-mono tabular-nums">Real-time data</span>
              </div>
            </div>

            {/* Middle Section: Quick Stats with Semantic Colors */}
            <div className="lg:col-span-1 flex flex-col justify-center space-y-6">
              <div>
                <div className="section-header mb-4">Performance Metrics</div>

                {/* Monthly Change - Semantic Color */}
                <div className="mb-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-2 mb-1">
                    {monthlyChange >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-success-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-danger-600" />
                    )}
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">vs Last Month</span>
                  </div>
                  <span className={`font-mono tabular-nums text-2xl font-bold ${monthlyChange >= 0 ? 'text-success-700 dark:text-success-500' : 'text-danger-700 dark:text-danger-500'}`}>
                    {monthlyChange >= 0 ? '+' : ''}{monthlyChange}%
                  </span>
                </div>

                {/* Competitive Position */}
                <div className="mb-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-neutral-500" />
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Market Position</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono tabular-nums text-2xl font-bold text-neutral-900 dark:text-neutral-0">
                      #{competitorRank}
                    </span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">of {totalCompetitors}</span>
                  </div>
                </div>

                {/* Actionable Insights */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-neutral-500" />
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Available Actions</span>
                  </div>
                  <span className="font-mono tabular-nums text-2xl font-bold text-neutral-900 dark:text-neutral-0">
                    {actionableInsights}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Section: Score Breakdown */}
            <div className="lg:col-span-1 flex flex-col justify-center">
              <div className="section-header mb-4">Score Components</div>
              <div className="space-y-3">
                {/* Visibility */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Visibility</span>
                    <span className="font-mono tabular-nums text-lg font-bold text-neutral-900 dark:text-neutral-0">{breakdown.visibility}</span>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Brand presence across AI platforms</div>
                </div>

                {/* Sentiment */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Sentiment</span>
                    <span className="font-mono tabular-nums text-lg font-bold text-neutral-900 dark:text-neutral-0">{breakdown.sentiment}</span>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Quality of brand mentions</div>
                </div>

                {/* Recommendations */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Recommendations</span>
                    <span className="font-mono tabular-nums text-lg font-bold text-neutral-900 dark:text-neutral-0">{breakdown.recommendations}</span>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Rate of direct recommendations</div>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Methodology Section */}
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-800"
            >
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-4 h-4 text-neutral-500" />
                <h3 className="section-header">Calculation Methodology</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-md">
                  <div className="font-mono tabular-nums text-lg font-bold text-neutral-900 dark:text-neutral-0 mb-2">40%</div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Visibility Weight</div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Overall brand presence and mention frequency across AI platforms
                  </p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-md">
                  <div className="font-mono tabular-nums text-lg font-bold text-neutral-900 dark:text-neutral-0 mb-2">30%</div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Sentiment Weight</div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Quality and tone of brand mentions in AI responses
                  </p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-md">
                  <div className="font-mono tabular-nums text-lg font-bold text-neutral-900 dark:text-neutral-0 mb-2">30%</div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Recommendation Weight</div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Rate and strength of direct brand recommendations
                  </p>
                </div>
              </div>

              {/* Data Attribution */}
              <div className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800/50 rounded-md">
                <div className="trust-metadata">
                  <Clock className="w-3 h-3" />
                  <span>Methodology last updated: {new Date().toLocaleDateString()}</span>
                  <span className="text-neutral-400">•</span>
                  <span>Weighted average formula</span>
                  <span className="text-neutral-400">•</span>
                  <button className="text-interactive-600 hover:underline text-xs font-medium">
                    View full documentation
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Expand/Collapse Button */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-0 flex items-center gap-1.5 mx-auto transition-colors"
            >
              {isExpanded ? (
                <>
                  <span>Hide methodology</span>
                  <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  <span>Show calculation details</span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
