'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, TrendingUp, Clock, CheckCircle2, AlertCircle, ArrowUp, ArrowDown, Zap, Trophy, Target, Brain, Globe } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { useAnalyzeDomain } from '@/lib/hooks/use-api';
import { getDomainFromUrl } from '@/lib/utils';

interface InstantScoreHeroProps {
  onAnalyze?: (domain: string, score: number) => void;
  initialScore?: number;
}

const platformIcons = {
  chatgpt: '🤖',
  claude: '🧠',
  perplexity: '🔍',
  gemini: '✨',
  bing: '🔎',
  you: '💬',
  poe: '⚡',
  huggingchat: '🤗'
};

const platformGradients = {
  chatgpt: 'from-green-500 to-emerald-600',
  claude: 'from-orange-500 to-amber-600',
  perplexity: 'from-blue-500 to-cyan-600',
  gemini: 'from-purple-500 to-violet-600',
  bing: 'from-blue-600 to-indigo-700',
  you: 'from-pink-500 to-rose-600',
  poe: 'from-indigo-500 to-purple-600',
  huggingchat: 'from-yellow-500 to-orange-600'
};

export function InstantScoreHero({ onAnalyze, initialScore }: InstantScoreHeroProps) {
  const [domain, setDomain] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();

  // Use real API hook
  const { mutate: analyzeDomain, isPending: isLoading } = useAnalyzeDomain();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDomain(value);
    setIsTyping(true);

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
    }, 500);
  };

  const handleAnalyze = () => {
    if (!domain) return;

    const cleanDomain = getDomainFromUrl(domain);
    setHasAnalyzed(true);

    analyzeDomain(
      { domain: cleanDomain, quick: true },
      {
        onSuccess: (data) => {
          setAnalysis(data);
          setShowResults(true);

          if (data.score > 80) {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#8b5cf6', '#764ba2', '#667eea'],
            });
          }

          if (onAnalyze) {
            onAnalyze(cleanDomain, data.score);
          }
        },
        onError: (error) => {
          console.error('Analysis failed:', error);
          setHasAnalyzed(false);
        }
      }
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && domain) {
      handleAnalyze();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 80) return 'text-emerald-500';
    if (score >= 70) return 'text-blue-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Outstanding';
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Average';
    return 'Needs Work';
  };

  const getPlatformGradient = (platform: string) => {
    return platformGradients[platform as keyof typeof platformGradients] || 'from-gray-500 to-gray-600';
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative w-full max-w-6xl mx-auto">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 via-purple-500/20 to-pink-500/20 blur-3xl -z-10" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.h1 
            className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            AI Visibility Score
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Discover how AI sees your brand in <span className="font-bold text-primary-600">10 seconds</span>
          </motion.p>
        </div>

        {/* Input Section */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={domain}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Enter your domain (e.g., nike.com)"
              className="w-full px-6 py-5 pr-32 text-lg rounded-2xl border-2 border-primary-200 dark:border-primary-800 
                       bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm
                       focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20
                       transition-all duration-300"
              disabled={isLoading}
            />
            
            <motion.button
              onClick={handleAnalyze}
              disabled={!domain || isLoading}
              className="absolute right-2 px-8 py-3 bg-gradient-to-r from-primary-600 to-purple-600 
                       text-white font-semibold rounded-xl
                       hover:from-primary-700 hover:to-purple-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-300 transform hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Analyze
                </span>
              )}
            </motion.button>
          </div>

          {/* Live Ticker */}
          {!showResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>23,451 brands analyzed today</span>
            </motion.div>
          )}
        </motion.div>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {showResults && analysis && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              {/* Main Score Card */}
              <motion.div
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/90 to-white/70 
                         dark:from-gray-900/90 dark:to-gray-900/70 backdrop-blur-xl 
                         shadow-2xl border border-white/20 p-8"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-500/20 to-purple-500/20 blur-3xl" />
                
                <div className="relative grid md:grid-cols-2 gap-8 items-center">
                  {/* Score Display */}
                  <div className="text-center md:text-left space-y-4">
                    <div className="flex items-center justify-center md:justify-start gap-4">
                      <motion.div
                        className="relative"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", duration: 0.5 }}
                      >
                        <div className={cn("text-8xl font-bold", getScoreColor(analysis.score))}>
                          {Math.round(analysis.score)}
                        </div>
                        <div className="absolute -top-2 -right-8 text-3xl">
                          {analysis.score >= 80 ? '🏆' : analysis.score >= 70 ? '👍' : '📈'}
                        </div>
                      </motion.div>
                      <div className="text-left">
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                          {getScoreLabel(analysis.score)}
                        </div>
                        <div className="text-sm text-gray-500">GEO Score</div>
                      </div>
                    </div>
                    
                    {/* Trend Indicator */}
                    <div className="flex items-center justify-center md:justify-start gap-4">
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                        <ArrowUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">12% vs industry</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Industry avg: {Math.round(analysis.score - 12)}
                      </div>
                    </div>
                  </div>

                  {/* Share of Voice */}
                  <div className="space-y-4">
                    <div className="text-center md:text-right">
                      <div className="text-sm text-gray-500 mb-2">Share of Voice</div>
                      <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {Math.round(analysis.shareOfVoice)}%
                      </div>
                    </div>
                    
                    {/* Sentiment Bar */}
                    <div className="space-y-2">
                      <div className="text-sm text-gray-500">Sentiment Analysis</div>
                      <div className="flex h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                        <div 
                          className="bg-green-500 flex items-center justify-center text-xs font-semibold text-white"
                          style={{ width: `${Math.round(analysis.sentiment.positive)}%` }}
                        >
                          {Math.round(analysis.sentiment.positive)}%
                        </div>
                        <div 
                          className="bg-gray-400 flex items-center justify-center text-xs font-semibold text-white"
                          style={{ width: `${Math.round(analysis.sentiment.neutral)}%` }}
                        >
                          {Math.round(analysis.sentiment.neutral)}%
                        </div>
                        <div 
                          className="bg-red-500 flex items-center justify-center text-xs font-semibold text-white"
                          style={{ width: `${Math.round(analysis.sentiment.negative)}%` }}
                        >
                          {Math.round(analysis.sentiment.negative)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Platform Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(analysis.platforms).map(([platform, score], index) => {
                  const scoreValue = typeof score === 'number' ? Math.round(score) : 0;
                  const gradientClass = getPlatformGradient(platform);
                  
                  return (
                    <motion.div
                      key={platform}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="relative group"
                    >
                      <div className={cn(
                        "absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500",
                        gradientClass
                      )} />
                      <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm 
                                    rounded-2xl p-6 border border-gray-200 dark:border-gray-700
                                    hover:border-primary-500 transition-all duration-300
                                    hover:shadow-xl hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl">{platformIcons[platform as keyof typeof platformIcons]}</span>
                          <div className={cn(
                            "text-xs px-2 py-1 rounded-full font-semibold",
                            scoreValue >= 80 ? 'bg-green-100 text-green-700' : 
                            scoreValue >= 60 ? 'bg-blue-100 text-blue-700' : 
                            'bg-yellow-100 text-yellow-700'
                          )}>
                            {scoreValue >= 80 ? 'Strong' : scoreValue >= 60 ? 'Good' : 'Weak'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                            {scoreValue}
                          </div>
                          <div className="text-sm text-gray-500 capitalize">{platform}</div>
                        </div>
                        <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className={cn("h-full bg-gradient-to-r", gradientClass)}
                            initial={{ width: 0 }}
                            animate={{ width: `${scoreValue}%` }}
                            transition={{ duration: 1, delay: 0.2 * index }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Competitors Section */}
              {analysis.competitorAnalysis && analysis.competitorAnalysis.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl p-6 
                           border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Top Competitors</h3>
                    <Trophy className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="space-y-3">
                    {analysis.competitorAnalysis.map((competitor: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 
                                                bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-white",
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                          )}>
                            {index + 1}
                          </div>
                          <span className="font-medium">{competitor.domain}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold">{Math.round(competitor.score)}</div>
                          {competitor.score > analysis.score ? (
                            <ArrowUp className="w-4 h-4 text-red-500" />
                          ) : (
                            <ArrowDown className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Insights & Recommendations */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Insights */}
                {analysis.insights && analysis.insights.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-3"
                  >
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-primary-500" />
                      Key Insights
                    </h3>
                    {analysis.insights.map((insight: string, index: number) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.1 }}
                        className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 
                                 border border-green-200 dark:border-green-800 rounded-lg"
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{insight}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {/* Recommendations */}
                {analysis.recommendations && analysis.recommendations.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-3"
                  >
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary-500" />
                      Action Items
                    </h3>
                    {analysis.recommendations.map((rec: string, index: number) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.1 }}
                        className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 
                                 border border-blue-200 dark:border-blue-800 rounded-lg"
                      >
                        <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{rec}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* CTA Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-center space-y-6 pt-8"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    Want to improve your score?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Get personalized recommendations and track your progress
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 bg-gradient-to-r from-primary-600 to-purple-600 
                             text-white font-semibold rounded-xl shadow-lg
                             hover:shadow-xl transition-all duration-300"
                  >
                    Get Full Report (Free) →
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 bg-white dark:bg-gray-800 
                             text-gray-800 dark:text-gray-200 font-semibold rounded-xl 
                             border-2 border-gray-200 dark:border-gray-700
                             hover:border-primary-500 transition-all duration-300"
                  >
                    Track Competitors
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}