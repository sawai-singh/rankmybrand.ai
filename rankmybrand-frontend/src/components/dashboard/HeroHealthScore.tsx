'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Users, Target, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
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

// Progress Ring Component with Animation
const ProgressRing = ({ score, color }: { score: number; color: string }) => {
  const [progress, setProgress] = useState(0);
  const radius = 85;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(score);
    }, 200);
    return () => clearTimeout(timer);
  }, [score]);

  // Dynamic colors based on score
  const getStrokeColor = () => {
    if (score >= 71) return '#22C55E'; // green-500
    if (score >= 41) return '#F59E0B'; // amber-500
    return '#EF4444'; // red-500
  };

  return (
    <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        stroke="#E5E7EB"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      {/* Progress circle */}
      <motion.circle
        stroke={getStrokeColor()}
        fill="transparent"
        strokeWidth={stroke}
        strokeDasharray={circumference + ' ' + circumference}
        style={{
          strokeDashoffset,
          strokeLinecap: 'round',
        }}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
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
    }, 300);
    return () => clearTimeout(timer);
  }, [avgScore]);

  // Determine status badge styling
  const getStatusBadgeStyle = () => {
    if (avgScore >= 71) {
      return 'bg-green-100 text-green-700 border-green-300';
    } else if (avgScore >= 41) {
      return 'bg-amber-100 text-amber-700 border-amber-300';
    } else {
      return 'bg-red-100 text-red-700 border-red-300';
    }
  };

  // Determine border color
  const getBorderColor = () => {
    if (avgScore >= 71) return 'border-green-500';
    if (avgScore >= 41) return 'border-amber-500';
    return 'border-red-500';
  };

  const hasCriticalIssues = criticalIssues && criticalIssues.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mb-8"
    >
      {/* Priority Alert Banner - Shows above health card if critical issues exist */}
      {hasCriticalIssues && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mb-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              </motion.div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-1">
                  ATTENTION REQUIRED
                </h3>
                <p className="text-sm text-amber-800 leading-relaxed">
                  {criticalIssues[0]}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                View Actions
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Hero Health Score Card */}
      <Card className={`border-2 ${getBorderColor()} shadow-lg hover:shadow-xl transition-shadow duration-300`}>
        <div className="relative overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-purple-50/30 to-white opacity-60" />

          <div className="relative p-8">
            <div className="flex items-center justify-between flex-wrap gap-8">
              {/* Left Section: Progress Ring & Score */}
              <div className="flex items-center gap-8">
                {/* Company Logo */}
                {companyLogoUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={companyLogoUrl}
                      alt={`${companyName || 'Company'} logo`}
                      className="w-20 h-20 rounded-xl object-contain bg-white p-3 shadow-md border-2 border-gray-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Progress Ring */}
                <div className="relative">
                  <ProgressRing score={avgScore} color={status.color} />
                  {/* Score in center */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      className="text-5xl font-bold text-purple-900"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                    >
                      {displayScore}
                    </motion.span>
                    <span className="text-sm text-gray-500 font-medium">/ 100</span>
                  </div>
                </div>

                {/* Score Info */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-700 mb-2">
                    AI Visibility Health
                  </h2>
                  <Badge
                    className={`text-sm px-4 py-1.5 font-semibold tracking-wide border ${getStatusBadgeStyle()}`}
                  >
                    {status.icon} {status.label.toUpperCase()}
                  </Badge>

                  {/* Quick Stats */}
                  <div className="mt-4 flex items-center gap-6 text-xs">
                    <div className="flex items-center gap-1.5">
                      {monthlyChange >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-red-500 transform rotate-180" />
                      )}
                      <span className={monthlyChange >= 0 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                        {monthlyChange >= 0 ? '+' : ''}{monthlyChange}% vs last month
                      </span>
                    </div>
                    <div className="h-4 w-px bg-gray-300" />
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-purple-500" />
                      <span className="text-gray-700 font-medium">
                        #{competitorRank} of {totalCompetitors} competitors
                      </span>
                    </div>
                    <div className="h-4 w-px bg-gray-300" />
                    <div className="flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-700 font-medium">
                        {actionableInsights} actions ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Section: Breakdown Pills */}
              <div className="flex-1 min-w-[280px]">
                <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">
                  Score Breakdown
                </h3>
                <div className="space-y-2">
                  {/* Visibility */}
                  <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:scale-[1.02] transition-all">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-sm font-medium text-gray-700">Visibility</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{breakdown.visibility}</span>
                  </div>

                  {/* Sentiment */}
                  <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-pink-300 hover:scale-[1.02] transition-all">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-pink-500" />
                      <span className="text-sm font-medium text-gray-700">Sentiment</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{breakdown.sentiment}</span>
                  </div>

                  {/* Recommendations */}
                  <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:scale-[1.02] transition-all">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-gray-700">Recommendations</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{breakdown.recommendations}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expandable section */}
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 pt-6 border-t border-gray-200"
              >
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Calculation Methodology</h3>
                <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Visibility (40%):</span>
                    <p className="mt-1">Overall presence across AI platforms</p>
                  </div>
                  <div>
                    <span className="font-medium">Sentiment (30%):</span>
                    <p className="mt-1">Quality of brand mentions</p>
                  </div>
                  <div>
                    <span className="font-medium">Recommendations (30%):</span>
                    <p className="mt-1">Rate of direct recommendations</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Expand/Collapse button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="absolute bottom-2 right-4 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
            >
              {isExpanded ? (
                <>
                  <span>Show less</span>
                  <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  <span>Show methodology</span>
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
