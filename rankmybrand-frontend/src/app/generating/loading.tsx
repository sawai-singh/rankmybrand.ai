'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Constants for consistency with main page
const SKELETON_ITEMS = {
  progressSteps: 4,
  infoCards: 3,
  actionButtons: 2
} as const;

// Shimmer animation keyframes
const shimmerKeyframes = {
  '0%': { transform: 'translateX(-100%)' },
  '100%': { transform: 'translateX(100%)' }
};

// Custom hook for progressive loading states
const useProgressiveLoading = (delay = 100) => {
  const [visibleItems, setVisibleItems] = useState(0);
  const [isShimmering, setIsShimmering] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleItems(prev => {
        const next = prev + 1;
        if (next >= SKELETON_ITEMS.progressSteps + SKELETON_ITEMS.infoCards) {
          clearInterval(timer);
          // Stop shimmer after all items are visible
          setTimeout(() => setIsShimmering(false), 500);
        }
        return next;
      });
    }, delay);

    return () => clearInterval(timer);
  }, [delay]);

  return { visibleItems, isShimmering };
};

// Skeleton components
interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
  delay?: number;
}

const SkeletonBox = ({ 
  className = '', 
  shimmer = true,
  delay = 0 
}: SkeletonProps) => {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: delay * 0.1, duration: 0.3 }}
      className={`relative overflow-hidden bg-white/5 ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      {shimmer && !shouldReduceMotion && (
        <motion.div
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={shimmerKeyframes}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: 'linear',
            delay: delay * 0.1
          }}
        />
      )}
    </motion.div>
  );
};

const SkeletonText = ({ 
  lines = 1, 
  className = '',
  shimmer = true,
  delay = 0
}: SkeletonProps & { lines?: number }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          className={`h-4 rounded ${
            lines > 1 && i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
          shimmer={shimmer}
          delay={delay + i}
        />
      ))}
    </div>
  );
};

const ProgressStepSkeleton = ({ 
  index, 
  isVisible,
  isLast 
}: { 
  index: number; 
  isVisible: boolean;
  isLast: boolean;
}) => {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.li 
      className="flex items-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: isVisible ? 1 : 0.3,
        scale: isVisible ? 1 : 0.8
      }}
      transition={{ 
        delay: index * 0.1,
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: 'easeOut'
      }}
    >
      <div className="relative">
        <SkeletonBox
          className="w-8 h-8 rounded-full"
          shimmer={isVisible}
          delay={index}
        />
        {isVisible && !shouldReduceMotion && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-purple-500/30"
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut'
            }}
          />
        )}
      </div>
      {!isLast && (
        <SkeletonBox
          className="w-12 h-0.5 ml-2"
          shimmer={false}
          delay={index}
        />
      )}
    </motion.li>
  );
};

const InfoCardSkeleton = ({ 
  index,
  isVisible 
}: { 
  index: number;
  isVisible: boolean;
}) => {
  return (
    <motion.div
      className="flex items-start gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ 
        opacity: isVisible ? 1 : 0,
        x: isVisible ? 0 : -20
      }}
      transition={{ 
        delay: index * 0.1,
        duration: 0.3,
        ease: 'easeOut'
      }}
    >
      <SkeletonBox
        className="w-8 h-8 rounded-lg flex-shrink-0"
        delay={index}
      />
      <div className="flex-1 space-y-2">
        <SkeletonBox
          className="h-4 rounded w-32"
          delay={index}
        />
        <SkeletonBox
          className="h-3 rounded w-full"
          delay={index + 0.5}
        />
      </div>
    </motion.div>
  );
};

