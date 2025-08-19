'use client';

import { ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

// Advanced Skeleton with Morphing Effect
interface MorphingSkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'avatar' | 'chart' | 'table';
  animate?: boolean;
}

export function MorphingSkeleton({ 
  className, 
  variant = 'text',
  animate = true 
}: MorphingSkeletonProps) {
  const [morphStep, setMorphStep] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const interval = setInterval(() => {
      setMorphStep(prev => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, [animate]);

  const variants = {
    text: {
      initial: { width: '60%', height: 16, borderRadius: 8 },
      morph: [
        { width: '80%', height: 16, borderRadius: 8 },
        { width: '70%', height: 20, borderRadius: 10 },
        { width: '90%', height: 16, borderRadius: 8 },
        { width: '60%', height: 16, borderRadius: 8 },
      ],
    },
    card: {
      initial: { width: '100%', height: 200, borderRadius: 16 },
      morph: [
        { width: '100%', height: 220, borderRadius: 20 },
        { width: '100%', height: 190, borderRadius: 24 },
        { width: '100%', height: 210, borderRadius: 16 },
        { width: '100%', height: 200, borderRadius: 16 },
      ],
    },
    avatar: {
      initial: { width: 48, height: 48, borderRadius: '50%' },
      morph: [
        { width: 52, height: 52, borderRadius: '50%' },
        { width: 44, height: 44, borderRadius: '40%' },
        { width: 50, height: 50, borderRadius: '50%' },
        { width: 48, height: 48, borderRadius: '50%' },
      ],
    },
    chart: {
      initial: { width: '100%', height: 300, borderRadius: 12 },
      morph: [
        { width: '100%', height: 320, borderRadius: 16 },
        { width: '100%', height: 280, borderRadius: 12 },
        { width: '100%', height: 310, borderRadius: 14 },
        { width: '100%', height: 300, borderRadius: 12 },
      ],
    },
    table: {
      initial: { width: '100%', height: 400, borderRadius: 12 },
      morph: [
        { width: '100%', height: 420, borderRadius: 14 },
        { width: '100%', height: 380, borderRadius: 12 },
        { width: '100%', height: 410, borderRadius: 16 },
        { width: '100%', height: 400, borderRadius: 12 },
      ],
    },
  };

  const currentVariant = variants[variant];
  const morphTarget = currentVariant.morph[morphStep];

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden",
        "bg-gradient-to-r from-gray-200/20 via-gray-300/30 to-gray-200/20",
        "dark:from-gray-800/30 dark:via-gray-700/40 dark:to-gray-800/30",
        className
      )}
      initial={currentVariant.initial}
      animate={morphTarget}
      transition={{ duration: 1.5, ease: [0.43, 0.13, 0.23, 0.96] }}
    >
      {/* Shimmer overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10"
        animate={{
          x: ['-200%', '200%'],
        }}
        transition={{
          duration: 1.5,
          ease: 'linear',
          repeat: Infinity,
          repeatDelay: 0.5,
        }}
      />
      
      {/* Pulse glow effect */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
        style={{
          background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.1), transparent)',
        }}
      />
    </motion.div>
  );
}

// DNA Helix Loading Animation
export function DNAHelixLoader({ className }: { className?: string }) {
  const numBars = 12;
  
  return (
    <div className={cn("relative w-16 h-16", className)}>
      {[...Array(numBars)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 bg-gradient-to-t from-violet-600 to-pink-600 rounded-full"
          style={{
            left: '50%',
            top: '50%',
            height: '40%',
            transformOrigin: 'center bottom',
          }}
          animate={{
            rotate: [0, 360],
            scaleY: [1, 1.5, 1],
          }}
          transition={{
            rotate: {
              duration: 2,
              ease: 'linear',
              repeat: Infinity,
              delay: (i / numBars) * 2,
            },
            scaleY: {
              duration: 1,
              ease: 'easeInOut',
              repeat: Infinity,
              delay: (i / numBars) * 1,
            },
          }}
        />
      ))}
    </div>
  );
}

