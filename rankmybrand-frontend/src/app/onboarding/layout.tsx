'use client';

/**
 * Onboarding Layout - Authentic AI Experience
 * [40:Semantic HTML] Proper landmarks and structure
 * [79:Theming] Dark/light mode support
 * [45:Skip link] Accessibility navigation
 * [98:Lazy loading] Smooth page transitions
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';

interface TransitionContextType {
  isTransitioning: boolean;
  startTransition: (message?: string) => void;
  endTransition: () => void;
}

const TransitionContext = createContext<TransitionContextType>({
  isTransitioning: false,
  startTransition: () => {},
  endTransition: () => {}
});

export const useOnboardingTransition = () => useContext(TransitionContext);

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('Loading...');

  const startTransition = (message = 'Loading...') => {
    setTransitionMessage(message);
    setIsTransitioning(true);
  };

  const endTransition = () => {
    setIsTransitioning(false);
  };

  return (
    <TransitionContext.Provider value={{ isTransitioning, startTransition, endTransition }}>
      {/* [45:Skip link] Accessibility navigation */}
      <a
        href="#onboarding-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-md z-50 focus:ring-2 focus:ring-offset-2"
      >
        Skip to onboarding content
      </a>

      {/* [40:Semantic HTML] Main landmark with proper structure */}
      <main className="min-h-screen relative">
        {/* [11:Aesthetic-Usability] Futuristic gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-primary-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-primary-950/20" />

        {/* [11:Aesthetic-Usability] Subtle grid pattern overlay */}
        <div className="fixed inset-0 grid-pattern opacity-[0.02] dark:opacity-[0.01]" />

        {/* [15:Whitespace] Content container with generous padding */}
        <div id="onboarding-content" className="relative z-10">
          {children}
        </div>

        {/* [11:Aesthetic-Usability] Subtle glow effects */}
        <div className="fixed top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl opacity-20 dark:opacity-10 pointer-events-none" />
        <div className="fixed bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl opacity-20 dark:opacity-10 pointer-events-none" />

        {/* [98:Lazy loading] Transition Loading Overlay */}
        <AnimatePresence>
          {isTransitioning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-md"
              role="alert"
              aria-live="polite"
              aria-busy="true"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-center"
              >
                <motion.div
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{
                    rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                    scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gradient-to-br from-primary-500 to-purple-500 rounded-2xl"
                >
                  <Sparkles className="w-8 h-8 text-white" />
                </motion.div>
                <motion.h2
                  className="text-xl font-semibold text-gray-900 dark:text-white mb-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {transitionMessage}
                </motion.h2>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Please wait...</span>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </TransitionContext.Provider>
  );
}