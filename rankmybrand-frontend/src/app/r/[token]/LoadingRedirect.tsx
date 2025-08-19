'use client';

import { motion } from 'framer-motion';
import { Shield, Loader2 } from 'lucide-react';

export default function LoadingRedirect() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center px-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900" />
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
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
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>

      {/* Loading content */}
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="text-center space-y-6">
            {/* Loading animation */}
            <div className="relative mx-auto w-20 h-20">
              <motion.div
                className="absolute inset-0 border-4 border-purple-500/30 rounded-full"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-10 h-10 text-purple-400" />
              </div>
            </div>

            {/* Loading text */}
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Loading Secure Portal
              </h1>
              <p className="text-gray-400 text-sm">
                Initializing encrypted connection...
              </p>
            </div>

            {/* Skeleton progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500/30 to-blue-500/30"
                animate={{
                  x: ['-100%', '100%']
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'linear'
                }}
                style={{ width: '50%' }}
              />
            </div>

            {/* Loading spinner */}
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Establishing secure connection</span>
            </div>
          </div>
        </motion.div>

        {/* Security badge skeleton */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <div className="inline-flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 bg-gray-700 rounded animate-pulse" />
            <div className="w-48 h-3 bg-gray-700 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}