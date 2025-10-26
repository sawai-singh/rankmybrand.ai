'use client';

import { motion } from 'framer-motion';
import { Check, Globe, Search, Sparkles, Shield, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EnrichmentStep {
  id: string;
  label: string;
  description: string;
  duration: number;
  icon: LucideIcon;
  metrics: string[];
}

interface StepIndicatorProps {
  currentStep: number;
  steps: EnrichmentStep[];
  progress: number; // 0-100
}

export function StepIndicator({ currentStep, steps, progress }: StepIndicatorProps) {
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Progress Rail */}
      <div className="absolute top-6 left-0 right-0 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-neutral-900 dark:bg-neutral-0 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Step Nodes */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <motion.div
              key={step.id}
              className="flex flex-col items-center max-w-[140px]"
              animate={{
                scale: isActive ? 1.05 : 1,
                opacity: isComplete || isActive ? 1 : 0.5
              }}
              transition={{ duration: 0.3 }}
            >
              {/* Icon Circle */}
              <div className={cn(
                "relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                isComplete && "bg-success-600 dark:bg-success-500 border-success-600 dark:border-success-500",
                isActive && "bg-neutral-900 dark:bg-neutral-0 border-neutral-900 dark:border-neutral-0",
                !isActive && !isComplete && "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
              )}>
                {isComplete ? (
                  <Check className="w-6 h-6 text-white" strokeWidth={3} />
                ) : (
                  <motion.div
                    animate={isActive ? {
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    } : {}}
                    transition={{
                      duration: 2,
                      repeat: isActive ? Infinity : 0,
                      ease: 'easeInOut'
                    }}
                  >
                    <step.icon className={cn(
                      "w-6 h-6 transition-colors",
                      isActive && "text-white dark:text-neutral-900",
                      !isActive && "text-neutral-400 dark:text-neutral-600"
                    )} />
                  </motion.div>
                )}
              </div>

              {/* Label */}
              <div className="mt-3 text-center">
                <p className={cn(
                  "text-sm font-medium transition-all duration-300",
                  isActive && "text-neutral-900 dark:text-neutral-0 font-bold",
                  isComplete && "text-neutral-700 dark:text-neutral-300",
                  !isActive && !isComplete && "text-neutral-500 dark:text-neutral-500"
                )}>
                  {step.label}
                </p>

                {/* Active Step Description */}
                {isActive && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs text-neutral-600 dark:text-neutral-400 mt-1"
                  >
                    {step.description}
                  </motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
