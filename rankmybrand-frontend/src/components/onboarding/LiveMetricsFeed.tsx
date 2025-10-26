'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Activity } from 'lucide-react';

interface LiveMetricsFeedProps {
  metrics: string[];
}

export function LiveMetricsFeed({ metrics }: LiveMetricsFeedProps) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
          <Activity className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">
          Live Analysis
        </h3>
      </div>

      <div className="space-y-0">
        <AnimatePresence mode="popLayout">
          {metrics.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center"
            >
              <div className="inline-flex items-center gap-2 text-sm text-neutral-500">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Activity className="w-4 h-4" />
                </motion.div>
                <span>Starting analysis...</span>
              </div>
            </motion.div>
          )}

          {metrics.map((metric, index) => (
            <motion.div
              key={`${metric}-${index}`}
              layout
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{
                duration: 0.4,
                ease: 'easeOut',
                layout: { duration: 0.3 }
              }}
              className="flex items-start gap-3 py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.2,
                  type: 'spring',
                  stiffness: 500,
                  damping: 25
                }}
                className="flex-shrink-0 mt-0.5"
              >
                <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-500" />
              </motion.div>

              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-neutral-700 dark:text-neutral-300 flex-1 leading-relaxed"
              >
                {metric}
              </motion.span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Metrics Count Badge */}
      {metrics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">Completed checks</span>
            <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-0 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
              {metrics.length}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
