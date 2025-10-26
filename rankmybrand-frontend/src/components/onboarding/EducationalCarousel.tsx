'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Zap, Target, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';

interface EducationalContent {
  title: string;
  content: string;
  source?: string;
  icon: typeof TrendingUp;
  highlight?: string;
}

const educationalContent: EducationalContent[] = [
  {
    title: "Why AI Visibility Matters",
    content: "73% of purchase decisions now start with AI assistants like ChatGPT and Claude",
    source: "Gartner 2024",
    icon: TrendingUp,
    highlight: "73%"
  },
  {
    title: "Multi-Platform Coverage",
    content: "We track your brand across ChatGPT, Claude, Gemini, and Perplexity in real-time",
    icon: Target,
    highlight: "4 Platforms"
  },
  {
    title: "Industry Benchmark",
    content: "Average B2B company scores 34/100 on AI visibility. See where you stand.",
    icon: BarChart3,
    highlight: "34/100"
  },
  {
    title: "Strategic Queries",
    content: "We'll generate 96 buyer journey queries tailored specifically to your business model",
    icon: Zap,
    highlight: "96 Queries"
  },
  {
    title: "Comprehensive Analysis",
    content: "Our AI analyzes your competitors, products, and market positioning automatically",
    icon: Target,
    highlight: "Auto-Detect"
  }
];

interface EducationalCarouselProps {
  autoRotate?: boolean;
  rotationInterval?: number;
}

export function EducationalCarousel({
  autoRotate = true,
  rotationInterval = 6000
}: EducationalCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const current = educationalContent[currentIndex];

  // Auto-rotation
  useEffect(() => {
    if (!autoRotate || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % educationalContent.length);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [autoRotate, isPaused, rotationInterval]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % educationalContent.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + educationalContent.length) % educationalContent.length);
  };

  return (
    <div
      className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-lg"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <current.icon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">
            Did You Know?
          </h3>
        </div>

        {/* Navigation Arrows */}
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevious}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Previous tip"
          >
            <ChevronLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>
          <button
            onClick={goToNext}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Next tip"
          >
            <ChevronRight className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative overflow-hidden min-h-[160px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="space-y-4"
          >
            {/* Title */}
            <h4 className="text-xl font-bold text-neutral-900 dark:text-neutral-0">
              {current.title}
            </h4>

            {/* Highlight Metric */}
            {current.highlight && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                <span className="text-2xl font-mono tabular-nums font-bold text-neutral-900 dark:text-neutral-0">
                  {current.highlight}
                </span>
              </div>
            )}

            {/* Content */}
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {current.content}
            </p>

            {/* Source */}
            {current.source && (
              <p className="text-xs text-neutral-500 italic">
                Source: {current.source}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {educationalContent.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className="group p-1"
            aria-label={`Go to tip ${index + 1}`}
          >
            <div className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'w-8 bg-neutral-900 dark:bg-neutral-0'
                : 'w-1.5 bg-neutral-300 dark:bg-neutral-700 group-hover:bg-neutral-400 dark:group-hover:bg-neutral-600'
            }`} />
          </button>
        ))}
      </div>

      {/* Pause Indicator */}
      {isPaused && autoRotate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-2 right-2 text-xs text-neutral-500"
        >
          Paused
        </motion.div>
      )}
    </div>
  );
}
