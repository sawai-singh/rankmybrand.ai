'use client';

import { motion } from 'framer-motion';
import { X, Sparkles, TrendingUp, Users, Target, ArrowRight, CheckCircle } from 'lucide-react';

interface WelcomeModalProps {
  userName: string;
  companyName?: string;
  onClose: () => void;
}

export function WelcomeModal({ userName, companyName, onClose }: WelcomeModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative max-w-2xl w-full mx-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10" />
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg glassmorphism glassmorphism-hover z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="relative p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4"
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold mb-2"
            >
              Welcome to RankMyBrand, {userName}!
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-400"
            >
              {companyName ? `Your analysis for ${companyName} is being prepared` : 'Your brand analysis is being prepared'}
            </motion.p>
          </div>

          {/* Progress Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-4 mb-8"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-green-500/20 rounded-full">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Company Profile Created</p>
                <p className="text-sm text-gray-400">Your company details have been enriched and saved</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded-full">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Analyzing AI Visibility</p>
                <p className="text-sm text-gray-400">Scanning your presence across all AI platforms</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-gray-500/20 rounded-full">
                <Users className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-500">Competitor Analysis</p>
                <p className="text-sm text-gray-500">Comparing your metrics with competitors</p>
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
          >
            <div className="glassmorphism rounded-lg p-4">
              <TrendingUp className="w-6 h-6 text-purple-400 mb-2" />
              <h4 className="font-medium mb-1">Real-time Tracking</h4>
              <p className="text-xs text-gray-400">Monitor your GEO score live</p>
            </div>

            <div className="glassmorphism rounded-lg p-4">
              <Target className="w-6 h-6 text-blue-400 mb-2" />
              <h4 className="font-medium mb-1">Smart Recommendations</h4>
              <p className="text-xs text-gray-400">AI-powered improvement tips</p>
            </div>

            <div className="glassmorphism rounded-lg p-4">
              <Users className="w-6 h-6 text-green-400 mb-2" />
              <h4 className="font-medium mb-1">Competitor Insights</h4>
              <p className="text-xs text-gray-400">Stay ahead of competition</p>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="text-center"
          >
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              Explore Your Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <p className="text-xs text-gray-500 mt-4">
              Your first analysis will complete in 2-3 minutes
            </p>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}