// Quantum Loading Dots
export function QuantumDots({ className }: { className?: string }) {
  const dots = 5;
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {[...Array(dots)].map((_, i) => (
        <motion.div
          key={i}
          className="w-3 h-3 bg-gradient-to-r from-violet-600 to-pink-600 rounded-full"
          animate={{
            y: [0, -20, 0],
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

// Morphing Progress Bar
interface MorphingProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}

export function MorphingProgressBar({ 
  progress, 
  className,
  showPercentage = true 
}: MorphingProgressBarProps) {
  const springProgress = useSpring(progress, {
    stiffness: 100,
    damping: 30,
  });

  const progressColor = useTransform(
    springProgress,
    [0, 50, 100],
    ['#8B5CF6', '#EC4899', '#06B6D4']
  );

  return (
    <div className={cn("relative", className)}>
      <div className="relative h-4 bg-gray-200/20 dark:bg-gray-800/30 rounded-full overflow-hidden backdrop-blur-sm">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: springProgress.get() + '%',
            background: progressColor,
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Animated stripes */}
          <motion.div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255, 255, 255, 0.1) 10px,
                rgba(255, 255, 255, 0.1) 20px
              )`,
            }}
            animate={{
              x: [0, 28],
            }}
            transition={{
              duration: 1,
              ease: 'linear',
              repeat: Infinity,
            }}
          />
          
          {/* Glow effect */}
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 2,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
            style={{
              boxShadow: '0 0 20px currentColor',
            }}
          />
        </motion.div>
      </div>
      
      {showPercentage && (
        <motion.div className="absolute -top-8 right-0 text-sm font-medium">
          <motion.span>{Math.round(springProgress.get())}%</motion.span>
        </motion.div>
      )}
    </div>
  );
}

// Content Morphing Loader
interface ContentMorphLoaderProps {
  isLoading: boolean;
  children: ReactNode;
  skeleton?: ReactNode;
  duration?: number;
}

export function ContentMorphLoader({
  isLoading,
  children,
  skeleton,
  duration = 0.5,
}: ContentMorphLoaderProps) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
          transition={{ duration }}
        >
          {skeleton || <MorphingSkeleton variant="card" />}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          transition={{ duration }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Particle Loading Screen
export function ParticleLoadingScreen({ className }: { className?: string }) {
  const particleCount = 50;
  
  return (
    <div className={cn("fixed inset-0 z-50 bg-black/90 backdrop-blur-xl", className)}>
      {/* Particles */}
      {[...Array(particleCount)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-gradient-to-r from-violet-400 to-pink-400 rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            scale: Math.random() * 2 + 0.5,
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          transition={{
            duration: Math.random() * 20 + 10,
            ease: 'linear',
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            filter: 'blur(1px)',
          }}
        />
      ))}
      
      {/* Center loader */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <DNAHelixLoader className="mx-auto mb-8" />
          <QuantumDots className="justify-center mb-4" />
          <motion.p
            className="text-white/80 text-lg font-medium"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Loading experience...
          </motion.p>
        </div>
      </div>
    </div>
  );
}

// Smart Loading Boundary
interface SmartLoadingBoundaryProps {
  children: ReactNode;
  isLoading: boolean;
  variant?: 'skeleton' | 'spinner' | 'particles' | 'morph';
  className?: string;
}

export function SmartLoadingBoundary({
  children,
  isLoading,
  variant = 'morph',
  className,
}: SmartLoadingBoundaryProps) {
  const loadingComponents = {
    skeleton: <MorphingSkeleton variant="card" />,
    spinner: <DNAHelixLoader />,
    particles: <ParticleLoadingScreen />,
    morph: <ContentMorphLoader isLoading={isLoading}>{children}</ContentMorphLoader>,
  };

  if (variant === 'morph') {
    return loadingComponents.morph;
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center min-h-[200px]"
          >
            {loadingComponents[variant]}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}