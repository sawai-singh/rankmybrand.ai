'use client';

import { ReactNode, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, LayoutGroup } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface AdvancedPageTransitionProps {
  children: ReactNode;
  mode?: 'fade' | 'slide' | 'morph' | 'flip' | 'zoom' | 'rotate' | 'parallax';
  duration?: number;
  enableSound?: boolean;
  enableViewTransitions?: boolean;
}

// Advanced transition variants
const transitionVariants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-100%', opacity: 0 },
  },
  morph: {
    initial: { 
      opacity: 0, 
      scale: 0.8,
      borderRadius: '100%',
      filter: 'blur(20px)',
    },
    animate: { 
      opacity: 1, 
      scale: 1,
      borderRadius: '0%',
      filter: 'blur(0px)',
    },
    exit: { 
      opacity: 0, 
      scale: 1.2,
      borderRadius: '100%',
      filter: 'blur(20px)',
    },
  },
  flip: {
    initial: { 
      rotateY: 90,
      opacity: 0,
      scale: 0.8,
    },
    animate: { 
      rotateY: 0,
      opacity: 1,
      scale: 1,
    },
    exit: { 
      rotateY: -90,
      opacity: 0,
      scale: 0.8,
    },
  },
  zoom: {
    initial: { 
      scale: 0,
      opacity: 0,
      filter: 'blur(10px)',
    },
    animate: { 
      scale: 1,
      opacity: 1,
      filter: 'blur(0px)',
    },
    exit: { 
      scale: 2,
      opacity: 0,
      filter: 'blur(10px)',
    },
  },
  rotate: {
    initial: { 
      rotate: -180,
      scale: 0.5,
      opacity: 0,
    },
    animate: { 
      rotate: 0,
      scale: 1,
      opacity: 1,
    },
    exit: { 
      rotate: 180,
      scale: 0.5,
      opacity: 0,
    },
  },
  parallax: {
    initial: { 
      y: 100,
      opacity: 0,
      scale: 0.95,
    },
    animate: { 
      y: 0,
      opacity: 1,
      scale: 1,
    },
    exit: { 
      y: -100,
      opacity: 0,
      scale: 1.05,
    },
  },
};

// Easing functions for smooth transitions
const easings = {
  smooth: [0.43, 0.13, 0.23, 0.96],
  spring: { type: 'spring', stiffness: 300, damping: 30 },
  elastic: { type: 'spring', stiffness: 400, damping: 10 },
  bounce: { type: 'spring', stiffness: 600, damping: 15 },
};

export function AdvancedPageTransition({ 
  children, 
  mode = 'morph',
  duration = 0.6,
  enableSound = false,
  enableViewTransitions = true,
}: AdvancedPageTransitionProps) {
  const pathname = usePathname();
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Track mouse position for interactive effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  // Transform mouse position for parallax effects
  const parallaxX = useTransform(mouseX, [0, typeof window !== 'undefined' ? window.innerWidth : 1920], [-20, 20]);
  const parallaxY = useTransform(mouseY, [0, typeof window !== 'undefined' ? window.innerHeight : 1080], [-20, 20]);

  // Initialize audio context for transition sounds
  useEffect(() => {
    if (enableSound && typeof window !== 'undefined' && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [enableSound]);

  // Play transition sound
  const playTransitionSound = useCallback(() => {
    if (!enableSound || !audioContextRef.current || audioContextRef.current.state !== 'running') return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Create a more sophisticated sound
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.3);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(5000, ctx.currentTime + 0.1);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  }, [enableSound]);

  // Handle View Transitions API
  const handleViewTransition = useCallback(async () => {
    if (!enableViewTransitions || !('startViewTransition' in document)) {
      return;
    }

    const transition = (document as any).startViewTransition(async () => {
      setIsTransitioning(true);
      await new Promise(resolve => setTimeout(resolve, duration * 1000));
      setIsTransitioning(false);
    });

    await transition.finished;
  }, [enableViewTransitions, duration]);

  // Trigger effects on route change
  useEffect(() => {
    playTransitionSound();
    handleViewTransition();

    // Animate progress bar
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setTransitionProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => setTransitionProgress(0), 200);
      }
    }, duration * 10);

    return () => clearInterval(interval);
  }, [pathname, playTransitionSound, handleViewTransition, duration]);

  // Get transition config based on mode
  const getTransitionConfig = () => {
    switch (mode) {
      case 'flip':
      case 'rotate':
        return easings.spring;
      case 'zoom':
      case 'morph':
        return easings.elastic;
      case 'parallax':
        return { ...easings.smooth, duration };
      default:
        return { duration, ease: easings.smooth };
    }
  };

  return (
    <>
      {/* Advanced Progress Indicator */}
      <motion.div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
        <motion.div
          className="h-1 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: transitionProgress / 100 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{ transformOrigin: 'left' }}
        />
        <motion.div
          className="absolute top-0 left-0 right-0 h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent)',
            backgroundSize: '200px 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      </motion.div>

      {/* Morphing Background Effects */}
      {mode === 'morph' && isTransitioning && (
        <motion.div
          className="fixed inset-0 z-[100] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-purple-600/20 to-pink-600/20 animate-gradient" />
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <filter id="morphing">
                <feTurbulence baseFrequency="0.02" numOctaves="3" seed="5" />
                <feDisplacementMap in="SourceGraphic" scale="20" />
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#morphing)" opacity="0.3" />
          </svg>
        </motion.div>
      )}

      {/* Main Content with Transitions */}
      <LayoutGroup>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            variants={transitionVariants[mode]}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={getTransitionConfig()}
            className="w-full"
            style={{
              perspective: mode === 'flip' || mode === 'rotate' ? 1000 : undefined,
              transformStyle: mode === 'flip' || mode === 'rotate' ? 'preserve-3d' : undefined,
            }}
          >
            {/* Parallax Container */}
            {mode === 'parallax' ? (
              <motion.div
                style={{
                  x: parallaxX,
                  y: parallaxY,
                }}
                transition={{ type: 'spring', stiffness: 100, damping: 30 }}
              >
                {children}
              </motion.div>
            ) : (
              children
            )}
          </motion.div>
        </AnimatePresence>
      </LayoutGroup>

      {/* Transition Overlay Effects */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            className="fixed inset-0 z-[90] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Particle Effects */}
            <div className="absolute inset-0">
              {typeof window !== 'undefined' && [...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-gradient-to-r from-violet-400 to-pink-400 rounded-full"
                  initial={{
                    x: Math.random() * window.innerWidth,
                    y: window.innerHeight + 20,
                    scale: Math.random() * 0.5 + 0.5,
                  }}
                  animate={{
                    y: -20,
                    transition: {
                      duration: Math.random() * 2 + 1,
                      ease: 'linear',
                      delay: Math.random() * 0.5,
                    },
                  }}
                  style={{
                    filter: 'blur(1px)',
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS for View Transitions API */}
      <style jsx global>{`
        @supports (view-transition-name: none) {
          ::view-transition-old(root) {
            animation: fade-out ${duration}s ease-out;
          }
          
          ::view-transition-new(root) {
            animation: fade-in ${duration}s ease-out;
          }
          
          @keyframes fade-out {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          
          @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-200px); }
          100% { transform: translateX(calc(100% + 200px)); }
        }
      `}</style>
    </>
  );
}