// Main loading component
export default function GeneratingLoading() {
  const { visibleItems, isShimmering } = useProgressiveLoading(150);
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Initial server render - show basic skeleton without animations
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-2xl">
            <div className="bg-white/5 rounded-3xl p-8 h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-900">
      {/* Animated gradient background */}
      <motion.div 
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900" />
        
        {/* Animated orbs */}
        {!shouldReduceMotion && (
          <>
            <motion.div
              className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
              animate={{
                x: [0, 30, 0],
                y: [0, -20, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
            <motion.div
              className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
              animate={{
                x: [0, -30, 0],
                y: [0, 20, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 1
              }}
            />
          </>
        )}
      </motion.div>
      
      {/* Main content */}
      <div 
        className="relative z-10 flex min-h-screen items-center justify-center px-4"
        role="status"
        aria-live="polite"
        aria-label="Loading report generation page"
      >
        <div className="w-full max-w-2xl">
          {/* Progress steps skeleton */}
          <nav aria-label="Loading progress steps" className="mb-8">
            <ol className="flex items-center justify-center space-x-2">
              {Array.from({ length: SKELETON_ITEMS.progressSteps }).map((_, i) => (
                <ProgressStepSkeleton
                  key={i}
                  index={i}
                  isVisible={i < visibleItems}
                  isLast={i === SKELETON_ITEMS.progressSteps - 1}
                />
              ))}
            </ol>
          </nav>
          
          {/* Main card skeleton */}
          <motion.article
            className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Central icon skeleton with pulse animation */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <SkeletonBox
                  className="w-24 h-24 rounded-full"
                  shimmer={isShimmering}
                />
                {!shouldReduceMotion && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full bg-purple-500/20"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full bg-blue-500/20"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.3, 0, 0.3]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: 0.5
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Progress bar skeleton */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <SkeletonBox className="h-3 w-20 rounded" />
                <SkeletonBox className="h-3 w-10 rounded" />
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500/30 to-blue-500/30"
                  initial={{ width: '0%' }}
                  animate={{ width: '60%' }}
                  transition={{
                    duration: 2,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    repeatType: 'reverse'
                  }}
                />
              </div>
            </div>
            
            {/* Title and subtitle skeletons */}
            <div className="space-y-4 mb-8">
              <SkeletonBox
                className="h-8 rounded-lg mx-auto max-w-sm"
                shimmer={isShimmering}
                delay={2}
              />
              <SkeletonBox
                className="h-4 rounded mx-auto max-w-xs"
                shimmer={isShimmering}
                delay={3}
              />
              <SkeletonBox
                className="h-3 rounded mx-auto max-w-[200px]"
                shimmer={isShimmering}
                delay={4}
              />
            </div>
            
            {/* Info cards skeleton */}
            <div className="space-y-4 mb-8">
              {Array.from({ length: SKELETON_ITEMS.infoCards }).map((_, i) => (
                <InfoCardSkeleton
                  key={i}
                  index={i + SKELETON_ITEMS.progressSteps}
                  isVisible={i + SKELETON_ITEMS.progressSteps < visibleItems}
                />
              ))}
            </div>

            {/* Email section skeleton */}
            <div className="p-4 bg-black/20 rounded-xl border border-white/10 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SkeletonBox className="w-5 h-5 rounded" />
                  <div className="space-y-1">
                    <SkeletonBox className="h-3 w-24 rounded" />
                    <SkeletonBox className="h-4 w-32 rounded" />
                  </div>
                </div>
                <SkeletonBox className="h-6 w-12 rounded" />
              </div>
            </div>
            
            {/* Action buttons skeleton */}
            <div className="flex flex-col sm:flex-row gap-4">
              {Array.from({ length: SKELETON_ITEMS.actionButtons }).map((_, i) => (
                <motion.div
                  key={i}
                  className="flex-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <SkeletonBox
                    className="h-12 rounded-xl"
                    shimmer={isShimmering}
                    delay={8 + i}
                  />
                </motion.div>
              ))}
            </div>
          </motion.article>

          {/* Bottom progress dots skeleton */}
          <motion.div 
            className="mt-8 flex justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            {Array.from({ length: SKELETON_ITEMS.progressSteps }).map((_, i) => (
              <motion.div
                key={i}
                className={`h-1.5 rounded-full bg-white/10 transition-all duration-500`}
                initial={{ width: '6px' }}
                animate={{ 
                  width: i === 0 ? '32px' : '6px',
                  backgroundColor: i === 0 ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.1)'
                }}
                transition={{
                  delay: i * 0.1,
                  duration: 0.3
                }}
              />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        Loading report generation interface. Please wait...
      </div>
    </div>
  );
}