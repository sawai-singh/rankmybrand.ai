'use client';

import { motion } from 'framer-motion';
import { Zap, Shield, Clock, CheckCircle } from 'lucide-react';

interface TrustSignalsBarProps {
  estimatedTimeLeft: number; // in seconds
}

export function TrustSignalsBar({ estimatedTimeLeft }: TrustSignalsBarProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const signals = [
    {
      icon: Zap,
      label: 'AI Models',
      value: 'Active',
      detail: 'GPT-4, Claude 3.5',
      color: 'text-interactive-600 dark:text-interactive-400'
    },
    {
      icon: Shield,
      label: 'Security',
      value: 'Encrypted',
      detail: 'SOC 2 Compliant',
      color: 'text-success-600 dark:text-success-400'
    },
    {
      icon: Clock,
      label: 'Time Left',
      value: formatTime(estimatedTimeLeft),
      detail: 'Faster than 89%',
      color: 'text-neutral-600 dark:text-neutral-400'
    },
    {
      icon: CheckCircle,
      label: 'Quality',
      value: 'Premium',
      detail: '118 LLM Calls',
      color: 'text-success-600 dark:text-success-400'
    }
  ];

  return (
    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {signals.map((signal, index) => (
          <motion.div
            key={signal.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon */}
            <div className="relative mb-3">
              <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <signal.icon className={`w-6 h-6 ${signal.color}`} />
              </div>

              {/* Pulse animation for active signals */}
              {(signal.label === 'AI Models' || signal.label === 'Time Left') && (
                <motion.div
                  className="absolute inset-0 rounded-xl bg-current opacity-20"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0, 0.2]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  style={{ color: signal.color.split(' ')[0].replace('text-', '') }}
                />
              )}
            </div>

            {/* Label */}
            <div className="text-xs text-neutral-500 mb-1">
              {signal.label}
            </div>

            {/* Value */}
            <div className="text-lg font-mono tabular-nums font-bold text-neutral-900 dark:text-neutral-0 mb-1">
              {signal.value}
            </div>

            {/* Detail */}
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              {signal.detail}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Additional Trust Message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700 text-center"
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Processing at{' '}
          <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-0">
            1.2TB/day
          </span>
          {' '}• Trusted by{' '}
          <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-0">
            1,000+
          </span>
          {' '}brands
        </p>
      </motion.div>
    </div>
  );
}
