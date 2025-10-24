'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Minus, AlertCircle } from 'lucide-react';
import { safeScore } from '@/lib/dashboard-utils';

interface EnhancedKPICardProps {
  value: number;
  label: string;
  icon: React.ElementType;
  color: string;
  trend?: number[]; // 7-day trend data
  comparisonValue?: number; // vs industry average
  priority: 'critical' | 'warning' | 'good';
  onActionClick?: () => void;
}

// Sparkline Component
const Sparkline = ({ data, color, label }: { data: number[]; color: string; label: string }) => {
  if (!data || data.length === 0) return null;

  const width = 80;
  const height = 24;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg width={width} height={height} className="inline-block">
      {/* Area fill */}
      <defs>
        <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`}
        fill={`url(#gradient-${label})`}
      />
      {/* Line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
      />
    </svg>
  );
};

export default function EnhancedKPICard({
  value,
  label,
  icon: Icon,
  color,
  trend = [45, 48, 46, 50, 52, 51, value],
  comparisonValue = 0,
  priority,
  onActionClick,
}: EnhancedKPICardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  // Priority-based styling
  const getPriorityConfig = () => {
    switch (priority) {
      case 'critical':
        return {
          borderColor: 'border-red-500',
          borderWidth: 'border-[3px]',
          badgeColor: 'bg-red-500',
          badgeText: 'CRITICAL',
          badge: '🔴',
          pulseAnimation: true,
          height: 'min-h-[240px]',
          scoreSize: 'text-4xl',
          ctaButton: {
            label: 'Fix This Now',
            variant: 'default' as const,
            className: 'bg-red-500 hover:bg-red-600 text-white',
          },
        };
      case 'warning':
        return {
          borderColor: 'border-amber-500',
          borderWidth: 'border-2',
          badgeColor: 'bg-amber-500',
          badgeText: 'NEEDS ATTENTION',
          badge: '⚡',
          pulseAnimation: false,
          height: 'min-h-[220px]',
          scoreSize: 'text-[2rem]',
          ctaButton: {
            label: 'Improve This',
            variant: 'outline' as const,
            className: 'border-amber-500 text-amber-700 hover:bg-amber-50',
          },
        };
      case 'good':
        return {
          borderColor: 'border-green-500',
          borderWidth: 'border-2',
          badgeColor: 'bg-green-500',
          badgeText: 'PERFORMING WELL',
          badge: '✨',
          pulseAnimation: false,
          height: 'min-h-[200px]',
          scoreSize: 'text-[1.75rem]',
          ctaButton: {
            label: 'Maintain Strategy',
            variant: 'ghost' as const,
            className: 'text-green-700 hover:bg-green-50',
          },
        };
    }
  };

  const config = getPriorityConfig();

  // Determine quality label
  const getQualityLabel = () => {
    if (value >= 75) return { text: 'Excellent', bg: 'bg-green-50', text: 'text-green-700' };
    if (value >= 50) return { text: 'Good', bg: 'bg-blue-50', text: 'text-blue-700' };
    if (value >= 25) return { text: 'Fair', bg: 'bg-amber-50', text: 'text-amber-700' };
    return { text: 'Poor', bg: 'bg-red-50', text: 'text-red-700' };
  };

  const quality = getQualityLabel();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative"
    >
      <Card
        className={`
          ${config.borderWidth} ${config.borderColor} ${config.height}
          hover:shadow-xl transition-all duration-300 group relative overflow-hidden
          ${isHovered ? 'scale-[1.02]' : ''}
        `}
      >
        {/* Priority Badge - Top Right */}
        <div className="absolute top-3 right-3">
          {config.pulseAnimation ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-2xl"
            >
              {config.badge}
            </motion.div>
          ) : (
            <span className="text-xl">{config.badge}</span>
          )}
        </div>

        {/* Gradient background effect */}
        <div
          className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
          style={{
            background: `linear-gradient(135deg, ${color}33 0%, ${color}11 100%)`,
          }}
        />

        <div className="relative z-10 p-6">
          {/* Header with Icon and Label */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="p-2.5 rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)`,
              }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="flex-1">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {label}
              </span>
            </div>
          </div>

          {/* Score Display */}
          <div className="space-y-3 mb-4">
            <div className="flex items-end gap-2">
              <motion.span
                className={`${config.scoreSize} font-bold text-gray-900`}
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

            {/* Progress Bar */}
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${color}88 0%, ${color} 100%)`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${displayValue}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              />
            </div>

            {/* Sparkline and Quality Label */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkline data={trend} color={color} label={label} />
                <Badge className={`text-xs px-2 py-0.5 ${quality.bg} ${quality.text} border-0`}>
                  {quality.text}
                </Badge>
              </div>
            </div>

            {/* Comparison */}
            <div className="flex items-center gap-1.5 text-xs">
              {comparisonValue > 0 ? (
                <>
                  <ArrowUp className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-green-700 font-medium">
                    +{comparisonValue.toFixed(1)}% vs industry
                  </span>
                </>
              ) : comparisonValue === 0 ? (
                <>
                  <Minus className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-600 font-medium">At industry average</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-700 font-medium">
                    {comparisonValue.toFixed(1)}% vs industry
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Button (only for critical/warning) */}
          {(priority === 'critical' || priority === 'warning') && (
            <Button
              size="sm"
              variant={config.ctaButton.variant}
              className={`w-full h-9 text-xs font-semibold ${config.ctaButton.className}`}
              onClick={onActionClick}
            >
              {config.ctaButton.label}
            </Button>
          )}

          {/* Good performance - show maintain button on hover */}
          {priority === 'good' && isHovered && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                size="sm"
                variant={config.ctaButton.variant}
                className={`w-full h-9 text-xs font-semibold ${config.ctaButton.className}`}
                onClick={onActionClick}
              >
                {config.ctaButton.label}
              </Button>
            </motion.div>
          )}
        </div>

        {/* Glow effect on hover for critical items */}
        {priority === 'critical' && isHovered && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `0 0 20px 2px ${color}40`,
            }}
          />
        )}
      </Card>
    </motion.div>
  );
}
